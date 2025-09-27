from __future__ import annotations

import asyncio
from typing import Callable, Dict, Set, Any, Coroutine, Any as AnyType


AsyncHandler = Callable[[Any], Coroutine[AnyType, AnyType, None]]


class EventBus:
    """Simple in-process pub/sub event bus for a single-process MVP.

    - subscribe(topic, handler): register an async handler
    - unsubscribe(topic, handler): remove a handler
    - publish(topic, payload): schedule all handlers for that topic
    """

    def __init__(self) -> None:
        self._topic_to_handlers: Dict[str, Set[AsyncHandler]] = {}

    def subscribe(self, topic: str, handler: AsyncHandler) -> None:
        handlers = self._topic_to_handlers.setdefault(topic, set())
        handlers.add(handler)

    def unsubscribe(self, topic: str, handler: AsyncHandler) -> None:
        handlers = self._topic_to_handlers.get(topic)
        if not handlers:
            return
        handlers.discard(handler)
        if not handlers:
            self._topic_to_handlers.pop(topic, None)

    async def publish(self, topic: str, payload: Any) -> None:
        # Snapshot to avoid mutation during iteration
        for handler in list(self._topic_to_handlers.get(topic, set())):
            # Fire and forget; add proper error logging if needed
            coro = handler(payload)
            asyncio.create_task(coro)


