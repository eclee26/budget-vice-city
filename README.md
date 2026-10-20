# Budget Vice City

A small open-world driving game that runs in the browser. It uses three.js with `index.html`, `vehicle-dynamics.js`, `structures.js`, `traffic-signals.js`, `world-detail.js`, `gameplay.js` and `driving.css`, with no runtime build step.

## Play

Serve this folder with `python -m http.server 8000`, then open `http://localhost:8000`. Keep all six runtime files together. GitHub Pages can also serve the repository root; the current development branch is `work`.

## Controls

| Action | Key |
|---|---|
| Walk / drive | W / S |
| Turn | A / D |
| Run (on foot) | Shift |
| Jump / handbrake | Space |
| Enter / exit car | E or F |
| Camera view (chase / hood / cockpit / Driver POV) | C |
| Look around | Drag mouse or touch |
| Zoom | Mouse wheel |
| Pause menu: activities / vehicle / settings / controls | H |
| Horn | B |
| Headlights: Auto / on / off | L |
| Left / right indicators | Z / X |
| Hazard lights | V |
| Mute | M |
| Enlarge / close map | G or Map button |

Touch devices get a left thumbstick for movement or steering, separate GAS and BRAKE pedals while driving, and buttons for entering/exiting a car, jumping/handbraking and changing the camera. Push the stick farther to run on foot. Steering, pedals and dragging the camera support simultaneous fingers. Hold BRAKE at a standstill to reverse.

The driving HUD shows speed, gear, vehicle condition, an RPM bar and light/signal states. Speed defaults to km/h; switch to MPH in Settings. Nearby cars get a highlight and an entry prompt; blocked sides explain why entry is unavailable. The minimap includes a heading readout and can be enlarged with G or the Map button. An off-screen arrow points toward the active checkpoint. Open **Menu** (or press **H**) for activities, vehicle controls, graphics/progress settings and the full control list. The simulation, entry/exit animation and activity timer pause while the menu is open. Horn and headlight buttons also appear in the driving HUD. Entry/exit takes a short animated sequence; the car must be stopped and a side must be clear.

## Features

- **Driving:** a vehicle model with:
  - Rotated rectangular body contacts, friction and contact-point angular impulses. Swept wall and vehicle checks reduce tunnelling between ticks.
  - Four spring/damper wheel supports and wheel-level surface grip. Road texture, grass, sand and the existing curb strip affect wheel loads and handling.
  - Wheel inertia, progressive longitudinal slip, brake lock and combined tyre forces. Braking torque opposes wheel rotation rather than spinning locked wheels backwards.
  - An engine torque curve and automatic gearbox.
  - Tyre slip and weight transfer.
  - Grip-limited braking and aerodynamic drag.
  - A reverse gear.
  - Combined acceleration/braking/cornering tyre forces, front/rear weight distribution, and damped body movement.
  - A fixed 60 Hz simulation with three tyre integration substeps, independent of rendering FPS.
- **Sedan handling:** passenger-car dimensions, a 2.7 m wheelbase, front-heavy weight distribution, responsive steering and throttle, six-speed automatic gearing, and visible wheel steering/rotation. Flat dry-road tests give approximately 8.5 s from 0–100 km/h and 38 m braking from 100 km/h.
- **Vehicles:** Sports, Sedan, Van, Bike, the original Kaze R sport sedan, and three Civics:
  - **Honda Civic FD 2009:** white, Type R photo-inspired body kit, red badges, raised wing, round rear-lamp elements and seven-spoke wheels, and an approximate 1.8 L / five-speed automatic setup.
  - **Honda Civic FB 2013:** pearl white, shorter cabin, taller grille/deck, earlier Asian-market rear-light outlines, and an approximate 1.8 L / five-speed automatic setup.
  - **Honda Civic SiR 1997:** blue, a more upright 1990s profile, amber lamp corners, five-spoke wheels, rear wing, and a lighter, high-revving B16A-style setup.
  - The FD now follows the supplied white FD2 Type R photographs, with seven-spoke wheels, red badges/calipers, body kit, rear wing and diffuser. The FD has sculpted fenders and bumpers, tapered wheel spokes, tyre tread, detailed brakes, reflector bowls, grille mesh, and a visible cabin behind tinted glass. Its existing 1.8 L engine tune remains. All three have curved body panels, open wheel arches, shaped lamp housings, separate window glass, working lights, animated wheel steering/rotation, and separate engine curves/chassis parameters. Shared geometry limits memory use when multiple copies spawn. The SiR uses five-speed manual-style ratios with automatic shifting for the existing controls. These are reference-informed procedural reconstructions with approximate tunes, not 1:1 scans. See [Civic reference sources and regional choices](references/CIVIC_REFERENCES.md).
  - One of each Civic is parked along the coast just ahead of the starting Kaze R, roughly 12–36 m away. They can also appear in traffic and among parked cars.
- **Vehicle detail:** sedans have sloping cabins, open arches, rounded mirrors and shaped lights/grilles; Civics have visible dark interiors, convex lamp lenses and textured brake discs. Shared simpler wheels replace fine wheel/lens detail at distance, with hysteresis to avoid flicker.
- **City life:** traffic follows curved lanes, adjusts speed for bends, predicts obstacles/crossing traffic, brakes to maintain a following gap and reserves junctions one vehicle at a time. Stalled junction claims expire; blocked traffic is only repositioned after a long wait away from the player. Pedestrians flee and can be knocked over.
- **World:** a city grid, a beach boardwalk, and an island with a lighthouse and bridge.
- **Architecture:** houses with pitched roofs and porches, shops with awnings, neon bars, balcony apartments, glass offices, and three malls with larger footprints and storefront signs. These are exterior scenery; repeated parts share instanced geometry.
- **Street detail:** beveled curbs, drainage grates, manhole covers, repair patches, storefront menu boards/planters/handles/window frames and rooftop grilles. Small scenery is instanced in spatial cells and hidden at distance.
- **Roads:** five 10 m neighbourhood streets, 18 m avenues and 22 m boulevards, sweeping coastal bends, rounded outer corners, and fewer intersections. World-space road surfaces and antialiased markings stay sharp up close; the minimap, collisions, and traffic lanes share the same paths.
- **Day and night:**
  - The sky changes through the day, with clearer daylight, warmer dusk, matching reflection presets and distance haze that adjusts at night.
  - Windows and street lamps light up at night.
- **Audio:** synthesized RPM/load-driven engines, nearby traffic, road noise, tyre slip and collision impacts. Sound starts after your first click, tap or keypress. Use the Sound button or **M** to mute; the preference is saved when browser storage is available. Help, background tabs and focus loss silence audio. These are generated effects, not recordings of the real cars.
- **Effects:**
  - FXAA edge smoothing, restrained bloom, colour grading and speed-dependent motion blur.
  - Closer sun-shadow coverage with stable positioning, plus soft contact shadows beneath cars and people.
  - Shared asphalt/concrete surface grain, sidewalk slab joints, clearer paint/glass/metal materials and cached day/dusk/night reflections. Touch devices use smaller shadow maps and a capped render resolution.
  - Tyre smoke, skid marks and dust.
  - Sparks and car damage.
  - Working car lights.
- **Ambient:** birds, clouds and palm fronds swaying in the wind.
- **Minimap:** shown in the corner, with an active activity route and cyan target marker.
- **Driving feedback:** damped body/wheel suspension motion on rough surfaces and curb transitions, restrained braking/cornering camera feedback, and generated shift/door/horn sounds. The motion option defaults off for reduced-motion preferences.
- **Activities:** coastal sprint (six checkpoints), parcel delivery (stop to collect/drop off), precision parking (the whole car inside the bay, aligned and stationary for three seconds), and four-checkpoint time trial. Each has a timer, completion/failure/cancel feedback, and saved best times/completion counts. Open Menu to retry after a result.
- **Vehicle interactions:** hinged door panels and a player entry/exit sequence; horn, Auto/on/off headlights, left/right indicators with turn cancellation, and hazard lights. Door animation is a gameplay representation over the existing procedural shell.
- **Smooth rendering:** interpolate vehicle, wheel, player and camera transforms between simulation ticks without changing the authoritative physics state.
- **Recovery:** Vehicle → Recover vehicle relocates the current or last car to an unoccupied road. Damage and challenge time remain unchanged.
- **Preferences:** independent suspension/camera lean, camera shake and motion blur toggles, plus steering and camera sensitivity. Motion effects default off for reduced-motion preferences.
- **Startup:** loading feedback and a Retry loading action explain graphics/script failures.
- **Performance:** Low/Medium/High presets, 50–100% render scale and an optional FPS display. Presets adjust shadows, bloom, resolution and scenery/wheel detail ranges; touch devices retain a lower upper budget.
- **Local progress:** autosave every five seconds of simulation, on menu close, on vehicle entry/exit completion, on activity/settings changes and when leaving the page. A manual Save this drive action is in Settings. Saves include location, current or last parked car and its condition/lights, camera, time of day, settings, activity progress, best times and completion counts. Reloaded cars start stationary. Invalid or unavailable saves leave the game playable, and another tab's save pauses this tab's autosave until explicitly overridden. Saves stay in this browser; clearing site storage removes them.

## Notes

- three.js r128 is loaded from a CDN, so the game needs an internet connection.
- It's graphically heavy and runs best on a desktop browser.

## Physics checks

Run `node tests/vehicle-physics.cjs` with Node.js; no packages are required. The checks cover acceleration, braking, steering under power, reverse, stability, grip differences, and identical driving results at 30/60/144 rendering FPS. The 18 checks also cover rotated body clearance, deterministic impact spin and momentum, swept thin walls/vehicle pairs, split-surface wheel loads, road steps, wheelspin and brake lock. These are model checks, not validation against a particular real vehicle.

## Gameplay browser checks

Install Python Playwright and Chromium for tests (`python -m pip install playwright` and `python -m playwright install chromium`), then run `python tests/gameplay-browser.py`. Set `CHROMIUM_PATH` if using an existing Chromium installation. An optional `--assets /path/to/cache` reads the eight Three.js CDN scripts by filename from a local cache; otherwise the browser uses the same CDN requests as the game.

The checks exercise real keyboard/touch controls, animated entry/exit, lights/signals/horn, all four activities and outcomes, timer pause, graphics settings, same-origin save/reload, on-foot parked-car recovery, denied/corrupt storage, cross-tab conflicts, predictive following/junction priority, reduced motion, and narrow/landscape layouts.


## Headlights and frame-time costs

The player car has two cool-white low-beam spotlights mounted at the left/right front lamps. Each aims at the road five metres ahead of its lamp. A wide, overlapping surface-light pattern produces a connected road wash with brighter centres and a world-level upper cutoff, including as the body pitches. The light reaches farther down the road without illuminating above lamp height. Lights follow the interpolated render pose, so they stay attached between physics ticks. Auto/on/off and entry/exit behavior remain shared with the existing light controls. The two lights do not allocate shadow maps.

Interpolation reuses pose buffers instead of creating vectors/quaternions every frame. Settled parked cars sleep until an impact, input or relocation; active vehicles retain the fixed 60 Hz physics and three tyre substeps. Contact rejection uses analytic rectangle projections before clipping polygons. Scenery visibility checks run at 10 Hz and the minimap redraws at up to 20 Hz, while the world renders at the display rate.

Run `python tests/performance-browser.py --label current` with the same Chrome executable/settings for repeatable CPU measurements. Set `CHROMIUM_PATH` when using an installed browser. Reports go to ignored `tests/artifacts/`. This measures simulation/interpolation CPU cost, not GPU frame time or guaranteed FPS. The measured baseline/optimized median tick times were about 2.06/0.93 ms with 28 cars, and interpolation fell from 0.133 to 0.079 ms.


## Driver POV

While driving, press **C** to cycle Chase → Hood → Cockpit → Driver POV. Touch users can use the Camera/POV button; the pause menu’s Vehicle section also has a named Camera control. Driver POV uses a left-side seating position, a fixed 58° field of view, a shared lightweight dashboard/animated steering wheel, gauge needles and windshield pillars. Bikes use handlebars. Drag to look around; mouse-wheel chase zoom does not move the driver’s seat. The view follows the car between physics ticks; modest acceleration/cornering head movement respects the suspension/camera feedback setting, and radial motion blur is disabled in POV. The chosen view persists with your drive. Cabin geometry is a procedural gameplay representation, not a replica of each real car’s interior.


World colours use common factory-style car paints (mostly white, silver, black and graphite, with deep blue/red/green and champagne) and natural plaster, concrete, stone, brick, terracotta and charcoal building finishes. Houses, shops and apartments draw from separate shared palettes; offices and malls use muted glass, concrete and metal.


## Neighbourhood structures

The city includes two drive-in fuel stations, **Sunway Fuel** (blue/gold) and **Harbor Fuel** (green/cream), with canopies, pumps, shops and pylons. Two-storey houses have five shared designs: gabled porch, brick duplex, balcony modern, twin gable and veranda terrace. Two playgrounds include swings, slides, play towers, sandpits and benches. A Coastal Police station, Coastside Clinic and Harbor Auto workshop add civic/service destinations. These are exterior scenery; refuelling, police services and playground interactions are not simulated.

Civic lots have reserved footprints, paths/driveways connecting to roads and collision geometry for buildings, pumps, posts and fences. Forecourts have road grip and remain drivable between obstacles. The minimap marks fuel with **F**, police **P**, clinic **+**, workshop **W** and recreation **R**.

`structures.js` owns lot planning, indexed collisions and the new building variants. It reuses the existing material/geometry instancing and sign caches. Run `python tests/gameplay-browser.py --only-structures` for two seeded-world checks of all destinations, five house variations, road/sidewalk clearance, sedan driveway access and preview images.


## Road widths and traffic signals

Five neighbourhood streets are **10 m wide**, alongside 18 m avenues, 22 m boulevards and the 14 m island bridge. The same widths feed meshes, markings, masks, minimap and AI lane positions. Random curbside parking stays on wider roads; local-street traffic aims for about 30 km/h.

Four inner-city junctions have working red/amber/green signals, overhead heads, stop bars and crosswalks. Each axis gets 18 seconds green, 3 seconds amber and a 2-second all-red clearance. Junctions use different offsets. Timing follows simulation ticks and pauses with the menu or hidden tab. AI brakes before red lights, stops on amber when it has room, clears committed crossings, then resumes on green. Existing junction reservations still prevent conflicting turns; red-light waiting does not trigger stuck-car recovery. The player retains manual driving control.

`traffic-signals.js` owns phases, approaches, AI signal constraints and shared instanced signal models. Lamps use emissive-looking materials rather than extra dynamic lights/shadow maps. Run `python tests/gameplay-browser.py --only-traffic` for phase conflicts, red stopping/green release, amber decisions, pause behavior, lane clearance and GPU-rendered stop-line visibility checks.


## World graphics

The world uses curved palm fronds, instanced broadleaf trees with cutout leaf clusters, roadside planting, hedges, grass tufts, garden paths, boardwalk benches and bins. Trees have indexed trunk collisions and stay clear of sidewalks, road lanes and civic access. Buildings include roof parapets/equipment, rain pipes, side windows, brick foundations, tiled roofs, recessed window artwork and lit room silhouettes. These are shared procedural assets rather than downloaded art packs.

Terrain uses metre-scale grass detail instead of enlarged atlas noise. The terrain atlas masks out water so one animated ocean surface covers both the coastline and the horizon, with distant wave detail fading to avoid shimmer. Shared material shaders add masonry courses, weathering and ground contact; softer clouds and lower sky radiance improve atmospheric depth without extra dynamic lights or postprocessing passes.

Run `python tests/world-browser.py` for deterministic residential, downtown, coast, park, dusk and night screenshots, WebGL error checks and full-frame render budgets. Images and draw/triangle counts are written to `tests/artifacts/world-*`. These counts include the composer and shadows; they are regression limits, not a hardware FPS guarantee.


The town now has four districts: coastal houses and shops, garden neighbourhoods, a concentrated downtown, and a southern harbor/service area. Eligible adjacent building tiles form wider blocks. Nine shared office/apartment/warehouse forms add setbacks, glass curtain walls, balconies, pilasters, podiums and loading doors. The coastline includes lifeguard towers, umbrellas and loungers, anchored sailboats, a detailed lighthouse gallery and bridge railings; streets include bus shelters and street-name signs. These are exterior scenery.

Window interiors vary across four room designs and turn on individually at night. Signs render to their actual mesh aspect ratio; boardwalk planks use real-world dimensions. Foliage and grass use spatial instance batches so camera and shadow culling can skip unseen areas. The eleven-view world review also verifies district coverage, wider lot footprints, collision clearance and culling-bound containment.
