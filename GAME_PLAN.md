# Existing-game improvement plan

Updated 2026-10-20 (Asia/Manila).

## Architecture and boundaries

The maintained source is a static HTML/CSS/JavaScript application. `index.html` owns the Three.js r128 WebGL renderer, sampled road graph, procedural vehicles, fixed 60 Hz simulation, traffic/pedestrians, cameras and postprocessing. `vehicle-dynamics.js` supplies planar rigid-body contacts, swept collision tests, four-wheel spring/damper supports and tyre slip. `structures.js` owns reserved civic lots and spatial collision buckets; `traffic-signals.js` owns timed signals. `world-detail.js` supplies district architecture, procedural textures and vegetation/prop batches. `gameplay.js` owns the menu, controls, activities and versioned local saves. `open-world.js` supplies police, cash and services.

There is no package manager, build pipeline, GLTF loader or third-party physics engine. Preserve the working stack and existing road/collision ownership. Physics and collision remain resident when rendering cells unload. The entire maintained tree, documentation and browser/physics tests were inventoried; `.test-tools` contains third-party test runtimes and `tests/artifacts` contains generated evidence.

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

The GTA V comparison is a subjective design target, not an automated test result. Further work toward that target should prioritize richer facade/ground art, varied pedestrian animation and stronger character/camera behavior. Full 3D airborne/rollover physics, building interiors and commercial-quality authored assets remain outside the current implementation. No verified overall 6/10 claim is made.

## Precise continuation priority

1. Trace the large preset-switch warm-up render call with Chrome GPU/devtools timing. The current diagnostic rules out a similarly long simulation or chunk-update call, but does not prove a specific driver/compiler cause. Preserve both the stalled and settled samples.
2. Investigate staged shader preparation for the pinned renderer, or a separately tested renderer compatibility update that supports asynchronous preparation. Keep the custom road/material/headlight shader behavior and all existing browser tests intact; do not hide the stall by removing it from frame statistics.
3. Re-run the isolated live test on High and Low after a fix, plus a modest supported GPU. Then address the remaining character/camera and authored-art gaps in the scorecard. The present world pass is functional and tested, but the overall comparison target remains open.
