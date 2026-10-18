# Budget Vice City

A small open-world driving game that runs in the browser. It's a single HTML file built with three.js, with no build step and no installs.

## Play

Open `index.html` in a browser, or turn on GitHub Pages: **Settings → Pages → Deploy from branch → `main` / root**.

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
| Controls help | H |

Touch devices get a left thumbstick for movement or steering, separate GAS and BRAKE pedals while driving, and buttons for entering/exiting a car, jumping/handbraking and changing the camera. Push the stick farther to run on foot. Steering, pedals and dragging the camera support simultaneous fingers. Hold BRAKE at a standstill to reverse.

The driving HUD shows speed, gear, vehicle condition and RPM. Open **Help** (or press **H**) for the full control list; gameplay pauses while Help is open.

## Features

- **Driving:** a vehicle model with:
  - An engine torque curve and automatic gearbox.
  - Tyre slip and weight transfer.
  - Grip-limited braking and aerodynamic drag.
  - A reverse gear.
  - Combined acceleration/braking/cornering tyre forces, front/rear weight distribution, and damped body movement.
  - A fixed 60 Hz simulation with three tyre integration substeps, independent of rendering FPS.
- **Sedan handling:** passenger-car dimensions, a 2.7 m wheelbase, front-heavy weight distribution, responsive steering and throttle, six-speed automatic gearing, and visible wheel steering/rotation. Flat dry-road tests give approximately 8.6 s from 0–100 km/h and 38 m braking from 100 km/h.
- **Vehicles:** Sports, Sedan, Van, Bike and the original Kaze R sport sedan.
- **City life:** traffic that follows lanes and uses indicators, and pedestrians who flee and can be knocked over.
- **World:** a city grid, a beach boardwalk, and an island with a lighthouse and bridge.
- **Architecture:** houses with pitched roofs and porches, shops with awnings, neon bars, balcony apartments, glass offices, and three malls with larger footprints and storefront signs. These are exterior scenery; repeated parts share instanced geometry.
- **Roads:** 18 m avenues and 22 m boulevards, sweeping coastal bends, rounded outer corners, and fewer intersections. World-space road surfaces and antialiased markings stay sharp up close; the minimap, collisions, and traffic lanes share the same paths.
- **Day and night:**
  - The sky changes through the day, with sky reflections and soft shadows.
  - Windows and street lamps light up at night.
- **Effects:**
  - Bloom, colour grading and motion blur.
  - Tyre smoke, skid marks and dust.
  - Sparks and car damage.
  - Working car lights.
- **Ambient:** birds, clouds and palm fronds swaying in the wind.
- **Minimap:** shown in the corner.

## Notes

- three.js r128 is loaded from a CDN, so the game needs an internet connection.
- It's graphically heavy and runs best on a desktop browser.

## Physics checks

Run `node tests/vehicle-physics.cjs` with Node.js; no packages are required. The checks cover acceleration, braking, steering under power, reverse, stability, grip differences, and identical driving results at 30/60/144 rendering FPS. These are flat-road model checks, not validation against a particular real vehicle.
