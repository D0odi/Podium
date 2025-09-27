from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.ws.manager import ConnectionManager


router = APIRouter(prefix="/rooms", tags=["rooms"])


class BroadcastRequest(BaseModel):
    event: str
    payload: dict


def get_manager(request: Request) -> ConnectionManager:
    return request.app.state.ws_manager  # type: ignore[attr-defined]


@router.post("/{roomId}/broadcast", status_code=202)
async def broadcast_event(
    roomId: str,
    body: BroadcastRequest,
    manager: ConnectionManager = Depends(get_manager),
) -> dict:
    if not body.event:
        raise HTTPException(status_code=400, detail="event is required")
    await manager.broadcast_json(roomId, {"event": body.event, "payload": body.payload})
    return {"status": "queued"}


