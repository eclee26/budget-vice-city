# Budget Vice City design context

## Overview

A browser driving sandbox with pastel coastal architecture, neon accents, palms and warm sunset lighting. The world is the main surface; keep controls compact and leave room to drive. Preserve the existing low-poly world; requested vehicle replicas can use curved surfaces and finer exterior detail to follow their references.

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

`advanceSimulation()` advances gameplay at 60 Hz independently of rendering; pause/hidden states clear accumulated time and long gaps are capped. Vehicle tyres integrate in three substeps. Speed-sensitive steering meters available wheel lock, while tyre forces determine yaw above parking speed. Keep sedan proportions close to an ordinary passenger car and show front-wheel steering and wheel rotation. Body roll and pitch use damped suspension motion; chase-camera yaw follows promptly enough to make steering readable. Preserve keyboard and analog touch parity when tuning the model.

The Civic FD (2009), FB (2013) and SiR (1997) use generation-specific procedural body/cabin profiles, front/rear lights, grille and wheel details. Default paints are warm white, pearl white and blue respectively; the SiR has a rear wing and amber front corners. Keep the FD/FB as 1.8 L commuter interpretations and the lighter SiR as a high-revving B16A-style interpretation. Per-model torque curves and dimensions live in `TY`; `torqueAt()` interpolates engine curves while preserving the generic model for existing cars. Guaranteed parked Civics line the starting coastal road; also include them in random parked and traffic pools. Long vehicle names wrap in the existing HUD. Preserve collision/effects behavior across every model.

Exterior references and regional choices are recorded in [CIVIC_REFERENCES.md](references/CIVIC_REFERENCES.md). Use Asian-market FD/FB details and a pre-facelift EK4 sedan silhouette. Curved body grids include open wheel arches; crowned roofs, curved windscreens, separate side glass and thin pillars replace opaque box cabins. Lamp/grille patches follow the bumper curvature and use separate depth layers to prevent flicker. FD facelift rear lamps have octagonal elements; the earlier Asian FB uses its own rear cluster outline rather than the North American 2013 facelift's L-shaped arrangement. Cache detailed geometry per generation and retain existing physical collision dimensions and wheel animation. These are approximate reconstructions; do not label them certified 1:1 assets.

Road overlay materials use polygon depth bias to prevent the terrain from showing through at shallow camera angles in the postprocessing depth buffer. Thin vehicle lamp/grille patches do not cast or receive shadows, avoiding shadow acne on closely spaced layers; the body still casts and receives shadows.

`architecture()` owns building type construction; `buildingBatches` instances shared geometry and materials. Reserve mall tiles before terrain generation and use the same occupied tiles for collisions and scenery placement. Keep façades, awnings, porches and roofs inside their reserved lots. Cache sign textures by text/colors and register luminous signs and windows with the existing day/night material system.

## Do's and Don'ts

- Keep road markings legible along bends and clear at junctions.
- Keep the bridge connected to the coastal road and its rails outside the carriageway.
- Check street-level and overhead views, vehicle clearance and traffic traversal when editing roads.
- Preserve keyboard and touch driving controls when changing world geometry.

Audio uses one lazy Web Audio graph unlocked by a trusted pointer/key gesture. Reuse engine oscillators and filtered noise sources; ramp gains/pitch, limit and disconnect impact voices, and keep audio outside physics. The Sound button below the minimap is at least 44px and exposes mute state with text and aria-pressed; M also toggles. Persist mute where storage is available. Silence Help, hidden tabs and focus loss immediately. Generated engine tones follow RPM/load, tyre noise follows slip/surface, and nearby traffic/impacts attenuate with distance. Do not present synthesized effects as vehicle recordings.

The FD exterior follows the user-supplied white FD2 Type R photos: seven-spoke white wheels, red calipers/center caps/emblems, three front intake openings, shaped twin reflectors per headlamp, four round rear red elements over clear strips, skirts, front lip, raised rear wing, diffuser and single hollow exhaust. The rear photo supplies the modified rear aero; the side photo supplies overall proportions. Keep its current game identifier and driving tune. Reference provenance and the limits of photo reconstruction are documented in CIVIC_REFERENCES.md.

FD detail refinement: use the dedicated FD hull with sculpted shoulder/sill sections, rolled open arches and joined crown/bumper surfaces. Body width is 1.77 m, wheelbase 2.70 m and tyre radius 0.323 m. Keep front/rear deck meshes outside the cabin so the cabin floor stays dark. Window openings have separate seals and tinted transparent panes, with dashboard, steering wheel, seat backs and headrests inside. Seven extruded tapered spokes, rim barrels/lips, treaded tyres, discs, lugs and fixed calipers share cached geometry. Headlights use concave reflector dishes and corner wrap surfaces; grilles use a shared honeycomb texture. Badge decals use transparent backgrounds and the Type R plate has its own 2:1 artwork. FD bumper patches use the same height-dependent surface function as the body. Preserve cached geometry and test finite positions, normals/UVs and all Civic entry/driving behavior after changes.

`fdBatchGroup()` merges static FD details by material/shadow flags and shares the resulting buffers across cars. Batch each wheel spin group separately for left/right faces before batching the body. Keep indicators and transparent glass separate, and keep the first body children as meshes for the existing damage effect. Brake and reverse batches must retain each car’s own live material. Batching currently reduces the completed FD to 63 meshes; do not duplicate cached buffers for extra parked/traffic copies.
