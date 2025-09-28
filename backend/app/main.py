from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import random
import time
import math

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
    STAGE2_TIMEOUT_S,
    get_phrases,
    compute_reaction_probability,
)
from app.services import reaction_config as rc

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
else:
    # Hardcoded local dev origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
    tail_context = app.state.room_manager.get_transcript_tail_chars(room_id, 150)
    await app.state.ws_manager.broadcast_json(
        room_id, {"event": "transcript", "payload": payload}
    )

    bots_in_room = app.state.room_manager.get_service_bots_in_room(room_id)

    async def stage1_react(bot: Bot, text: str, fm: dict) -> dict:
        """Generate a quick, local reaction (Stage-1) without model calls.
        Simple mapping based on punctuation and keyword hits.
        """
        is_question = bool(fm.get("question"))
        is_exclaim = bool(fm.get("exclaim"))

        cat: Optional[str] = app.state.room_manager.get_category(room_id)
        stance = bot.personality.stance
        domain = bot.personality.domain

        # Keyword hit counts from category presets
        preset = getattr(rc, "CATEGORIES", {}).get(cat or "", {})
        txt = (text or "").lower()
        pos_hits = 0
        neg_hits = 0
        try:
            for kw in preset.get("keywords_pos", []):
                if kw.lower() in txt:
                    pos_hits += 1
            for kw in preset.get("keywords_neg", []):
                if kw.lower() in txt:
                    neg_hits += 1
        except Exception:
            pos_hits = pos_hits
            neg_hits = neg_hits

        # Bucket selection: prioritize questions, then negatives, else exclaim/positive/neutral
        if is_question:
            bucket = "curious"
        elif neg_hits > pos_hits:
            bucket = "negative"
        elif is_exclaim or pos_hits > 0:
            bucket = "positive"
        else:
            bucket = "neutral"

        # Pick an emoji from config
        emoji_groups = getattr(rc, "EMOJI", {})
        group = emoji_groups.get({
            "positive": "pos",
            "negative": "neg",
            "curious": "curious",
            "neutral": "neutral",
            "anticipation": "neutral",
        }.get(bucket, "neutral"), ["😐"])  # map to available groups
        emoji = group[0] if isinstance(group, list) and group else "😐"

        # Choose a short phrase
        phrases = get_phrases(stance, bucket, domain) or []
        default_phrase = getattr(rc, "DEFAULT_PHRASE", {}).get(bucket, "")
        phrase = phrases[random.randint(0, len(phrases) - 1)] if phrases else default_phrase

        
        await asyncio.sleep(random.uniform(0.2, 2))

        # Stage-1 no longer computes any score delta
        return {"emoji_unicode": emoji, "micro_phrase": phrase, "score_delta": 0}

    async def generate_and_publish_reactions():


        async def one_bot_react(bot, start_delay_s: float = 0.0, leave_delay_s: float = 0.0):
            # Stagger start to avoid simultaneous reactions
            if start_delay_s > 0:
                try:
                    await asyncio.sleep(start_delay_s)
                except Exception:
                    pass
            try:
                start = asyncio.get_event_loop().time()
                stance = bot.personality.stance
                is_question = bool(flush_meta.get("question"))
                # suppression: use configured probability to ignore entirely
                if random.random() < 0.30:
                    reaction = None
                else:

                    stage1_used = False
                    if random.random() < 0.5:
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
                        if random.random() < 0.65:
                            reaction = None
                        else:
                            reaction = await stage1_react(bot, text_chunk, flush_meta)
                            stage1_used = True

                cooldown = bot.state.cooldownSeconds
                prob = compute_reaction_probability(
                    bot.state.reactionProbability,
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
                    # Update engagement and auto-leave if it drops too low
                    # Parse and clamp engagement delta from model
                    def _parse_delta(val):
                        try:
                            if isinstance(val, (int, float)):
                                return int(round(float(val)))
                            if isinstance(val, str):
                                return int(round(float(val.strip())))
                        except Exception:
                            return 0
                        return 0
                    delta = _parse_delta(reaction.get("score_delta", 0))
                    # Clamp input delta to [-5, 5]
                    delta = max(-5, min(5, delta))
                    # Make deductions stricter: amplify negatives slightly
                    if delta < 0:
                        # e.g., -1 -> -2, -2 -> -3, -3 -> -4, -4/-5 stay as is
                        delta = max(-5, delta - 1)
                    try:
                        before = float(bot.state.engagementScore)
                        after = before + float(delta)
                        # Cap maximum engagement at 10
                        if after > 10.0:
                            after = 10.0
                        bot.state.engagementScore = after
                        print(f"[bot] engagement update room={room_id} bot={bot.id} delta={delta} score={after:.1f}")
                    except Exception:
                        pass
                    # Threshold for removal
                    try:
                        threshold = -10.0
                        score = float(bot.state.engagementScore)
                        if score <= threshold:
                            # Stagger leave to avoid simultaneous exits
                            if leave_delay_s > 0:
                                try:
                                    await asyncio.sleep(leave_delay_s)
                                except Exception:
                                    pass
                            print(f"[bot] engagement low, removing bot room={room_id} bot={bot.id} score={score}")
                            # Remove from room and broadcast leave
                            app.state.room_manager.remove_bot_from_room(room_id, bot.id)
                            await app.state.event_bus.publish("bot:leave", {"roomId": room_id, "botId": bot.id})
                            return
                    except Exception as e:
                        print(f"[bot] engagement check error room={room_id} bot={bot.id} err={e}")
                else:
                    print(f"[bot] reaction suppressed room={room_id} bot={bot.id}")
            else:
                print(f"[bot] NO REACTION room={room_id} bot={bot.id}")

        # Sequentially process bots with staggered delays to avoid bursts
        for idx, bot in enumerate(bots_in_room):
            print(f"[bot] start reaction room={room_id} bot={bot.id}")
            start_delay = 0.10 + 0.10 * idx + random.uniform(0.05, 0.25)
            leave_delay = 0.05 + 0.10 * idx + random.uniform(0.05, 0.20)
            await one_bot_react(bot, start_delay, leave_delay)

        # Append transcript AFTER reactions are published to avoid duplicating
        # the current chunk when constructing Stage-2 context (tail + chunk)
        try:
            app.state.room_manager.append_transcript(room_id, text_chunk)
        except Exception:
            pass

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