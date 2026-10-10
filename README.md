# University Park Contour Map

A Three.js terrain study of the University of Nottingham's University Park campus. It shows terrain contours and mapped roads without building models. Drag to orbit, scroll to zoom, right-drag to pan. The map controls toggle contour lines and road labels and reset the view.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

Open the local URL shown by Vite, usually `http://localhost:5173`.

## Data and accuracy

The app loads public terrain tiles from AWS Terrain Tiles in the Terrarium RGB format and road geometry from the Overpass API for OpenStreetMap. Internet access is required. AWS source terrain is roughly 30 m resolution in this area; the rendered grid interpolates those pixels, which does not add source detail. Contours are interpolated from this surface at 2 m intervals, and 10 m index contours are highlighted. Vertical relief is exaggerated 3× for legibility. OpenStreetMap contributes road names and classifications under the ODbL. Attribution links and precision caveats appear in the map.

The extent is a University Park overview, including some surroundings. It is an illustrative campus map, not a navigation or engineering survey product. Public APIs can be rate-limited or unavailable; the app reports data-loading failures instead of inventing terrain or roads.

Sources: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) and [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
