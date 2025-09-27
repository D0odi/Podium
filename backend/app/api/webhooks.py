from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.events.bus import EventBus
from app.services.transcript_buffer import TranscriptBuffer


router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class DeepgramWebhook(BaseModel):
    roomId: str
    text: str
    meta: dict | None = None


def get_bus(request: Request) -> EventBus:
    return request.app.state.event_bus  # type: ignore[attr-defined]


def get_buffer(request: Request) -> TranscriptBuffer:
    return request.app.state.transcript_buffer  # type: ignore[attr-defined]


@router.post("/deepgram", status_code=202)
async def deepgram_webhook(
    body: DeepgramWebhook,
    bus: EventBus = Depends(get_bus),
    buffer: TranscriptBuffer = Depends(get_buffer),
) -> dict:
    if not body.roomId or not body.text:
        raise HTTPException(status_code=400, detail="roomId and text are required")

    flushed, chunk, flush_meta = buffer.append(body.roomId, body.text, body.meta or {})
    if flushed:
        await bus.publish(
            "transcript:chunk",
            {"roomId": body.roomId, "text": chunk, "flush_meta": flush_meta},
        )

    return {"status": "accepted", "flushed": flushed}


