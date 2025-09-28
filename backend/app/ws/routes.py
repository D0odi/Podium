from __future__ import annotations

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Request
import json
import time

from app.ws.manager import ConnectionManager
from app.events.bus import EventBus


router = APIRouter()


def get_manager(websocket: WebSocket) -> ConnectionManager:
    # Access the globally created manager from app.state in main.py
    return websocket.app.state.ws_manager  # type: ignore[attr-defined]


def get_bus(websocket: WebSocket) -> EventBus:
    return websocket.app.state.event_bus  # type: ignore[attr-defined]


@router.websocket("/ws/rooms/{roomId}")
async def websocket_room_endpoint(
    websocket: WebSocket,
    roomId: str,
    manager: ConnectionManager = Depends(get_manager),
    bus: EventBus = Depends(get_bus),
) -> None:
    await manager.connect(roomId, websocket)
    try:
        # Optional: greet the client
        await websocket.send_json({"event": "ready", "payload": {"roomId": roomId}})
        # Client->server messages: handle client_transcript (room-aware)
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue
            event = data.get("event")
            payload = data.get("payload") or {}
            if event == "client_transcript":
                text = payload.get("text")
                meta = payload.get("meta") or {}
                if isinstance(text, str) and text.strip():
                    # Append with meta; returns (flushed, chunk, flush_meta)
                    flushed, chunk, flush_meta = websocket.app.state.transcript_buffer.append(roomId, text.strip(), meta)  # type: ignore[attr-defined]
                    if flushed and chunk:
                        await websocket.app.state.event_bus.publish(  # type: ignore[attr-defined]
                            "transcript:chunk", {"roomId": roomId, "text": chunk, "flush_meta": flush_meta}
                        )
            elif event == "join" and payload.get("bot"):
                # Allow client to seed initial bots after room creation
                try:
                    bot = payload.get("bot")
                    await bus.publish("bot:join", {"roomId": roomId, "bot": bot})
                except Exception:
                    pass
            elif event == "seed_bots" and isinstance(payload.get("bots"), list):
                try:
                    for bot in payload.get("bots", []):
                        await bus.publish("bot:join", {"roomId": roomId, "bot": bot})
                except Exception:
                    pass
            elif event == "state_request":
                # Return current bots in room to the requesting client only
                try:
                    room = websocket.app.state.room_manager.ensure_room(roomId)  # type: ignore[attr-defined]
                    bots = []
                    for b in room.bots.values():
                        bots.append({
                            "id": b.id,
                            "name": b.personality.name,
                            "avatar": getattr(b, 'avatar', '🤖'),
                            "persona": {
                                "stance": b.personality.stance,
                                "domain": b.personality.domain,
                            },
                        })
                    await websocket.send_json({"event": "state", "payload": {"bots": bots}})
                except Exception:
                    await websocket.send_json({"event": "state", "payload": {"bots": []}})
    except WebSocketDisconnect:
        manager.disconnect(roomId, websocket)


@router.websocket("/ws/transcript/{roomId}")
async def websocket_transcript_endpoint(
    websocket: WebSocket,
    roomId: str,
    bus: EventBus = Depends(get_bus),
) -> None:
    # Dedicated endpoint for receiving Deepgram live events and forwarding
    # simplified chunks into the backend TranscriptBuffer. All timing-based
    # calculations (silence, stutters, rhetorical pauses) are done server-side.
    await websocket.accept()

    # Initialize per-room DG tracking state on app
    if not hasattr(websocket.app.state, "dg_state"):
        websocket.app.state.dg_state = {}
    room_state = websocket.app.state.dg_state.setdefault(
        roomId, {"last_end": None, "last_speech_start": None, "last_silence": 0.0}
    )

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue

            event = data.get("event")
            payload = data.get("payload") or {}

            # Handle Deepgram event types
            if event == "dg_speech_started":
                try:
                    ts = payload.get("timestamp")
                    if isinstance(ts, (int, float)):
                        room_state["last_speech_start"] = float(ts)
                        last_end = room_state.get("last_end")
                        if isinstance(last_end, (int, float)):
                            room_state["last_silence"] = max(0.0, float(ts) - float(last_end))
                        else:
                            # First speech start in session; treat silence as ts (>=0)
                            room_state["last_silence"] = max(0.0, float(ts))
                except Exception:
                    pass
            elif event == "dg_utterance_end":
                try:
                    # Prefer last_word_end if present, fallback to timestamp
                    end_ts = (
                        payload.get("last_word_end")
                        if isinstance(payload.get("last_word_end"), (int, float))
                        else payload.get("timestamp")
                    )
                    if isinstance(end_ts, (int, float)):
                        room_state["last_end"] = float(end_ts)
                except Exception:
                    pass
            elif event == "dg_transcript":
                try:
                    is_final = bool(payload.get("is_final"))
                    text = (data.get("text") or "").strip()
                    if not text:
                        # Attempt to derive text from DG payload if not provided explicitly
                        alt = ((payload or {}).get("channel") or {}).get("alternatives") or []
                        if isinstance(alt, list) and alt:
                            t = (alt[0] or {}).get("transcript")
                            if isinstance(t, str):
                                text = t.strip()
                    if is_final and text:
                        # Append to TranscriptBuffer with computed silence
                        silence = float(room_state.get("last_silence") or 0.0)
                        flushed, chunk, flush_meta = websocket.app.state.transcript_buffer.append(  # type: ignore[attr-defined]
                            roomId, text, {"silence_preceding_s": silence}
                        )
                        if flushed and chunk:
                            await bus.publish(
                                "transcript:chunk",
                                {"roomId": roomId, "text": chunk, "flush_meta": flush_meta},
                            )
                except Exception:
                    pass
            else:
                # ignore other events on this endpoint
                pass
    except WebSocketDisconnect:
        # Client disconnected; no shared state to clean up here
        return


