import * as THREE from 'three';

// University Park overview. Coordinates are WGS84; model dimensions use local metres.
export const BOUNDS = { south: 52.928, west: -1.213, north: 52.949, east: -1.184 };
const MID_LAT = (BOUNDS.south + BOUNDS.north) / 2;
const MID_LON = (BOUNDS.west + BOUNDS.east) / 2;
export const SCALE_X = 111320 * Math.cos(MID_LAT * Math.PI / 180);
export const SCALE_Z = 111320;
export const WIDTH = (BOUNDS.east - BOUNDS.west) * SCALE_X;
export const DEPTH = (BOUNDS.north - BOUNDS.south) * SCALE_Z;
export const TERRAIN_ZOOM = 15;

export function project(lon, lat) {
  return { x: (lon - MID_LON) * SCALE_X, z: -(lat - MID_LAT) * SCALE_Z };
}

export function tilePixel(lon, lat, zoom = TERRAIN_ZOOM) {
  const n = 2 ** zoom;
  const px = (lon + 180) / 360 * n * 256;
  const latRad = lat * Math.PI / 180;
  const py = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n * 256;
  return { x: px, y: py, tx: Math.floor(px / 256), ty: Math.floor(py / 256) };
}

async function loadTerrariumTiles() {
  const corners = [
    tilePixel(BOUNDS.west, BOUNDS.north), tilePixel(BOUNDS.east, BOUNDS.north),
    tilePixel(BOUNDS.west, BOUNDS.south), tilePixel(BOUNDS.east, BOUNDS.south)
  ];
  const minX = Math.min(...corners.map(p => p.tx));
  const maxX = Math.max(...corners.map(p => p.tx));
  const minY = Math.min(...corners.map(p => p.ty));
  const maxY = Math.max(...corners.map(p => p.ty));
  const tiles = new Map();
  const requests = [];
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) requests.push((async () => {
    const response = await fetch(`https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${TERRAIN_ZOOM}/${x}/${y}.png`);
    if (!response.ok) throw new Error(`高程瓦片请求失败（HTTP ${response.status}）`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bitmap, 0, 0);
    tiles.set(`${x}/${y}`, { data: ctx.getImageData(0, 0, 256, 256).data, bitmap });
  })());
  await Promise.all(requests);
  return tiles;
}

function createSampler(tiles) {
  return (lon, lat) => {
    const p = tilePixel(lon, lat);
    const tile = tiles.get(`${p.tx}/${p.ty}`);
    if (!tile) return null;
    const fx = Math.max(0, Math.min(255, p.x - p.tx * 256));
    const fy = Math.max(0, Math.min(255, p.y - p.ty * 256));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(255, x0 + 1), y1 = Math.min(255, y0 + 1);
    const tx = fx - x0, ty = fy - y0;
    const pixel = (x, y) => { const k = (y * 256 + x) * 4; return tile.data[k] * 256 + tile.data[k + 1] + tile.data[k + 2] / 256 - 32768; };
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(pixel(x0, y0), pixel(x1, y0), tx), THREE.MathUtils.lerp(pixel(x0, y1), pixel(x1, y1), tx), ty);
  };
}

async function loadAgencyLidarGrid(columns = 300, rows = 360) {
  const params = new URLSearchParams({
    bbox: `${BOUNDS.west},${BOUNDS.south},${BOUNDS.east},${BOUNDS.north}`,
    bboxSR: '4326', imageSR: '4326', size: '1300,1560', format: 'tiff',
    pixelType: 'F32', interpolation: 'RSP_Bilinear', f: 'image'
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  let response;
  try {
    response = await fetch(`https://environment.data.gov.uk/image/rest/services/EA/LIDAR_Composite_DTM_2022_1m/ImageServer/exportImage?${params}`, { signal: controller.signal });
  } finally { clearTimeout(timeout); }
  if (!response.ok) throw new Error(`EA LiDAR 请求失败（HTTP ${response.status}）`);
  const { fromArrayBuffer } = await import('geotiff');
  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const source = await image.readRasters({ interleave: true });
  const sw = image.getWidth(), sh = image.getHeight(), nodata = image.getGDALNoData();
  const values = new Float32Array(columns * rows); let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const sx = Math.min(sw - 1, Math.round(x / (columns - 1) * (sw - 1)));
    const sy = Math.min(sh - 1, Math.round(y / (rows - 1) * (sh - 1)));
    let h = source[sy * sw + sx];
    if (!Number.isFinite(h) || h === nodata || h < -1000 || h > 10000) {
      let found = false;
      for (let r = 1; r <= 6 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
        const xx = Math.max(0, Math.min(sw - 1, sx + dx)), yy = Math.max(0, Math.min(sh - 1, sy + dy));
        const candidate = source[yy * sw + xx];
        if (Number.isFinite(candidate) && candidate !== nodata && candidate > -1000 && candidate < 10000) { h = candidate; found = true; }
      }
      if (!found) throw new Error('EA LiDAR returned substantial NoData coverage.');
    }
    values[y * columns + x] = h; lo = Math.min(lo, h); hi = Math.max(hi, h);
  }
  if (hi - lo < 2) throw new Error('EA LiDAR returned an invalid height range.');
  return { values, columns, rows, min: lo, max: hi, interval: 2, sourceShort: 'EA LiDAR 1 m', sourceNote: 'Environment Agency LIDAR Composite DTM · 2022 · 1 m' };
}

async function loadTerrariumGrid(columns = 180, rows = 220) {
  const tiles = await loadTerrariumTiles();
  const sample = createSampler(tiles);
  const values = new Float32Array(columns * rows);
  let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const lon = THREE.MathUtils.lerp(BOUNDS.west, BOUNDS.east, x / (columns - 1));
    const lat = THREE.MathUtils.lerp(BOUNDS.north, BOUNDS.south, y / (rows - 1));
    const h = sample(lon, lat);
    if (h == null || !Number.isFinite(h)) throw new Error('高程数据未覆盖完整地图范围。');
    values[y * columns + x] = h;
    lo = Math.min(lo, h); hi = Math.max(hi, h);
  }
  return { values, columns, rows, min: lo, max: hi, interval: 10, sourceShort: 'Terrain Tiles ≈30 m', sourceNote: 'AWS Terrain Tiles · global DEM approximately 30 m locally', sample };
}

export async function loadElevationGrid() {
  try { return await loadAgencyLidarGrid(); }
  catch (error) {
    console.warn('EA LiDAR unavailable; using lower-resolution public terrain tiles.', error);
    return loadTerrariumGrid();
  }
}

export function heightAt(grid, x, z) {
  const gx = THREE.MathUtils.clamp((x / WIDTH + 0.5) * (grid.columns - 1), 0, grid.columns - 1);
  const gy = THREE.MathUtils.clamp((z / DEPTH + 0.5) * (grid.rows - 1), 0, grid.rows - 1);
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const x1 = Math.min(x0 + 1, grid.columns - 1), y1 = Math.min(y0 + 1, grid.rows - 1);
  const tx = gx - x0, ty = gy - y0;
  const a = THREE.MathUtils.lerp(grid.values[y0 * grid.columns + x0], grid.values[y0 * grid.columns + x1], tx);
  const b = THREE.MathUtils.lerp(grid.values[y1 * grid.columns + x0], grid.values[y1 * grid.columns + x1], tx);
  return THREE.MathUtils.lerp(a, b, ty);
}

function colorForHeight(h, min, max) {
  const t = (h - min) / Math.max(1, max - min);
  const color = new THREE.Color();
  if (t < .4) color.setRGB(.64 + t * .28, .68 + t * .3, .51 + t * .25);
  else if (t < .75) color.setRGB(.75 + (t - .4) * .27, .8 - (t - .4) * .35, .61 - (t - .4) * .25);
  else color.setRGB(.85, .68 - (t - .75) * .55, .43 - (t - .75) * .2);
  return color;
}

export function createTerrain(grid) {
  const geometry = new THREE.PlaneGeometry(WIDTH, DEPTH, grid.columns - 1, grid.rows - 1);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = [];
  for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.columns; x++) {
    const i = y * grid.columns + x;
    const h = grid.values[i];
    positions.setY(i, (h - grid.min) * 3);
    const c = colorForHeight(h, grid.min, grid.max);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  return mesh;
}

function interpolate(a, b, level) {
  const t = a.h === b.h ? .5 : THREE.MathUtils.clamp((level - a.h) / (b.h - a.h), 0, 1);
  return { x: THREE.MathUtils.lerp(a.x, b.x, t), z: THREE.MathUtils.lerp(a.z, b.z, t) };
}

export function createContours(grid, interval = 2) {
  const minor = [], major = [];
  const first = Math.ceil(grid.min / interval) * interval;
  for (let level = first; level <= grid.max; level += interval) {
    const out = level % 10 === 0 ? major : minor;
    for (let y = 0; y < grid.rows - 1; y++) for (let x = 0; x < grid.columns - 1; x++) {
      const x0 = -WIDTH / 2 + x * WIDTH / (grid.columns - 1);
      const x1 = -WIDTH / 2 + (x + 1) * WIDTH / (grid.columns - 1);
      const z0 = -DEPTH / 2 + y * DEPTH / (grid.rows - 1);
      const z1 = -DEPTH / 2 + (y + 1) * DEPTH / (grid.rows - 1);
      const corners = [
        { x: x0, z: z0, h: grid.values[y * grid.columns + x] },
        { x: x1, z: z0, h: grid.values[y * grid.columns + x + 1] },
        { x: x1, z: z1, h: grid.values[(y + 1) * grid.columns + x + 1] },
        { x: x0, z: z1, h: grid.values[(y + 1) * grid.columns + x] }
      ];
      const edges = [[0,1],[1,2],[2,3],[3,0]];
      const hits = [];
      for (const [a,b] of edges) if ((corners[a].h < level && corners[b].h >= level) || (corners[b].h < level && corners[a].h >= level)) hits.push(interpolate(corners[a], corners[b], level));
      if (hits.length >= 2) for (let i = 0; i + 1 < hits.length; i += 2) out.push(hits[i].x, (heightAt(grid, hits[i].x, hits[i].z) - grid.min) * 3 + .5, hits[i].z, hits[i+1].x, heightAt(grid, hits[i+1].x, hits[i+1].z) - grid.min + .22, hits[i+1].z);
    }
  }
  const group = new THREE.Group();
  for (const [points, color, opacity] of [[minor, 0x45675a, .45], [major, 0x73583d, .82]]) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
  }
  return group;
}

export async function loadRoads() {
  const query = `[out:json][timeout:35];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|track)$"](${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east});out tags geom;`;
  const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: `data=${encodeURIComponent(query)}` });
  if (!response.ok) throw new Error(`OpenStreetMap 道路接口请求失败（HTTP ${response.status}）`);
  const data = await response.json();
  if (!Array.isArray(data.elements) || data.elements.length === 0) throw new Error('道路接口没有返回校区范围内的数据。');
  return data.elements.filter(e => e.type === 'way' && e.geometry?.length > 1 && e.tags?.highway).map(e => ({ id: e.id, name: e.tags.name || e.tags.ref || '', kind: e.tags.highway, points: e.geometry.map(p => ({ ...project(p.lon, p.lat), lat: p.lat, lon: p.lon })) }));
}

const roadWidths = { motorway: 12, trunk: 10, primary: 8, secondary: 7, tertiary: 6, unclassified: 5, residential: 4.6, living_street: 4.2, service: 3.1, track: 2.7 };
export function createRoad(road, grid) {
  const points = road.points.map(p => new THREE.Vector3(p.x, (heightAt(grid, p.x, p.z) - grid.min) * 3 + .7, p.z));
  const width = roadWidths[road.kind] || 3.5;
  const verts = [], indices = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - prev.x, dz = next.z - prev.z, len = Math.hypot(dx, dz) || 1;
    const ox = -dz / len * width / 2, oz = dx / len * width / 2;
    verts.push(points[i].x + ox, points[i].y, points[i].z + oz, points[i].x - ox, points[i].y, points[i].z - oz);
    if (i < points.length - 1) { const n = i * 2; indices.push(n, n+1, n+2, n+1, n+3, n+2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setIndex(indices); geo.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: road.kind === 'service' || road.kind === 'track' ? 0xb5a88b : 0xf1e7ce, roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh(geo, material); mesh.userData.road = road; return mesh;
}

export function makeRoadLabel(text) {
  if (!text) return null;
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d'); ctx.font = '600 32px system-ui, sans-serif';
  const width = Math.min(500, ctx.measureText(text).width + 44); canvas.width = width; canvas.height = 70;
  const c = canvas.getContext('2d'); c.font = '600 24px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(247,245,232,.92)'; c.beginPath(); c.roundRect(1, 1, width - 2, 68, 16); c.fill();
  c.fillStyle = '#3f5046'; c.fillText(text, width / 2, 35, width - 24);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }));
  sprite.scale.set(width * .13, 18, 1); return sprite;
}
