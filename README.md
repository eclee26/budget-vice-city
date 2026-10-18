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

On-screen buttons are shown for touch devices.

## Features

- **Driving:** a full vehicle simulation with:
  - An engine torque curve and automatic gearbox.
  - Tyre slip and weight transfer.
  - Anti-lock brakes and aerodynamic drag.
  - A reverse gear.
- **Vehicles:** Sports, Sedan, Van, Bike and the original Kaze R sport sedan.
- **City life:** traffic that follows lanes and uses indicators, and pedestrians who flee and can be knocked over.
- **World:** a city grid, a beach boardwalk, and an island with a lighthouse and bridge.
- **Roads:** 18 m avenues and 22 m boulevards, sweeping coastal bends, rounded outer corners, and fewer intersections. Road markings, the minimap, collisions, and traffic lanes share the same paths.
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
