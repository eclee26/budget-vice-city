# Budget Vice City

A small open-world driving game that runs in the browser. It uses three.js with `index.html` and `gameplay.js`, with no runtime build step.

## Play

Serve this folder with `python -m http.server 8000`, then open `http://localhost:8000`. Keep `index.html` and `gameplay.js` together. GitHub Pages can also serve the repository root; the current development branch is `work`.

## Controls

| Action | Key |
|---|---|
| Walk / drive | W / S |
| Turn | A / D |
| Run (on foot) | Shift |
| Jump / handbrake | Space |
| Enter / exit car | E or F |
| Camera view (chase / hood / cockpit) | C |
| Look around | Drag mouse or touch |
| Zoom | Mouse wheel |
| Pause menu: activities / vehicle / settings / controls | H |
| Horn | B |
| Headlights: Auto / on / off | L |
| Left / right indicators | Z / X |
| Hazard lights | V |
| Mute | M |

Touch devices get a left thumbstick for movement or steering, separate GAS and BRAKE pedals while driving, and buttons for entering/exiting a car, jumping/handbraking and changing the camera. Push the stick farther to run on foot. Steering, pedals and dragging the camera support simultaneous fingers. Hold BRAKE at a standstill to reverse.

The driving HUD shows speed, gear, vehicle condition and RPM. Open **Menu** (or press **H**) for activities, vehicle controls, graphics/progress settings and the full control list. The simulation, entry/exit animation and activity timer pause while the menu is open. Horn and headlight buttons also appear in the driving HUD. Entry/exit takes a short animated sequence; the car must be stopped and a side must be clear.

## Features

- **Driving:** a vehicle model with:
  - An engine torque curve and automatic gearbox.
  - Tyre slip and weight transfer.
  - Grip-limited braking and aerodynamic drag.
  - A reverse gear.
  - Combined acceleration/braking/cornering tyre forces, front/rear weight distribution, and damped body movement.
  - A fixed 60 Hz simulation with three tyre integration substeps, independent of rendering FPS.
- **Sedan handling:** passenger-car dimensions, a 2.7 m wheelbase, front-heavy weight distribution, responsive steering and throttle, six-speed automatic gearing, and visible wheel steering/rotation. Flat dry-road tests give approximately 8.6 s from 0–100 km/h and 38 m braking from 100 km/h.
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
- **Roads:** 18 m avenues and 22 m boulevards, sweeping coastal bends, rounded outer corners, and fewer intersections. World-space road surfaces and antialiased markings stay sharp up close; the minimap, collisions, and traffic lanes share the same paths.
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
- **Performance:** Low/Medium/High presets, 50–100% render scale and an optional FPS display. Presets adjust shadows, bloom, resolution and scenery/wheel detail ranges; touch devices retain a lower upper budget.
- **Local progress:** autosave every five seconds of simulation, on menu close, on vehicle entry/exit completion, on activity/settings changes and when leaving the page. A manual Save this drive action is in Settings. Saves include location, current or last parked car and its condition/lights, camera, time of day, settings, activity progress, best times and completion counts. Reloaded cars start stationary. Invalid or unavailable saves leave the game playable, and another tab's save pauses this tab's autosave until explicitly overridden. Saves stay in this browser; clearing site storage removes them.

## Notes

- three.js r128 is loaded from a CDN, so the game needs an internet connection.
- It's graphically heavy and runs best on a desktop browser.

## Physics checks

Run `node tests/vehicle-physics.cjs` with Node.js; no packages are required. The checks cover acceleration, braking, steering under power, reverse, stability, grip differences, and identical driving results at 30/60/144 rendering FPS. These are flat-road model checks, not validation against a particular real vehicle.

## Gameplay browser checks

Install Python Playwright and Chromium for tests (`python -m pip install playwright` and `python -m playwright install chromium`), then run `python tests/gameplay-browser.py`. Set `CHROMIUM_PATH` if using an existing Chromium installation. An optional `--assets /path/to/cache` reads the eight Three.js CDN scripts by filename from a local cache; otherwise the browser uses the same CDN requests as the game.

The checks exercise real keyboard/touch controls, animated entry/exit, lights/signals/horn, all four activities and outcomes, timer pause, graphics settings, same-origin save/reload, on-foot parked-car recovery, denied/corrupt storage, cross-tab conflicts, predictive following/junction priority, reduced motion, and narrow/landscape layouts.
