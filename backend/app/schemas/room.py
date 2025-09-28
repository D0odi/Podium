from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Persona(BaseModel):
    stance: Literal["supportive", "skeptical", "curious"]
    domain: Literal["tech", "design", "finance"]
    description: str


class Bot(BaseModel):
    id: str
    name: str
    avatar: str = Field(description="Emoji or character representing the bot, e.g., '🤖'")
    persona: Persona


class CreateRoomRequest(BaseModel):
    category: str
    topic: str


class CreateRoomResponse(BaseModel):
    id: str
    createdAt: datetime
    updatedAt: datetime
    bots: list[Bot] = []
    category: str


class RoomState(BaseModel):
    roomId: str
    category: str
    bots: list[Bot]
    transcript: str = ""
    updatedAt: datetime


