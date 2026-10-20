# Test results — 2026-10-20

The actual maintained game was tested in Chrome using Playwright with the project's existing Three.js r128 scripts cached locally for repeatability. Screenshots were opened and visually inspected. Generated images and detailed JSON remain in ignored `tests/artifacts/`.

## Functional verification

| Check | Result |
| --- | --- |
| `node tests/vehicle-physics.cjs` | All 18 pass: acceleration/braking, steering/reverse, contacts, tyre support, stability and render-rate independence. |
| `python tests/gameplay-browser.py --assets .test-tools/cdn-cache` | Pass: desktop/mobile, POV, vehicle entry/exit, lights/headlights, activities, input, interpolation, map, recovery, saves, denied/corrupt storage, cross-tab conflicts and loading failure. No browser/shader errors. |
| `python tests/gameplay-browser.py --assets .test-tools/cdn-cache --only-structures` | Pass over seeds 17 and 2026: nine reserved lots, five house variants, clear roads/sidewalks and accessible civic driveways. |
| `node tests/sandbox-browser.cjs` | Pass: career rewards, getaway escape gating, pursuit routing/driving, service charges/refusals, capture/escape, reload, pause and narrow layouts. |
| `python tests/streaming-browser.py` | Pass: high/low cell caps, actual loading/unloading, terrain/road separation, mesh/support height agreement, hill suspension/slope, parking capacity, car LOD and stable repeated-travel resources. |
| `python tests/world-browser.py` | Pass: eleven day/dusk/night views, district/style/footprint coverage, vegetation bounds and road/sidewalk collision clearance. No browser/shader errors. |
| JavaScript syntax / Python parsing | Inline game script and all runtime JavaScript parse; all five Python test files parse. |

No production bundler exists or was added. The deployable artifact remains the static project root with its HTML, CSS and runtime scripts, exercised directly by the browser tests. This is not a claim that an absent `npm build` command ran.

## Rendering and lifetime evidence

The seeded eleven-view review originally peaked at **2,279 draw calls / 2,175,495 triangles**. The final review peaks at **1,644 draw calls / 819,959 triangles**. The scenario-selection method and seed are unchanged, but the city and selected building instances changed; this is a scene-suite comparison, not a pixel-identical benchmark or an FPS claim.

The final world has four districts, nine office/apartment/warehouse variants, 37 wider buildings, two 14-space public parking lots, two garden hills, 95 garden/landscape trees plus 98 street trees, seven bus shelters and two lifeguard towers. Small props/foliage retain shared geometry and existing PBR materials.

The repeated-travel fixture has 37 source cells. Low detail remains within six active cells; its three identical trips finish at **243 geometries, 113 textures, 204 live instance buffers** each. The test records **110 loads and 102 unloads** without duplicating source definitions or changing collision. This demonstrates stable resources over the tested loops, not a proof against every possible long-session leak.

Reviewed captures include `world-residential-day.png`, `world-downtown-day.png`, `world-fuel-dusk.png`, and `streaming-garden.png`, `streaming-parking.png`, `streaming-skyline.png`, `streaming-garden-night.png`. The second garden iteration deliberately opens the summit view and adds supported signage/collision furniture. Screenshots are test views, not a promise of a particular user's GPU quality.

## Performance methodology and limitations

The reported browser GPU is **NVIDIA GeForce GTX 1650 via ANGLE / Direct3D11**, with WebGL2. Live samples use a 1280×720 viewport, three seconds of warm-up and approximately ten seconds of RAF sampling per scene, with the actual simulation/traffic/render loop running. Headless RAF cadence can exceed a display's refresh rate; these are this host's browser throughput measurements.

First live sample: High coast **111.8 FPS** (p95 13.9 ms); High downtown **87.8 FPS** (p95 20.8 ms); Low downtown **59.7 FPS** (p95 13.9 ms). The Low run included one long frame and lasted 12.8 seconds rather than ten; it is retained as `live-world-performance-first.json`. It must not be silently omitted or described as perfectly stable frame pacing. An isolated repeat and the final CPU report are in `live-world-performance.json` and `performance-world-streaming-final.json`; see the appended results below.

The CPU tick/interpolation fixture is separate from GPU FPS. The first world-pass profile ran alongside other checks and measured 3.10 ms median tick / 0.176 ms interpolation; it is not a valid isolated before/after comparison with the earlier 0.927 / 0.079 ms report. Do not claim a CPU speedup from those different workloads.

No modest-GPU or mobile-hardware FPS certification was performed. Browser/mobile interaction tests do not substitute for device performance tests. The subjective GTA V comparison remains below the declared target in `GAME_SCORECARD.md`.

## Static audit

The premium UI scanner ran in strict mode and reports 22 `affordance.actionless-button` findings. They are the existing documented programmatic event-binding false positives plus generated historical HTML fixtures; there are no other rule types. Buttons bind in `DrivingGame.bind`, `OpenWorld.buildUI` and the core input setup, and the actual actions pass browser tests. The scanner did **not** return a clean exit; its raw output is retained in `tests/ui-audit.json`. No unrelated inline event handlers were added to satisfy the scanner.

## Isolated repeat and render-path diagnosis

The final isolated CPU sample measured **1.475 ms median simulation tick** and **0.0233 ms interpolation** with 35 cars. The final live repeat measured High coast **104.4 FPS** (p95 14.0 ms, max 20.9 ms) and High downtown **87.3 FPS** (p95 20.9 ms, max 55.5 ms). Low downtown averaged **55.5 FPS** because of an **8,068.7 ms** long frame; its p95 was 7.2 ms. The first and repeat reports are both retained.

An instrumented Low-only diagnostic found a **7,283 ms `comp.render` call during graphics warm-up**, with no corresponding long simulation step or chunk update. After that warm-up, its sampled window averaged **137.3 FPS**, p95 7.2 ms, max 76.5 ms. This localizes the major delay to the render path. Synchronous shader compilation/driver preparation in the pinned renderer is a plausible explanation, not a proven attribution without a GPU trace. The diagnostic is retained as `live-world-performance-low-diagnostic.json`.

**Remaining limitation:** changing graphics presets can cause a multi-second rendering warm-up stall on this host. Steady-state throughput exceeds the 30 FPS fallback target in the tested views, but stable preset switching and broad hardware performance are not certified. Do not describe the current game as having flawless frame pacing or as meeting the full GTA V comparison target.

## Vehicle-exit regression

`python tests/gameplay-browser.py --assets .test-tools/cdn-cache --only-exit` passes: four models × four headings, front-left placement, gear preservation, a reverse-gear exit, blocked-left refusal despite a clear right side, and outward door motion. Position drift was below the 1e-6 m assertion threshold during the exit and one second afterward, including held brake input during the transition. No browser errors were reported. The test captures `vehicle-front-left-exit.png`.

## Vehicle-indicator regression

`python tests/gameplay-browser.py --assets .test-tools/cdn-cache --only-signals` passes all eight models and 24 model/mode combinations. It checks a consistent 900 ms cycle, left/right isolation, hazards, immediate off, repeated per-tick detail refreshes, distant-body hiding/restoration, keyboard toggles, paused-menu buttons and pause timing. Signals-off remains dark through subsequent simulation ticks. No browser errors were reported.


## Wider sidewalks and increased population

Sidewalk width increased from 2.2 m to 3.2 m. Desktop population is 64 pedestrians / 24 moving traffic cars, plus starter and parked cars; mobile caps are 48 / 18. The seeded world contains 48 continuous sidewalk routes. Initial movement verification found 52 sidewalk walkers, of which 51 moved over 3 m during 600 ticks without entering asphalt or buildings.

Structure regression passes seeds 17 and 2026 with all nine reserved civic lots and clear road/sidewalk footprints. Traffic signal/narrow-road regression passes, including stop-line gaps and green-light resumption. Eleven world views pass geometry/render budgets with no browser or shader errors (maximum 1,958 draw calls and 828,867 triangles). The first CPU benchmark ran alongside browser checks, so its 4.995 ms median tick is a contended sample rather than an isolated performance comparison.


Final population regression passes: 64 desktop pedestrians, 24 traffic cars, 48 total cars; all 24 traffic cars advanced more than 5 m in 600 ticks. Mobile confirms 48 pedestrians and 18 traffic cars. The sidewalk screenshot was inspected at street level. The isolated CPU sample with 49 cars (including a dynamically spawned vehicle) measured 3.828 ms median simulation tick and 0.0394 ms interpolation. This is higher CPU cost than the earlier smaller population; it is not a GPU FPS measurement. Reports are retained in `tests/artifacts/performance-population-isolated.json` and `tests/artifacts/population-sidewalk.png`. Inline JavaScript syntax and `git diff --check` pass.


## Road material realism pass

Road wear was reviewed at driving height on coast, local and harbor streets, day/dusk/night, High and Low quality, and a 390 px viewport. All six renders complete with no browser/shader errors. Evidence: `road-wear-{coast,local,harbor,night,low,narrow}.png` and `road-wear-review.json` in `tests/artifacts`. The pass uses one shared 1024² packed texture and extends the existing road shader; it adds no road meshes/draw calls. All eleven existing world-render views pass the 2,300 draw-call / 2.2M triangle budgets; maximums are 1,852 calls and 1,021,524 triangles. Road/building clearance checks pass.

Inline JavaScript syntax passes. The strict premium UI audit retains the same 22 existing `affordance.actionless-button` findings and no unresolved items; these documented programmatic-handler false positives remain in `tests/ui-audit.json`. The scanner is not clean. No controls or application flows changed in this material pass.


Live rendering with the updated roads and larger street population, 1280×720 High on the available GTX 1650: coast 61.1 FPS (p95 20.9 ms), downtown 50.2 FPS (p95 27.8 ms), with no frames over 50 ms in either ten-second sampled window. Raw evidence is `tests/artifacts/live-road-performance.json`. This is host-specific steady-state evidence, not a universal FPS guarantee or a matched comparison isolating road-material cost. Previously documented preset-switch warm-up limitations remain applicable.


## Car-to-character scale correction

Character height now uses metre values instead of the old arbitrary rig multiplier. Player target: 1.80 m; NPC range: 1.65–1.88 m. This corrects the old player height of approximately 2.12 m and increases perceived car size relative to the player by about 18%. Vehicle physical dimensions remain aligned with their rendered geometry. Character contact shadows scale with their footprint and idle/walk cycles preserve the sole offset.

JavaScript syntax passes. The vehicle-exit regression passes all 16 model/heading combinations, reverse exit, blocked-left refusal and stationary parking-brake behavior with zero observed position drift. Browser scale measurements and street-level screenshots are retained as `character-scale-review.json` and `car-character-scale-{sedan,civic}.png` in `tests/artifacts`.

The final scale review measures the player at 1.799 m (idle breathing slightly varies the bounds), NPCs at 1.656–1.873 m for the seeded population, and a car-to-player size ratio increase of 1.1783×. Separate sedan and Civic screenshots were visually inspected. All 18 vehicle-physics tests also pass, including rotated/swept contacts, parking stability and render-rate independence.


## Adjustable population settings

`tests/population-settings-browser.py` passes: desktop defaults; native slider keyboard increments; zero and maximum values (128 pedestrians / 48 moving cars); current/last-used/parked-car protection; periodic replenishment after a traffic vehicle is claimed; three complete down/up cycles reusing the same actor identities; clear traffic placement at least 55 m away for live additions; 180 simulation ticks with finite traffic state after recycling; settings save/reload; clamping malformed saved numbers; accessible count text; and 390 px layout with 44 px range targets. Screenshots: `population-settings-desktop.png` and `population-settings-narrow.png` in `tests/artifacts`.

The complete gameplay browser suite passes after initializing all engine/suspension fields on dynamically added cars. Coverage includes POV, all front-left exits, all vehicle indicators, desktop entry/exit and activities, settings/storage failures and conflicts, predictive traffic, recovery/interpolation, headlights, mobile touch/layout, the live animation loop and startup failure/retry. No browser or shader errors remain. Core/gameplay JavaScript syntax and `git diff --check` pass.

The strict premium UI audit retains 22 existing `affordance.actionless-button` programmatic-binding false positives, zero unresolved items, and no new rule categories. Its non-clean report remains in `tests/ui-audit.json`. No new buttons were introduced; population controls reuse the existing native range design. Maximum density increases CPU/render work; it is an optional user setting, not a guarantee of the same FPS as default density.


## Internet multiplayer and global chat

`node --test tests/multiplayer-server.test.mjs` passes both server integration tests using actual loopback HTTP/event-stream connections: room membership/capacity, authenticated pose updates, prevention of name impersonation, room-wide chat delivery and isolation, text handling, chat rate limits, origin validation, stale-session expiry and denial of private filesystem paths. Server credentials never appear in invite URLs.

`tests/multiplayer-browser.py` passes with three independent browser contexts against the actual Node game service: two clients in one room and a third in another. It verifies identical city maps, room presence, text-only chat (including hostile markup rendered literally), movement hotkeys ignored while typing, offline/reconnect behavior, preserved drafts, history deduplication, remote driven-car/on-foot representation outside local simulation arrays, mobile chat geometry, explicit leaving/resource cleanup, retryable join failures and accessible required-field feedback. Screenshots are `multiplayer-room.png`, `multiplayer-global-chat.png` and `multiplayer-chat-mobile.png`; machine-readable evidence is `multiplayer-review.json` in `tests/artifacts`.

The complete gameplay browser suite also passes with the new scripts: POV, 16 vehicle-exit combinations, all eight indicator models/24 modes, activities, save failures/conflicts, traffic, recovery/interpolation, headlights, desktop/mobile controls, actual render-loop driving/pause and startup error/retry. No browser or shader errors were reported. JavaScript syntax and `git diff --check` pass.

The strict UI audit retains the same 22 documented `affordance.actionless-button` programmatic-binding false positives, zero unresolved findings and no new rule types. The audit is not clean; raw evidence remains in `tests/ui-audit.json`.

`render.yaml`, `Dockerfile` and `DEPLOYMENT.md` prepare a single Render web service, using same-origin HTTPS behind Render's TLS proxy and ephemeral in-memory rooms/chat. No public Render service has been launched. The local Node runtime is tested; the Docker container build was not run because Docker Desktop's Linux daemon is unavailable on this host. The 16-player limit is configured, not a 16-client load certification. NPCs, career systems and vehicle ownership remain local; remote players do not collide.
