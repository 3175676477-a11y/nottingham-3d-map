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

The app first requests the Environment Agency's 2022 LIDAR Composite DTM at 1 m resolution through its public ArcGIS ImageServer. If the service is unavailable or blocked by browser/network policy, it falls back to AWS Terrain Tiles, which are approximately 30 m resolution locally. The map labels which dataset loaded and changes the contour interval to 10 m for the coarse fallback. Neither grid interpolation nor tighter contour spacing creates more source detail.

Road geometry comes from the Overpass API for OpenStreetMap. Road names and classifications are provided by OpenStreetMap contributors under the ODbL. Contours are interpolated from the loaded elevation grid; vertical relief is exaggerated 3× for legibility. The coverage is a University Park overview including nearby surroundings, not a navigation or engineering survey product. Public APIs may rate-limit or be unavailable; the app reports failures instead of inventing terrain or roads.

Sources: [Environment Agency LIDAR](https://environment.data.gov.uk/DefraDataDownload/?Mode=survey), [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), and [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

## Sun–Earth–Moon observatory

Open `/astronomy.html` from the Vite server (for example `http://localhost:5173/astronomy.html`). The space view follows Earth as it orbits the Sun; the globe uses the bundled 1:50m Natural Earth coastlines, country borders, relief shading, and a moving cloud layer. Click a point on Earth to jump to `/sky.html`, a separate ground-observer view. Drag there to look around from the horizon; the Sun and Moon follow their paths across the sky and the Moon's lit phase is visible. Cardinal bearings, local sunrise/sunset, daylight duration, twilight, Moon phase, altitude, and azimuth are shown for the selected time. The timeline can be paused or advanced at accelerated rates. Earth outlines are bundled locally and do not require a map API.

Solar altitude and sunrise estimates use NOAA-style solar equations with the conventional −0.833° sunrise/sunset horizon. Lunar coordinates use a low-precision orbital-elements model suitable for an educational visualization; phase/azimuth are approximate and are not an ephemeris for navigation. Orbital distances and body sizes are strongly compressed for visibility.
