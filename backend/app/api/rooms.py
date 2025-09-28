from __future__ import annotations
from datetime import datetime, timezone
import asyncio
import uuid
import random
from fastapi import APIRouter, HTTPException, Request, Depends

from app.schemas.room import (
    CreateRoomRequest,
    CreateRoomResponse,
    Bot as SchemaBot,
    Persona as SchemaPersona,
)
from app.events.bus import EventBus
from app.services.bot_spawner import generatePersonaPool, AVATAR_EMOJIS
from app.services.bot import Bot as ServiceBot, BotPersona, BotState
from app.services.coach_anal.coach import get_coach_feedback
import httpx

router = APIRouter(prefix="/rooms", tags=["rooms"])

@router.post("", response_model=CreateRoomResponse, status_code=201)
async def create_room(request: Request, body: CreateRoomRequest) -> CreateRoomResponse:
    room_id = str(uuid.uuid4())
    rm = request.app.state.room_manager
    rm.set_category(room_id, body.category)
    rm.set_duration_seconds(room_id, body.durationSeconds)
    bots_api: list[SchemaBot] = []

    # Create bots using a single AI-generated persona pool
    num_bots = 10
    topic = body.topic.strip()
    personas = await generatePersonaPool(topic=topic, count=num_bots)
    print(f"[rooms] persona pool fetched count={len(personas)} topic='{topic}'")

    for p in personas:
        if not isinstance(p, dict):
            raise HTTPException(status_code=500, detail="Invalid persona format from generator.")
        try:
            persona_model = BotPersona(**p)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Invalid persona data: {e}")

        avatar = random.choice(AVATAR_EMOJIS)

        new_bot_instance = ServiceBot(avatar=avatar, personality=persona_model, state=BotState())
        request.app.state.room_manager.add_bot_to_room(room_id, new_bot_instance)

        bot_for_api = SchemaBot(
            id=new_bot_instance.id,
            name=new_bot_instance.personality.name,
            avatar=new_bot_instance.avatar,
            persona=SchemaPersona(
                stance=new_bot_instance.personality.stance,
                domain=new_bot_instance.personality.domain,
                description=new_bot_instance.personality.description,
            ),
        )
        bots_api.append(bot_for_api)
        # Log and notify via event bus
        print(f"[rooms] bot joined room={room_id} bot={bot_for_api.model_dump()}")
        await request.app.state.event_bus.publish("bot:join", {  # type: ignore[attr-defined]
            "roomId": room_id,
            "bot": bot_for_api.model_dump(),
        })

    return CreateRoomResponse(
        id=room_id,
        createdAt=datetime.now(timezone.utc),
        updatedAt=datetime.now(timezone.utc),
        bots=bots_api,
        category=body.category,
        durationSeconds=body.durationSeconds,
    )

def get_bus(request: Request) -> EventBus:
    return request.app.state.event_bus

@router.post("/{roomId}/bots", response_model=SchemaBot, status_code=201)
async def add_bot(
    roomId: str,
    request: Request,
    bus: EventBus = Depends(get_bus),
) -> SchemaBot:
    personas = await generatePersonaPool(topic="AI Presentations", count=1)
    if not personas or not isinstance(personas[0], dict):
        raise HTTPException(status_code=500, detail="Failed to create a new bot.")

    persona_model = BotPersona(**personas[0])
    avatar = random.choice(AVATAR_EMOJIS)
    new_bot_instance = ServiceBot(avatar=avatar, personality=persona_model, state=BotState())

    request.app.state.room_manager.add_bot_to_room(roomId, new_bot_instance)

    bot_for_api = SchemaBot(
        id=new_bot_instance.id,
        name=new_bot_instance.personality.name,
        avatar=new_bot_instance.avatar,
        persona=SchemaPersona(
            stance=new_bot_instance.personality.stance,
            domain=new_bot_instance.personality.domain,
            description=new_bot_instance.personality.description,
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
    transcript = room_manager.get_transcript_window(roomId, seconds=3600) # Get full transcript

    if not transcript:
        raise HTTPException(status_code=404, detail="No transcript found for this room.")
    
    duration_goal = room_manager.get_duration_seconds(roomId)
    feedback = get_coach_feedback(transcript, duration_goal)

    if feedback:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                await client.post(
                    f"{request.base_url}events/coach-feedback",
                    json={"roomId": roomId, "feedback": feedback},
                )
            except Exception as e:
                raise HTTPException(status_code=502, detail=f"Failed to POST coach feedback: {e}")
        return {"status": "feedback_posted"}
    
    raise HTTPException(status_code=500, detail="Failed to generate feedback.")

@router.get("/{roomId}/transcript")
async def get_transcript_window(roomId: str, request: Request, windowSeconds: int = 60) -> dict:
    text = request.app.state.room_manager.get_transcript_window(roomId, windowSeconds)
    return {"roomId": roomId, "windowSeconds": windowSeconds, "text": text}