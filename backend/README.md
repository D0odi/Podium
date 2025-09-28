# Backend: AI Audience Orchestrator

This backend is a Python [FastAPI](https://fastapi.tiangolo.com/) application that manages real‑time AI audience behavior. It receives transcript data (Deepgram webhook), maintains per‑room state, and pushes events to the frontend over WebSockets.

## Architecture & Data Flow

Real‑time, event‑driven pipeline:

1. **Frontend audio → Deepgram:** The browser streams mic audio directly to Deepgram.
2. **Webhook → Transcript buffer:** Deepgram sends transcripts to `POST /webhooks/deepgram`. We buffer text and emit chunks every ~2s or when a sentence ends.
3. **Event bus:** The buffer publishes `transcript:chunk` to an in‑process EventBus.
4. **Room state:** `RoomManager` appends transcript to per‑room history; bots will read 60‑second windows for prompting.
5. **WebSocket gateway:** Subscribed bus bridges broadcast events to connected clients: transcript, join, leave, reaction.

No Redis is used in the MVP; all state is in memory and single‑process.

## Project Layout

```
backend/
  app/
    api/                # HTTP routes
      rooms.py          # create room, state, bots endpoints, transcript window
      webhooks.py       # Deepgram webhook (POST /webhooks/deepgram)
      events.py         # Test publisher for bot:reaction
      broadcast.py      # Test HTTP→WS broadcast (optional)
    core/
      config.py         # settings loader (.env)
      registry.py       # access singletons (RoomManager, EventBus) from anywhere
    events/
      bus.py            # in‑process async pub/sub bus
    services/
      transcript_buffer.py  # buffer transcript and emit chunks
    state/
      room_manager.py   # in‑memory room state (bots, transcript)
    ws/
      manager.py        # WebSocket connection management per room
      routes.py         # WS endpoint: /ws/rooms/{roomId}
    main.py             # app wiring, middleware, router includes, bus bridges
```

## Run locally

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Health check: `GET /health`

## Configuration




Create and fill `.env` (see `.env.example`):

```
APP_ENV=development
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DEEPGRAM_API_KEY=
OPENROUTER_API_KEY=
```

## HTTP API (MVP)

- `POST /rooms` → `{ id, createdAt }`
- `GET /rooms/{roomId}/state` → `{ roomId, bots, transcript, updatedAt }`
- `GET /rooms/{roomId}/transcript?windowSeconds=60` → `{ roomId, windowSeconds, text }`
- `POST /rooms/{roomId}/bots` body=Bot → add bot, emits join
- `DELETE /rooms/{roomId}/bots/{botId}` → remove bot, emits leave
- `POST /webhooks/deepgram` body=`{ roomId, text }` → buffers transcript and publishes chunk(s)

Testing helpers:

- `POST /rooms/{roomId}/broadcast` body=`{ event, payload }` → direct WS broadcast (debug)
- `POST /events/bot-reaction` body=`{ roomId, botId, reaction }` → publish via EventBus

## WebSocket

- Endpoint: `WS /ws/rooms/{roomId}`
- Envelope: `{ "event": string, "payload": object }`
- Events sent by server:
  - `ready`: `{ roomId }` (on connect)
  - `transcript`: `{ roomId, text }` (buffer flush)
  - `join`: `{ bot }`
  - `leave`: `{ botId }`
  - `reaction`: `{ roomId, botId, reaction }`

## Event Bus Topics (in‑process)

- `transcript:chunk` → `{ roomId, text }`
- `bot:join` → `{ roomId, bot }`
- `bot:leave` → `{ roomId, botId }`
- `bot:reaction` → `{ roomId, botId, reaction }`

Bridges in `main.py` forward these to WS so the frontend stays in sync.

## RoomManager (single process, in memory)

Holds per‑room bots and transcript history (rolling window). Used by HTTP routes and by bot logic.

Key methods:

- `add_bot_to_room(room_id, bot)`
- `remove_bot_from_room(room_id, bot_id)`
- `get_transcript_window(room_id, seconds)` → `str`

## Internal usage (for bot/spawner/coach modules)

Use the registry to access singletons without HTTP:

```python
from app.core.registry import get_room_manager, get_event_bus
from app.schemas.room import Bot, Persona

room_id = "<room-uuid>"

# Add a bot
rm = get_room_manager()
bot = Bot(id="b1", name="Alex", avatar="🤖", persona=Persona(stance="curious", domain="tech"))
rm.add_bot_to_room(room_id, bot)

# Publish a reaction (will be broadcast to the room)
import asyncio
async def send_reaction():
    bus = get_event_bus()
    await bus.publish("bot:reaction", {
        "roomId": room_id,
        "botId": "b1",
        "reaction": {"emoji": "🔥", "phrase": "Nice point!", "intensity": 0.9}
    })
asyncio.run(send_reaction())

# Read a 60s transcript window
text = rm.get_transcript_window(room_id, 60)
print(text)
```

## Manual testing recipes

Create a room and open WS:

```bash
ROOM_ID=$(curl -s -X POST http://127.0.0.1:8000/rooms | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
echo $ROOM_ID
```

Browser console (go to http://127.0.0.1:8000/docs):

```js
const ROOM_ID = "aff930ab-31d0-4d3d-b7e5-e69cd2d12c3a";
const ws = new WebSocket(`ws://127.0.0.1:8000/ws/rooms/${ROOM_ID}`);
ws.onmessage = (e) => console.log("msg:", e.data);
```

Simulate Deepgram:

```bash
curl -s -X POST http://127.0.0.1:8000/webhooks/deepgram -H "content-type: application/json" -d '{"roomId":"'"$ROOM_ID"'","text":"Hello there"}'
curl -s -X POST http://127.0.0.1:8000/webhooks/deepgram -H "content-type: application/json" -d '{"roomId":"'"$ROOM_ID"'","text":" finishing the sentence."}'
```

Add/remove a bot:

```bash
curl -s -X POST http://127.0.0.1:8000/rooms/$ROOM_ID/bots -H "content-type: application/json" -d '{"id":"b1","name":"Alex","avatar":"🤖","persona":{"stance":"curious","domain":"tech"}}'
curl -s -X DELETE http://127.0.0.1:8000/rooms/$ROOM_ID/bots/b1 -i | head -n 1
```

Publish a reaction via bus (HTTP helper):

```bash
curl -s -X POST http://127.0.0.1:8000/events/bot-reaction -H "content-type: application/json" -d '{"roomId":"'"$ROOM_ID"'","botId":"b1","reaction":{"emoji":"🔥","phrase":"Let’s go!","intensity":0.8}}'
```

Fetch state:

```bash
curl -s http://127.0.0.1:8000/rooms/$ROOM_ID/state | jq
```
