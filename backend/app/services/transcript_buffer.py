from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class BufferState:
    text: str
    last_flush_s: float
    pauses: list[dict] = field(default_factory=list)


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
        self.PAUSE_THRESHOLDS = {
            "min_stutter": 0.6,
            "max_stutter": 2.5,
            "rhetorical": 2.5,
        }

    def append(self, room_id: str, piece: str, meta: dict | None = None) -> tuple[bool, str, dict]:
        now = time.monotonic()
        state = self._room_to_state.get(room_id)
        if state is None:
            state = BufferState(text="", last_flush_s=now)
            self._room_to_state[room_id] = state

        occurred_mid_sentence = not any(state.text.endswith(ch) for ch in ".!?" )
        if meta is not None:
            try:
                s = meta.get("silence_preceding_s")
                if s is not None:
                    state.pauses.append({"s": float(s), "mid": bool(occurred_mid_sentence)})
            except Exception:
                pass

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
            pauses = state.pauses[:]
            state.text = ""
            state.pauses = []
            state.last_flush_s = now

            try:
                stutters = sum(1 for p in pauses if p.get("mid") and self.PAUSE_THRESHOLDS["min_stutter"] <= p.get("s", 0.0) < self.PAUSE_THRESHOLDS["max_stutter"])
                rhet = any((not p.get("mid")) and p.get("s", 0.0) >= self.PAUSE_THRESHOLDS["rhetorical"] for p in pauses)
                flush_meta = {
                    "max_pause_s": max([p.get("s", 0.0) for p in pauses], default=0.0),
                    "stutter_count": int(stutters),
                    "rhetorical_pause": bool(rhet),
                    "question": ("?" in chunk),
                    "exclaim": ("!" in chunk),
                }
            except Exception:
                flush_meta = {"max_pause_s": 0.0, "stutter_count": 0, "rhetorical_pause": False, "question": ("?" in chunk), "exclaim": ("!" in chunk)}

            return True, chunk, flush_meta

        return False, "", {}


