# Budget Vice City design context

## Overview

A browser driving sandbox with natural coastal architecture, neon accents, palms and warm sunset lighting. The world is the main surface; keep controls compact and leave room to drive. Develop a coherent, detailed coastal world with varied architectural massing and believable materials; use shared geometry, instancing and culling to preserve driving performance.

## Colors

Runtime values in `index.html` are canonical. The `ROAD` object owns road colors: asphalt `#30343b`, sidewalk `#b9b4aa`, white edge markings `#eee9da`, and double yellow center lines `#e8c35b`. These feed world-space road meshes and the minimap canvas. Grass uses muted olive `#566347`, palm leaves use deep green `#3b5435`, and sand uses natural beige `#c8b795`.

HUD tokens live in the root CSS: `--panel` is translucent dark blue, `--fg` is warm white `#fff8eb`, `--muted` is `#b7c8d0`, and `--accent` is cyan `#76e4e1`. Reserve `--warning` (`#ffd38a`) and `--danger` (`#ff828d`) for vehicle condition. Condition always has a percentage and progress semantics as well as color.

## Typography

Use system-ui/sans-serif at 13px for controls and tabular numerals for driving data. Speed leads at 54px on desktop, 44px on phones and 34px in short landscape views. Gear is secondary; RPM and vehicle condition stay compact. Keep full control instructions in Help instead of a persistent instruction strip.

## Layout

Mix five 10 m neighbourhood streets with 18 m avenues, 22 m coastal/outer boulevards and a 14 m island bridge. Favor sweeping curves and occasional T-junctions over a dense, uniform intersection grid. The coastline and lighthouse remain recognizable landmarks.

City blocks mix residential, commercial and civic silhouettes: plaster and muted painted houses with pitched roofs and porches; stores with striped awnings and display windows; bars with dark façades and neon signs; apartments with balconies; glass offices with rooftop setbacks; and malls on reserved 30 m × 20 m lots. Favor houses toward the coast and a broader commercial/vertical mix inland. Face single-tile entrances toward a nearby road. Signs identify fictional venues, such as Coast Mart, Palm Room and Sunset Galleria; these buildings are exterior scenery.

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

`fdBatchGroup()` merges static FD details by material/shadow flags and shares the resulting buffers across cars. Batch each wheel spin group separately for left/right faces before batching the body. Keep indicators and transparent glass separate, and keep the first body children as meshes for the existing damage effect. Brake and reverse batches must retain each car’s own live material. Keep the FD base batches shared; optional nearby lenses/brakes and low-detail wheel substitutes also share geometry across cars. Do not duplicate cached buffers for extra parked/traffic copies.

Graphics use a final FXAA pass after colour grading; resize its inverse-resolution uniform to physical render pixels. Preserve native renderer antialiasing when postprocessing is unavailable. Limit pixel ratio to 1.5 on desktop and 1.25 on touch devices; use 2048/1024 sun shadow maps respectively. The sun shadow covers 96 m, follows the player at texel-snapped coordinates, and uses a small normal bias to keep wheel/building contacts attached. A single instanced soft contact layer grounds nearby cars and people.

Shared procedural mipmapped grain uses world-space projection on roads and instanced building surfaces, preserving grain scale and the road-edge UVs. Asphalt varies colour, roughness and fine normals; sidewalks have subtle slab joints. Paint uses a dielectric base with a clearcoat; glass has restrained reflections; chrome uses brushed roughness and tyres use fine bump detail. Keep material textures shared and anisotropy capped at 8. Three cached sky/skyline reflection targets cover daylight, dusk and night; dim material reflection strength at night and avoid allocating environment targets inside the simulation. The sky fades to dark blue below the horizon. Use restrained bloom/saturation/vignette and skip multi-tap motion blur when stationary.

Vehicle refinement adds convex transparent lamp covers and textured brake rotors, a sloping cabin/open arches/rounded mirrors on the generic sedan, shaped sedan lamps/grilles, and dark interiors beneath Civic glass. End the Civic deck/hood outside the cabin opening. `vehicleRefinement()` adds shared low-detail wheel substitutes; `updateScenery()` switches wheel and lens detail at 60 m on desktop / 38 m on touch devices, with a 4 m hysteresis band. Keep wheels steering/rotating through either view and preserve per-car brake/reverse/indicator materials.

Street detail uses one merged beveled curb mesh following the road edges, plus instanced drains, circular manhole covers and subtle repair patches. Skip bridge/intersection curbs and keep flush road details in asphalt. Facade handles, mullions, menu boards, planters and rooftop grille slats stay inside existing building lots. Cache artwork by kind. `sceneryPart()` groups shared geometry/material into 40 m spatial cells; show cells within 110 m desktop / 70 m touch plus their 29 m half-diagonal. These are visual details and do not add blocking collision geometry.

Atmosphere uses linear-space fog colours with time-dependent near/far distances, clearer daytime sky turbidity, hazier dusk and restrained grading/exposure. Cached reflection presets use matching sky turbidity. Keep nearby road markings/cars legible; distant props disappear before their detail is useful.

## Gameplay, menu and progress

`gameplay.js` extends the core 60 Hz simulation through guarded hooks; the force/gear model in `index.html` uses the shared contact and wheel-support helpers in `vehicle-dynamics.js`. `DrivingGame` owns vehicle transitions, activity state, settings, sound transients, local progress and the pause-menu panes. `UX-CONTRACT.md` records UI ownership and behavior. Keep runtime colours/type in the existing CSS tokens; the menu uses those same dark blue panels, cyan actions, warm white text, tabular timers and 44px targets. Native selects intentionally use platform popup behavior.

The existing modal is now Pause menu, with Activities, Vehicle, Settings and Controls sections. Only one pane is visible. Keep native modal focus/Escape restoration, simulation/timer/transition pause, and keyboard/touch parity. Use the driving HUD for horn/lights; use the menu for signals/hazards, entry/exit, activities, graphics and save actions. Shared status feedback targets the open modal or the world without showing a hidden background toast.

`aiDrive()` uses predictive following/crossing checks, curvature speed limits, bounded junction ownership and brake hold at a stop. Release stalled reservations and only recover stuck traffic far from the player. Drive-lane connectors remain the same curved road network.

Vehicle entry/exit lasts 0.95 s with a hinged overlay door panel and posed player movement; it does not replace the procedural shell with a cut-out interior asset. Require a stopped car. Exits always use the front-left door (negative vehicle-local Z), aligned with the front door centre; refuse a blocked left exit without falling back to the right. Entry may use either clear front door. Hold the transitioning vehicle with zero throttle/service-brake input and the parking brake, clear residual throttle/wheel rotation at the start, and preserve its gear. Do not hold the service brake during transitions: that invokes brake-to-reverse. Save only stable states. Physical wheel support runs in `phys()`; wheel/body presentation and camera/gear/door feedback remain outside it. Respect reduced-motion preferences and the motion setting.

Activity routes use actual drivable lane points. Race/time trial require ordered targets, deliveries require a stationary hold, and parking tests the whole rotated car footprint inside a 6 m × 2.7 m bay for three seconds. Timing uses simulation seconds; pause/hidden/offline time is excluded. Expose current target/time in the world and minimap, with cancel/retry paths in the menu.

Settings apply to existing render targets, shadow maps, bloom and detail distances, updating FXAA's physical resolution after a resize. Keep menus at native CSS resolution. Local save schema `bvc-progress-v1` validates finite coordinates, known car/activity IDs, bounds and settings; cars resume stationary. Save the active car or last parked car and allow an on-foot activity to resume. Storage failures explain retry without blocking play; cross-tab updates pause autosave until manual Save this drive. Never overwrite during a transition or persist malformed activity targets.


## Driving physics and instrument refinement

`vehicle-dynamics.js` owns rotated body contacts, swept collision sampling, angular/friction impulses, wheel inertia/slip and four spring/damper supports. `phys()` remains the 60 Hz owner of forces and gearing, with three tyre substeps. Surface heights follow the existing road masks, including the narrow raised curb strip; they are an approximate contact surface, not a full terrain mesh or jump/rollover simulation. Suspension loads affect tyre forces regardless of the visual motion preference. Brake torque opposes wheel rotation, while load-sensitive service-brake distribution preserves stable stopping.

`DrivingGame.captureVisual/interpolateVisual/restoreVisual` interpolate only rendering transforms and restore them immediately after drawing; physics, saves and activity timing always read the authoritative state. Clear interpolation on recovery, and snap across teleports.

`driving.css` consumes the canonical root tokens in `index.html` (existing runtime-token ownership / Model B). Keep the existing system-ui typography, dark translucent blue panels, warm white text, cyan focus/navigation and amber urgent feedback. These additions do not introduce another palette. RPM uses a progress bar without a live region; signals and lights include text. Speed defaults to km/h, with MPH available in the same native Settings select pattern.

The upper-right minimap has a heading readout and a Map / Close map button (G shortcut). Expansion increases its canvas resolution; it does not pause a timed activity. Tab remains normal keyboard focus traversal. The checkpoint direction cue appears only when the target is outside the central camera view. On phones it sits below the minimap instead of covering the road centre. Nearby cars use the shared entry prompt with the same candidate and side-clearance checks as entry. Do not draw a bounding box or wireframe around the vehicle.

Desktop routine notices sit below the driving view; portrait notices append to the player panel so they cannot cover activity timers or touch pedals. Short landscape notices use the clear upper middle region. Urgent notices add amber text and border, with their actionable state also available in the HUD or menu. Startup loading/error feedback covers the game until initialization and provides retry on failure.

Settings persist steering/camera sensitivity, speed units and independent suspension/lean, shake and blur toggles. Reduced-motion defaults disable all three motion options. Vehicle recovery finds a nearby unoccupied drivable lane, resets dynamic motion, retains condition and elapsed activity time, and explains failure when no clear location exists.


## Low beams and frame pacing

`updateHeadlights()` owns a permanent pair of cool-white unshadowed spotlights; each lamp is laterally offset by 0.34 vehicle widths and mounted near the model’s front lamp height. The ground aim point is five metres forward of the lamp and uses the shared road-height function. The pinned Three.js r128 spotlight shader uses an anisotropic low-beam pattern: wide horizontal falloff, overlapping foreground fill and brighter centres. `HEADLIGHT_BEAM` owns range, intensity, spread and positive downward cutoff slopes. The world-level cutoff rejects surfaces at/above lamp height independent of chassis/camera roll; the five-metre aim is retained while useful light spreads farther along the road. Both spotlights are headlamps; keep this shader extension scoped to this two-spot setup if other spot types are introduced later. Read the interpolated body pose immediately before rendering to avoid a 60 Hz light/car mismatch. Preserve Auto/on/off and clear both light intensities when on foot. Avoid extra headlight shadow-map passes.

Reuse `DrivingGame.poseBuffer` vectors/quaternions across capture/interpolate/restore. Rebuild membership only when the car count changes; retain authoritative-state restoration. Settled, unoccupied parked cars may skip tyre calculations only while position, heading and dynamics remain unchanged; impacts and relocation wake them. Keep active force integration at 60 Hz. Scenery visibility is sampled every six ticks, and minimap redraws are capped at 20 Hz with immediate manual map toggles. Rectangle collision rejection uses analytic projections and allocates clipped polygons only after overlap.

`tests/performance-browser.py` records seeded, warmed CPU timings at a fixed viewport/settings. Compare the same browser/environment; software rendering is unsuitable evidence for player GPU FPS. `tests/gameplay-browser.py` verifies paired beam origins, five-metre ground targets, downward cutoff behavior over heading/pitch changes, render-pose attachment and off/exit behavior, and retains a night screenshot.


## Driver POV camera

Camera mode 3 adds Driver POV after Chase/Hood/Cockpit, using the existing C/touch controls and a Vehicle-pane camera button. Keep camera names and selected state consistent across controls; mode 3 persists through the existing save schema. `DrivingGame.makePovCabin/povCamera/updatePovCabin` own one shared, low-detail interior rig, left-seat eye position, animated wheel/gauges and bike handlebars. Cabin materials use world trim colours; existing HUD tokens and typography remain unchanged. This is an approximate gameplay interior, not a generation-specific replica.

Use a fixed 58° vertical FOV and reset look to level on POV entry/restoration. Ignore chase zoom and speed-based FOV/blur in this mode. Head response is tightly limited and disabled by the existing motion preference. Camera position interpolates through the canonical pose buffers; the cabin copies the rendered body pose immediately before drawing. Hide the opaque exterior body only for the active first-person car, restore it on other views/exit, and hide the rig on foot. Keep the shared rig allocated once and avoid per-frame geometry/material creation.


## Real-world world palette

`CAR_PAINTS` in `index.html` owns the random traffic/parked paint pool: warm white, silver, black, graphite, deep navy, dark red, burgundy, forest green and champagne. Neutral paints have repeated entries to make them more common while retaining material caching. Kaze R uses deep navy. The reference-informed Civic FD/FB whites and SiR blue remain their established realistic model colours.

`BUILDING_PALETTES` owns house/store/apartment wall colours: chalk plaster, limestone, warm concrete, taupe, muted sage and brick brown. House roofs use terracotta or charcoal; offices use slate/grey glass and concrete; mall finishes use stone/concrete and dark metal. Awnings use muted burgundy, green and navy. Keep colours shared across instanced buildings and keep neon confined to venue signs/accents. Runtime CSS continues to own HUD colours; these world palettes change scenery and vehicle paint.


The headlight visual reference calls for a continuous cool-white road wash instead of two isolated round pools. Keep the two physical lamp origins, allow their broad patterns to overlap, and preserve Auto/on/off, interpolated attachment and the existing shadow/render-pass budget. Browser tests probe actual GPU-rendered surface pixels for road/shoulder coverage and rejection above lamp height, in addition to retaining a night preview.


## Neighbourhood variety and civic sites

`structures.js` owns `planStructureLots`, `structureCollider/structureSolid/structurePaved` and `buildVariedStructure`. Reserve two 30×20 m fuel sites and five 20×20 m civic/recreation sites before terrain and collisions are generated. Choose clear road-facing lots near separate city anchors, preserve mall reservations, and clear matching driveway/path cells before placing ordinary buildings or palms. Fuel sites use two fictional brands: Sunway Fuel (blue/gold) and Harbor Fuel (green/cream). Include two playgrounds, one police station, one clinic and one auto workshop.

Lots own terrain fill, paved grip, access corridors and map markers. Register actual building/pump/post/fence footprints in grid-indexed collision buckets; keep the public portions of forecourts and parks accessible. Keep structure solids outside asphalt/sidewalk masks. The minimap marker alphabet is F/P/+/W/R for fuel/police/clinic/workshop/recreation. All new structures are exterior scenery, with no implied refuelling, police-service or playground interaction.

Two-storey homes replace part of the existing residential pool and cycle through five geometric designs: gabled porch, brick duplex, flat-roof balcony modern, twin gable and veranda terrace. Give them distinct roofs, setbacks, balconies/porches and brick/plaster combinations while keeping them inside the existing 10 m tile. The first five two-storey homes cover every style; retain smaller single-storey houses in the mix.

Reuse `architecture()` part batching, shared pole/slide/roof geometry, canonical world palettes and cached signs/windows. Add no dynamic lights per site. `tests/gameplay-browser.py --only-structures` verifies seven sites, both brands, all five house styles, exact collision/terrain reservations, clear sidewalks and sedan-accessible fuel driveways over two random seeds, and renders each new type for visual review.


## Varied road widths and signal-controlled junctions

`ROAD.local` is 10 m; north→upper on the first inner column, upper→lower on the second column, lower→south on the first column, the western upper cross-street and western lower cross-street use that width. Keep the remaining 18/22 m routes and 14 m bridge. Drive lanes still derive from the shared centreline/width; do not add narrow-road curbside spawns that block the only through lane. Local-road AI cruising is capped at 8.3 m/s.

`traffic-signals.js` owns four selected inner junctions, approach stop positions, simulation-timed phases and instanced heads/poles/road paint. Phases alternate horizontal/vertical green for 18 s, amber for 3 s and all-red clearance for 2 s, with per-junction offsets. Never allow crossing axes simultaneous green/amber. Pause/hidden states freeze the same 60 Hz tick counter. Light materials change only when phase changes; range-cull signal groups and add no dynamic lamp lights or shadows.

Keep signal constraints tied to the incoming approach through an AI lane-connector handoff. Uncommitted traffic brakes before the stop bar; amber permits a committed car to clear when stopping would be abrupt. Release unentered reservations while held at red, keep the existing one-car junction reservation for turning conflicts, and exclude red waiting from stuck recovery. Vehicles already beyond the stop line must clear the crossing. The player continues to drive manually.

Stop bars and crosswalks share the same approach coordinates in the world and minimap. Render world paint after the depth-biased road ribbons with compatible depth bias, so asphalt cannot hide it. `--only-traffic` browser checks cover red/green behavior, amber near/far decisions, clearance phases, pause timing, van clearance on narrow lanes and actual rendered stop-bar contrast.


## World material and landscaping pass

`world-detail.js` owns reusable procedural leaf cards, curved palm frond geometry, grass texture, building/interior window maps, terrain/water shader helpers and `buildWorldDetail`. Preserve the existing natural paint/plaster palettes. Prioritize street-level silhouettes, vegetation layering, facade depth and material scale over brighter colours or more bloom. The intended direction is a more believable coastal town; the current procedural asset set should not be presented as GTA V visual parity.

Keep scenery construction out of the frame loop. Batch architectural trim globally by geometry/material. Split leaf cards and grass into bounded 80 m cells, with local instance coordinates and conservative shared 70 m bounding spheres; explicitly enable frustum culling for the pinned Three.js InstancedMesh implementation. Use existing range-culling for small boardwalk props. Leaf cards use alpha testing and shared textures rather than transparent sorting. Trunks register through `structureCollider`; clear road/sidewalk masks and all reserved civic/access tiles before planting. Hedges and paths stay inside existing house footprints or clear front access. No extra light or shadow-map passes are added.

The terrain atlas owns land type and minimap colour; its blue water cells discard in the ground shader so the continuous ocean shows beneath. Detail textures use world coordinates, mipmaps and capped anisotropy. Fade high-frequency water waves at distance. Keep brick/roof courses antialiased with derivatives. Window emissive maps must copy the diffuse map repeat/offset so lit rooms align with frames. Roof trim uses the building wall height rather than the tallest rooftop fixture.

`tests/world-browser.py` captures eleven seeded day/dusk/night views, reports scenery counts and full-frame render calls/triangles, and rejects page/console shader errors. Inspect screenshots as well as metrics. Its desktop high-detail limits include all existing vehicles, composer and shadows; software-rendered timings are not evidence of player GPU FPS. Retain physics, camera/headlight, structure-clearance and traffic regression checks.


## Districts, wider buildings and coastal identity

`cityDistrict/cityBuildingKind` in `world-detail.js` define four coherent areas: low coastal houses/shops, inland garden neighbourhoods, a concentrated downtown, and a southern harbor/service district. The road graph and reserved civic/access tiles remain canonical. Pair eligible adjacent occupied tiles for wider commercial/residential masses; reserve the mate with `pairedBuildingTiles` and convert the 20 by 10 m world footprint into the facade's local axes before construction. Never spread geometry across a grass or road tile to achieve density.

`buildCityArchitecture` provides nine shared office/apartment/warehouse designs: stepped glass offices, limestone towers, brick hotels, three balcony/terrace apartment forms and three industrial frontages. `footprintW/footprintD` store the actual local wall footprint, and `roofHeight` stores the equipment-bearing roof. Use those values for contact shadows and rooftop props. Reuse the same building/trim batches; keep balconies inside occupied tile boundaries. Curtain-wall mullions use world-space shading instead of many separate panes.

`enrichCityWorld` builds coastal shade seating, two lifeguard towers, three offshore sailboats, seven eligible bus shelters, street-name signs, the lighthouse lantern gallery/bands, bridge rails and shoreline rocks. Plant posts/steps and shelter supports through the existing collision buckets; reject road/sidewalk and reserved-access overlaps. These remain exterior scenery, with no implied boarding, transit or tower-climbing mechanics.

`windowInteriorMaps/finishWindowInteriors` use a four-room atlas with deterministic per-instance room selection and night illumination. Diffuse and emissive UVs must stay aligned. `buildingSign` caches its physical aspect ratio; architecture and global prop batching resolve each sign to the mesh width/height so text stays proportional. Terrain shading owns 18 cm boardwalk courses and 3 m staggered joints, subtle sand ripples and mipmapped detail. Keep sky/fog depth natural and preserve the established night/headlight behavior.

World review checks include district/type coverage, wider-building occupied footprints, every registered prop's road/sidewalk clearance, vegetation instance containment in culling bounds, page/shader errors and rendering budgets. Preserve desktop/mobile gameplay, traffic, physics and two-seed civic driveway checks. A numeric comparison with a AAA game is subjective; report concrete changes and rendered evidence rather than claiming equivalence.

## Driving sandbox progression (2026-10-20)

`OpenWorld` in `open-world.js` owns cash, player health, wanted heat, police dispatch and road-graph pursuit, world services, and career statistics. `DrivingGame` remains the canonical owner for activities, the shared modal, feedback, keyboard input and local saves. It calls explicit sandbox hooks; the core simulation selects police steering before civilian AI. No new framework, build step or render pass is introduced.

Maintain the existing dark blue panel, system-ui text, cyan navigation/success, warm white text, and amber pursuit urgency. Cash uses tabular monospace; wanted stars include a textual level label, pursuit phase and escape progress. The signature is a live wanted/search display tied to actual police visibility. Do not claim a numerical GTA V quality rating. Preserve the natural world palette and existing city identity.

City-service routes and career information extend the Activities pane. Native buttons own destination selection/clearing and Q/service-button actions. The current nearest service owns both prompt and interaction, including overlapping entrance ranges. Charges require valid health/damage, funds, no pursuit/job/transition and a stopped vehicle. Invalid actions explain recovery through the existing notice owner. The modal retains its native focus, scroll and Escape behavior. Compact phone and short-landscape rules keep pursuit/cash readable alongside touch driving controls; honor reduced-motion settings and retain visible focus.

Police are capped at three pooled sedans; reuse the road graph, existing physics and civilian return-to-patrol AI. Dispatch only at clear road locations beyond 80 m; do not teleport active units in front of the player. Line of sight uses existing building/solid collisions. Capture requires clear sight and five simulation seconds near a slow/stopped player. Services, arrest fines and successful jobs save through the existing validated schema, storage failure handling and cross-tab guard. Old saves default to $500 and full health; restored heat dispatches fresh units. Hot cargo must retain its escape phase across reloads.

Reconciliation: the earlier civic-sites description called all services scenery. Workshop repair, clinic healing and fuel-station tune-ups are now intentional interactive variants. Fuel consumption, building interiors, playground actions and station interiors remain unsimulated. Existing HUD colors/type and modal semantics remain canonical; no palette drift was introduced.

Verification: `tests/sandbox-browser.cjs` covers reward idempotence, cargo escape gating, road routing/finite pursuit physics, services and refusal states, fines/capture/escape, reload, pause, destination buttons, and narrow layouts. The premium scanner's programmatic-button findings remain the documented false positives; `OpenWorld.buildUI` binds its service and destination buttons directly. Ignore generated `tests/artifacts` fixtures when reviewing scanner findings.

## Streamed world and designed green space (2026-10-20)

`world-streaming.js` owns lazy 80 m building/facade cells and their instance-buffer lifetime. `worldStream.register` retains reusable source transforms; cell loading creates InstancedMesh objects, and unloading disposes those instance buffers without disposing shared geometry/materials. Hard detailed-cell budgets are 6/9/12 for Low/Medium/High. Prefer already loaded cells by 12 m to reduce boundary churn; build up to two new cells per 10 Hz scenery update. A shared low-detail skyline preserves the city's massing while detail streams. Collision and navigation never unload. Foliage remains in its existing bounded, frustum-culled 80 m groups and adds distance visibility.

`planGardenHills/worldElevation` reserve two 50 m garden parcels before ordinary architecture and random foliage. Preserve all road/sidewalk clearance, civic driveways and mall reservations. Use 17 m-radius smooth hills at 3.4 m and 2.6 m, a continuous 20 m-radius stone path, open summit seating, eight deliberately spaced garden trees and planted/rock detail. Keep the centre open rather than filling it with random canopies. Hill height is shared by the terrain mesh, four-wheel supports, character/prop placement, body slope and contact shadows. Bench, rock, sign-post and tree footprints use `structureCollider`. These features are physically supported terrain; distant southern headlands are explicitly outside the playable boundary.

`structures.js` also owns two reserved public parking lots with 14 bays each, unobstructed driveways, wheel stops, light fixtures, public-parking signs and rear billboards. Actual cars use the canonical car factory/physics and leave the entrance/central aisle clear. Parking is mapped as lowercase p, distinct from police P. Building styles and tower setbacks remain district-owned in `world-detail.js`; occasional downtown towers add height without changing occupied footprints. All new signs use the cached aspect-correct artwork and existing night emissive behavior.

`optimizeVehicleRendering` merges compatible opaque parts by model/material and preserves wheel, indicator, glass and brake/reverse ownership. Distant car proxies share box geometry and existing paint/light materials; retain the full active car in every camera mode. `DrivingGame` skips invisible wheel pose work while always capturing the camera and vehicle roots, including the hidden exterior used by POV. Uphill body alignment remains enabled when decorative suspension motion is disabled.

Runtime HUD color/type ownership is unchanged. Reconciliation intentionally updates the older globally resident building-batch description to lazy per-cell rendering, and the earlier flat-terrain description to shared garden elevation. No unrelated interface redesign or migration was introduced. `tests/world-browser.py` captures representative day/dusk/night views; `tests/streaming-browser.py` verifies repeated cell lifetime, bounded buffers/resources and terrain collision support; `tests/live-world-browser.py` records hardware-specific live frame samples. Quality scores remain explicitly provisional.

Vehicle indicator visibility is owned only by `updateVehicleIndicators` in `world-streaming.js`. The world-detail refresh must not force `v.il` meshes visible when restoring the full car model. Signals use a 54-tick cycle (450 ms on, 450 ms off), reset to the on phase when selected, and pause with simulation time. The same signal/hazard key or menu button toggles that mode off immediately, including in the paused menu. Hidden distant bodies suppress their indicators without changing the logical signal state. `tests/gameplay-browser.py --only-signals` checks every vehicle model through repeated detail refreshes, all three modes, off states, distance changes, keyboard/menu actions and pause.


## Sidewalk and street population (2026-10-20)

The canonical sidewalk width is 3.2 m (previously 2.2 m), shared by geometry, road masks, building clearance and map artwork. Street lamps sit near the outer edge, leaving the middle available for walking. Desktop starts with 64 pedestrians and 24 moving traffic cars; mobile uses 48 and 18. Random curb parking has 14 slots, in addition to the starter lineup and public parking bays. Existing distance culling remains active.

Most pedestrians use continuous sampled sidewalk segments, with clearance on both sides and routes split before roads or solid scenery. They reverse at segment ends, use varied walking speeds and retain fleeing/knockdown behavior. Park and beach wandering remains available. Route-following never authorizes stepping across asphalt. `tests/population-browser.py` checks safe connected routes, sustained walking progress, denser traffic movement and mobile population limits.


## Weathered asphalt (2026-10-20)

`surfaceFinish` remains the canonical surface shader for all four road ribbon layers. Asphalt now combines centimetre-scale aggregate with metre-scale sun bleaching, branching cracks, tar seals, jagged utility-cut repairs, sparse shallow spalling, oil discoloration, curb grime and polished wheel paths. The 1024² packed `roadWear` canvas uses red for tone, green for apparent relief and blue for roughness. A private deterministic seed avoids perturbing world or traffic generation. Sample it in 32 m world-space cells with cell-dependent mirroring/rotation and neutral seam blending; keep crack relief and color aligned. Mipmaps and anisotropy prevent distant texture shimmer. The shared map adds about 5.3 MiB including mipmaps and no additional road draw calls.

Maintain the canonical asphalt/marking colors; wear modulates them rather than replacing road ownership or collision masks. White/yellow paint receives granular fading and crack wear while retaining route legibility. The same material reacts to sunlight, street lighting and vehicle headlights at every quality setting. Damage is shading detail on the existing flat road surface, not physical potholes or suspension obstacles. No new controls or interface flows are introduced.


## Vehicle-to-character proportions (2026-10-20)

All world dimensions use metres. Vehicle `TY` lengths/widths and their physical collision footprints remain canonical. `HUMAN` owns character height calibration: the procedural joint rig is 2.02 m tall before scaling; the player is 1.80 m and pedestrians vary from 1.65 to 1.88 m. `mkHuman` accepts actual `height`, not an arbitrary visual scale. Preserve the 5 mm sole offset in idle/walk animation so shoes remain grounded. Character contact shadows follow the calibrated footprint. This makes existing cars approximately 18% larger relative to the player compared with the former 1.05-scale (about 2.12 m) player. Sedan roofs should sit near shoulder height. Vehicle geometry, physics, parking fit, front-left door coordinates and seated camera ownership stay in world metres.


## Adjustable world population (2026-10-20)

Menu → Settings → World population owns native range sliders for Pedestrians (0–128, increments of 8) and Traffic cars (0–48, increments of 2). Use the existing `.gp-row.gp-range` controls, tabular count outputs, full-width 44 px targets, descriptive text and `aria-valuetext`. Show actual active counts in the shared polite population status. Changes apply on `input`; save on `change` using the existing local save, conflict and denied-storage behavior. Desktop defaults remain 64/24, mobile 48/18; missing older save fields use device defaults. Restored counts must be finite, clamped and snapped to the permitted step. Graphics presets do not override population.

`DrivingGame.applyPopulation` owns active actor membership and bounded reusable pools. Reconcile requested counts while paused immediately, then check once per second in `frame` to replenish taken traffic; never mutate vehicle arrays midway through a physics step. Shrink by removing farther actors first. Preserve parked cars, police, the current car, last-used car and active door transitions. Reuse removed ambient cars/pedestrians, detach pooled roots from the scene and simulation arrays, release junction claims, and invalidate pose buffers when membership changes. Shared meshes/materials remain available for reuse. Add traffic only to clear lane positions; live additions spawn at least 55 m away. Pedestrians prefer distant existing sidewalk routes. Update scenery visibility, contact shadows and map after membership changes.

The earlier fixed-count initialization loops are superseded by these saved settings and their runtime controller. Existing vehicle scale, road surface and UI palette ownership are unchanged.


## Internet multiplayer and room chat (2026-10-20)

`CityMultiplayer` in `multiplayer.js` owns the Online pane, invite link, roster, room chat, remote render actors and connection lifecycle. Extend the existing pause menu with a fifth Online tab, reuse its controls/tokens, and expose a compact Online button below the right-side map controls. Chat is a non-modal panel with an explicit label, bounded scrollable log, Send/Close controls, sending/error feedback and preserved drafts. T opens it, Escape closes it, and focusing editable fields must never trigger movement, entry, camera or menu keys. Pause-menu focus behavior remains native; gameplay controls reset whenever chat opens/closes. Mobile chat sits above the touch pedals with its own bounded scrolling.

`server.mjs` owns room membership (16 per room), authenticated position relay and global chat within a room. The client uses same-origin fetch POST plus a streaming SSE response with authorization headers. No session tokens appear in URLs, local saves or logs. Nicknames are not verified accounts. Display messages and names through text nodes only. Cap chat length/rates/history and server session counts; validate all incoming poses/models before broadcasting. Connected status requires a live response; interrupted connections disable sending, preserve input and hide stale peers. Retry at 1/2/4 seconds up to three failures; session expiry offers Join again. Leave explicitly removes remote objects, credentials, labels and pooled vehicle resources without altering career progress.

`R` now uses the fixed 2026 procedural seed for a versioned shared city (`coast-2026-v1`). This supersedes per-load random city layouts. World collision, terrain and architecture must agree across clients. Player/vehicle transforms are replicated; local AI traffic, NPC density, police, jobs and parked-car ownership remain local. Remote actors are visual peers, outside `cars`, `peds`, local collision and population management. Use distance visibility and interpolation for peers; reuse a bounded vehicle pool and dispose only per-peer paint/light materials and instance buffers. Shared factory geometry remains resident. Remote players are cyan on the minimap. Server time supplies the shared day/night phase.

Single-player continues on static hosting or on disconnect. A Node web service is required for multiplayer. The Render Blueprint and Dockerfile prepare one hosted process; no public deployment is claimed. `DEPLOYMENT.md` is the deployment and network-scope contract.
