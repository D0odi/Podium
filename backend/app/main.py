from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import random
import time

from app.core.config import get_settings
from app.api.rooms import router as rooms_router
from app.api.broadcast import router as broadcast_router
from app.api.events import router as events_router
from app.ws.manager import ConnectionManager
from app.ws.routes import router as ws_router
from app.events.bus import EventBus
from app.api.webhooks import router as webhooks_router
from app.services.transcript_buffer import TranscriptBuffer
from app.services.bot import Bot
from app.state.room_manager import RoomManager
from app.core import registry
from typing import Optional
from app.services.reaction_config import (
    STAGE1_DELAY_MIN_S,
    STAGE1_DELAY_MAX_S,
    STAGE2_TIMEOUT_S,
    choose_emoji_phrase,
    score_text,
    map_score_to_bucket,
    get_phrases,
    adjust_bucket_for_meta,
    select_phrase_for_bucket,
    apply_recent_emoji_lru,
    apply_recent_phrase_lru,
    should_suppress_fire,
    should_escalate,
    compute_reaction_probability,
)

app = FastAPI(title="Podium Backend", version="0.1.0")

settings = get_settings()
app.state.settings = settings
app.state.ws_manager = ConnectionManager()
app.state.event_bus = EventBus()
app.state.transcript_buffer = TranscriptBuffer(max_interval_s=7.0, flush_on_interval=True)
app.state.room_manager = RoomManager()
registry.bind(app)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

app.include_router(rooms_router)
app.include_router(broadcast_router)
app.include_router(events_router)
app.include_router(webhooks_router)
app.include_router(ws_router)

async def _on_bot_reaction(payload: dict) -> None:
    room_id = payload.get("roomId")
    if not room_id:
        return
    print(f"[ws] broadcasting reaction room={room_id} bot={payload.get('botId')}")
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "reaction", "payload": payload},
    )

app.state.event_bus.subscribe("bot:reaction", _on_bot_reaction)

async def _on_transcript_chunk(payload: dict) -> None:
    room_id = payload.get("roomId")
    print(f"[transcript] chunk: {payload}") 
    text_chunk = payload.get("text", "")
    flush_meta = payload.get("flush_meta") or {}

    # Get tail context BEFORE appending current chunk to avoid duplication
    tail_context = app.state.room_manager.get_transcript_tail_chars(room_id, 200)
    await app.state.ws_manager.broadcast_json(
        room_id, {"event": "transcript", "payload": payload}
    )

    bots_in_room = app.state.room_manager.get_service_bots_in_room(room_id)

    async def stage1_react(bot: Bot, text: str, fm: dict) -> dict:
        """Generate a quick, local reaction (Stage-1) without model calls.
        Uses scoring, bucket mapping, and lightweight adjustments for delivery cues.
        """
        is_question = bool(fm.get("question"))
        is_exclaim = bool(fm.get("exclaim"))
        stutters = int(fm.get("stutter_count") or 0)
        rhet = bool(fm.get("rhetorical_pause"))

        cat: Optional[str] = app.state.room_manager.get_category(room_id)
        stance = bot.personality.stance
        domain = bot.personality.domain

        # Score and map to coarse sentiment bucket
        score = score_text(text, cat, stance, domain, is_question, is_exclaim)
        bucket = map_score_to_bucket(score, is_question)

        # Adjust bucket for stance and delivery cues
        bucket = adjust_bucket_for_meta(bucket, stance, stutters, rhet)

        # Choose emoji and phrase for bucket
        emoji, phrase, delta = choose_emoji_phrase(bucket, stance, domain, stutters, rhet)

        # Prefer random phrase selection avoiding recent repeats
        phrase = select_phrase_for_bucket(
            stance,
            bucket,
            domain,
            len(bot.state.recentEmojis),
            bot.state.recentPhrases,
        ) or phrase

        # Apply recent-emoji LRU to reduce repetition and update state
        recent = bot.state.recentEmojis
        emoji, recent = apply_recent_emoji_lru(emoji, recent)
        bot.state.recentEmojis = recent  # type: ignore[attr-defined]

        # Track recent phrases to avoid repetition
        recent_phrases = bot.state.recentPhrases
        phrase, recent_phrases = apply_recent_phrase_lru(phrase, recent_phrases)
        bot.state.recentPhrases = recent_phrases  # type: ignore[attr-defined]

        # timer for realistic reaction time
        await asyncio.sleep(random.uniform(STAGE1_DELAY_MIN_S, STAGE1_DELAY_MAX_S))

        return {"emoji_unicode": emoji, "micro_phrase": phrase, "score_delta": delta}

    async def generate_and_publish_reactions():
        async def one_bot_react(bot):
            try:

                
                start = asyncio.get_event_loop().time()
                stance = bot.personality.stance
                is_question = bool(flush_meta.get("question"))
                # suppression: use configured probability to ignore entirely
                if random.random() < 0.45:
                    reaction = None
                else:
                    # base: allowed only on questions for certain stances
                    escalate, escalate_allowed = should_escalate(is_question, stance)

                    stage1_used = False
                    if escalate and escalate_allowed:
                        try:
                            # Include prior transcript tail to provide brief context
                            stage2_input = f"{tail_context}{text_chunk}"
                            reaction = await asyncio.wait_for(
                                bot.generateReaction(stage2_input), timeout=STAGE2_TIMEOUT_S
                            )
                            if reaction is None:
                                reaction = await stage1_react(bot, text_chunk, flush_meta)
                                stage1_used = True
                        except Exception:
                            reaction = await stage1_react(bot, text_chunk, flush_meta)
                            stage1_used = True
                    else:
                        # running supression prob again to increase randomness
                        if should_suppress_fire():
                            reaction = None
                        else:
                            reaction = await stage1_react(bot, text_chunk, flush_meta)
                            stage1_used = True

                cooldown = bot.state.cooldownSeconds
                prob = compute_reaction_probability(
                    bot.state.reactionProbability,
                    int(flush_meta.get("stutter_count") or 0),
                    stance,
                )
            except asyncio.TimeoutError:
                print(f"[bot] reaction TIMEOUT room={room_id} bot={bot.id}")
                reaction = {
                    "emoji_unicode": "⏳",
                    "micro_phrase": "Thinking",
                    "score_delta": 0,
                }
            except Exception as e:
                print(f"[bot] reaction ERROR room={room_id} bot={bot.id} err={e}")
                reaction = {
                    "emoji_unicode": "❓",
                    "micro_phrase": "Hmm",
                    "score_delta": 0,
                }
            if reaction:
                elapsed = asyncio.get_event_loop().time() - start
                print(f"[bot] reaction ready room={room_id} bot={bot.id} in {elapsed:.2f}s")
                now = time.monotonic()
                should_react = True
                try:
                    last_ts = bot.state.lastReactionTs  # type: ignore[attr-defined]

                    cooldown = bot.state.cooldownSeconds
                    prob = locals().get('prob', bot.state.reactionProbability)

                    if now - last_ts < cooldown:
                        should_react = False
                    elif random.random() > prob:
                        should_react = False
                except Exception:
                    should_react = True

                if should_react:
                    bot.state.lastReactionTs = now  # type: ignore[attr-defined]
                    print(f"[bot] publishing reaction room={room_id} bot={bot.id}")
                    # emit debug events about decision path
                    await app.state.ws_manager.broadcast_json(
                        room_id,
                        {"event": "reaction_debug", "payload": {
                            "roomId": room_id,
                            "botId": bot.id,
                            "decision": {
                                "is_question": bool(flush_meta.get("question")),
                                "escalated": bool('stage1_used' in locals() and not stage1_used),
                                "timeout_s": STAGE2_TIMEOUT_S if ('escalate' in locals() and escalate) else 0,
                            },
                            "reaction": reaction,
                        }}
                    )
                    await app.state.event_bus.publish(
                        "bot:reaction",
                        {"roomId": room_id, "botId": bot.id, "reaction": reaction},
                    )
                else:
                    print(f"[bot] reaction suppressed room={room_id} bot={bot.id}")
            else:
                print(f"[bot] NO REACTION room={room_id} bot={bot.id}")

        tasks = []
        for bot in bots_in_room:
            print(f"[bot] start reaction room={room_id} bot={bot.id}")
            tasks.append(asyncio.create_task(one_bot_react(bot)))

        try:
            if tasks:
                await asyncio.gather(*tasks)
        finally:
            # Append transcript AFTER reactions are published to avoid duplicating
            # the current chunk when constructing Stage-2 context (tail + chunk)
            app.state.room_manager.append_transcript(room_id, text_chunk)

    asyncio.create_task(generate_and_publish_reactions())

app.state.event_bus.subscribe("transcript:chunk", _on_transcript_chunk)

async def _on_bot_join(payload: dict) -> None:
    room_id = payload.get("roomId")
    bot = payload.get("bot")
    if not room_id or not bot:
        return
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "join", "payload": {"bot": bot}},
    )

async def _on_bot_leave(payload: dict) -> None:
    room_id = payload.get("roomId")
    bot_id = payload.get("botId")
    if not room_id or not bot_id:
        return
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "leave", "payload": {"botId": bot_id}},
    )

app.state.event_bus.subscribe("bot:join", _on_bot_join)
app.state.event_bus.subscribe("bot:leave", _on_bot_leave)

async def _on_coach_feedback(payload: dict) -> None:
    room_id = payload.get("roomId")
    if not room_id:
        return
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "coach_feedback", "payload": payload},
    )

app.state.event_bus.subscribe("coach:feedback", _on_coach_feedback)