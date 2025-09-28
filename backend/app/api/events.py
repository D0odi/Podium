from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.events.bus import EventBus


router = APIRouter(prefix="/events", tags=["events"])


class BotReactionEvent(BaseModel):
    roomId: str
    botId: str
    reaction: dict


def get_bus(request: Request) -> EventBus:
    return request.app.state.event_bus  # type: ignore[attr-defined]


@router.post("/bot-reaction", status_code=202)
async def publish_bot_reaction(
    body: BotReactionEvent,
    bus: EventBus = Depends(get_bus),
) -> dict:
    if not body.roomId:
        raise HTTPException(status_code=400, detail="roomId is required")
    await bus.publish("bot:reaction", body.model_dump())
    return {"status": "queued"}


class CoachFeedbackEvent(BaseModel):
    roomId: str
    feedback: dict


@router.post("/coach-feedback", status_code=202)
async def publish_coach_feedback(
    body: CoachFeedbackEvent,
    bus: EventBus = Depends(get_bus),
) -> dict:
    if not body.roomId:
        raise HTTPException(status_code=400, detail="roomId is required")
    await bus.publish("coach:feedback", body.model_dump())
    return {"status": "queued"}


