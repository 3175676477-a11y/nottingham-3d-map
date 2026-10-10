import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import { BOUNDS, WIDTH, DEPTH, loadElevationGrid, loadRoads, createTerrain, createContours, createRoad, makeRoadLabel } from './topography.js';

const app = document.querySelector('#app');
app.innerHTML = `<main class="map-shell"><header class="masthead"><div class="wordmark"><span class="mark">U</span><div><strong>FIELDNOTES <i>/</i> 01</strong><small>NOTTINGHAM · UNIVERSITY PARK</small></div></div><div class="edition">TERRAIN STUDY&nbsp; <b>52°56′N&nbsp; 01°12′W</b></div></header><section class="title"><span class="eyebrow">CAMPUS LANDSCAPE / 地形专题</span><h1>Contours of<br><em>University Park.</em></h1><p>诺丁汉大学 · University Park 校区地形与道路</p></section><div id="scene"><div class="loading"><i></i><span>正在读取公开地形与道路数据…</span><small>高程瓦片 · OpenStreetMap</small></div></div><aside class="data-card"><span class="eyebrow">TERRAIN / 地形</span><h2>地势与坡度</h2><div class="legend"><div><i class="line minor"></i><span>等高线 <b id="contour-interval">2 m</b></span></div><div><i class="line major"></i><span>主等高线 <b>10 m</b></span></div><div><i class="road-swatch"></i><span>道路 <b>OSM</b></span></div></div><div class="stats"><div><span>范围</span><b>University Park</b></div><div><span>高程范围</span><b id="elevations">读取中</b></div><div><span>高程数据</span><b id="terrain-source">读取中</b></div><div><span>垂直夸大</span><b>3 ×</b></div><div><span>道路要素</span><b id="road-count">读取中</b></div></div><div id="data-status" class="data-status">正在连接公开数据源…</div></aside><div class="map-stamp">UP<br><span>UNIVERSITY<br>PARK</span></div><div class="north">N <i>↑</i></div><div class="scale"><span>0</span><i></i><span>500 m</span></div><div class="map-controls"><button id="contours-toggle" class="active" aria-pressed="true"><span>〰</span> 等高线</button><button id="labels-toggle" class="active" aria-pressed="true"><span>Aa</span> 道路名称</button><button id="reset-view" title="重置视角">↺</button></div><div class="orbit-hint">拖动旋转&nbsp; · &nbsp;滚轮缩放&nbsp; · &nbsp;右键平移</div><details class="sources"><summary>数据来源与精度说明</summary><p>地形：AWS Terrain Tiles（Terrarium 高程瓦片；源数据约 30 m 级，网格插值不增加原始精度，垂直视觉夸大 3 倍）。道路：OpenStreetMap contributors（ODbL），显示机动车道路及服务道路。等高线依据瓦片内插值生成，2 m 间隔仅用于可视化，精度受源数据限制。范围为校区周边概览，不用于导航或工程测量。</p><p><a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">AWS Terrain Tiles ↗</a>　<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap attribution ↗</a></p></details><footer><span>地形先于建筑 · 校园道路网络</span><span>DATA : PUBLIC SOURCES&nbsp; / &nbsp;CONTOUR INTERVAL : 2 M</span></footer></main>`;

const stage = document.querySelector('#scene');
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xdbe1d7); scene.fog = new THREE.Fog(0xdbe1d7, 4500, 10000);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 1, 20000); camera.position.set(WIDTH * .72, WIDTH * .6, DEPTH * .88);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(stage.clientWidth, stage.clientHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; stage.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xf4f2e9, 0x76856a, 2));
const sun = new THREE.DirectionalLight(0xfff1d7, 2.6); sun.position.set(-WIDTH * .35, WIDTH * .8, DEPTH * .3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -WIDTH; sun.shadow.camera.right = WIDTH; sun.shadow.camera.top = DEPTH; sun.shadow.camera.bottom = -DEPTH; scene.add(sun);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 20, 0); controls.enableDamping = true; controls.dampingFactor = .06; controls.minDistance = 250; controls.maxDistance = 7000; controls.maxPolarAngle = Math.PI * .49; controls.update();
const overlays = { contours: null, roads: [], labels: [] };
const hint = document.querySelector('.orbit-hint');
const setStatus = (text, state = '') => { const node = document.querySelector('#data-status'); node.textContent = text; node.className = `data-status ${state}`; };

async function initialize() {
  try {
    const grid = await loadElevationGrid();
    const terrain = createTerrain(grid); terrain.position.y = 0; scene.add(terrain);
    overlays.contours = createContours(grid, grid.interval); scene.add(overlays.contours);
    document.querySelector('#contour-interval').textContent = `${grid.interval} m`;
    document.querySelector('#terrain-source').textContent = grid.sourceShort;
    document.querySelector('#elevations').textContent = `${Math.floor(grid.min)}–${Math.ceil(grid.max)} m`;
    setStatus(`${grid.sourceNote} · 等高线由地形网格插值生成。`, grid.interval <= 2 ? 'ok' : 'warn');
    try {
      const roads = await loadRoads();
      for (const road of roads) {
        const mesh = createRoad(road, grid); scene.add(mesh); overlays.roads.push(mesh);
        if (road.name && road.points.length > 8 && overlays.labels.length < 100) {
          const middle = road.points[Math.floor(road.points.length / 2)];
          const label = makeRoadLabel(road.name); if (label) { label.position.set(middle.x, mesh.geometry.attributes.position.getY(Math.floor(road.points.length / 2) * 2) + 14, middle.z); scene.add(label); overlays.labels.push(label); }
        }
      }
      document.querySelector('#road-count').textContent = `${roads.length} 段`;
      setStatus(`已载入 ${roads.length} 段 OpenStreetMap 道路。`, 'ok');
    } catch (error) {
      document.querySelector('#road-count').textContent = '暂不可用';
      setStatus(`高程已显示；道路加载失败：${error.message}。检查网络后刷新页面。`, 'warn');
    }
    document.querySelector('.loading')?.remove();
  } catch (error) {
    const loading = document.querySelector('.loading');
    loading.innerHTML = `<strong>暂时无法载入地形数据</strong><span>${error.message}</span><small>地图依赖公开高程瓦片与 OpenStreetMap 数据；请检查网络连接后刷新重试。</small>`;
    loading.classList.add('error'); setStatus('公开高程服务当前不可用。', 'warn');
    document.querySelector('#elevations').textContent = '未载入';
  }
}

initialize();
document.querySelector('#contours-toggle').addEventListener('click', e => { const b = e.currentTarget; const visible = b.classList.toggle('active'); b.setAttribute('aria-pressed', String(visible)); if (overlays.contours) overlays.contours.visible = visible; });
document.querySelector('#labels-toggle').addEventListener('click', e => { const b = e.currentTarget; const visible = b.classList.toggle('active'); b.setAttribute('aria-pressed', String(visible)); overlays.labels.forEach(label => label.visible = visible); });
document.querySelector('#reset-view').addEventListener('click', () => { camera.position.set(WIDTH * .72, WIDTH * .6, DEPTH * .88); controls.target.set(0, 20, 0); controls.update(); });
let resizeObserver = new ResizeObserver(() => { const w = stage.clientWidth, h = stage.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); }); resizeObserver.observe(stage);
function render() { requestAnimationFrame(render); controls.update(); renderer.render(scene, camera); }
render();
