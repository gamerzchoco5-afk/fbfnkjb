# Fake News Studio — Server (Stages 2–10 complete)

A Colyseus server that is the full authority over a match: room
creation/joining, live player sync, role assignment, the story, the
8-minute phase timer, and now voice chat permissions via LiveKit. The
frontend only renders what this server sends.

## Run it

```bash
npm install
npm start      # or: npm run dev   (restarts on file changes)
```

Listens on `ws://localhost:2567` by default (override with `PORT`).
`GET /health` returns `{ ok: true, voice: true|false }` — the `voice` flag
tells you whether LiveKit credentials were found at boot.

## Voice chat setup (Stage 7)

Voice is **optional** — the game is fully playable without it; the
Debate screen just falls back to its demo "speaking" animation and the
mic/speaker buttons stay harmless local toggles. To enable real audio:

1. Create a free project at [cloud.livekit.io](https://cloud.livekit.io)
   (or run your own LiveKit server).
2. Copy `.env.example` to `.env` and fill in `LIVEKIT_URL`,
   `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` from that project.
3. Restart the server — `GET /health` should now show `"voice": true`.

With that done, every player who joins a room gets a private
`voice_token` message right after joining, and the frontend uses it to
connect to a LiveKit room named after the Colyseus room's own id.

## What it does

- **`studio` room, 4–15 players**, host = first to join, random
  5-character join code in room metadata so clients can find it via
  `client.getAvailableRooms('studio')`.
- **Join/leave validation, server-side**: rejects joins once a match has
  started or the room is full; a non-host leaving before the match starts
  is removed from the lobby; a non-host disconnecting *mid-match* is kept
  in place (`connected: false`) so the grid/results don't break; if the
  **host** leaves at any point, the room broadcasts `host_left` and
  closes immediately, per the spec.
- **Role assignment (`src/roles.js`)**: on `start_game`, assigns roles
  using the exact distribution table from the spec (4–15 players) and
  privately sends each player only what their role is entitled to know
  (`role_assigned`) — their own story and named teammates, if any. Never
  put on synced state, so no client can inspect anyone else's role.
  **The Anchor's identity is public** (`state.anchorId`) since the spec's
  UI calls for a clearly-marked Anchor panel; team affiliations (Real /
  Fake / Manipulator) stay secret.
- **Story bank (`src/stories.js`)**: short, simple Hinglish (Hindi, Roman
  script) headline + two-claim pairs. Which claim counts as "real" is
  **not fixed in the data** — the server flips a coin per match
  (`handleStartGame`), so the sensible-sounding claim isn't reliably the
  true one and players can't learn to pattern-match their way to an answer.
- **Phase timer (`src/phases.js`)**: server-side `setInterval` broadcasts
  `phase_tick` once a second so every client shares exactly one clock.
  **Total match length is 8 minutes** (480s): the Anchor's two speaking
  turns stay at the spec's 60s cap each (120 total); the extra time over
  the original 5-minute cut went into the three discussion phases (120s
  each): `120+60+120+60+120 = 480`.
- **The Anchor's mic lock is real, not just a UI suggestion** (Stage 6):
  `applyAnchorMicPermission()` calls LiveKit's `updateParticipant` to
  flip the Anchor's `canPublish` grant every time the phase changes — a
  modified or bypassed client still can't transmit audio outside the
  Anchor's two speaking windows, because the media server itself refuses
  the track. No other player's permission is ever touched.
- **`submit_choice`**: validated server-side — only the Anchor's own
  client can submit, only after all 5 discussion phases have actually
  finished (`decisionStarted`), and only once (`decided`). Broadcasts
  `results` with the winner, both full stories, and everyone's role — all
  safe to reveal once the match is over.

## Project layout

```
src/
  index.js                  // boots the HTTP + WebSocket server, loads .env
  avatars.js                 // avatar/room-code helpers, kept in sync with the frontend's mock.js
  roles.js                   // ROLE_DISTRIBUTION table + assignRoles()
  stories.js                 // Hinglish headline + two-claim bank + pickStory()
  phases.js                  // the 8-minute, 5-phase timing table
  livekit.js                  // token issuance + server-enforced Anchor mic permission
  rooms/StudioRoom.js         // all room logic: join/leave, start_game, submit_choice, the timer
  rooms/schema/RoomState.js   // synced PUBLIC state only: code, started, anchorId, player list
loadtest.mjs                 // Stage 10 — see below
```

## Testing

### Manually, with the real frontend
Open the frontend in two or more browser tabs/devices — see its README
for the full walkthrough (create/join by code, confirm live lobby sync,
confirm each tab gets a different private role, confirm only the Anchor
can submit a choice, confirm results match across tabs).

### Automated — 15-player load test (Stage 10)
```bash
npm start            # terminal 1
npm run loadtest      # terminal 2
```
Spins up 15 simulated players (the spec's max room size) through a full
`start_game`, and exercises the edge cases a real session could hit:
- a 16th join attempt is rejected (room full)
- a non-host's `start_game` is ignored
- the exact 15-player role distribution matches the spec table
  (anchor 1 / fake 4 / real 9 / manipulator 1)
- a join attempt *after* the match has started is rejected
- a mid-match disconnect keeps that player's seat (`connected: false`)
  instead of corrupting the player list
- the host leaving broadcasts `host_left` and closes the room for
  everyone else

All of the above currently passes. Re-run it any time you touch
`StudioRoom.js` to catch a regression quickly without opening 15 browser
tabs by hand.

## What's still open

- **Reconnection**: a non-host whose connection drops mid-match has no
  path back in yet from the client side — their seat is held, but
  nothing currently lets them resume the same session.
- **Scale beyond one process**: this is a single in-memory Colyseus
  process; running many simultaneous rooms at real scale would want
  Colyseus's clustering/Redis presence support, which isn't set up here.
