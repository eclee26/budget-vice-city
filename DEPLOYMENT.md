# Hosting multiplayer

The repository includes a complete web service: `server.mjs` serves the game and its room/chat API on the same origin. No npm dependencies, database or build step are required. `render.yaml` provisions one Docker web service in Singapore with the free plan and `/healthz` health checks. No Render service has been created or deployed by this change.

## Ubuntu with Docker Compose and existing Nginx

The default `compose.yaml` starts only the game. It binds `127.0.0.1:18080` on the host, leaving public ports 80/443 to your existing Nginx and other apps. This configuration assumes Nginx is installed directly on Ubuntu. Set a different unused `GAME_PORT` in `.env` if 18080 is taken.

Inside the latest project checkout:

```sh
cp .env.example .env
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:18080/healthz
```

Add `sudo` to Docker commands if required by your installation. If upgrading from the earlier Caddy-based stack, use `docker compose up -d --build --remove-orphans` once to remove that stack's old proxy container. Other Compose projects are unaffected; certificate volumes are retained.

Point your game's subdomain DNS to the server. Copy the included site example to a new Nginx site; do not replace your global configuration or other apps' site files:

```sh
sudo cp nginx/game.conf.example /etc/nginx/sites-available/budget-vice-city
sudo nano /etc/nginx/sites-available/budget-vice-city
```

Replace `game.example.com` with your domain. If you changed `GAME_PORT`, use that same port in `proxy_pass`. Enable the new site using Ubuntu's normal sites-enabled layout:

```sh
sudo ln -s /etc/nginx/sites-available/budget-vice-city /etc/nginx/sites-enabled/budget-vice-city
sudo nginx -t && sudo systemctl reload nginx
```

Keep your existing HTTPS/certificate workflow. If it uses Certbot's Nginx integration, obtain the new domain's certificate using `sudo certbot --nginx -d game.yourdomain.com` after its DNS and HTTP site work. Then open the HTTPS game address and join a room. The example preserves the public Host and authorization header and disables buffering/caching for the multiplayer event stream. See [Nginx proxy buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering).

If your existing reverse proxy is **also a Docker container**, its `127.0.0.1` points to itself. Connect that proxy and the game to an existing shared Docker network and use `http://game:8000` (or a unique network alias) as the upstream instead. Do not use the host-local upstream example unchanged inside a container. Shared-network names/aliases depend on your server's proxy setup.

To update the app later:

```sh
git pull
docker compose up -d --build
```

Recreating the game ends current rooms/chat; browser career saves remain. Keep one game instance because room state is in memory. You do not need to open port 18080 publicly. The public domain/HTTPS remains owned by Nginx.

### Optional dedicated-server Caddy setup

For a separate server where ports 80/443 are available, set `SITE_ADDRESS=game.yourdomain.com` in `.env`, point DNS to it, and run:

```sh
docker compose -f compose.yaml -f compose.caddy.yaml up -d --build
```

This adds Caddy HTTPS and persistent certificate volumes. Do not enable this optional proxy alongside another service already listening on those ports.

Both base Compose configurations (defaults and `.env.example`) and the optional Caddy override validate. Container startup and live Nginx validation were not performed on this Windows workspace; its Docker Linux daemon is unavailable.

## Render launch

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
