from __future__ import annotations

import time
from dataclasses import dataclass


@dataclass
class BufferState:
    text: str
    last_flush_s: float


class TranscriptBuffer:
    """Collects transcript pieces and flushes them in chunks.

    Simple heuristics for MVP:
    - Flush if buffer contains a sentence terminator (. ! ?) OR
    - Flush if more than max_interval_s elapsed since last flush
    """

    def __init__(self, max_interval_s: float = 2.0, flush_on_interval: bool = True) -> None:
        self.max_interval_s = max_interval_s
        self.flush_on_interval = flush_on_interval
        self._room_to_state: dict[str, BufferState] = {}
        # Rhetorical pauses and stutter tracking removed

    def append(self, room_id: str, piece: str, meta: dict | None = None) -> tuple[bool, str, dict]:
        now = time.monotonic()
        state = self._room_to_state.get(room_id)
        if state is None:
            state = BufferState(text="", last_flush_s=now)
            self._room_to_state[room_id] = state

        # Accumulate
        state.text = (state.text + " " + piece).strip()

        should_flush = False
        # question mark flush
        if state.text.endswith("?"):
            should_flush = True
        # sentence terminal or interval
        elif any(state.text.endswith(ch) for ch in (".", "!")):
            should_flush = True
        elif self.flush_on_interval and (now - state.last_flush_s >= self.max_interval_s):
            should_flush = True

        if should_flush and state.text:
            chunk = state.text
            state.text = ""
            state.last_flush_s = now

            # Only expose basic punctuation-derived metadata
            flush_meta = {
                "question": ("?" in chunk),
                "exclaim": ("!" in chunk),
            }

            return True, chunk, flush_meta

        return False, "", {}


