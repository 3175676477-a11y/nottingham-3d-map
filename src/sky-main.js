import * as THREE from 'three';
import { DateTime } from 'luxon';
import tzlookup from 'tz-lookup';
import { daylight, localPosition, moonCoordinates, skyState, sunCoordinates } from './astronomy.js';
import './sky.css';
import './sky-hud.css';

const app = document.querySelector('#sky-app');
app.innerHTML = `
  <main class="sky-observatory">
    <header class="sky-header">
      <a class="return-link" href="/astronomy.html">← 返回地球视图</a>
      <div class="sky-title"><span>GROUND OBSERVER / 地面观测者</span><b>仰望天空</b></div>
      <div class="view-tag" id="view-heading">拖动视角环顾天空</div>
    </header>
    <section class="sky-place">
      <span class="eyebrow">YOUR HORIZON</span>
      <h1 id="place-name">正在定位</h1>
      <div class="coordinates"><span id="latitude">--</span><span id="longitude">--</span><span id="timezone">--</span></div>
      <div class="daylight-card"><span>今日白昼</span><b id="day-length">--</b><small id="sun-times">日出 -- · 日落 --</small></div>
      <div class="moon-card"><span>月相</span><div class="moon-phase-row"><canvas id="phase-mini" width="88" height="88" aria-label="当前月相图示"></canvas><div><b id="phase-name">--</b><small><span id="illumination">--</span> 照明 · 月龄 <span id="moon-age">--</span> 天</small></div></div></div>
    </section>
    <section class="dome-stage" aria-label="站在地面仰望太阳和月球">
      <div class="dome-caption">GROUND-LEVEL SKY <span>太阳与月球当日轨迹</span></div>
      <div class="dome-wrap" id="dome-viewport"><div class="horizon-markers" aria-label="地平线方位"><span id="bearing-n">N · 北</span><span id="bearing-e">E · 东</span><span id="bearing-s">S · 南</span><span id="bearing-w">W · 西</span></div></div>
      <div class="dome-legend"><span><i class="moon-key"></i>月球轨迹与月相</span><span><i class="sun-key"></i>太阳轨迹</span><span><i class="cardinal-key"></i>方向标</span></div>
    </section>
    <aside class="sky-readout">
      <div class="readout-head"><span>LOCAL SKY / 此刻</span><b id="local-time">--:--</b></div>
      <div class="sky-condition"><i id="sky-symbol">✦</i><div><b id="sky-state">正在计算</b><small id="sun-altitude">太阳高度 --°</small></div></div>
      <div class="readout-rule"></div>
      <div class="readout-label">MOON POSITION / 月球</div>
      <div class="moon-position"><b id="moon-horizon">--</b><span id="moon-status">--</span></div>
      <div class="position-pair"><div><span>高度 ALT</span><b id="moon-altitude">--°</b></div><div><span>方位 AZ</span><b id="moon-azimuth">--°</b></div></div>
      <div class="readout-rule"></div>
      <p class="track-note">当前视线固定在地面观测点。拖动画面左右环顾、上下抬头或低头；轨迹显示所选当地日期中升到地平线以上的部分。</p>
      <p class="model-note">天体尺寸经过夸大，轨道位置及月相为教学用途近似计算。</p>
    </aside>
    <section class="sky-timeline">
      <label for="sky-time">观测日期与时间</label>
      <input id="sky-time" type="datetime-local" step="60">
      <button id="sky-play" aria-label="播放或暂停时间">▶</button>
      <input id="sky-speed" type="range" min="0" max="3" step="1" value="1" aria-label="时间流速">
      <select id="sky-speed-select" aria-label="时间流速"><option value="3600">1 小时 / 秒</option><option value="86400" selected>1 天 / 秒</option><option value="604800">1 周 / 秒</option><option value="2592000">1 月 / 秒</option></select>
      <button id="sky-now">现在</button>
    </section>
    <footer class="sky-footer">地平线下方的天体不会显示 · 时间控制可观察月球在天空中的移动</footer>
  </main>`;

const params = new URLSearchParams(location.search);
const parsedLat = Number(params.get('lat'));
const parsedLon = Number(params.get('lon'));
let latitude = Number.isFinite(parsedLat) && params.has('lat') ? Math.max(-89.9, Math.min(89.9, parsedLat)) : 52.95;
let longitude = Number.isFinite(parsedLon) && params.has('lon') ? ((parsedLon + 180) % 360 + 360) % 360 - 180 : -1.15;
let zone = 'Europe/London';
try { zone = tzlookup(latitude, longitude); } catch { zone = 'UTC'; }
const parsedTime = new Date(params.get('time') || Date.now());
let currentTime = Number.isNaN(parsedTime.getTime()) ? new Date() : parsedTime;
let playing = false, previousFrame = 0, lastInputSync = 0, trajectoryKey = '', trajectory = [], renderedTimeKey = '';
const timeInput = document.querySelector('#sky-time');
const playButton = document.querySelector('#sky-play');
const speedInput = document.querySelector('#sky-speed');
const speedSelect = document.querySelector('#sky-speed-select');
const viewport = document.querySelector('#dome-viewport');
const phaseCanvas = document.querySelector('#phase-mini');
const phaseContext = phaseCanvas.getContext('2d');
const clamp = THREE.MathUtils.clamp;
const formatCoord = (n, positive, negative) => `${Math.abs(n).toFixed(4)}°${n >= 0 ? positive : negative}`;
const compassName = az => ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][Math.round(az / 45) % 8];
const radians = THREE.MathUtils.degToRad;

document.querySelector('#latitude').textContent = formatCoord(latitude, 'N', 'S');
document.querySelector('#longitude').textContent = formatCoord(longitude, 'E', 'W');
document.querySelector('#timezone').textContent = zone.replaceAll('_', ' ');
document.querySelector('#place-name').textContent = params.has('lat') ? '自选观测点' : '诺丁汉 · University Park';
function syncInput() { timeInput.value = DateTime.fromJSDate(currentTime).setZone(zone).toFormat("yyyy-MM-dd'T'HH:mm"); }
syncInput();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 1, .1, 1400);
camera.position.set(0, 1.72, 0);
camera.rotation.order = 'YXZ';
const firstSky = skyState(currentTime, latitude, longitude);
const firstTarget = firstSky.moon.altitude > 0 ? firstSky.moon : firstSky.sun.altitude > 0 ? firstSky.sun : null;
let yaw = firstTarget ? -radians(firstTarget.azimuth) : latitude >= 0 ? Math.PI : 0;
let pitch = radians(firstTarget ? clamp(firstTarget.altitude * .55, 10, 38) : 15);
camera.rotation.set(pitch, yaw, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
viewport.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0x9db9da, 0x263239, 1.35));

const skyUniforms = { zenith: { value: new THREE.Color('#0b1930') }, horizon: { value: new THREE.Color('#3a4659') } };
const skyShell = new THREE.Mesh(new THREE.SphereGeometry(700, 64, 40), new THREE.ShaderMaterial({
  uniforms: skyUniforms,
  vertexShader: 'varying vec3 vDirection; void main(){ vDirection=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 zenith; uniform vec3 horizon; varying vec3 vDirection; void main(){ float h=pow(max(vDirection.y,0.0),0.48); gl_FragColor=vec4(mix(horizon,zenith,h),1.0); }',
  side: THREE.BackSide, depthWrite: false,
}));
scene.add(skyShell);

const ground = new THREE.Mesh(new THREE.SphereGeometry(280, 64, 40, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x151d22, side: THREE.BackSide }));
scene.add(ground);
const skyRadius = 220;
function skyVector(az, alt, radius = skyRadius) {
  const a = radians(az), h = radians(alt), horizontal = Math.cos(h) * radius;
  return new THREE.Vector3(Math.sin(a) * horizontal, Math.sin(h) * radius, -Math.cos(a) * horizontal);
}

function addSkyCircle(altitude, material) {
  const pts = [];
  for (let i = 0; i <= 360; i += 2) pts.push(skyVector(i, altitude));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material);
  scene.add(line);
}
const horizonMaterial = new THREE.LineBasicMaterial({ color: 0xc2ccd1, transparent: true, opacity: .66 });
const altitudeMaterial = new THREE.LineDashedMaterial({ color: 0xb5c4d1, transparent: true, opacity: .28, dashSize: 2.4, gapSize: 2.4 });
addSkyCircle(0, horizonMaterial); addSkyCircle(30, altitudeMaterial); addSkyCircle(60, altitudeMaterial);
scene.children.filter(o => o.isLine && o.material === altitudeMaterial).forEach(o => o.computeLineDistances());

function makeTextSprite(text, color = '#e5e9eb') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d'); ctx.font = '500 52px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 12; ctx.fillStyle = color; ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })); sprite.scale.set(17, 4.25, 1); return sprite;
}
for (const [az, label] of [[0, 'N · 北'], [90, 'E · 东'], [180, 'S · 南'], [270, 'W · 西']]) {
  const sprite = makeTextSprite(label, '#f1ca83'); sprite.position.copy(skyVector(az, 0, 242)); sprite.position.y = 2.5; scene.add(sprite);
}
for (const [alt, label] of [[30, '30°'], [60, '60°']]) { const sprite = makeTextSprite(label, '#a9bac8'); sprite.scale.set(9, 2.25, 1); sprite.position.copy(skyVector(180, alt, skyRadius + 1)); scene.add(sprite); }

const starsGeometry = new THREE.BufferGeometry(), starPositions = [], starColors = [];
let starSeed = 99173; const random = () => { starSeed = (starSeed * 16807) % 2147483647; return starSeed / 2147483647; };
for (let i = 0; i < 2300; i++) {
  const az = random() * Math.PI * 2, y = .03 + random() * .97, r = 550 + random() * 80, horizontal = Math.sqrt(1-y*y);
  starPositions.push(Math.cos(az)*horizontal*r, y*r, Math.sin(az)*horizontal*r);
  const c = new THREE.Color().setHSL(.55 + random()*.12, .12, .55 + random()*.38); starColors.push(c.r,c.g,c.b);
}
starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3)); starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ size: 1.25, vertexColors: true, transparent: true, opacity: .85, sizeAttenuation: false })); scene.add(stars);

const sun = new THREE.Mesh(new THREE.SphereGeometry(7, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffcb73 })); scene.add(sun);
const sunLight = new THREE.DirectionalLight(0xffe4b5, 2.6); sunLight.target.position.set(0, 0, 0); scene.add(sunLight, sunLight.target);
function makeGlow(colorA, colorB) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256; const c = canvas.getContext('2d');
  const g = c.createRadialGradient(128,128,8,128,128,128); g.addColorStop(0,colorA); g.addColorStop(.28,colorB); g.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=g;c.fillRect(0,0,256,256);
  const texture = new THREE.CanvasTexture(canvas); const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:texture, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); return sprite;
}
const sunGlow = makeGlow('rgba(255,238,190,.7)','rgba(255,174,75,.32)'); sunGlow.scale.set(34,34,1); scene.add(sunGlow);
const moonGlow = makeGlow('rgba(226,235,244,.32)','rgba(185,205,227,.12)'); moonGlow.scale.set(23,23,1); scene.add(moonGlow);

function makeMoonTexture() {
  const canvas = document.createElement('canvas'); canvas.width=1024; canvas.height=512; const c=canvas.getContext('2d');
  const base=c.createLinearGradient(0,0,1024,512);base.addColorStop(0,'#b8b9b6');base.addColorStop(.5,'#e0ddd1');base.addColorStop(1,'#a8aaa8');c.fillStyle=base;c.fillRect(0,0,1024,512);
  let seed=24681;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<1100;i++){const x=rand()*1024,y=rand()*512,r=1+rand()*13;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=`rgba(58,62,66,${.025+rand()*.1})`;c.fill();}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.offset.x=.25;return texture;
}
const moon = new THREE.Mesh(new THREE.SphereGeometry(5.2, 48, 32), new THREE.MeshStandardMaterial({ map: makeMoonTexture(), roughness: .94, metalness: 0 })); scene.add(moon);
const sunLabel=makeTextSprite('太阳','#ffd589'),moonLabel=makeTextSprite('月球','#eee6d2');sunLabel.scale.set(10,2.5,1);moonLabel.scale.set(9,2.25,1);scene.add(sunLabel,moonLabel);

const trackMaterials = {
  sunPast: new THREE.LineBasicMaterial({ color: 0xffc46b, transparent: true, opacity: .94 }),
  sunFuture: new THREE.LineDashedMaterial({ color: 0xffc46b, transparent: true, opacity: .48, dashSize: 3, gapSize: 2 }),
  moonPast: new THREE.LineBasicMaterial({ color: 0xf0e8d3, transparent: true, opacity: .94 }),
  moonFuture: new THREE.LineDashedMaterial({ color: 0xf0e8d3, transparent: true, opacity: .55, dashSize: 3, gapSize: 2 }),
};
const trackLines = {};
for (const [key, material] of Object.entries(trackMaterials)) { trackLines[key]=new THREE.LineSegments(new THREE.BufferGeometry(),material);scene.add(trackLines[key]); }
const bearingElements=[[0,document.querySelector('#bearing-n')],[90,document.querySelector('#bearing-e')],[180,document.querySelector('#bearing-s')],[270,document.querySelector('#bearing-w')]];
function updateBearings(){for(const [az,el] of bearingElements){const p=skyVector(az,0,240);p.y=7;p.project(camera);const x=(p.x*.5+.5)*viewport.clientWidth,y=(-p.y*.5+.5)*viewport.clientHeight,visible=p.z<1&&x>-20&&x<viewport.clientWidth+20&&y>-15&&y<viewport.clientHeight+15;el.style.display=visible?'block':'none';el.style.left=`${x}px`;el.style.top=`${y}px`;}}

function rebuildTrajectory(dateTime) {
  const key=`${dateTime.toISODate()}|${latitude.toFixed(4)}|${longitude.toFixed(4)}`;
  if(key===trajectoryKey)return;
  trajectoryKey=key;trajectory=[];
  const start=dateTime.startOf('day').toUTC().toMillis(),end=dateTime.plus({days:1}).startOf('day').toUTC().toMillis(),step=10*60*1000;
  for(let ms=start;ms<end;ms+=step){const date=new Date(ms),sunPos=sunCoordinates(date),moonPos=moonCoordinates(date);trajectory.push({ms,sun:localPosition(sunPos.ra,sunPos.dec,date,latitude,longitude),moon:localPosition(moonPos.ra,moonPos.dec,date,latitude,longitude)});}
  const date=new Date(end),sunPos=sunCoordinates(date),moonPos=moonCoordinates(date);trajectory.push({ms:end,sun:localPosition(sunPos.ra,sunPos.dec,date,latitude,longitude),moon:localPosition(moonPos.ra,moonPos.dec,date,latitude,longitude)});
}
function updateTracks(now) {
  const key=`${trajectoryKey}|${Math.floor(now/600000)}`;if(key===renderedTimeKey)return;renderedTimeKey=key;
  for(const body of ['sun','moon'])for(const when of ['Past','Future']){
    // Include the exact current position in both halves so the solid and
    // dashed tracks meet cleanly instead of leaving a gap at a sample boundary.
    const current=skyState(new Date(now),latitude,longitude)[body];
    const samples=trajectory.filter(p=>when==='Past'?p.ms<now:p.ms>now);
    samples.push({ms:now,[body]:current});samples.sort((a,b)=>a.ms-b.ms);
    const points=[];
    const positionAt=(a,b,f)=>{
      let delta=((b.azimuth-a.azimuth+540)%360)-180;
      return {azimuth:(a.azimuth+delta*f+360)%360,altitude:a.altitude+(b.altitude-a.altitude)*f};
    };
    // Clip segments precisely to the horizon. This keeps a trajectory
    // continuous while preventing lines from cutting below the visible dome.
    for(let i=1;i<samples.length;i++){
      const a=samples[i-1],b=samples[i],pa=a[body],pb=b[body];
      if(pa.altitude<0&&pb.altitude<0)continue;
      let start=pa,end=pb;
      if(pa.altitude<0)start=positionAt(pa,pb,-pa.altitude/(pb.altitude-pa.altitude));
      if(pb.altitude<0)end=positionAt(pa,pb,-pa.altitude/(pb.altitude-pa.altitude));
      points.push(skyVector(start.azimuth,Math.max(0,start.altitude)),skyVector(end.azimuth,Math.max(0,end.altitude)));
    }
    const line=trackLines[body+when];line.geometry.dispose();line.geometry=new THREE.BufferGeometry().setFromPoints(points);if(trackMaterials[body+when].isLineDashedMaterial)line.computeLineDistances();
  }
}

let dragging=false,lastPointerX=0,lastPointerY=0;
renderer.domElement.addEventListener('pointerdown',event=>{dragging=true;lastPointerX=event.clientX;lastPointerY=event.clientY;renderer.domElement.setPointerCapture(event.pointerId);renderer.domElement.classList.add('dragging');});
renderer.domElement.addEventListener('pointermove',event=>{if(!dragging)return;const dx=event.clientX-lastPointerX,dy=event.clientY-lastPointerY;lastPointerX=event.clientX;lastPointerY=event.clientY;yaw-=dx*.004;pitch=clamp(pitch-dy*.003,-.12,1.42);camera.rotation.set(pitch,yaw,0);});
function stopDrag(){dragging=false;renderer.domElement.classList.remove('dragging');}
renderer.domElement.addEventListener('pointerup',stopDrag);renderer.domElement.addEventListener('pointercancel',stopDrag);
renderer.domElement.addEventListener('wheel',event=>{camera.fov=clamp(camera.fov+Math.sign(event.deltaY)*2,42,88);camera.updateProjectionMatrix();event.preventDefault();},{passive:false});

timeInput.addEventListener('change',()=>{const local=DateTime.fromFormat(timeInput.value,"yyyy-MM-dd'T'HH:mm",{zone});if(local.isValid){currentTime=local.toUTC().toJSDate();trajectoryKey='';renderedTimeKey='';}});
playButton.addEventListener('click',()=>{playing=!playing;playButton.textContent=playing?'Ⅱ':'▶';playButton.classList.toggle('active',playing);});
speedInput.addEventListener('input',()=>{speedSelect.selectedIndex=Number(speedInput.value);});
speedSelect.addEventListener('change',()=>{speedInput.value=String(speedSelect.selectedIndex);});
document.querySelector('#sky-now').addEventListener('click',()=>{currentTime=new Date();syncInput();trajectoryKey='';renderedTimeKey='';});

function updateSkyColors(altitude){
  const isDay=altitude>6,isTwilight=altitude>-18;
  skyUniforms.zenith.value.set(isDay?'#3987b8':isTwilight?'#263b64':'#071326');
  skyUniforms.horizon.value.set(isDay?'#b8ac91':isTwilight?'#76566a':'#394452');
  stars.material.opacity=altitude<-8?.85:altitude<-2?.32:.04;
  ground.material.color.set(isDay?'#3e5047':isTwilight?'#272d35':'#151d22');
}
function updateReadout(sky,day,local){
  const heading=((THREE.MathUtils.radToDeg(-yaw)%360)+360)%360;
  document.querySelector('#view-heading').textContent=`视线朝向 · ${compassName(heading)} ${heading.toFixed(0)}°`;
  document.querySelector('#local-time').textContent=local.toFormat('yyyy-LL-dd · HH:mm');
  document.querySelector('#day-length').textContent=`${String(Math.floor(day.minutes/60)).padStart(2,'0')}:${String(Math.round(day.minutes%60)).padStart(2,'0')} 小时`;
  document.querySelector('#sun-times').textContent=day.state==='极昼'?'太阳整日不落':day.state==='极夜'?'太阳整日不升':`日出 ${day.sunrise.toFormat('HH:mm')} · 日落 ${day.sunset.toFormat('HH:mm')}`;
  document.querySelector('#phase-name').textContent=sky.phase;document.querySelector('#illumination').textContent=`${Math.round(sky.illumination*100)}%`;document.querySelector('#moon-age').textContent=sky.ageDays.toFixed(1);
  drawPhase(sky.illumination,sky.waxing);
  document.querySelector('#sky-state').textContent=sky.twilight;document.querySelector('#sky-symbol').textContent=sky.sun.altitude>0?'☼':sky.sun.altitude>-18?'☾':'✦';document.querySelector('#sun-altitude').textContent=`太阳高度 ${sky.sun.altitude.toFixed(1)}°`;
  document.querySelector('#moon-horizon').textContent=sky.moon.altitude>=0?`${sky.moon.altitude.toFixed(1)}° · 地平线上`:`${sky.moon.altitude.toFixed(1)}° · 地平线下`;
  document.querySelector('#moon-status').textContent=`${compassName(sky.moon.azimuth)} ${sky.moon.azimuth.toFixed(1)}°`;document.querySelector('#moon-altitude').textContent=`${sky.moon.altitude.toFixed(1)}°`;document.querySelector('#moon-azimuth').textContent=`${sky.moon.azimuth.toFixed(1)}° ${compassName(sky.moon.azimuth)}`;
}
function drawPhase(fraction,waxing){const c=phaseContext;c.clearRect(0,0,88,88);c.save();c.beginPath();c.arc(44,44,37,0,Math.PI*2);c.clip();c.fillStyle='#202b39';c.fillRect(7,7,74,74);if(fraction>.98){c.fillStyle='#eee5d0';c.fillRect(7,7,74,74);}else if(fraction>.02){const split=waxing?44:7;c.fillStyle='#eee5d0';c.fillRect(split,7,37,74);const width=Math.abs(1-2*fraction)*37;c.beginPath();c.ellipse(44,44,width,37,0,0,Math.PI*2);c.fillStyle=fraction>.5?(waxing?'#eee5d0':'#202b39'):(waxing?'#202b39':'#eee5d0');c.fill();}c.restore();c.beginPath();c.arc(44,44,37,0,Math.PI*2);c.strokeStyle='#f1ead855';c.lineWidth=1.4;c.stroke();}
function resize(){const rect=viewport.getBoundingClientRect();if(!rect.width||!rect.height)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(viewport);resize();
function frame(now){requestAnimationFrame(frame);if(playing){currentTime=new Date(currentTime.getTime()+Math.min((now-(previousFrame||now))/1000,.1)*Number(speedSelect.value)*1000);if(performance.now()-lastInputSync>250){syncInput();lastInputSync=performance.now();}}previousFrame=now;
  const local=DateTime.fromJSDate(currentTime).setZone(zone);rebuildTrajectory(local);const sky=skyState(currentTime,latitude,longitude),day=daylight(currentTime,latitude,longitude,zone,DateTime);updateReadout(sky,day,local);updateTracks(currentTime.getTime());updateSkyColors(sky.sun.altitude);
  const sunDirection=skyVector(sky.sun.azimuth,sky.sun.altitude,1),moonDirection=skyVector(sky.moon.azimuth,sky.moon.altitude,1);const sunPosition=sunDirection.clone().multiplyScalar(220),moonPosition=moonDirection.clone().multiplyScalar(220);
  sun.position.copy(sunPosition);sun.visible=sky.sun.altitude>-.5;sunGlow.position.copy(sunPosition);sunGlow.visible=sun.visible;sunLabel.position.copy(sunPosition).add(new THREE.Vector3(0,12,0));sunLabel.visible=sun.visible;
  moon.position.copy(moonPosition);moon.visible=sky.moon.altitude>-.5;moonGlow.position.copy(moonPosition);moonGlow.visible=moon.visible;moonLabel.position.copy(moonPosition).add(new THREE.Vector3(0,10,0));moonLabel.visible=moon.visible;
  sunLight.position.copy(sunDirection).multiplyScalar(300);sunLight.target.position.set(0,0,0);sunLight.target.updateMatrixWorld();
  updateBearings();renderer.render(scene,camera);
}
requestAnimationFrame(frame);
