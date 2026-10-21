# Improvement iterations

## 2026-10-21 — shaped characters and coordinated wardrobe variety

Replace plain body cylinders with shared profiled surfaces, shaped heads/hairlines, rounded shoes, visible facial features and fitted clothing seams/collars. Ambient residents combine three builds, five hairstyles and four garments with quieter palettes. Explicit palette roles recolor base and shaded details by reassignment, preserving shared materials. The neutral height envelope, joint calibration, seated actor identity and saved progress stay intact. Body width now feeds standing clearance, pedestrian spacing, vehicle contact/avoidance and recovery rather than leaving broader figures on the former fixed footprint.

Visual review rejected oversized collar blocks, broad shoulder caps, a floating waist treatment and a disconnected hairline; these were corrected before final review. Sixty style/build combinations pass geometry, height, ground and neutral-radius checks. The final models use ten shared geometry families, with at most 56 parts and 3,564 triangles in the sampled variants. Crowd image/pose/color parity and resource reuse still pass. This is a clearer stylized population rather than commercial character art: faces remain simple and animation is still procedural. Overall provisional judgment remains 5.3/10. The next priority is authored mission/contact depth, while broader artwork and animation remain unfinished.

## 2026-10-21 — populated neighborhoods with shared crowd rendering

The prior seeded starting view had only three pedestrians within 70 m, out of a 64-person pool spread across the city. Nearby site selection now places 44 within that range, with personal space and static/vehicle clearance. As the player travels, a bounded simulation-time pass reuses distant uninvolved residents at hidden sites; active injuries, fleeing/recovery and conversations remain protected. Failed placement leaves the original position intact. Menus pause replenishment and zero/max population still reuses the existing pool.

Flatten ambient body parts into four fixed geometry batches, retaining original mesh geometry, articulated transforms, linear colors and shadows. Only active matrix/color ranges upload; the original hierarchy remains available for controlled appearance/cost comparisons. In the animated starting view, total draw calls fall from 3,281 to 1,507. Geometry submissions rise from about 1.246 M to 1.330 M because batching gives up per-part frustum culling. Pixel and joint/color checks pass, as do four-neighborhood hidden-recycling and buffer-reuse checks. This is a measured scene tradeoff, not blanket FPS certification. Stronger character/environment art and mission depth remain needed; the overall provisional score stays 5.3/10.

## 2026-10-21 — reactive ambient pedestrians

Pedestrians now predict approaching traffic from any car, retain their sidewalk route through an evasive reaction and avoid nearby people/the on-foot player. Rotated car footprints replace the broad collision radius that could falsely knock down a person standing beside a long vehicle. Short swept knockdown steps stop at walls; clear pedestrians recover in place while blocked ones wait. Brief paired conversations, idle looks/stretches, player greetings, blinking and bounded horn reactions use the existing rig with simulation-time clocks. Removing/reusing an actor clears social links; mission passengers remain separate.

Fourteen pure behavior checks and browser scenarios cover these interactions, route safety, paused animation, recovery and pooling. A 30-second maximum-density sample naturally enters walking, looking, stretching and talking states without creating graphics resources. Full gameplay and existing density/traffic checks pass. Visual review still shows simple human meshes and stiff procedural recovery. NPC/traffic behavior provisionally rises from 5.0 to 5.5, taking the weighted total to 5.25 (displayed 5.3), far short of 8.0. Local population distribution, stronger art and authored missions remain priorities.

## 2026-10-21 — original-body doors and a usable Van cabin

Replace door overlays with cached partitions of original skin, glass and hardware. Preserve normals/UVs, keep the roof/pillars fixed, add inward-facing liners and allow both front doors to open independently. Closed vehicles use the untouched original mesh; replacement meshes are created only when needed, follow body damage, and remain correctly masked through detail refreshes. Prepare glass shader variants alongside city materials before readiness. Exclude glass from police paint overrides. The Van now has transparent front windows, a hollow cabin, seats/floor and a forward-aligned POV; it remains a visibly simple box model.

Update passenger/driver door alignment and tuck the rider's knees during transfer. Existing stationary front-left exits, passenger mission/save handling and the complete desktop/touch suite pass. New pure tests verify clip-area/UV preservation and liner winding; seven-model browser checks cover real lower/glass openings, the other side staying closed, independent doors, LOD, damage, bounded render cost, original closed cost and stable reuse. This resolves an obvious overlay artifact but does not provide authored vehicle interiors, physical door collision or a fully collision-solved character animation. Overall judgment remains 5.2/10; ambient character behavior, authored missions and richer street art are the next priorities.

## 2026-10-21 — seated passengers and calibrated cabins

The passenger remains visible while riding, using the same rig through crouch/slide boarding, seated motion and alighting. Share metre-based floor/seat/roof calibration between sedan/Civic interiors, the passenger pose and cockpit seats. Adjust knee angles to keep shoes on the floor, lower the actor before entering the roof envelope, and keep transfer feet above the road. A belt, subtle head motion/blinking and four bounded skin/clothing/hair palettes improve the participant's presentation without new actors or label textures. Shared NPC materials are reassigned, never recolored globally.

The rider synchronizes after vehicle interpolation, inheriting heave/roll/pitch while the name label hides inside the cabin. Both cockpit and Driver POV keep their interior context. Save/restore now rebuilds the visible seated state. Twenty-one car/orientation geometry checks and 126 sampled transfer poses pass; a POV render A/B adds 19 calls / 1,386 triangles in the sampled view. Mission, full gameplay, 24 controller/preparation checks and the graphics/time-cycle diagnostic pass.

Visual review still shows a basic human rig and simplified cabin art. Exterior front doors remain overlays on an uncut body, so complete articulated openings/glass are the next needed refinement. The overall provisional score stays 5.2; visible riders alone do not justify a GTA V quality claim.

## 2026-10-21 — cold material preparation and stable night lighting

Prepare registered world styles before dismissing the loading screen, using temporary hidden one-instance proxies and the composer's actual linear output target. Compiling screen-output variants did not warm the programs used by the game; the retained implementation matches the real render path. Proxies are removed/disposed, shared geometry/materials and cell membership remain intact, and shader failures propagate to the existing startup error flow. Simulation timing/input reset after preparation so loading work does not advance a saved activity.

The prior 1,280 ms cold downtown frame falls to approximately 105 ms; 150 deduplicated proxies prepare five extra programs (51 → 56) in ~1,142 ms before readiness. The measured preset/day/night sequence then creates no programs or info-log queries. Keep the sun in the lighting list with zero intensity at night, stopping its shadow updates and shadow sampling without generating another program family. The strict one-second diagnostic now passes without excluding the cold frame or disabling shader diagnostics. Ordinary ~100 ms cold frames and overall initial loading latency remain limitations, and the overall rating stays 5.2.

Three focused preparation checks cover target encoding, registry deduplication, shared-resource retention, streaming-state stability and cleanup on both driver exceptions and invalid shader diagnostics. Actual desktop/touch RAF, streaming lifetime and full gameplay tests pass; a forced preparation exception leaves Retry available and never marks the load ready. Day/night images were inspected. These remain results on one GTX 1650, not broad hardware certification.

## 2026-10-21 — passenger job and verification correction

Added a full passenger job: named waiting actor/label, separated curbside destinations, two-second stopped/aligned boarding and exiting with an animated right door, path checks against scenery and every vehicle, a comfort/time fare, actionable blocked-door feedback, failure conditions and safe stage/comfort persistence. One actor and label texture are reused across jobs. The rider is currently hidden while aboard; a proper seated pose/cabin presentation is a remaining quality gap. The mission raises interactivity provisionally to 5.5 and the weighted total to 5.20, still displayed as 5.2.

Nine focused state-machine checks and the browser mission checks cover pickup/drop-off, driving penalties, payout once, cancellation/timeouts/pursuits/recovery/car abandonment, corrupt saves, resource reuse and three touch layouts. Navigation now sits inside the activity panel, clearing the fare/comfort display; portrait and landscape panels clear the map and driving controls.

Visual review found that raw Windows CRLF line endings bypassed LF-only JavaScript fixture hooks. Normalize line endings and assert hook insertion in the passenger, character, sandbox and graphics tests. Repeated passenger/character/sandbox checks pass with the intended stopped loop. The normalized graphics diagnostic exposes a separate 1.28 s cold downtown High frame in shader info-log queries; retain it as a failure, not a hidden warm-up. A normalized real-loop preset repeat passes with 53 programs and no multi-second Low stall. The original before/after program-variant evidence remains historical evidence of a real blocking call, while the new normalized reports supersede claims about deterministic capture timing.

## 2026-10-21 — preset-switch shader stall

Reproduced a 14,566 ms first-Low render. Chrome's CPU profile attributes approximately 14,428 ms to the native `getProgramInfoLog` call; Low created 30 extra shader programs (53 → 83). This replaces the earlier unproven shader/driver attribution with direct timing evidence at the blocking call.

Kept the sun's shadow-light shader configuration stable across presets. Low stops shadow updates, disposes the shadow render target and uses a uniform bias to reject shadow sampling; Medium/High restore normal bias, map size and updates. Shader error reporting remains enabled. The first Low render now measures 27.2 ms, with zero new compile/link/info-log calls and a stable count of 53 programs. High/Low captures were inspected for lighting and shadow restoration.

Live RAF tests include every switch interval from before applying settings, with no warm-up exclusion. Both desktop and 390×844 touch-layout tests pass repeated High → Low → Medium → High → Low switches, stable program counts, map release/restoration and shader diagnostics. These are GTX 1650 results, including the touch-layout test; they do not establish actual phone performance. Performance provisionally rises to 6.0, putting the weighted assessment at 5.15 (rounded 5.2), still well short of the 8.0 target.

## 2026-10-21 — character movement and chase camera

Weaknesses: keyboard tank steering, diagonal/input inconsistency, broad circular car exclusions, automatic repeat jumping, foot sliding against obstacles and cameras passing through scenery.

Added shared camera-relative movement, smooth starts/stops and facing changes, normalized diagonal input, analog speed, radius-aware wall sliding, rotated car collision/separation, single-press buffered jumping, distance-based gait, landing compression, static boom obstruction and saved on-foot heading. Instructions now distinguish keyboard and touch. Twelve controller checks cover directions/orbits, speed, braking, analog input, walls, rotated cars, jump height/repeat/buffering, blocked animation, camera clearance and safe car separation. Browser checks exercise real keyboard input, orbit-relative movement, touch, jump hold and saved heading, with desktop/phone captures.

Self-assessment: the inspected character/world still looks rudimentary next to GTA V. Character movement provisionally rises from 3.5 to 4.5, moving the weighted score from 5.0 to 5.1. The user target is now 8.0; it has not been achieved. Broader authored art, mission depth, pedestrian behavior and the known preset warm-up stall remain meaningful gaps.

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


## 2026-10-22 — Last Light and 1999 Civic Si

Added a connected authored mission: meet Inez, choose a careful/urgent run, collect and carry a controller, load a stopped eligible car, drive it to the clinic, unload and hand it to Dr. Vale. Cargo condition and deadline affect the first-completion payment. Serious pursuit, loss/damage, recovery, incapacitation and cancellation end the run without a reward; completed replays pay nothing. Existing services/jobs cannot conflict with the run. Named actors and props reuse their resources. Physical carrying slows movement and extends clearance; hands reach the case handle.

Imported the user-supplied blue 1999 Honda Civic Si without modifying the GLB. Normalize its axes and metre scale, animate four separate wheel assemblies and the source steering wheel, use its cockpit in first-person views, partition original door surfaces, calibrate lamp origins, retain save/multiplayer identity and provide a Vehicle-menu map locator. The model remains separate from the existing 1997 SiR. Added an optional-asset decode fallback and bounded loading, local loader/license files, attribution links and Docker asset packaging. Existing deterministic fixtures now poll readiness independently of their disabled animation loop.

The overall subjective score remains 5.3/10. The visible car asset is substantially more detailed, but the rest of the world, character animation and mission staging still have major gaps.
