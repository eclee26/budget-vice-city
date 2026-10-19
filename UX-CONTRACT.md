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

Runtime evidence: `tests/gameplay-browser.py` covers desktop/mobile keyboard/touch, completion/failure/recovery, modal pause, render settings, storage failure/corruption/conflict, saved parked-car recovery and traffic behavior. `tests/vehicle-physics.cjs` covers the unchanged core vehicle model.

Static audit evidence is retained in `tests/ui-audit.json`. Its 11 `affordance.actionless-button` reports are reviewed false positives: the scanner only detects inline `onclick` attributes. Menu/activity buttons bind in `DrivingGame.bind`; existing Help, sound, entry, camera, and pedal buttons bind through `onclick` properties and pointer handlers in `index.html`. Browser tests exercise these handlers. Keep programmatic binding instead of duplicating inline actions to satisfy this scanner.
