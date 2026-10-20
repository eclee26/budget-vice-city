# Improvement iterations

## 2026-10-20 — driving sandbox and vehicle presentation

Added wanted heat, bounded police pursuit, paid jobs including Hot cargo, cash/health consequences, service transactions and local career progress. Replaced the coarse Kaze R/Sports shells with curved vehicle construction. Removed the nearby-car wireframe at the user's request while retaining the entry prompt.

Evidence: 18 physics checks; the existing gameplay suite and `tests/sandbox-browser.cjs`. The sandbox tests exposed overlapping service-selection ranges; prompt/action now select the same nearest entrance.

## 2026-10-20 — world streaming and environmental structure

Weaknesses: globally resident building detail; flat, randomly filled grass parcels; limited off-street destinations and a shallow skyline.

Added `world-streaming.js`, lazy 80 m building/facade cells, skyline LOD, preset detail budgets, instance-buffer disposal, distant vehicle proxies and pedestrian/vegetation distance budgets. Added two public parking lots/billboards, two terrain-backed gardens, taller downtown towers and distant headlands.

The first pass's streaming radius would retain too much of this compact city. Replaced radius-only selection with a hard 6/9/12-cell budget and a 12 m preference for already loaded cells, preserving nearby detail without rendering the whole map at maximum quality.

## 2026-10-20 — playtest fixes and refinement

The terrain support check initially failed because its brake input automatically selected reverse and drove the test car off the hill. Corrected the fixture to use the handbrake, then checked stable suspension height and terrain pitch. Added furniture collision and support posts, made the garden paths continuous, and replaced random interior trees with deliberate ring planting so summit seating stays visible.

Added six parked-car placements with driveway/occupancy clearance, skipped invisible wheel-pose work, and retained automatic camera/vehicle behavior from the regression suite. Reviewed day, dusk and night renders. The repeated-travel test records actual loads/unloads and stable texture/geometry counts across identical loops; details and live performance are in `GAME_TEST_RESULTS.md`.

Browser processes required the host's approved browser execution context; a restricted run stalled and was stopped. Public Three.js scripts were cached in ignored test tooling to remove CDN variation from repeatable checks. Runtime loading behavior still uses the project's existing public CDN scripts.

## 2026-10-20 — isolated performance diagnosis

The final functional, sandbox, world, terrain and lifetime suites pass. A first live sample exposed a large Low-preset frame. An isolated repeat reproduced an 8.07-second maximum frame; it was retained rather than excluded. A Low-only instrumented diagnostic located a 7.28-second call in the rendering path during warm-up, while simulation/chunk-update wrappers showed no comparable stall. Settled Low rendering then averaged 137.3 FPS on the GTX 1650. High samples were approximately 104 FPS coast / 87 FPS downtown at 720p. The preset-switch warm-up issue remains open; source, images, raw reports and a precise continuation priority are preserved.

## 2026-10-20 — front-left vehicle exits and backward-creep fix

Exits now always select the front-left door and place the character beside its centre. A blocked left exit gives feedback and keeps the player in the car. Front door panels swing outward. Entry retains the existing nearest-clear-side behavior.

Root cause of backward motion: the transition supplied a held service-brake input for approximately 57 simulation ticks; after 18 ticks, the automatic gearbox interpreted it as a reverse request. Transition vehicles now receive parking-brake hold with zero throttle/service-brake input; residual throttle and wheel angular velocity are cleared at the start, and the existing gear is preserved.

The new `--only-exit` browser regression passes 16 model/heading combinations, a reverse-gear exit, blocked-left/right-clear refusal and outward door motion. No vehicle position drift was measured during or for one second after an unobstructed exit. Held controls during the animation cannot accelerate or reverse the car. This parking-brake fix does not make vehicles immovable under external collision impulses.

## 2026-10-20 — uncontrolled indicator flashing

Root cause: full-detail car restoration set every cached child visible, including all four indicator meshes, every six ticks. This overrode signals-off and one-sided signals, producing repeated flashes at the detail-update rate. Full-detail restoration now excludes indicator meshes. A shared visibility controller owns side selection and a 54-tick cycle (450 ms on, 450 ms off) using simulation time; input toggles update meshes immediately, including while paused. No wall-clock timing remains in the indicator effect.

The dedicated browser regression passes all eight models and 24 mode/model combinations, repeated forced detail refreshes, hidden/visible body changes, immediate off, real keyboard/menu actions and paused phase behavior. No browser errors were reported.
