# Game interaction contract

This browser driving sandbox has one world and one native modal pause menu. It has no accounts, payments, remote mutations or server-side progress.

| Capability | Canonical owner | Behavior |
| --- | --- | --- |
| HUD, keyboard/touch input, pause dialog | `index.html` | H/Menu opens; Escape/Close restores focus to Menu. Pointer capture keeps steering, pedals and camera independent. Blur/hidden/menu release inputs. |
| Pause-menu panes and status | `gameplay.js` `DrivingGame.buildUI/showPane/notify` | Native buttons with selected `aria-pressed` state and pane ownership. One pane visible. Native modal traps focus. Feedback goes inside an open modal, otherwise to the world live region. |
| Graphics settings | `DrivingGame.applySettings` | Native select popup is intentional; range/checkboxes use native keyboard/touch semantics. Changes apply immediately, remain local, and save on commit. |
| Vehicle transitions | `DrivingGame.act/beforeStep` | Stop first; find a clear side; suppress movement until the animation finishes. Repeated input cannot start a second transition. Failure gives readable guidance. |
| Activities | `DrivingGame.startActivity/updateActivity/finishActivity` | Start from a usable car. Ordered route targets, visible timer/marker, pause with the menu. Success updates best/count; failure preserves previous achievements. Cancel and retry are reversible. |
| Local progress | `DrivingGame.snapshot/save/restore` | Validate version/data. Autosave stable state; manual save acknowledges success or failure. Corrupt/denied storage keeps play available. Cross-tab writes stop autosave until manual override. No claim of cloud synchronization. |

The root CSS tokens in `index.html` own color and type. Menu/HUD extensions in `gameplay.js` reference those tokens. The game intentionally owns viewport scrolling; the pause dialog owns its own overflow and inherited visible scrollbar. Timers and FPS are not live regions; only state changes announce. Motion starts disabled under a reduced-motion preference.

Runtime evidence: `tests/gameplay-browser.py` covers desktop/mobile keyboard/touch, completion/failure/recovery, modal pause, render settings, storage failure/corruption/conflict, saved parked-car recovery and traffic behavior. `tests/vehicle-physics.cjs` covers vehicle forces, wheel support/slip, rotated and swept contacts and render-rate independence.

Additional owners: `vehicle-dynamics.js` owns physics contacts and wheel support; `DrivingGame.navigationHud/toggleMap` own entry hints, instruments and map state; `DrivingGame.recoverVehicle` owns recovery; `window.gameBoot` owns startup loading/failure/retry. `driving.css` references the canonical root tokens. Recovery retains damage and activity time, chooses a clear drivable lane and refuses to run during entry/exit. Settings restore only known units, finite bounded sensitivities and boolean motion toggles. Reduced-motion defaults disable suspension/lean, shake and blur separately.

Static audit evidence is retained in `tests/ui-audit.json`. Its `affordance.actionless-button` reports are reviewed false positives: the scanner only detects inline event attributes. Existing menu/activity/vehicle buttons bind in `DrivingGame.bind`; Help, sound, entry, camera and pedal buttons bind through event properties/pointer handlers in `index.html`. The new map, prompt, recovery and retry buttons also bind programmatically. Browser tests exercise these actions, including a forced graphics-loading failure. Preserve programmatic binding rather than duplicating inline actions for this scanner.


Camera selection is owned by `CAMERA_VIEWS/cyc()` in `index.html`, shared by C, the touch Camera/POV button and `menu-camera` in the Vehicle pane. Driver POV is saved as mode 3, starts with level look, keeps fixed seating/FOV and disables chase zoom/radial blur. The existing motion preference controls subtle head movement. `DrivingGame` owns the shared interior rig; its visibility and the exterior car visibility must reset when changing views or leaving a vehicle. `tests/gameplay-browser.py --only-pov` covers desktop/touch layout, cycle/menu, pose, look-around, steering animation, persistence and model/exit behavior.
