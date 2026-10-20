# Game interaction contract

This browser driving sandbox has one world and one native modal pause menu. It has no accounts, payments, remote mutations or server-side progress.

| Capability | Canonical owner | Behavior |
| --- | --- | --- |
| HUD, keyboard/touch input, pause dialog | `index.html` | H/Menu opens; Escape/Close restores focus to Menu. Pointer capture keeps steering, pedals and camera independent. Blur/hidden/menu release inputs. |
| Pause-menu panes and status | `gameplay.js` `DrivingGame.buildUI/showPane/notify` | Native buttons with selected `aria-pressed` state and pane ownership. One pane visible. Native modal traps focus. Feedback goes inside an open modal, otherwise to the world live region. |
| Graphics settings | `DrivingGame.applySettings` | Native select popup is intentional; range/checkboxes use native keyboard/touch semantics. Changes apply immediately, remain local, and save on commit. |
| Vehicle transitions | `DrivingGame.act/beforeStep` | Stop first. Always exit through the clear front-left door; refuse a blocked left door without switching sides. Entry may use either clear front door. Parking brake holds the vehicle with no throttle/service-brake input throughout the transition, preserving gear and preventing brake-to-reverse creep. Repeated input cannot start a second transition. Failure gives readable guidance. |
| Activities | `DrivingGame.startActivity/updateActivity/finishActivity` | Start from a usable car. Ordered route targets, visible timer/marker, pause with the menu. Success updates best/count; failure preserves previous achievements. Cancel and retry are reversible. |
| Local progress | `DrivingGame.snapshot/save/restore` | Validate version/data. Autosave stable state; manual save acknowledges success or failure. Corrupt/denied storage keeps play available. Cross-tab writes stop autosave until manual override. No claim of cloud synchronization. |

The root CSS tokens in `index.html` own color and type. Menu/HUD extensions in `gameplay.js` reference those tokens. The game intentionally owns viewport scrolling; the pause dialog owns its own overflow and inherited visible scrollbar. Timers and FPS are not live regions; only state changes announce. Motion starts disabled under a reduced-motion preference.

Runtime evidence: `tests/gameplay-browser.py` covers desktop/mobile keyboard/touch, completion/failure/recovery, modal pause, render settings, storage failure/corruption/conflict, saved parked-car recovery and traffic behavior. `tests/vehicle-physics.cjs` covers vehicle forces, wheel support/slip, rotated and swept contacts and render-rate independence.

Additional owners: `vehicle-dynamics.js` owns physics contacts and wheel support; `DrivingGame.navigationHud/toggleMap` own entry hints, instruments and map state; `DrivingGame.recoverVehicle` owns recovery; `window.gameBoot` owns startup loading/failure/retry. `driving.css` references the canonical root tokens. Recovery retains damage and activity time, chooses a clear drivable lane and refuses to run during entry/exit. Settings restore only known units, finite bounded sensitivities and boolean motion toggles. Reduced-motion defaults disable suspension/lean, shake and blur separately.

Static audit evidence is retained in `tests/ui-audit.json`. Its `affordance.actionless-button` reports are reviewed false positives: the scanner only detects inline event attributes. Existing menu/activity/vehicle buttons bind in `DrivingGame.bind`; Help, sound, entry, camera and pedal buttons bind through event properties/pointer handlers in `index.html`. The new map, prompt, recovery and retry buttons also bind programmatically. Browser tests exercise these actions, including a forced graphics-loading failure. Preserve programmatic binding rather than duplicating inline actions for this scanner.


Camera selection is owned by `CAMERA_VIEWS/cyc()` in `index.html`, shared by C, the touch Camera/POV button and `menu-camera` in the Vehicle pane. Driver POV is saved as mode 3, starts with level look, keeps fixed seating/FOV and disables chase zoom/radial blur. The existing motion preference controls subtle head movement. `DrivingGame` owns the shared interior rig; its visibility and the exterior car visibility must reset when changing views or leaving a vehicle. `tests/gameplay-browser.py --only-pov` covers desktop/touch layout, cycle/menu, pose, look-around, steering animation, persistence and model/exit behavior.

| Sandbox capability | Canonical owner | Observable contract |
| --- | --- | --- |
| Career and wanted state | `OpenWorld.snapshot/restore/tick` | Optional bounded career data shares DrivingGame saves; simulation-time search/capture pauses with the game. Restore heat without persisting stale police references. |
| Police pursuit | `OpenWorld.dispatchUnit/routeFor/drivePolice` | At most three pooled sedans; roads and existing physics own movement. Buildings obstruct sight and capture. Five slow/stopped seconds near visible police causes arrest; continuous hiding ends search. |
| City services | `OpenWorld.nearbyService/interact` | Prompt and action choose the same nearest entrance. Q and touch/button are equivalent. Stop first; refuse during jobs/pursuits/transitions, insufficient funds or unnecessary treatment. Save only successful charges. |
| Paid jobs | `DrivingGame.finishActivity` | Pay once on success only. Hot cargo requires three ordered checkpoints and then zero wanted heat; preserve the escape phase on reload. Capture or zero health fails the job without reward. |
| Recovery consequence | `OpenWorld.respawn` | Clear job/pursuit, deduct only available funds, restore health, move on foot to a clear station/clinic location and leave the last car recoverable. |

City-services interaction intentionally supersedes the earlier exterior-only description for workshop/clinic/fuel-site services. No building interior or fuel-consumption behavior is implied. Runtime color/type tokens remain in `index.html`; sandbox styles extend `driving.css`. Static button-scan results for programmatic event bindings and generated historical fixtures are reviewed false positives, with real browser interaction evidence in `tests/artifacts/sandbox-review.json`.

| Render capability | Canonical owner | Observable contract |
| --- | --- | --- |
| Building cells and distant skyline | `WorldStreamer` in `world-streaming.js` | 80 m cells, 6/9/12 detailed-cell caps, small loading batches, shared asset reuse and instance-buffer disposal. Geometry visibility never changes collision/navigation. |
| Garden elevation | `planGardenHills/worldElevation/updateTerrainPose` | Reserve green space before architecture; mesh, wheel support, character/prop elevation and slope presentation share one height function. Roads and civic driveways remain flat. |
| Parking destinations | `structures.js`, canonical `mkCar` | Two reserved 14-space lots with actual parked vehicles, clear central aisles/access, signs and collision footprints. Lowercase p distinguishes parking from police P on the map. |
| Distance presentation | `updateScenery/optimizeVehicleRendering` | Preserve the active car at full detail; switch distant car bodies/wheels, pedestrians and vegetation under graphics budgets. Driver POV and the removed nearby-car wireframe remain unchanged. |

| Capability | Canonical owner | Behavior |
| --- | --- | --- |
| Vehicle indicator visibility | `updateVehicleIndicators`, with state selected by `DrivingGame.signal` | One simulation-time 450 ms on / 450 ms off cycle. Detail refreshes cannot enable indicator meshes. Selecting the active left/right/hazard mode again turns it off immediately; pause preserves the phase and distance changes preserve the logical state. |


World-population settings are owned by `DrivingGame.settings/applyPopulation`: pedestrian range 0–128 (step 8), moving traffic range 0–48 (step 2). Native ranges support keyboard/touch and report both requested values and actual active counts. Input applies live, change saves locally, and restore clamps finite values; older saves use the device defaults. Lowering density preserves parked/claimed cars, police and door transitions. Reusable pools leave inactive actors outside the scene and physics arrays. Graphics presets do not reset density. `tests/population-settings-browser.py` covers zero/max, keyboard input, safe spawns, actor reuse, protected vehicles, persistence, malformed saved values and narrow-screen geometry.


Online play is owned by `CityMultiplayer` and same-origin `server.mjs`. Join is pending until the API responds; duplicate joins are blocked, invalid input stays editable, and failures re-enable Join with readable status. Copy invite uses the Clipboard API with a select/copy fallback. Room chat is public to room members, uses server-confirmed sends and preserves failed drafts. Global game hotkeys ignore editable targets and chat resets held controls. A polite chat log announces new text; historical replay is deduplicated. Reconnect is bounded/cancellable and stale actors hide. Leaving remains available during reconnect, ends presence and resumes single-player. Credentials remain in memory/authorization headers; invites contain only the room code. Hosting preparation does not imply a launched server.
