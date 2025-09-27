from __future__ import annotations

from typing import Dict, Set
import asyncio

from fastapi import WebSocket


class ConnectionManager:
    """Tracks WebSocket connections per room and provides broadcast helpers.

    In-memory and single-process only (sufficient for MVP).
    """

    def __init__(self) -> None:
        self._room_to_sockets: Dict[str, Set[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if room_id not in self._room_to_sockets:
            self._room_to_sockets[room_id] = set()
        self._room_to_sockets[room_id].add(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket) -> None:
        sockets = self._room_to_sockets.get(room_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            # Cleanup empty room sets to avoid unbounded growth
            self._room_to_sockets.pop(room_id, None)

    async def broadcast_json(self, room_id: str, message: dict) -> None:
        sockets = list(self._room_to_sockets.get(room_id, set()))
        if not sockets:
            return

        async def _send(ws: WebSocket) -> None:
            try:
                await ws.send_json(message)
            except Exception:
                # If sending fails, drop the socket from the room
                self.disconnect(room_id, ws)

        await asyncio.gather(*(_send(ws) for ws in sockets), return_exceptions=True)


