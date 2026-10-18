# Budget Vice City design context

## Overview

A browser driving sandbox with pastel coastal architecture, neon accents, palms and warm sunset lighting. The world is the main surface; keep controls compact and leave room to drive. Preserve the existing low-poly style.

## Colors

Runtime values in `index.html` are canonical. The `ROAD` object owns road colors: asphalt `#30343b`, sidewalk `#b9b4aa`, white edge markings `#eee9da`, and double yellow center lines `#e8c35b`. These feed world-space road meshes and the minimap canvas. Grass and sand retain `#4f7f3a` and `#e3cf9a`.

## Typography

The existing HUD uses 13px sans-serif for compact driving information. Road changes do not introduce new menus or type styles.

## Layout

Use long 18 m streets, 22 m coastal/outer boulevards and a 14 m island bridge. Favor sweeping curves and occasional T-junctions over a dense, uniform intersection grid. The coastline and lighthouse remain recognizable landmarks.

## Components

`roads` and `nodes` own the street network. Sampled centerlines drive world-space ribbons with antialiased edges, the minimap canvas, road and sidewalk collision masks, traffic paths, vehicle placement and roadside lighting. Buildings and palms must clear the sidewalk envelope. Keep visible roads and collision surfaces aligned through `tile()`; do not restore separate tile-grid road logic. Road surfaces and markings use geometry rather than the city-wide terrain texture so they stay smooth up close. Merge geometry into four material layers to limit draw calls, and draw those layers before transparent tyre marks and particles.

## Do's and Don'ts

- Keep road markings legible along bends and clear at junctions.
- Keep the bridge connected to the coastal road and its rails outside the carriageway.
- Check street-level and overhead views, vehicle clearance and traffic traversal when editing roads.
- Preserve keyboard and touch driving controls when changing world geometry.
