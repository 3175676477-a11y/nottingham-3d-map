import { DateTime } from 'luxon';
import tzlookup from 'tz-lookup';
import { daylight, localPosition, moonCoordinates, skyState, sunCoordinates } from './astronomy.js';
import './sky.css';

const app = document.querySelector('#sky-app');
app.innerHTML = `
  <main class="sky-observatory">
    <header class="sky-header">
      <a class="return-link" href="/astronomy.html">← 返回日地月模型</a>
      <div class="sky-title"><span>GROUND OBSERVER / 地面观测者</span><b>仰望天空</b></div>
      <div class="view-tag">全天空穹顶 · 方位朝北</div>
    </header>
    <section class="sky-place">
      <span class="eyebrow">YOUR HORIZON</span>
      <h1 id="place-name">正在定位</h1>
      <div class="coordinates"><span id="latitude">--</span><span id="longitude">--</span><span id="timezone">--</span></div>
      <div class="daylight-card"><span>今日白昼</span><b id="day-length">--</b><small id="sun-times">日出 -- · 日落 --</small></div>
      <div class="moon-card"><span>当前月相</span><b id="phase-name">--</b><small><span id="illumination">--</span> 照明 · 月龄 <span id="moon-age">--</span> 天</small></div>
    </section>
    <section class="dome-stage" aria-label="地面观测者看到的全天空穹顶">
      <div class="dome-caption">全天空穹顶 <span>月球与太阳在所选日期的视运动</span></div>
      <div class="dome-wrap"><canvas id="sky-dome" aria-label="月球和太阳在天空中的方位与高度轨迹"></canvas></div>
      <div class="dome-legend"><span><i class="moon-key"></i>月球轨迹</span><span><i class="sun-key"></i>太阳轨迹</span><span><i class="now-key"></i>所选时刻</span></div>
    </section>
    <aside class="sky-readout">
      <div class="readout-head"><span>NOW / 此刻</span><b id="local-time">--:--</b></div>
      <div class="sky-condition"><i id="sky-symbol">✦</i><div><b id="sky-state">正在计算</b><small id="sun-altitude">太阳高度 --°</small></div></div>
      <div class="readout-rule"></div>
      <div class="readout-label">MOON POSITION / 月球</div>
      <div class="moon-position"><b id="moon-horizon">--</b><span id="moon-status">--</span></div>
      <div class="position-pair"><div><span>高度 ALT</span><b id="moon-altitude">--°</b></div><div><span>方位 AZ</span><b id="moon-azimuth">--°</b></div></div>
      <div class="readout-rule"></div>
      <p class="track-note">圆周是地平线，中心是天顶。轨迹按所选日期逐时计算；地平线以下的弧段不显示。</p>
      <p class="model-note">天体位置为教学用途的近似计算，月球轨迹不用于导航或观测预报。</p>
    </aside>
    <section class="sky-timeline">
      <label for="sky-time">观测日期与时间</label>
      <input id="sky-time" type="datetime-local" step="60">
      <button id="sky-play" aria-label="播放或暂停时间">▶</button>
      <input id="sky-speed" type="range" min="0" max="3" step="1" value="1" aria-label="时间流速">
      <select id="sky-speed-select" aria-label="时间流速"><option value="3600">1 小时 / 秒</option><option value="86400" selected>1 天 / 秒</option><option value="604800">1 周 / 秒</option><option value="2592000">1 月 / 秒</option></select>
      <button id="sky-now">现在</button>
    </section>
    <footer class="sky-footer">方位以真北为 0°，顺时针增加 · 拖动时间查看月球在天空中的移动</footer>
  </main>`;

const params = new URLSearchParams(location.search);
const parsedLat = Number(params.get('lat'));
const parsedLon = Number(params.get('lon'));
let latitude = Number.isFinite(parsedLat) && params.has('lat') ? Math.max(-89.9, Math.min(89.9, parsedLat)) : 52.95;
let longitude = Number.isFinite(parsedLon) && params.has('lon') ? ((parsedLon + 180) % 360 + 360) % 360 - 180 : -1.15;
let zone = 'Europe/London';
try { zone = tzlookup(latitude, longitude); } catch { zone = 'UTC'; }
const initialTime = new Date(params.get('time') || Date.now());
let currentTime = Number.isNaN(initialTime.getTime()) ? new Date() : initialTime;
let playing = false;
let trajectoryKey = '';
let trajectory = [];
let lastInputSync = 0;
const timeInput = document.querySelector('#sky-time');
const playButton = document.querySelector('#sky-play');
const speedInput = document.querySelector('#sky-speed');
const speedSelect = document.querySelector('#sky-speed-select');
const canvas = document.querySelector('#sky-dome');
const ctx = canvas.getContext('2d');
const speeds = [3600, 86400, 604800, 2592000];

const formatCoord = (n, positive, negative) => `${Math.abs(n).toFixed(4)}°${n >= 0 ? positive : negative}`;
const compassName = az => ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][Math.round(az / 45) % 8];
function syncInput() { timeInput.value = DateTime.fromJSDate(currentTime).setZone(zone).toFormat("yyyy-MM-dd'T'HH:mm"); }
function invalidateTrajectory() { trajectoryKey = ''; }

document.querySelector('#latitude').textContent = formatCoord(latitude, 'N', 'S');
document.querySelector('#longitude').textContent = formatCoord(longitude, 'E', 'W');
document.querySelector('#timezone').textContent = zone.replaceAll('_', ' ');
document.querySelector('#place-name').textContent = params.has('lat') ? '自选观测点' : '诺丁汉 · University Park';
syncInput();

timeInput.addEventListener('change', () => {
  const local = DateTime.fromFormat(timeInput.value, "yyyy-MM-dd'T'HH:mm", { zone });
  if (local.isValid) { currentTime = local.toUTC().toJSDate(); invalidateTrajectory(); }
});
playButton.addEventListener('click', () => {
  playing = !playing;
  playButton.textContent = playing ? 'Ⅱ' : '▶';
  playButton.classList.toggle('active', playing);
});
speedInput.addEventListener('input', () => { speedSelect.selectedIndex = Number(speedInput.value); });
speedSelect.addEventListener('change', () => { speedInput.value = String(speedSelect.selectedIndex); });
document.querySelector('#sky-now').addEventListener('click', () => { currentTime = new Date(); syncInput(); invalidateTrajectory(); });

function makeTrajectory(dateTime) {
  const key = `${dateTime.toISODate()}|${latitude.toFixed(4)}|${longitude.toFixed(4)}`;
  if (key === trajectoryKey) return;
  trajectoryKey = key;
  const start = dateTime.startOf('day').toUTC().toMillis();
  const end = dateTime.plus({ days: 1 }).startOf('day').toUTC().toMillis();
  const step = 10 * 60 * 1000;
  trajectory = [];
  for (let ms = start; ms < end; ms += step) {
    const date = new Date(ms);
    const sun = sunCoordinates(date);
    const moon = moonCoordinates(date);
    trajectory.push({
      ms,
      sun: localPosition(sun.ra, sun.dec, date, latitude, longitude),
      moon: localPosition(moon.ra, moon.dec, date, latitude, longitude),
    });
  }
  const lastDate = new Date(end - 1);
  const sun = sunCoordinates(lastDate), moon = moonCoordinates(lastDate);
  trajectory.push({ ms: end, sun: localPosition(sun.ra, sun.dec, lastDate, latitude, longitude), moon: localPosition(moon.ra, moon.dec, lastDate, latitude, longitude) });
}

function domePoint(azimuth, altitude, cx, cy, radius) {
  const r = radius * (90 - Math.max(0, Math.min(90, altitude))) / 90;
  const az = azimuth * Math.PI / 180;
  return { x: cx + Math.sin(az) * r, y: cy - Math.cos(az) * r };
}

function drawSky(dateTime, sky) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  const cx = rect.width / 2, cy = rect.height / 2, radius = Math.min(rect.width, rect.height) * .405;
  const gradient = ctx.createRadialGradient(cx - radius * .16, cy - radius * .54, radius * .06, cx, cy, radius * 1.08);
  if (sky.sun.altitude > 6) {
    gradient.addColorStop(0, '#5a9bc5'); gradient.addColorStop(.72, '#397294'); gradient.addColorStop(1, '#c28d70');
  } else if (sky.sun.altitude > -6) {
    gradient.addColorStop(0, '#273c62'); gradient.addColorStop(.72, '#493859'); gradient.addColorStop(1, '#bd795c');
  } else {
    gradient.addColorStop(0, '#101a30'); gradient.addColorStop(.72, '#17263c'); gradient.addColorStop(1, '#4d3d52');
  }
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fillStyle = gradient; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2); ctx.clip();
  if (sky.sun.altitude <= -4) {
    let seed = 731;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 130; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * radius * .96;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      ctx.fillStyle = `rgba(245,239,220,${.18 + rand() * .5})`;
      ctx.beginPath(); ctx.arc(x, y, .55 + rand() * .7, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  // Altitude circles and cardinal bearings form a local horizon coordinate grid.
  for (const altitude of [60, 30]) {
    ctx.beginPath(); ctx.arc(cx, cy, radius * (90 - altitude) / 90, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(235,242,247,.25)'; ctx.lineWidth = 1; ctx.setLineDash([3, 6]); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '10px system-ui, sans-serif'; ctx.fillStyle = 'rgba(238,242,245,.72)'; ctx.fillText(`${altitude}°`, cx + 5, cy - radius * (90 - altitude) / 90 - 4);
  }
  for (let az = 0; az < 360; az += 45) {
    const p = domePoint(az, 0, cx, cy, radius);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); ctx.strokeStyle = 'rgba(235,242,247,.13)'; ctx.lineWidth = 1; ctx.stroke();
  }

  function drawTrack(body, color, currentMs, dash = []) {
    ctx.lineWidth = body === 'moon' ? 3 : 2;
    ctx.lineCap = 'round'; ctx.setLineDash(dash);
    for (let i = 1; i < trajectory.length; i++) {
      const a = trajectory[i - 1], b = trajectory[i];
      if (a[body].altitude < 0 || b[body].altitude < 0) continue;
      const p1 = domePoint(a[body].azimuth, a[body].altitude, cx, cy, radius);
      const p2 = domePoint(b[body].azimuth, b[body].altitude, cx, cy, radius);
      const past = b.ms <= currentMs;
      ctx.strokeStyle = past ? color : `${color}70`;
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  drawTrack('sun', '#ffc46b', currentTime.getTime());
  drawTrack('moon', '#f0e8d3', currentTime.getTime(), [7, 4]);

  // Mark the selected instant. A below-horizon body is shown at its bearing on the rim.
  function marker(position, color, glyph) {
    const above = position.altitude >= 0;
    const p = domePoint(position.azimuth, above ? position.altitude : 0, cx, cy, radius);
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(p.x, p.y, glyph === '☾' ? 8 : 7, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.restore();
    if (!above) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.strokeStyle = `${color}99`; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#17202b'; ctx.fillText(glyph, p.x, p.y + .5); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }
  marker(sky.sun, '#ffc46b', '☼'); marker(sky.moon, '#eee5d0', '☾');

  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(239,244,248,.64)'; ctx.lineWidth = 1.5; ctx.stroke();
  const labels = [[0, '北'], [45, '东北'], [90, '东'], [135, '东南'], [180, '南'], [225, '西南'], [270, '西'], [315, '西北']];
  ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#dbe5ed';
  for (const [az, label] of labels) { const p = domePoint(az, 0, cx, cy, radius + 17); ctx.fillText(label, p.x, p.y + 4); }
  ctx.fillStyle = 'rgba(234,241,246,.68)'; ctx.font = '10px system-ui, sans-serif'; ctx.fillText('天顶 · 90°', cx, cy - 8); ctx.textAlign = 'start';
}

function update() {
  const local = DateTime.fromJSDate(currentTime).setZone(zone);
  makeTrajectory(local);
  const sky = skyState(currentTime, latitude, longitude);
  const day = daylight(currentTime, latitude, longitude, zone, DateTime);
  document.querySelector('#local-time').textContent = local.toFormat('yyyy-LL-dd · HH:mm');
  document.querySelector('#day-length').textContent = `${String(Math.floor(day.minutes / 60)).padStart(2, '0')}:${String(Math.round(day.minutes % 60)).padStart(2, '0')} 小时`;
  document.querySelector('#sun-times').textContent = day.state === '极昼' ? '太阳整日不落' : day.state === '极夜' ? '太阳整日不升' : `日出 ${day.sunrise.toFormat('HH:mm')} · 日落 ${day.sunset.toFormat('HH:mm')}`;
  document.querySelector('#phase-name').textContent = sky.phase;
  document.querySelector('#illumination').textContent = `${Math.round(sky.illumination * 100)}%`;
  document.querySelector('#moon-age').textContent = sky.ageDays.toFixed(1);
  document.querySelector('#sky-state').textContent = sky.twilight;
  document.querySelector('#sky-symbol').textContent = sky.sun.altitude > 0 ? '☼' : sky.sun.altitude > -18 ? '☾' : '✦';
  document.querySelector('#sun-altitude').textContent = `太阳高度 ${sky.sun.altitude.toFixed(1)}°`;
  document.querySelector('#moon-horizon').textContent = sky.moon.altitude >= 0 ? `${sky.moon.altitude.toFixed(1)}° · 地平线上` : `${sky.moon.altitude.toFixed(1)}° · 地平线下`;
  document.querySelector('#moon-status').textContent = `${compassName(sky.moon.azimuth)} ${sky.moon.azimuth.toFixed(1)}°`;
  document.querySelector('#moon-altitude').textContent = `${sky.moon.altitude.toFixed(1)}°`;
  document.querySelector('#moon-azimuth').textContent = `${sky.moon.azimuth.toFixed(1)}° ${compassName(sky.moon.azimuth)}`;
  drawSky(local, sky);
  if (playing && performance.now() - lastInputSync > 250) { syncInput(); lastInputSync = performance.now(); }
}

let previousFrame = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (playing) currentTime = new Date(currentTime.getTime() + Math.min((now - (previousFrame || now)) / 1000, .1) * Number(speedSelect.value) * 1000);
  previousFrame = now;
  update();
}
requestAnimationFrame(frame);
new ResizeObserver(() => update()).observe(canvas);
