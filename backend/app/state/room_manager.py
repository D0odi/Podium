from __future__ import annotations
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, Deque, Tuple, Optional

from app.services.bot import Bot as ServiceBot
from app.schemas.room import Bot as SchemaBot, Persona as SchemaPersona

@dataclass
class Room:
    id: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    bots: Dict[str, ServiceBot] = field(default_factory=dict)
    transcript: Deque[Tuple[datetime, str]] = field(default_factory=lambda: deque(maxlen=1000))
    category: Optional[str] = None

class RoomManager:
    def __init__(self) -> None:
        self._rooms: Dict[str, Room] = {}

    def ensure_room(self, room_id: str) -> Room:
        room = self._rooms.get(room_id)
        if room is None:
            room = Room(id=room_id)
            self._rooms[room_id] = room
        return room

    def set_category(self, room_id: str, category: Optional[str]) -> None:
        room = self.ensure_room(room_id)
        room.category = category
        room.updated_at = datetime.now(timezone.utc)

    def get_category(self, room_id: str) -> Optional[str]:
        room = self.ensure_room(room_id)
        return room.category

    def add_bot_to_room(self, room_id: str, bot: ServiceBot) -> None:
        room = self.ensure_room(room_id)
        room.bots[bot.id] = bot
        room.updated_at = datetime.now(timezone.utc)

    def remove_bot_from_room(self, room_id: str, bot_id: str) -> None:
        room = self.ensure_room(room_id)
        room.bots.pop(bot_id, None)
        room.updated_at = datetime.now(timezone.utc)

    def append_transcript(self, room_id: str, text: str) -> None:
        room = self.ensure_room(room_id)
        room.transcript.append((datetime.now(timezone.utc), text))
        room.updated_at = datetime.now(timezone.utc)

    def get_transcript_tail_chars(self, room_id: str, max_chars: int) -> str:
        room = self.ensure_room(room_id)
        if max_chars <= 0 or not room.transcript:
            return ""
        collected: list[str] = []
        remaining = max_chars
        # Walk from the end to efficiently collect only what's needed
        for _, txt in reversed(room.transcript):
            if remaining <= 0:
                break
            if not txt:
                continue
            if len(txt) <= remaining:
                collected.append(txt)
                remaining -= len(txt)
            else:
                collected.append(txt[-remaining:])
                remaining = 0
                break
        # We collected in reverse order; reverse back to chronological and join
        collected.reverse()
        return "".join(collected)

    def get_service_bots_in_room(self, room_id: str) -> list[ServiceBot]:
        room = self.ensure_room(room_id)
        return list(room.bots.values())