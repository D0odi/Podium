# AI Audience — Frontend (Next.js) MVP

## 🎯 Goal

Build a demo-ready frontend that simulates an “AI audience” reacting in real time to a presenter. This MVP is mocked (no real FastAPI/Deepgram/LLM yet) and shows:

- A grid of 2–15 bot “audience members”
- Emoji + micro-phrase reactions that appear over time
- Join/leave churn to feel like a real room
- Simple controls to seed/reset and trigger mock events

---

## 🛠️ Tech Choices

- **Next.js (App Router)** + **TypeScript**
- **Tailwind CSS** for styling
- **shadcn/ui** for polished primitives (cards, buttons, badges, etc.)
- **framer-motion** for enter/exit/reaction animations
- **@faker-js/faker** for mock personas and reactions
- **Zustand** (or comparable) for light client state during the mock phase

> **Rationale:** `shadcn/ui` + `framer-motion` gives a fast, clean, production-looking UI; `faker` and a tiny state management store let us simulate the eventual WebSocket stream without wiring up the backend.

---

## 📁 Repository Layout (Monorepo)

- `/frontend` — The Next.js app (this MVP).
- `/backend` — FastAPI (to be built later). For now, it will contain a `README.md` that describes webhooks, WebSocket topics, and orchestrator loops.

---

## 🔑 Environment Placeholders

Create app-local environment variables (e.g., `.env.local`). Do not commit secrets. Include an example file (e.g., `.env.example`) for easy onboarding.

- `NEXT_PUBLIC_DEEPGRAM_API_KEY` — placeholder only (unused in MVP)
- `NEXT_PUBLIC_OPENROUTER_API_KEY` — placeholder only (unused in MVP)
- `NEXT_PUBLIC_WS_URL` — placeholder URL to show where the future WebSocket would connect (e.g., `ws://localhost:8000/ws`)

---

## 📜 Data Contracts

These data shapes should be documented to ensure alignment with the backend later.

- **`Bot`**
  - `id`: `string`
  - `name`: `string`
  - `avatar`: `string` (emoji or URL)
  - `persona`: `{ stance: string, domain: string, politeness?: number, snark?: number }`
- **`ReactionEvent`**
  - `botId`: `string`
  - `reaction`: `{ emoji: string, phrase: string, intensity?: number }`
- **`JoinEvent`**: The full `Bot` object.
- **`LeaveEvent`**: Contains `botId` only.

**Enums & Constraints:**

- **Stances:** `supportive`, `skeptical`, `curious`.
- **Domains:** `tech`, `design`, `finance`.
- **Phrase Budget:** ≤ 3 words.
- **Intensity:** A small discrete range (e.g., `-2` to `+2`) for potential UI flair later.

---

## 🎨 UI Scope (MVP)

- **Audience Grid:** A responsive card grid (`shadcn/ui Card`) that shows each bot's avatar, name, and stance/domain. Should feature smooth add/remove animations.
- **Reaction Stream:** A scrollable panel listing the most recent reactions (emoji + micro-phrase). Should auto-scroll to the latest event.
- **Controls:** A set of buttons to:
  - Seed initial audience
  - Trigger a join/leave event
  - Trigger a "reaction tick"
  - Reset the simulation
- **Accessibility & Polish:**
  - Use semantic headings and ARIA-friendly components from `shadcn/ui`.
  - Motion should be subtle (opacity/scale/translates) with short durations.
  - Respect `prefers-reduced-motion` settings if possible.

---

## 🤖 Client-Side "Mock Orchestrator"

During the mock phase, we will simulate what the server will eventually do via WebSockets.

- **Seeding:** On page load, spawn an initial audience of 2–7 bots.
- **Churn:** Every few seconds, randomly add or remove a bot, maintaining a total count between 2 and 15.
- **Reactions:** Every couple of seconds, select a random subset of present bots to emit a mock reaction.
- **State:** Use a simple client-side store (e.g., Zustand) for `bots[]` and `reactions[]`. This acts as a stand-in for server pushes and includes a reset function.

> **Note:** This mock orchestrator file should be clearly marked as temporary, as it will be replaced by a WebSocket subscriber in a future iteration. Keep a small, curated list of emojis and safe micro-phrases. The logic should be minimal; the goal is simply to visualize the cadence and feel of a live audience.

---

## 📄 Pages & Components

- **Home Page (`/`)**:
  - A title and short description.
  - A two-column layout:
    - **Left:** The `AudienceGrid` component.
    - **Right:** The `Controls` and `ReactionStream` components.
- **Component Suggestions:**
  - `AudienceGrid`: Lays out bot cards and animates joins/leaves.
  - `ReactionStream`: Renders recent reactions and auto-scrolls.
  - `Controls`: Contains buttons to seed, trigger churn, trigger reaction ticks, and reset.

---

## ✨ Styling & Theming

- Use `shadcn/ui` defaults (neutral background, subtle borders, soft shadows).
- Use rounded corners on cards and badges/chips.
- Keep typography simple: bold section titles and muted descriptions.
- Ensure the layout is responsive and looks good on both mobile (e.g., 3-column grid) and desktop (e.g., 5-column grid).

---

## 🚀 Running Locally

1.  Navigate to the `/frontend` directory.
2.  Install dependencies (e.g., `pnpm install` or `npm install`).
3.  Run the development server (e.g., `pnpm dev` or `npm run dev`).
4.  Open the app in your browser. The initial bots should appear on first load, and reactions will stream in periodically.
5.  Use the controls to simulate joins, leaves, and reaction bursts.

---

## 🚫 What’s Intentionally Stubbed

- No real Deepgram streaming; no real webhook.
- No real OpenRouter/LLM calls; all reactions are fake.
- No WebSocket connection; everything is driven by client-side timers (`setInterval`).
- No persistence; refreshing the page creates a new, clean session.

---

## 🤝 Backend Handoff Plan

This plan should be documented in `/backend/README.md`.

- **Webhook:** A `/webhooks/deepgram` endpoint will receive 2–5 second transcript segments.
- **Orchestrator:** A core service that maintains room state, per-bot state machines, engagement scoring, and handles joins/leaves.
- **LLM Integration:**
  - **Option A:** Per-bot session with a 60-second sliding summary window.
  - **Option B (cheaper):** A batched turn that returns reactions for all present bots at once.
- **WebSocket Topics:**
  - `audience:state`: Full sync on initial connect.
  - `audience:join`: Sends the full `Bot` object.
  - `audience:leave`: Sends the `botId`.
  - `audience:reaction`: Sends a `ReactionEvent`.
- **State Management:** In-memory for the hackathon; could be migrated to Redis later if needed.

---

## ✅ Acceptance Criteria (MVP)

- The grid displays between 2 and 15 audience bots at all times.
- Bots visually enter and exit the grid with tasteful animations.
- Reactions appear continuously without user input.
- Controls allow a demo operator to seed, churn, trigger reactions, and reset the state.
- The frontend code is organized in a way that makes replacing the mock orchestrator with a real WebSocket subscriber straightforward.

---

## ➡️ Next Steps (Post-MVP)

- Add a category selector and an “edgy” tone dial on the UI (client-state only for now).
- Replace the mock orchestrator with a real WebSocket subscriber.
- Connect the backend webhook to a real Deepgram stream to process live transcripts.
- Add a "coach summary" panel for periodic tips and end-of-talk feedback.
- Introduce a minimal safety filter for generated phrases and a curated emoji palette.
