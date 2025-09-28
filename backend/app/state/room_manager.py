from __future__ import annotations
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, Deque, Tuple, Optional, List, Any

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
    duration_seconds: Optional[int] = None
    persona_pool: Optional[List[Dict[str, Any]]] = None

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

    def set_duration_seconds(self, room_id: str, duration_seconds: Optional[int]) -> None:
        room = self.ensure_room(room_id)
        room.duration_seconds = duration_seconds
        room.updated_at = datetime.now(timezone.utc)

    def get_duration_seconds(self, room_id: str) -> Optional[int]:
        room = self.ensure_room(room_id)
        return room.duration_seconds

    def set_duration_minutes(self, room_id: str, duration_minutes: Optional[int]) -> None:
        if duration_minutes is None:
            self.set_duration_seconds(room_id, None)
            return
        try:
            seconds = int(max(0, duration_minutes)) * 60
        except Exception:
            seconds = None
        self.set_duration_seconds(room_id, seconds)

    def get_duration_minutes(self, room_id: str) -> Optional[int]:
        sec = self.get_duration_seconds(room_id)
        if sec is None:
            return None
        try:
            return max(0, int(round(sec / 60)))
        except Exception:
            return None

    def set_persona_pool(self, room_id: str, pool: List[Dict[str, Any]]) -> None:
        room = self.ensure_room(room_id)
        room.persona_pool = list(pool) if isinstance(pool, list) else []
        room.updated_at = datetime.now(timezone.utc)

    def get_random_persona(self, room_id: str) -> Optional[Dict[str, Any]]:
        """Return a random persona dict from the stored pool, if available.

        Does not remove from pool to allow reuse; returns None if no pool.
        """
        room = self.ensure_room(room_id)
        pool = room.persona_pool or []
        if not pool:
            return None
        try:
            import random as _random
            return _random.choice(pool)
        except Exception:
            # Fallback to first element if random fails
            return pool[0] if pool else None

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