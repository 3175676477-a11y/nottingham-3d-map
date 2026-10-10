import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { merge, mesh } from 'topojson-client';
import landTopology from 'world-atlas/land-110m.json';
import { DateTime } from 'luxon';
import tzlookup from 'tz-lookup';
import { daylight, sceneDirections, skyState } from './astronomy.js';
import './astronomy.css';

const root = document.querySelector('#astronomy-app');
root.innerHTML = `<main class="observatory"><div id="cosmos"></div><header class="topbar"><div class="astro-brand"><span class="astro-mark">☼</span><div><b>SOLAR ATLAS <i>·</i> 02</b><small>EARTH / MOON / SUN OBSERVATORY</small></div></div><div class="top-coords">GEOCENTRIC MODEL&nbsp; / &nbsp;UTC INTERPRETED BY OBSERVER TIMEZONE</div><a class="back-link" href="/">校园地形图&nbsp; ↗</a></header><section class="hero"><span class="eyebrow">THREE BODIES / ONE SKY</span><h1>Sun, Earth<br><em>&amp; Moon.</em></h1><p>点击地球任意地点，查看当地天空。</p></section><div class="body-label sun-label" id="sun-label">SUN / 太阳</div><div class="body-label earth-label" id="earth-label">EARTH / 地球</div><div class="body-label moon-label" id="moon-label">MOON / 月球</div><aside class="info-card"><div class="card-head"><h2>当地天空</h2><span class="live"><i></i> LIVE SKY</span></div><div class="place" id="place-line">NOTTINGHAM · 52.95°N, 1.15°W</div><div class="rule"></div><div class="section-label">DAYLIGHT / 日照</div><div class="day-row"><div><span class="day-length" id="day-length">--:--</span><span class="day-unit">小时</span></div><div class="rise-set"><div><span>日出</span><b id="sunrise">--:--</b></div><div><span>日落</span><b id="sunset">--:--</b></div></div></div><div class="sky-state"><i id="sky-icon">☼</i><span id="sky-state">正在计算当地天空</span></div><div class="section-label">MOON / 月球观测</div><div class="moon-block"><canvas class="moon-icon" id="phase-icon" width="130" height="130"></canvas><div><div class="moon-phase" id="phase-name">月相</div><div class="moon-meta"><span id="illumination">--</span> 照明&nbsp; · &nbsp;月龄 <span id="moon-age">--</span> 天</div></div></div><div class="moon-position"><div class="compass" id="compass"><b class="n">N</b><b class="e">E</b><b class="s">S</b><b class="w">W</b><i class="moon-dot" id="moon-dot"></i></div><div class="compass-values"><div><span>地平高度 ALT</span><b id="moon-alt">--°</b></div><div><span>地平方位 AZ</span><div class="compass-row"><b id="moon-az">--°</b><b class="moon-pos-name" id="moon-dir">--</b></div></div><div><span>地平状态</span><b id="moon-horizon">--</b></div></div></div><p class="model-note"><strong>比例说明：</strong>天体大小与距离经过视觉夸大；轨道演示方向与天空数值按所选时间计算。月球采用同步自转模型。</p></aside><div class="location-readout">OBSERVER / <strong id="location-label">NOTTINGHAM</strong><br>LAT <span id="lat-label">52.9500°</span>&nbsp;&nbsp; LON <span id="lon-label">−1.1500°</span><br><span id="zone-label">Europe/London</span></div><section class="timeline"><div class="timeline-head"><label>SIMULATION TIME / 观测时间</label><div class="time-edit"><input id="date-time" type="datetime-local" step="60"><div class="transport"><button id="play" aria-label="播放或暂停">▶</button><input id="speed" type="range" min="0" max="3" step="1" value="1" title="时间流速"><select id="speed-select"><option value="3600">1 小时 / 秒</option><option value="86400" selected>1 天 / 秒</option><option value="604800">1 周 / 秒</option><option value="2592000">1 月 / 秒</option></select><button id="now">现在</button></div></div></div></section><div class="help">拖动旋转视角&nbsp; · &nbsp;滚轮缩放&nbsp; · &nbsp;点击地球选择地点</div><a class="source-link" href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">LAND : NATURAL EARTH&nbsp; ↗</a></main>`;

const host = document.querySelector('#cosmos');
const scene = new THREE.Scene(); scene.background = new THREE.Color('#090e19');
const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, .1, 4000);
camera.position.set(42, 31, 68);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(host.clientWidth, host.clientHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.22; host.append(renderer.domElement);
scene.add(new THREE.AmbientLight(0x43516e, .62));
const sunlight = new THREE.DirectionalLight(0xfff1d6, 3.2); sunlight.position.set(-500, 0, 0); sunlight.target.position.set(0,0,0); scene.add(sunlight, sunlight.target);

const orbitControls = new OrbitControls(camera, renderer.domElement); orbitControls.enableDamping = true; orbitControls.dampingFactor = .055; orbitControls.minDistance = 17; orbitControls.maxDistance = 220; orbitControls.target.set(0,0,0); orbitControls.autoRotate = false;
const body = { sun: null, earthCarrier: new THREE.Group(), earthSpin: new THREE.Group(), earthSurface: null, moon: new THREE.Group(), moonSurface: null, marker: new THREE.Group(), sunGlow: null, moonOrbit: null };
const earthRadius = 6, sunRadius = 4.2, moonRadius = 1.45, earthOrbitRadius = 43, moonOrbitRadius = 10.5;

function makeEarthTexture() {
  const width = 2048, height = 1024, canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const ocean = ctx.createLinearGradient(0, 0, width, height); ocean.addColorStop(0, '#163c61'); ocean.addColorStop(.5, '#275b83'); ocean.addColorStop(1, '#153652'); ctx.fillStyle = ocean; ctx.fillRect(0, 0, width, height);
  const land = merge(landTopology, landTopology.objects.land.geometries);
  const projection = geoEquirectangular().scale(width / (2 * Math.PI)).translate([width / 2, height / 2]);
  const path = geoPath(projection, ctx);
  ctx.fillStyle = '#789477'; ctx.strokeStyle = '#b7bd8c'; ctx.lineWidth = 1.7; ctx.beginPath(); path(land); ctx.fill(); ctx.stroke();
  const borders = mesh(landTopology, landTopology.objects.countries, (a,b) => a !== b);
  ctx.strokeStyle = '#d1c89b75'; ctx.lineWidth = .8; ctx.beginPath(); path(borders); ctx.stroke();
  ctx.strokeStyle = '#e5e5d544'; ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) { const y = (90-lat)/180*height; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke(); }
  for (let lon = -150; lon <= 180; lon += 30) { const x=(lon+180)/360*width; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke(); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); texture.offset.x = .25; return texture;
}

function makeMoonTexture() {
  const canvas = document.createElement('canvas'); canvas.width=1024; canvas.height=512; const ctx=canvas.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,1024,512); grad.addColorStop(0,'#bfc2bf'); grad.addColorStop(.5,'#e1dfd5'); grad.addColorStop(1,'#a8aaa9'); ctx.fillStyle=grad; ctx.fillRect(0,0,1024,512);
  let seed=24681; const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<1450;i++){const x=rand()*1024,y=rand()*512,r=1+rand()*14;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=`rgba(61,65,68,${.025+rand()*.09})`;ctx.fill();ctx.beginPath();ctx.arc(x-r*.18,y-r*.18,r*.76,Math.PI,Math.PI*1.8);ctx.strokeStyle=`rgba(255,255,255,${.05+rand()*.14})`;ctx.lineWidth=.8;ctx.stroke();}
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.offset.x=.25;return tex;
}

const sunGeo = new THREE.SphereGeometry(sunRadius, 48, 48);
body.sun = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ color: 0xffcf75 })); scene.add(body.sun);
const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=256;const gctx=glowCanvas.getContext('2d');const glow=gctx.createRadialGradient(128,128,12,128,128,128);glow.addColorStop(0,'rgba(255,215,143,.65)');glow.addColorStop(.2,'rgba(255,177,72,.3)');glow.addColorStop(1,'rgba(255,143,48,0)');gctx.fillStyle=glow;gctx.fillRect(0,0,256,256);body.sunGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));body.sunGlow.scale.set(24,24,1);body.sunGlow.position.set(0,0,0);scene.add(body.sunGlow);

const orbitPoints=[];for(let i=0;i<=320;i++){const a=i/320*Math.PI*2;const ecl=new THREE.Vector3(Math.cos(a)*earthOrbitRadius,Math.sin(a)*earthOrbitRadius,0);orbitPoints.push(new THREE.Vector3(ecl.x,ecl.y*Math.cos(23.439* Math.PI/180),-ecl.y*Math.sin(23.439*Math.PI/180)));}
const orbitLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPoints),new THREE.LineDashedMaterial({color:0x65738b,dashSize:.65,gapSize:.7,transparent:true,opacity:.48}));orbitLine.computeLineDistances();scene.add(orbitLine);
body.earthCarrier.add(body.earthSpin);scene.add(body.earthCarrier);
body.earthSurface=new THREE.Mesh(new THREE.SphereGeometry(earthRadius,96,64),new THREE.MeshStandardMaterial({map:makeEarthTexture(),roughness:.78,metalness:.02}));body.earthSurface.userData.selectable=true;body.earthSpin.add(body.earthSurface);
const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(earthRadius*1.035,64,48),new THREE.MeshBasicMaterial({color:0x5bb8ef,transparent:true,opacity:.075,side:THREE.BackSide,blending:THREE.AdditiveBlending}));body.earthSpin.add(atmosphere);
const axisGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-9,0),new THREE.Vector3(0,9,0)]);const axisLine=new THREE.Line(axisGeo,new THREE.LineDashedMaterial({color:0x9db6cf,dashSize:.35,gapSize:.35,transparent:true,opacity:.48}));axisLine.computeLineDistances();body.earthCarrier.add(axisLine);
body.marker.add(new THREE.Mesh(new THREE.SphereGeometry(.19,20,14),new THREE.MeshBasicMaterial({color:0xffd073})));const markerRing=new THREE.Mesh(new THREE.TorusGeometry(.32,.025,8,32),new THREE.MeshBasicMaterial({color:0xffd073}));markerRing.rotation.x=Math.PI/2;body.marker.add(markerRing);body.earthSpin.add(body.marker);

body.moonSurface=new THREE.Mesh(new THREE.SphereGeometry(moonRadius,48,32),new THREE.MeshStandardMaterial({map:makeMoonTexture(),roughness:1}));body.moon.add(body.moonSurface);scene.add(body.moon);
const moonOrbitPoints=[];for(let i=0;i<=180;i++){const a=i/180*Math.PI*2;moonOrbitPoints.push(new THREE.Vector3(Math.cos(a)*moonOrbitRadius,0,Math.sin(a)*moonOrbitRadius));}body.moonOrbit=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(moonOrbitPoints),new THREE.LineBasicMaterial({color:0x8291a7,transparent:true,opacity:.38}));scene.add(body.moonOrbit);

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
renderer.domElement.addEventListener('click',e=>{if(!pointerDown||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5)return;pointerDown=null;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(body.earthSurface)[0];if(!hit)return;const local=body.earthSpin.worldToLocal(hit.point.clone());const lat=Math.asin(THREE.MathUtils.clamp(local.y/earthRadius,-1,1))*180/Math.PI;const lon=Math.atan2(local.x,local.z)*180/Math.PI;setLocation(lat,lon);});

function sceneDirToVector(d){return new THREE.Vector3(d.x,d.y,d.z).normalize();}
const axis=new THREE.Vector3(0,1,0);const cameraLabels=[['sun-label',body.sun],['earth-label',body.earthCarrier],['moon-label',body.moon]];
function updateLabel(id,obj){const el=document.getElementById(id),point=obj.getWorldPosition(new THREE.Vector3());point.project(camera);if(point.z>1){el.style.opacity='0';return;}el.style.opacity='1';el.style.left=`${(point.x*.5+.5)*innerWidth}px`;el.style.top=`${(-point.y*.5+.5)*innerHeight-25}px`;}
function render(now){requestAnimationFrame(render);const dt=Math.min((now-(render.last||now))/1000,.05);render.last=now;if(playing)currentTime=new Date(currentTime.getTime()+dt*Number(speedSelect.value)*1000);const directions=sceneDirections(currentTime);const earthDir=sceneDirToVector(directions.earthFromSun);body.earthCarrier.position.copy(earthDir).multiplyScalar(earthOrbitRadius);body.earthSpin.rotation.y=(directions.siderealSpin+90)*Math.PI/180;
  const moonDir=sceneDirToVector(directions.moonFromEarth);body.moon.position.copy(body.earthCarrier.position).add(moonDir.multiplyScalar(moonOrbitRadius));body.moon.rotation.set(0,0,0);const facingEarth=body.earthCarrier.position.clone().sub(body.moon.position).normalize();body.moonSurface.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),facingEarth);
  body.moonOrbit.position.copy(body.earthCarrier.position);body.moonOrbit.quaternion.setFromUnitVectors(axis,sceneDirToVector(directions.moonOrbitNormal));
  const sunlightFrom=earthDir.clone().multiplyScalar(200);sunlight.position.copy(sunlightFrom);sunlight.target.position.set(0,0,0);sunlight.target.updateMatrixWorld();
  const lat=latitude*Math.PI/180,lon=longitude*Math.PI/180;body.marker.position.set(earthRadius*Math.cos(lat)*Math.sin(lon),earthRadius*Math.sin(lat),earthRadius*Math.cos(lat)*Math.cos(lon));body.marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),body.marker.position.clone().normalize());
  updateReadout();orbitControls.update();renderer.render(scene,camera);cameraLabels.forEach(([id,obj])=>updateLabel(id,obj));}
requestAnimationFrame(render);
let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);},50);}).observe(host);
