from __future__ import annotations
from datetime import datetime, timezone
import asyncio
import uuid
from fastapi import APIRouter, HTTPException, Request, Depends

from app.schemas.room import (
    CreateRoomRequest,
    CreateRoomResponse,
    Bot as SchemaBot,
    Persona as SchemaPersona,
)
from app.events.bus import EventBus
from app.services.bot_spawner import createBotFromPool, generatePersonaPool
from app.services.reaction_config import CATEGORIES
import random
from app.services.coach import create_megaknight_coach

router = APIRouter(prefix="/rooms", tags=["rooms"])

@router.post("", response_model=CreateRoomResponse, status_code=201)
async def create_room(request: Request, body: CreateRoomRequest | None = None) -> CreateRoomResponse:
    room_id = str(uuid.uuid4())
    coach = create_megaknight_coach()
    request.app.state.room_manager.add_coach_to_room(room_id, coach)
    # category if provided
    category = None
    try:
        category = body.category if body is not None else None
    except Exception:
        category = None
    request.app.state.room_manager.set_category(room_id, category)
    bots_api: list[SchemaBot] = []

    # Create bots concurrently; reuse persona generation here rather than inside add_bot
    num_bots = 18
    try:
        topic = None
        try:
            topic = (body.topic or "").strip() if body is not None else None
        except Exception:
            topic = None
        persona_tasks = [generatePersonaPool(topic=topic or (category or "Public Speaking")) for _ in range(num_bots)]
        personas = await asyncio.gather(*persona_tasks, return_exceptions=True)

        # Prepare diversity helpers
        stance_cycle = ["supportive", "skeptical", "curious"]
        domain_bias = CATEGORIES.get(category or "", {}).get("domain_bias", {"tech": 0.5, "design": 0.25, "finance": 0.25})
        domains = list(domain_bias.keys())
        weights = [float(domain_bias[d]) for d in domains]
        total_w = sum(weights) or 1.0
        weights = [w / total_w for w in weights]

        idx = 0
        for p in personas:
            if isinstance(p, Exception) or not isinstance(p, dict):
                continue
            # Enforce stance/domain diversity
            mod = dict(p)
            try:
                mod["stance"] = stance_cycle[idx % len(stance_cycle)]
            except Exception:
                mod["stance"] = p.get("stance", "supportive")
            try:
                r = random.random()
                acc = 0.0
                chosen = domains[0]
                for d, w in zip(domains, weights):
                    acc += w
                    if r <= acc:
                        chosen = d
                        break
                mod["domain"] = chosen
            except Exception:
                mod["domain"] = p.get("domain", "tech")

            new_bot_instance = createBotFromPool(mod)
            if not new_bot_instance:
                continue
            request.app.state.room_manager.add_bot_to_room(room_id, new_bot_instance)
            # Build API bot representation
            # Pick a fun emoji avatar
            avatar_choices = [
                "😀","🙂","😎","🤔","👏","🤖","🧠","🧐","🤓","🧑‍💻",
                "😄","😌","🤝","💡","🔥","👍","✨","🤯","😬","🫡"
            ]
            bot_for_api = SchemaBot(
                id=new_bot_instance.id,
                name=new_bot_instance.personality.name,
                avatar=random.choice(avatar_choices),
                persona=SchemaPersona(
                    stance=new_bot_instance.personality.stance,
                    domain=new_bot_instance.personality.domain,
                ),
            )
            bots_api.append(bot_for_api)
            # Also persist avatar on service bot so later WS state matches POST /rooms
            try:
                new_bot_instance.avatar = bot_for_api.avatar  # type: ignore[attr-defined]
            except Exception:
                pass
            # Log and notify via event bus
            print(f"[rooms] bot joined room={room_id} id={bot_for_api.id} name={bot_for_api.name}")
            await request.app.state.event_bus.publish("bot:join", {  # type: ignore[attr-defined]
                "roomId": room_id,
                "bot": bot_for_api.model_dump(),
            })
            idx += 1
    except Exception as e:
        print(f"[rooms] bot creation error for room={room_id}: {e}")

    return CreateRoomResponse(
        id=room_id,
        createdAt=datetime.now(timezone.utc),
        bots=bots_api,
        category=category,
        updatedAt=datetime.now(timezone.utc),
    )

# Removed: /rooms/{roomId}/state — initial state is now returned by POST /rooms

def get_bus(request: Request) -> EventBus:
    return request.app.state.event_bus

@router.post("/{roomId}/bots", response_model=SchemaBot, status_code=201)
async def add_bot(
    roomId: str,
    request: Request,
    bus: EventBus = Depends(get_bus),
) -> SchemaBot:
    persona_pool = await generatePersonaPool(topic="AI Presentations")
    new_bot_instance = createBotFromPool(persona_pool)

    if not new_bot_instance:
        raise HTTPException(status_code=500, detail="Failed to create a new bot.")

    request.app.state.room_manager.add_bot_to_room(roomId, new_bot_instance)

    bot_for_api = SchemaBot(
        id=new_bot_instance.id,
        name=new_bot_instance.personality.name,
        avatar="🤖",
        persona=SchemaPersona(
            stance=new_bot_instance.personality.stance,
            domain=new_bot_instance.personality.domain,
        )
    )
    
    await bus.publish("bot:join", {"roomId": roomId, "bot": bot_for_api.model_dump()})
    return bot_for_api

@router.delete("/{roomId}/bots/{botId}", status_code=204)
async def remove_bot(
    roomId: str,
    botId: str,
    request: Request,
    bus: EventBus = Depends(get_bus),
) -> None:
    request.app.state.room_manager.remove_bot_from_room(roomId, botId)
    await bus.publish("bot:leave", {"roomId": roomId, "botId": botId})
    return None

@router.post("/{roomId}/feedback", status_code=202)
async def get_final_feedback(roomId: str, request: Request, bus: EventBus = Depends(get_bus)) -> dict:
    room_manager = request.app.state.room_manager
    coach = room_manager.get_coach_in_room(roomId)
    
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found for this room.")
    
    feedback = await coach.generate_end_session_feedback()

    if feedback:
        await bus.publish(
            "coach:feedback",
            {"roomId": roomId, "coachId": coach.id, "feedback": feedback}
        )
        return {"status": "feedback_generation_queued"}
    
    raise HTTPException(status_code=500, detail="Failed to generate feedback.")

@router.get("/{roomId}/transcript")
async def get_transcript_window(roomId: str, request: Request, windowSeconds: int = 60) -> dict:
    text = request.app.state.room_manager.get_transcript_window(roomId, windowSeconds)
    return {"roomId": roomId, "windowSeconds": windowSeconds, "text": text}