import { installReleaseNavigation } from './release-navigation.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeEarthTexture, makeTileNoise } from './earth-texture.js';
import { DateTime } from 'luxon';
import tzlookup from 'tz-lookup';
import { daylight, sceneDirections, skyState } from './astronomy.js';
import { createGlobeTexture, createMoonTexture } from './globe-texture.js';
import './astronomy.css';

const root = document.querySelector('#astronomy-app');
root.innerHTML = `<main class="observatory"><div id="cosmos"></div><header class="topbar"><div class="astro-brand"><span class="astro-mark">☼</span><div><b>SOLAR ATLAS <i>·</i> 02</b><small>EARTH / MOON / SUN OBSERVATORY</small></div></div><div class="top-coords">EARTH-CENTERED VIEW&nbsp; / &nbsp;HELIOCENTRIC ORBITS</div><a class="back-link" href="./index.html">校园地形图&nbsp; ↗</a></header><section class="hero"><span class="eyebrow">THREE BODIES / ONE SKY</span><h1>Sun, Earth<br><em>&amp; Moon.</em></h1><p>点击天体标识切换旋转中心。<br><a id="lunar-entry" href="./lunar.html">站在月球上看天空 ↗</a></p><nav class="focus-switch" aria-label="旋转中心"><button data-focus="sun">太阳</button><button data-focus="earth">地球</button><button data-focus="moon">月球</button></nav></section><button type="button" class="body-label sun-label" id="sun-label" aria-label="围绕太阳旋转">SUN / 太阳</button><button type="button" class="body-label earth-label" id="earth-label" aria-label="围绕地球旋转">EARTH / 地球</button><button type="button" class="body-label moon-label" id="moon-label" aria-label="围绕月球旋转">MOON / 月球</button><aside class="info-card"><div class="card-head"><h2>当地天空</h2><span class="live"><i></i> LIVE SKY</span></div><div class="place" id="place-line">NOTTINGHAM · 52.95°N, 1.15°W</div><div class="rule"></div><div class="section-label">DAYLIGHT / 日照</div><div class="day-row"><div><span class="day-length" id="day-length">--:--</span><span class="day-unit">小时</span></div><div class="rise-set"><div><span>日出</span><b id="sunrise">--:--</b></div><div><span>日落</span><b id="sunset">--:--</b></div></div></div><div class="sky-state"><i id="sky-icon">☼</i><span id="sky-state">正在计算当地天空</span></div><div class="section-label">MOON / 月球观测</div><div class="moon-block"><canvas class="moon-icon" id="phase-icon" width="130" height="130"></canvas><div><div class="moon-phase" id="phase-name">月相</div><div class="moon-meta"><span id="illumination">--</span> 照明&nbsp; · &nbsp;月龄 <span id="moon-age">--</span> 天</div></div></div><div class="moon-position"><div class="compass" id="compass"><b class="n">N</b><b class="e">E</b><b class="s">S</b><b class="w">W</b><i class="moon-dot" id="moon-dot"></i></div><div class="compass-values"><div><span>地平高度 ALT</span><b id="moon-alt">--°</b></div><div><span>地平方位 AZ</span><div class="compass-row"><b id="moon-az">--°</b><b class="moon-pos-name" id="moon-dir">--</b></div></div><div><span>地平状态</span><b id="moon-horizon">--</b></div></div></div><p class="model-note"><strong>比例说明：</strong>天体大小与距离经过视觉夸大；轨道演示方向与天空数值按所选时间计算。月球采用同步自转模型。</p></aside><div class="location-readout">OBSERVER / <strong id="location-label">NOTTINGHAM</strong><br>LAT <span id="lat-label">52.9500°</span>&nbsp;&nbsp; LON <span id="lon-label">−1.1500°</span><br><span id="zone-label">Europe/London</span></div><section class="timeline"><div class="timeline-head"><label>SIMULATION TIME / 观测时间</label><div class="time-edit"><input id="date-time" type="datetime-local" step="60"><div class="transport"><button id="play" aria-label="播放或暂停">▶</button><input id="speed" type="range" min="0" max="3" step="1" value="1" title="时间流速"><select id="speed-select"><option value="3600">1 小时 / 秒</option><option value="86400" selected>1 天 / 秒</option><option value="604800">1 周 / 秒</option><option value="2592000">1 月 / 秒</option></select><button id="now">现在</button></div></div></div></section><div class="help">拖动旋转视角&nbsp; · &nbsp;滚轮缩放&nbsp; · &nbsp;点击地球选择地点</div><a class="source-link" href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">LAND : NATURAL EARTH&nbsp; ↗</a></main>`;

installReleaseNavigation('.top-coords');

const host = document.querySelector('#cosmos');
const earthOrbitRadius = 43;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#090e19');
const initialEarthDirection = sceneDirections(new Date()).earthFromSun;
const initialEarthPosition = new THREE.Vector3(initialEarthDirection.x, initialEarthDirection.y, initialEarthDirection.z).normalize().multiplyScalar(earthOrbitRadius);
const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, .1, 4000);
camera.position.copy(initialEarthPosition).add(new THREE.Vector3(56, 40, 78));
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(host.clientWidth, host.clientHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.22; host.append(renderer.domElement);
scene.add(new THREE.AmbientLight(0x43516e, .62));
const sunlight = new THREE.DirectionalLight(0xfff1d6, 3.2); sunlight.position.set(-500, 0, 0); sunlight.target.position.set(0,0,0); scene.add(sunlight, sunlight.target);

const orbitControls = new OrbitControls(camera, renderer.domElement); orbitControls.enableDamping = true; orbitControls.enablePan = false; orbitControls.dampingFactor = .055; orbitControls.minDistance = 17; orbitControls.maxDistance = 220; orbitControls.target.copy(initialEarthPosition); orbitControls.autoRotate = false;
let focusName = "earth";
let previousFocusPosition = initialEarthPosition.clone();
const body = { sun: null, earthCarrier: new THREE.Group(), earthSpin: new THREE.Group(), earthSurface: null, earthClouds: null, moon: new THREE.Group(), moonSurface: null, marker: new THREE.Group(), sunGlow: null };
const earthRadius = 6, sunRadius = 4.2, moonRadius = 1.45, moonOrbitRadius = 10.5;

function makeCloudTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512; const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height), data = image.data;
  const cloudBroad = makeTileNoise(18, 9, 70891), cloudMid = makeTileNoise(52, 26, 30719), cloudFine = makeTileNoise(150, 75, 95287);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const i = (y * canvas.width + x) * 4;
    const u = x / canvas.width, v = y / canvas.height;
    const coverage = cloudBroad(u, v) * .58 + cloudMid(u, v) * .3 + cloudFine(u, v) * .12;
    const alpha = THREE.MathUtils.smoothstep(coverage, .55, .73) * 82;
    data[i] = 226; data[i + 1] = 234; data[i + 2] = 236; data[i + 3] = alpha;
  }
  ctx.putImageData(image, 0, 0);
  return createGlobeTexture(canvas, renderer.capabilities.getMaxAnisotropy());
}


const sunGeo = new THREE.SphereGeometry(sunRadius, 48, 48);
body.sun = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ color: 0xffcf75 })); scene.add(body.sun);
const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=256;const gctx=glowCanvas.getContext('2d');const glow=gctx.createRadialGradient(128,128,12,128,128,128);glow.addColorStop(0,'rgba(255,215,143,.65)');glow.addColorStop(.2,'rgba(255,177,72,.3)');glow.addColorStop(1,'rgba(255,143,48,0)');gctx.fillStyle=glow;gctx.fillRect(0,0,256,256);body.sunGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));body.sunGlow.scale.set(24,24,1);body.sunGlow.position.set(0,0,0);scene.add(body.sunGlow);

body.earthCarrier.add(body.earthSpin);scene.add(body.earthCarrier);
body.earthSurface=new THREE.Mesh(new THREE.SphereGeometry(earthRadius,112,80),new THREE.MeshStandardMaterial({map:makeEarthTexture(renderer.capabilities.getMaxAnisotropy()),roughness:.72,metalness:.015}));body.earthSurface.userData.selectable=true;body.earthSpin.add(body.earthSurface);
body.earthClouds=new THREE.Mesh(new THREE.SphereGeometry(earthRadius*1.012,96,64),new THREE.MeshLambertMaterial({map:makeCloudTexture(),transparent:true,opacity:.08,depthWrite:false}));body.earthSpin.add(body.earthClouds);
const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(earthRadius*1.035,64,48),new THREE.MeshBasicMaterial({color:0x5bb8ef,transparent:true,opacity:.075,side:THREE.BackSide,blending:THREE.AdditiveBlending}));body.earthSpin.add(atmosphere);
body.marker.add(new THREE.Mesh(new THREE.SphereGeometry(.19,20,14),new THREE.MeshBasicMaterial({color:0xffd073})));const markerRing=new THREE.Mesh(new THREE.TorusGeometry(.32,.025,8,32),new THREE.MeshBasicMaterial({color:0xffd073}));markerRing.rotation.x=Math.PI/2;body.marker.add(markerRing);body.earthSpin.add(body.marker);

body.moonSurface=new THREE.Mesh(new THREE.SphereGeometry(moonRadius,48,32),new THREE.MeshStandardMaterial({map:createMoonTexture(renderer.capabilities.getMaxAnisotropy()),roughness:1}));body.moon.add(body.moonSurface);scene.add(body.moon);
const starsGeo=new THREE.BufferGeometry(),starPos=[],starColors=[];let starSeed=8331;const random=()=>{starSeed=(starSeed*16807)%2147483647;return starSeed/2147483647;};for(let i=0;i<2600;i++){const theta=random()*Math.PI*2, z=random()*2-1,r=450+random()*900,q=Math.sqrt(1-z*z);starPos.push(r*q*Math.cos(theta),r*z,r*q*Math.sin(theta));const c=new THREE.Color().setHSL(.56+random()*.12,.15,.56+random()*.4);starColors.push(c.r,c.g,c.b);}starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));starsGeo.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));const stars=new THREE.Points(starsGeo,new THREE.PointsMaterial({size:1.15,vertexColors:true,transparent:true,opacity:.8,sizeAttenuation:false}));scene.add(stars);

const dateInput=document.querySelector('#date-time'),playButton=document.querySelector('#play'),speedSelect=document.querySelector('#speed-select'),speedRange=document.querySelector('#speed');
const speedValues=[3600,86400,604800,2592000];speedRange.addEventListener('input',()=>{speedSelect.selectedIndex=Number(speedRange.value);});speedSelect.addEventListener('change',()=>{speedRange.value=speedSelect.selectedIndex;});
let latitude=52.95,longitude=-1.15,zone='Europe/London',playing=false,elapsed=0,lastPaintTime=0;
let currentTime=new Date();let locationName='NOTTINGHAM';
function localInputValue(date){return DateTime.fromJSDate(date).setZone(zone).toFormat("yyyy-MM-dd'T'HH:mm");}
function syncTimeInput(){dateInput.value=localInputValue(currentTime);}
syncTimeInput();
function formatCoord(n, pos, neg){return `${Math.abs(n).toFixed(4)}°${n>=0?pos:neg}`;}
function setLocation(lat,lon){latitude=Math.max(-89.9,Math.min(89.9,lat));longitude=((lon+180)%360+360)%360-180;try{zone=tzlookup(latitude,longitude);}catch{zone='UTC';}locationName='CUSTOM LOCATION';document.querySelector('#place-line').textContent=`${zone.replaceAll('_',' ')} · ${formatCoord(latitude,'N','S')} ${formatCoord(longitude,'E','W')}`;document.querySelector('#location-label').textContent=locationName;document.querySelector('#lat-label').textContent=formatCoord(latitude,'N','S');document.querySelector('#lon-label').textContent=formatCoord(longitude,'E','W');document.querySelector('#zone-label').textContent=zone;syncTimeInput();}
dateInput.addEventListener('change',()=>{const dt=DateTime.fromFormat(dateInput.value,"yyyy-MM-dd'T'HH:mm",{zone});if(dt.isValid)currentTime=dt.toUTC().toJSDate();});
playButton.addEventListener('click',()=>{playing=!playing;playButton.textContent=playing?'Ⅱ':'▶';playButton.classList.toggle('active',playing);});
document.querySelector('#now').addEventListener('click',()=>{currentTime=new Date();syncTimeInput();});

const compassDot=document.querySelector('#moon-dot'),phaseCanvas=document.querySelector('#phase-icon'),phaseCtx=phaseCanvas.getContext('2d');
function drawPhase(fraction,waxing){phaseCtx.clearRect(0,0,130,130);phaseCtx.beginPath();phaseCtx.arc(65,65,52,0,Math.PI*2);phaseCtx.fillStyle='#283446';phaseCtx.fill();phaseCtx.save();phaseCtx.beginPath();phaseCtx.arc(65,65,51,0,Math.PI*2);phaseCtx.clip();const right=waxing;phaseCtx.fillStyle='#e3dcc8';phaseCtx.fillRect(right?65:0,0,65,130);const width=Math.abs(1-2*fraction)*52;phaseCtx.beginPath();phaseCtx.ellipse(65,65,width,51,0,0,Math.PI*2);phaseCtx.fillStyle=fraction>.5?(right?'#e3dcc8':'#283446'):(right?'#283446':'#e3dcc8');phaseCtx.fill();phaseCtx.restore();phaseCtx.beginPath();phaseCtx.arc(65,65,52,0,Math.PI*2);phaseCtx.strokeStyle='#eef0e344';phaseCtx.lineWidth=2;phaseCtx.stroke();}
function compassDirection(az){return ['北','东北','东','东南','南','西南','西','西北'][Math.round(az/45)%8];}
function updateReadout(){
  const sky=skyState(currentTime,latitude,longitude),dateTime=DateTime.fromJSDate(currentTime).setZone(zone);
  const day=daylight(currentTime,latitude,longitude,zone,DateTime);
  document.querySelector('#day-length').textContent=day.minutes===1440?'24:00':`${String(Math.floor(day.minutes/60)).padStart(2,'0')}:${String(Math.round(day.minutes%60)).padStart(2,'0')}`;
  document.querySelector('#sunrise').textContent=day.state==='极夜'?'—':day.state==='极昼'?'全天':day.sunrise.toFormat('HH:mm');
  document.querySelector('#sunset').textContent=day.state==='极夜'?'—':day.state==='极昼'?'全天':day.sunset.toFormat('HH:mm');
  document.querySelector('#sky-state').textContent=`${day.state==='极夜'?'极夜 · ':day.state==='极昼'?'极昼 · ':''}${sky.twilight} · 太阳高度 ${sky.sun.altitude.toFixed(1)}°`;
  document.querySelector('#sky-icon').textContent=sky.sun.altitude>0?'☼':sky.sun.altitude>-18?'☾':'✦';
  document.querySelector('#phase-name').textContent=sky.phase;
  document.querySelector('#illumination').textContent=`${Math.round(sky.illumination*100)}%`;
  document.querySelector('#moon-age').textContent=sky.ageDays.toFixed(1);
  document.querySelector('#moon-alt').textContent=`${sky.moon.altitude.toFixed(1)}°`;
  document.querySelector('#moon-az').textContent=`${sky.moon.azimuth.toFixed(1)}°`;
  document.querySelector('#moon-dir').textContent=compassDirection(sky.moon.azimuth);
  document.querySelector('#moon-horizon').textContent=sky.moon.altitude>0?'地平线上方':'地平线下方';
  const rr=35*(1-Math.max(0,Math.min(90,sky.moon.altitude))/180),az=sky.moon.azimuth*Math.PI/180;compassDot.style.left=`calc(50% + ${Math.sin(az)*rr}px)`;compassDot.style.top=`calc(50% - ${Math.cos(az)*rr}px)`;
  drawPhase(sky.illumination,sky.waxing);
  document.querySelector('#place-line').textContent=`${zone.replaceAll('_',' ')} · ${formatCoord(latitude,'N','S')} ${formatCoord(longitude,'E','W')}`;
  if(playing&&performance.now()-lastPaintTime>300){syncTimeInput();lastPaintTime=performance.now();}
  return sky;
}

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerDown=null;
renderer.domElement.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('click',e=>{if(!pointerDown||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5)return;pointerDown=null;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(body.earthSurface)[0];if(!hit)return;const local=body.earthSpin.worldToLocal(hit.point.clone());const lat=Math.asin(THREE.MathUtils.clamp(local.y/earthRadius,-1,1))*180/Math.PI;const lon=Math.atan2(local.x,local.z)*180/Math.PI;const skyUrl=new URL('./sky.html',location.href);skyUrl.searchParams.set('lat',String(lat));skyUrl.searchParams.set('lon',String(lon));skyUrl.searchParams.set('time',currentTime.toISOString());window.location.assign(skyUrl);});

function sceneDirToVector(d){return new THREE.Vector3(d.x,d.y,d.z).normalize();}
const cameraLabels=[['sun-label',body.sun],['earth-label',body.earthCarrier],['moon-label',body.moon]];
function focusBody() { return focusName === 'earth' ? body.earthCarrier : body[focusName]; }
function setFocus(name) {
  const direction = camera.position.clone().sub(orbitControls.target).normalize();
  focusName = name;
  const target = focusBody().getWorldPosition(new THREE.Vector3());
  const radius = { sun: sunRadius, earth: earthRadius, moon: moonRadius }[name];
  orbitControls.minDistance = radius * 1.6;
  orbitControls.target.copy(target); camera.position.copy(target).addScaledVector(direction, radius * 6);
  previousFocusPosition.copy(target); orbitControls.update();
  cameraLabels.forEach(([id]) => document.getElementById(id).setAttribute('aria-pressed', String(id === name + '-label')));
  document.querySelector('.help').textContent = '当前围绕' + {sun:'太阳',earth:'地球',moon:'月球'}[name] + '旋转 · 拖动旋转 · 滚轮缩放 · 点击地球表面进入当地天空';
}
for (const name of ['sun', 'earth', 'moon']) document.getElementById(name + '-label').addEventListener('click', () => setFocus(name));
document.querySelectorAll('[data-focus]').forEach(el => el.addEventListener('click', () => setFocus(el.dataset.focus)));
document.getElementById('earth-label').setAttribute('aria-pressed', 'true');
function updateLabel(id,obj){const el=document.getElementById(id),point=obj.getWorldPosition(new THREE.Vector3());point.project(camera);if(point.z>1){el.style.visibility='hidden';return;}el.style.visibility='visible';el.style.opacity='1';el.style.left=`${(point.x*.5+.5)*innerWidth}px`;el.style.top=`${(-point.y*.5+.5)*innerHeight-25}px`;}
function render(now){requestAnimationFrame(render);const dt=Math.min((now-(render.last||now))/1000,.05);render.last=now;if(playing)currentTime=new Date(currentTime.getTime()+dt*Number(speedSelect.value)*1000);const directions=sceneDirections(currentTime);const earthDir=sceneDirToVector(directions.earthFromSun);body.earthCarrier.position.copy(earthDir).multiplyScalar(earthOrbitRadius);body.earthSpin.rotation.y=(directions.siderealSpin+90)*Math.PI/180;body.earthClouds.rotation.y=-body.earthSpin.rotation.y*.08;
  const moonDir=sceneDirToVector(directions.moonFromEarth);body.moon.position.copy(body.earthCarrier.position).add(moonDir.multiplyScalar(moonOrbitRadius));body.moon.rotation.set(0,0,0);const facingEarth=body.earthCarrier.position.clone().sub(body.moon.position).normalize();body.moonSurface.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),facingEarth);
const focusPosition = focusBody().getWorldPosition(new THREE.Vector3());
  const focusShift = focusPosition.clone().sub(previousFocusPosition);
  camera.position.add(focusShift); orbitControls.target.add(focusShift); previousFocusPosition.copy(focusPosition);
  document.querySelector('#lunar-entry').href = './lunar.html?time=' + encodeURIComponent(currentTime.toISOString());
// DirectionalLight's position points toward its source. Put that source on
  // Earth's sunward side so the lit hemisphere faces the Sun.
  const sunlightFrom=earthDir.clone().multiplyScalar(-200);sunlight.position.copy(sunlightFrom);sunlight.target.position.set(0,0,0);sunlight.target.updateMatrixWorld();
  const lat=latitude*Math.PI/180,lon=longitude*Math.PI/180;body.marker.position.set(earthRadius*Math.cos(lat)*Math.sin(lon),earthRadius*Math.sin(lat),earthRadius*Math.cos(lat)*Math.cos(lon));body.marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),body.marker.position.clone().normalize());
  updateReadout();orbitControls.update();renderer.render(scene,camera);cameraLabels.forEach(([id,obj])=>updateLabel(id,obj));}
requestAnimationFrame(render);
let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);},50);}).observe(host);
