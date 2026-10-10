import { geoEquirectangular, geoPath } from 'd3-geo';
import { merge } from 'topojson-client';
import landTopology from 'world-atlas/land-50m.json';
import { createGlobeTexture } from './globe-texture.js';
export function makeTileNoise(columns, rows, seed) {
  let state = seed; const values = new Float32Array(columns * rows);
  for (let i = 0; i < values.length; i++) { state = (state * 16807) % 2147483647; values[i] = state / 2147483647; }
  const fade = n => n * n * (3 - 2 * n);
  return (u, v) => {
    const x = ((u % 1) + 1) % 1 * columns, y = ((v % 1) + 1) % 1 * rows;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = fade(x - x0), fy = fade(y - y0);
    const at = (dx, dy) => values[((y0 + dy) % rows) * columns + (x0 + dx) % columns];
    const top = at(0, 0) * (1 - fx) + at(1, 0) * fx, bottom = at(0, 1) * (1 - fx) + at(1, 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

export function makeEarthTexture(anisotropy = 1) {
  const width = 2048, height = 1024, canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const land = merge(landTopology, landTopology.objects.land.geometries);
  const projection = geoEquirectangular().scale(width / (2 * Math.PI)).translate([width / 2, height / 2]);
  const path = geoPath(projection, ctx);
  // Use the bundled Natural Earth coastline as the geographic base, then
  // shade land into broad climate/terrain regions with fine-scale relief.
  // This avoids the visible atlas grid and flat, single-color continents.
  const mask = document.createElement('canvas'); mask.width = width; mask.height = height;
  const maskCtx = mask.getContext('2d'); maskCtx.fillStyle = '#fff'; maskCtx.beginPath(); geoPath(projection, maskCtx)(land); maskCtx.fill();
  const landMask = maskCtx.getImageData(0, 0, width, height).data;
  const image = ctx.createImageData(width, height); const data = image.data;
  const broadNoise = makeTileNoise(22, 11, 68131), midNoise = makeTileNoise(70, 35, 93817), fineNoise = makeTileNoise(220, 110, 41239);
  for (let y = 0; y < height; y++) {
    const v = y / height, latitude = 90 - v * 180, absLat = Math.abs(latitude);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const u = x / width, broad = broadNoise(u, v), mid = midNoise(u, v), fine = fineNoise(u, v);
      const ocean = landMask[i] < 100;
      let color;
      if (ocean) {
        // Keep open water almost uniform: a very soft, isotropic variation
        // reads as ocean depth without producing latitude-like stripes.
        const depth = (broad - .5) * 5 + (mid - .5) * 2 + (fine - .5);
        color = [Math.round(14 + depth * .65), Math.round(43 + depth * 1.2), Math.round(70 + depth * 1.8)];
      } else {
        const aridity = (broad - .5) * .86 + (mid - .5) * .68;
        let base;
        if (absLat > 70) base = [190, 193, 177];
        else if (absLat < 27 && aridity > .17) base = [157, 139, 94];
        else if (absLat < 12) base = [57, 111, 71];
        else if (aridity > .36) base = [143, 137, 98];
        else if (aridity < -.24) base = [73, 112, 77];
        else base = [111, 130, 88];
        const relief = (broad - .5) * 14 + (mid - .5) * 12 + (fine - .5) * 8;
        color = base.map((value, c) => Math.max(0, Math.min(255, Math.round(value + relief * (c === 2 ? .7 : 1)))));
      }
      data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  ctx.beginPath(); path(land); ctx.strokeStyle = 'rgba(202,205,169,.55)'; ctx.lineWidth = .8; ctx.stroke();
  return createGlobeTexture(canvas, anisotropy);
}

