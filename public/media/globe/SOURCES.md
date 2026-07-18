# Globe rendering sources

The runtime textures in this folder were retrieved from the official Three.js
examples on 2026-07-18:

- `earth-day.jpg`: https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg
- `earth-night.png`: https://threejs.org/examples/textures/planets/earth_lights_2048.png
- `earth-normal.jpg`: https://threejs.org/examples/textures/planets/earth_normal_2048.jpg
- `earth-specular.jpg`: https://threejs.org/examples/textures/planets/earth_specular_2048.jpg
- `earth-clouds.png`: https://threejs.org/examples/textures/planets/earth_clouds_1024.png
- `countries-50m.json`: `world-atlas@2.0.2` (Natural Earth source data)

The rendering approach was checked against these public references:

- ThreeGlobe day/night cycle: https://github.com/vasturiano/three-globe/tree/master/example/day-night-cycle
- ThreeGlobe cloud layer: https://github.com/vasturiano/three-globe/tree/master/example/clouds
- ThreeGlobe animated links: https://github.com/vasturiano/three-globe/tree/master/example/links
- React Three Fiber performance guidance: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- NASA Blue Marble: https://science.nasa.gov/earth/earth-observatory/collections/blue-marble/
- NASA Earth at Night: https://science.nasa.gov/earth/earth-observatory/earth-at-night/
- Google Photorealistic 3D Tiles, used only as a visual benchmark: https://developers.google.com/maps/documentation/tile/3d-tiles

Keep this provenance file with the assets and review upstream terms before any
commercial redistribution.
