from __future__ import annotations

from typing import Optional, TYPE_CHECKING

from fastapi import FastAPI

if TYPE_CHECKING:
    from app.state.room_manager import RoomManager
    from app.events.bus import EventBus


_app: Optional[FastAPI] = None


def bind(app: FastAPI) -> None:
    """Bind the FastAPI app so non-HTTP code can access app.state singletons."""
    global _app
    _app = app


def _get_app() -> FastAPI:
    if _app is None:
        raise RuntimeError("Registry not bound. Call registry.bind(app) during startup.")
    return _app


def get_room_manager() -> "RoomManager":
    return _get_app().state.room_manager  # type: ignore[attr-defined]


def get_event_bus() -> "EventBus":
    return _get_app().state.event_bus  # type: ignore[attr-defined]


