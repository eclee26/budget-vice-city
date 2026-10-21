# Existing-game improvement plan

Updated 2026-10-21 (Asia/Manila). Current user target: 8/10 relative to GTA V, with repeated implementation, playtesting and honest self-assessment. This remains a subjective target, not a measured equivalence.

## Architecture and boundaries

The maintained source is a static HTML/CSS/JavaScript application. `index.html` owns the Three.js r128 WebGL renderer, sampled road graph, procedural vehicles, fixed 60 Hz simulation, traffic/pedestrians, cameras and postprocessing. `vehicle-dynamics.js` supplies planar rigid-body contacts, swept collision tests, four-wheel spring/damper supports and tyre slip. `structures.js` owns reserved civic lots and spatial collision buckets; `traffic-signals.js` owns timed signals. `world-detail.js` supplies district architecture, procedural textures and vegetation/prop batches. `gameplay.js` owns the menu, controls, activities and versioned local saves. `open-world.js` supplies police, cash and services. `pedestrian-ai.js` owns ambient intent and bounded neighborhood replenishment; `pedestrian-crowd.js` flattens the existing rigs into shared geometry batches; `character-art.js` supplies shaped character surfaces and palette roles; `vehicle-doors.js` owns shared door partitions and animation state.

The browser code is served directly, with no asset build pipeline, GLTF loader or third-party physics engine. Preserve the working stack and existing road/collision ownership. Physics and collision remain resident when rendering cells unload. The entire maintained tree, documentation and browser/physics tests were inventoried; `.test-tools` contains third-party test runtimes and `tests/artifacts` contains generated evidence.

## Implemented world pass

1. Stream building/facade instance buffers in 80 m cells, capped at 6/9/12 detailed cells by graphics preset; retain inexpensive skyline representations beyond them.
2. Release instance buffers on unload, reuse geometry/materials, amortize new cells during travel and retain all collision masks independently.
3. Add two reserved, accessible, 14-space parking lots with billboards, fixtures, wheel stops and parked cars.
4. Reserve two designed garden areas with 3.4 m / 2.6 m hills, circular paths, summit seating, ring planting and physical furniture/rock/trunk collisions.
5. Share hill height between the terrain mesh, wheel contact support, character/prop elevation and vehicle slope presentation. Keep roads and civic driveways flat.
6. Strengthen downtown with occasional taller towers; frame the southern horizon with distant headlands.
7. Merge static car details, provide simpler distant vehicle bodies, cull distant pedestrians/vegetation and skip interpolation of hidden wheel detail.

## Verification and next work

Run the physics suite, existing desktop/mobile gameplay suite, two-seed structure checks, seeded world captures, repeated-travel resource checks, CPU benchmark and live GPU samples. Inspect rendered images. Fix failures before reporting completion; keep performance hardware/viewport/preset explicit.

The GTA V comparison is a subjective design target, not an automated test result. Further work toward that target should prioritize richer facade/ground art, varied pedestrian behavior/animation and stronger mission design. Full 3D airborne/rollover physics, building interiors and commercial-quality authored assets remain missing. No verified overall 8/10 claim is made.

## Character control pass — 2026-10-21

Implemented a shared camera-relative keyboard/touch controller, diagonal normalization, bounded facing turns, smooth speed changes, radius-aware wall sliding and rotated rectangular vehicle clearance. Cars overlapping the player separate to a clear nearby face without pushing through static walls. Jumping requires a new press, buffers a press just before landing and uses a roughly 1.1 m apex; the gait follows travelled distance and blends down when blocked. Surface-sensitive synthesized footsteps and a landing sound follow movement and respect mute/focus/menu state. The chase camera retracts when its boom crosses static collision or terrain. On-foot camera heading persists in saves. Touch and keyboard instructions match the active controls.

The camera uses the world's existing horizontal collision footprint rather than height-aware geometry. It can retract conservatively near short props. There is no character vaulting, swimming, articulated ragdoll or full character animation library. Next character work should address these actual gaps rather than inflating the score for passing tests.

## Precise continuation priority

The preset-switch blocker is resolved on the available GTX 1650. A CPU profile attributes 14.4 seconds to `getProgramInfoLog` while r128 initializes 30 new shadowless program variants. Keep the sun in the shadow-light list across presets, stop its shadow updates and release its map on Low, and use a depth-bias uniform to skip shadow texture lookups. The post-fix switch creates no new programs. Shader diagnostics stay enabled. High/Medium rebuild their appropriately sized map and restore ordinary bias. Both live and instrumented tests retain the first frame after each change.

The cold downtown diagnostic also now passes on the tested GPU. `WorldStreamer.prepareMaterials` creates hidden one-instance proxies for distinct registered styles and compiles against the composer's linear target before readiness. The 1,280 ms first High frame becomes ~105 ms, with zero new compile/link/info-log calls in the measured sequence. Preparation is explicitly recorded (~1.14 s) as loading cost; the test's one-second gate remains unchanged. The sun stays visible with zero intensity at night, while sun-shadow updates/sampling stop, preserving the same lighting program layout across the time cycle. Failed preparation keeps the startup Retry flow available. Cold-frame upload/scene work and overall initial-load latency remain future performance work.

Seated passenger presentation is implemented: one reusable actor fits seven car cabins, shows a belt and subtle head/blink motion, follows rendered roll/pitch/interpolation, and restores visibly while aboard. Floors/front seats now share metre-based calibration; both cockpit and Driver POV show the interior. Boarding lowers the actor before sliding into the seat, and exiting reverses that transfer. Four bounded outfit palettes reuse rig/label resources. Geometry checks cover 21 model/orientation combinations and 126 transfer poses. The sampled POV render adds 19 calls / 1,386 triangles; this is not general FPS certification. The rig and cabin art remain simple. Front doors now partition the original skin/glass and reveal actual openings; closed vehicles retain their original meshes and ordinary render cost. The Van has a hollow front cabin with windows and aligned forward seating/camera. Shared cut geometry prepares during loading, while replacement meshes are created on demand.

1. Strengthen character/environment art so the busier streets have convincing variety. Local residents and hidden neighborhood replenishment are implemented, with unchanged rig geometry/colors rendered through four shared batches. Current faces, silhouettes, clothing, get-up poses and repeated facades remain clear quality gaps; density alone does not resolve them.
2. Add authored mission/character variety beyond the procedural passenger route and existing checkpoint activities. Improve navigation and compact the dense phone HUD as part of real playtesting rather than increasing scores for test coverage alone.
3. Extend performance testing to actual phones and a modest physical GPU when available. Touch-layout tests run on the same desktop GPU and are not phone hardware certification. Continue useful game work while that external coverage is unavailable.

## Articulated door pass — 2026-10-21

Original front skin, side glass, handles and mirrors hinge together. Fixed roof/pillars remain attached to the body; opaque liners face inward. Both doors work independently, source visibility survives LOD refreshes, and fragments follow existing body damage transforms. Closing restores the exact original geometry and draw cost. Pure geometry checks and seven-model browser ray tests verify actual lower/glass apertures, opposite-side closure, damage transforms and repeated reopening without cache growth. The complete gameplay and passenger suites retain their previous entry/exit, mission, save and layout behavior. This is still a procedural approximation: simple inner panels/rigs, no latch/hinge hardware or physical door collision, and no fully collision-solved character transfer. These limitations remain visible and do not justify raising the overall 5.2/10 assessment.

## Ambient behavior pass — 2026-10-21

Replace radius-based pedestrian impacts and player-only fleeing with rotated-body contact and relative-motion prediction for all cars. Add local personal space, route-preserving evasive motion, bounded horn glances/startles, conversations, idle looks/stretches and brief greetings. Use only simulation time and existing rig resources; release removed partners and reset reused actors. Knockdown movement sweeps short steps against city collision. A clear actor gets up in place; blocked recovery waits, with relocation limited to hidden distant actors. Thirteen traffic/social/recovery checks plus a separate on-foot personal-space check pass, as do actual-world behavior, density, full gameplay and CPU checks. Natural idle/conversation states appear in a 30-second maximum-population sample. These are bounded local behaviors, not dialogue, schedules, road crossings or ragdoll physics. The NPC/traffic category provisionally rises to 5.5; the weighted total becomes 5.25, displayed as 5.3. The 8.0 target remains unmet.

## Neighborhood population and crowd rendering — 2026-10-21

Initial residents use clear nearby sidewalk/green-space sites. Replenishment reuses far, uninvolved residents, limits placement attempts to three per quarter simulation second, and chooses locations outside the current view or beyond the draw range. Visible/nearby actors and active injury/flee/social states remain protected; menus pause replenishment. Initial distribution, four-neighborhood travel, mobile draw-range logic, safe spawn spacing and zero/max pool cycles have dedicated checks. Crowd rendering preserves the original meshes, joint matrices and linear colors, using four fixed instanced buffers and active upload ranges. Controlled animated renders compare against the original hierarchy; no simplified replacement model is used. Conservative batch culling increases submitted triangles even while reducing draw calls. The current people/world art and animation still look basic, so the provisional 5.3/10 assessment stays unchanged.

## Character surface/wardrobe pass — 2026-10-21

Shared profiled body/limb surfaces, sculpted heads, a parametric hairline, rounded footwear and fitted garment details replace the simplest primitives. Ambient variants combine three builds, five hairstyles and four garment types without extra random draws affecting the existing appearance stream. Explicit palette roles recolor shaded clothing details and skin/hair consistently while keeping other actors’ materials unchanged. Standing radii scale with body width; spawn, avoidance, contact and recovery use those radii. Sixty shape/style combinations retain height/ground clearance and a fixed geometry vocabulary; passenger seating and existing gameplay retain their controls. Visual review corrected oversized collars/shoulders and a disconnected hairline before acceptance. The current art is more varied but remains plainly stylized; the provisional overall 5.3/10 assessment stays unchanged.
