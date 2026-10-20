# Internet multiplayer on Render

The repository includes a complete web service: `server.mjs` serves the game and its room/chat API on the same origin. No npm dependencies, database or build step are required. `render.yaml` provisions one Docker web service in Singapore with the free plan and `/healthz` health checks. No Render service has been created or deployed by this change.

## Launch

1. Push these files to the branch you want to deploy in `eclee26/budget-vice-city`.
2. Open the [Render dashboard](https://dashboard.render.com/), choose **New → Blueprint**, and connect that repository and branch.
3. Select the root `render.yaml`, review the service and plan, and create the Blueprint.
4. Wait for the web service to become healthy. Open its generated HTTPS address.
5. In the game choose **Online**, enter a name and room code, then **Join room**. Use **Copy invite** and share that HTTPS link. Friends open it, enter their names and join. **T** or **Chat** opens chat for everyone in that room.

The server binds to `0.0.0.0` and Render's `PORT`. Render terminates HTTPS. The Blueprint uses a single instance because room membership and chat are held in that process. For plan and Blueprint details see [Render's specification](https://render.com/docs/blueprint-spec) and [web-service port binding](https://render.com/docs/web-services#port-binding).

## Run locally

With Node.js 22 or later:

```sh
npm start
```

Open `http://localhost:8000`. For a different port set the `PORT` environment variable. `python -m http.server` and GitHub Pages still support single-player but do not provide multiplayer APIs. Use the hosted Node service's address for multiplayer.

## What is shared

- Up to 16 players in a room, with visible names, interpolated on-foot movement, driven car models/paint/steering/signals, player markers and a shared day/night clock.
- Room-wide chat, with a bounded recent history, sending feedback, draft preservation through reconnect, text-only rendering and message-rate limits.
- A fixed versioned city layout (`coast-2026-v1`) so buildings, roads and terrain agree between players.

NPCs, traffic density, parked-car ownership, jobs, police and career saves remain local. Remote players/cars are visual peers and do not collide or transfer vehicle ownership. Position updates are client-controlled; this is cooperative free roam, not an authoritative competitive simulation.

## Server behavior

Rooms are public to anyone with their code; names are nicknames, not verified accounts. Chat is visible to all connected room members. Session credentials stay in browser memory and authorization headers, never invite URLs or local saves. Invitations contain only the room code.

The service keeps the latest 40 messages per room in memory and removes empty rooms after ten minutes. A restart clears rooms/chat and ends existing sessions; players can join again. Local career saves are unaffected. There are no chat databases, analytics, external messaging services or per-player accounts. Join/message rate limits, request-size bounds, strict model/position validation, a 128-session server cap and an explicit static-file allowlist bound the service.

Inactive sessions expire after 30 seconds without client updates. The client retries interrupted event streams up to three times with backoff and offers joining again if recovery fails. Chat drafts remain in the input when a send fails. Background/suspended tabs can expire; single-player remains playable after leaving or disconnecting.

Render may suspend or restart a free service; allow time for it to wake before retrying a join. Choose the hosting plan in Render based on expected availability and player count. Horizontal scaling would require shared room storage/pub-sub and is not enabled here.

## Verification

```sh
npm run test:multiplayer
```

`tests/multiplayer-browser.py` tests independent browser clients against a running server. Set `MULTIPLAYER_URL` (default `http://127.0.0.1:8010`) and `CHROMIUM_PATH`; it also uses the existing test CDN cache. The Docker daemon must be running to test the container build locally. The Node service and browser networking are tested separately; a successful local test does not claim a live Render deployment.
