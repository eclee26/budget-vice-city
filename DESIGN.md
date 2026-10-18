# Budget Vice City design context

## Overview

A browser driving sandbox with pastel coastal architecture, neon accents, palms and warm sunset lighting. The world is the main surface; keep controls compact and leave room to drive. Preserve the existing low-poly style.

## Colors

Runtime values in `index.html` are canonical. The `ROAD` object owns road colors: asphalt `#30343b`, sidewalk `#b9b4aa`, white edge markings `#eee9da`, and double yellow center lines `#e8c35b`. These feed world-space road meshes and the minimap canvas. Grass and sand retain `#4f7f3a` and `#e3cf9a`.

HUD tokens live in the root CSS: `--panel` is translucent dark blue, `--fg` is warm white `#fff8eb`, `--muted` is `#b7c8d0`, and `--accent` is cyan `#76e4e1`. Reserve `--warning` (`#ffd38a`) and `--danger` (`#ff828d`) for vehicle condition. Condition always has a percentage and progress semantics as well as color.

## Typography

Use system-ui/sans-serif at 13px for controls and tabular numerals for driving data. Speed leads at 54px on desktop, 44px on phones and 34px in short landscape views. Gear is secondary; RPM and vehicle condition stay compact. Keep full control instructions in Help instead of a persistent instruction strip.

## Layout

Use long 18 m streets, 22 m coastal/outer boulevards and a 14 m island bridge. Favor sweeping curves and occasional T-junctions over a dense, uniform intersection grid. The coastline and lighthouse remain recognizable landmarks.

City blocks mix six recognizable silhouettes: pastel houses with pitched roofs and porches; stores with striped awnings and display windows; bars with dark façades and neon signs; apartments with balconies; glass offices with rooftop setbacks; and malls on reserved 30 m × 20 m lots. Favor houses toward the coast and a broader commercial/vertical mix inland. Face single-tile entrances toward a nearby road. Signs identify fictional venues, such as Coast Mart, Palm Room and Sunset Galleria; these buildings are exterior scenery.

The player panel sits at the upper left and the minimap at the upper right with safe-area spacing. Touch devices get a left thumbstick, separate right accelerator/brake pedals and a row of secondary actions above the pedals. Adapt the HUD and controls for narrow portrait and short landscape screens; keep control targets at least 44px. Desktop mouse devices keep the touch overlay hidden.

## Components

`roads` and `nodes` own the street network. Sampled centerlines drive world-space ribbons with antialiased edges, the minimap canvas, road and sidewalk collision masks, traffic paths, vehicle placement and roadside lighting. Buildings and palms must clear the sidewalk envelope. Keep visible roads and collision surfaces aligned through `tile()`; do not restore separate tile-grid road logic. Road surfaces and markings use geometry rather than the city-wide terrain texture so they stay smooth up close. Merge geometry into four material layers to limit draw calls, and draw those layers before transparent tyre marks and particles.

`updateHud()` owns on-foot/driving visibility, speed, gear, condition and touch labels. The Help panel is a native modal dialog: H or Help opens it, Escape or Close dismisses it, gameplay pauses while open, and focus returns to Help. Keep speed updates out of live regions. Keyboard state, held touch buttons, thumbstick axes and camera pointer tracking are independent. Pointer capture lets steering, pedals and camera gestures work simultaneously; cancellation, focus loss, hidden tabs and opening Help release inputs. Thumbstick movement on foot is relative to the camera and full tilt runs; driving uses its horizontal axis for analog steering. Hold the brake while stopped for reverse, matching keyboard behavior.

`architecture()` owns building type construction; `buildingBatches` instances shared geometry and materials. Reserve mall tiles before terrain generation and use the same occupied tiles for collisions and scenery placement. Keep façades, awnings, porches and roofs inside their reserved lots. Cache sign textures by text/colors and register luminous signs and windows with the existing day/night material system.

## Do's and Don'ts

- Keep road markings legible along bends and clear at junctions.
- Keep the bridge connected to the coastal road and its rails outside the carriageway.
- Check street-level and overhead views, vehicle clearance and traffic traversal when editing roads.
- Preserve keyboard and touch driving controls when changing world geometry.
