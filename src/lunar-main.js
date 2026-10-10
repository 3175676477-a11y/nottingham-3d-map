import * as THREE from 'three';
import { lunarSky, lunarDaylight, lunarTrackWindow } from './lunar-astronomy.js';
import { makeEarthTexture } from './earth-texture.js';
import { splitVisibleTrack } from './sky-trajectories.js';
import { installReleaseNavigation } from './release-navigation.js';
import './lunar.css';

const $ = id => document.getElementById(id);
document.querySelector('#lunar-app').innerHTML = `
<header><a id="back" href="./astronomy.html">← 返回太空</a><span class="edition">SOLAR ATLAS / LUNAR OBSERVER</span><a href="./sky.html">地面天空 ↗</a></header>
<main><section class="intro"><small>THE SKY FROM THE MOON</small><h1>站在月球，<br><em>仰望地球。</em></h1><p>拖动画面环顾天空，滚轮缩放。<br>金色为太阳轨迹，蓝色为地球轨迹。</p>
<div class="panel"><h2>月面观测地点</h2><label>地点 <select id="site"><option value="0,45">近地面 · 东经 45°</option><option value="0,0">近地面中央</option><option value="0,180">月球背面</option><option value="80,0">北纬 80°</option><option value="custom">自定义</option></select></label><label>纬度 ° <input id="latitude" type="number" min="-90" max="90" required step=".1" value="0"></label><label>东经 ° <input id="longitude" type="number" min="-180" max="180" required step=".1" value="45"></label><button id="apply">前往此处</button></div>
<div class="panel"><h2>月面日照</h2><b id="day-state"></b><p id="day-duration"></p><div id="events"></div></div></section>
<section class="stage"><div id="lunar-viewport"></div><div class="stage-title"><span>月面天空 · 无大气</span><b id="heading"></b></div><div id="earth-label" class="sky-label">地球 / EARTH</div><div id="sun-label" class="sky-label gold">太阳 / SUN</div><div class="stage-controls"><button id="look-earth">看地球</button><button id="look-sun">看太阳</button><button id="look-horizon">看地平线</button></div><div id="notice"></div></section>
<aside><div class="panel"><h2>地球 / EARTH</h2><strong id="phase"></strong><p id="earth-data"></p><p id="earth-visible"></p><label>天体显示倍率 <select id="magnification"><option value="1">1× 真实角大小</option><option value="4" selected>4× 看清大陆</option><option value="8">8× 细看大陆</option></select></label><p>轮廓：Natural Earth 50m。陆地颜色为示意，非卫星影像。暗面保留微弱辅助光。</p></div><div class="panel"><h2>太阳 / SUN</h2><p id="sun-data"></p></div><div class="panel"><h2>轨迹与方位</h2><p>北 N · 东 E · 南 S · 西 W<br>方位角从北向东计数。<br>实线：已走过；虚线：尚未到达。</p><p id="track-dates"></p><p>近地面地球大致停留在同一区域，以小幅摆动形成轨迹。月背通常看不到地球。</p></div></aside></main>
<footer><div class="time-controls"><label>观测时间 UTC <input id="lunar-time" type="datetime-local" step="60"></label><button id="play">▶ 播放</button><select id="speed"><option value="3600">1 小时 / 秒</option><option value="86400" selected>1 天 / 秒</option><option value="604800">1 周 / 秒</option></select><button id="now">现在</button></div><p>简化天文模型：IAU 平均月面朝向与近似轨道，未计精密天平动、食与地形遮挡。日照按水平地平线计算；月面与星空仅作示意。月球没有地球式的蓝天和暮光。</p></footer>`;
installReleaseNavigation('.edition');
const params = new URLSearchParams(location.search);
let time = new Date(params.get('time') || Date.now()); if (!Number.isFinite(time.getTime())) time = new Date();
let lat = 0, lon = 45, playing = false, yaw = 0, pitch = 0, lastUI = 0, trackKey = '', eventKey = '';
const inputTime = () => { $('lunar-time').value = time.toISOString().slice(0,16); };
inputTime();
const host = $('lunar-viewport'), scene = new THREE.Scene(); scene.background = new THREE.Color('#030609');
const camera = new THREE.PerspectiveCamera(35, 1, .1, 700); camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.localClippingEnabled = true; host.append(renderer.domElement);
const horizonClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshStandardMaterial({ map: makeEarthTexture(renderer.capabilities.getMaxAnisotropy()), roughness: .95, clippingPlanes: [horizonClip] })); scene.add(earth);
const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: '#fff0b6', clippingPlanes: [horizonClip] })); scene.add(sun);
scene.add(new THREE.AmbientLight(0x8ba6bc, .16));
const sunlight = new THREE.DirectionalLight(0xfff5e4, 3); scene.add(sunlight, sunlight.target);
const ground = new THREE.Mesh(new THREE.SphereGeometry(170, 96, 48, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#282929', side: THREE.BackSide })); scene.add(ground);
function skyVector(az, alt, radius = 180) { const a = az * Math.PI / 180, h = alt * Math.PI / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(h), Math.sin(h), -Math.cos(a) * Math.cos(h)).multiplyScalar(radius); }
function labelSprite(text, color) { const c = document.createElement('canvas'); c.width = 256; c.height = 80; const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text,128,52); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); s.scale.set(22,7,1); return s; }
for (const [az, text] of [[0,'北 N'],[90,'东 E'],[180,'南 S'],[270,'西 W']]) { const marker = labelSprite(text,'#e6ca8f'); marker.position.copy(skyVector(az, 3, 160)); scene.add(marker); }
for (const altitude of [0,30,60]) { const pts = Array.from({length:361},(_,az)=>skyVector(az,altitude,190)); const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({color:0x52626e,transparent:true,opacity:altitude ? .22 : .65,dashSize:3,gapSize:3})); line.computeLineDistances(); scene.add(line); }
let seed = 817; const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
const starPoints = []; for(let i=0;i<1800;i++) { const az = random()*360, alt = Math.asin(random())*180/Math.PI; starPoints.push(...skyVector(az,alt,400).toArray()); }
const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(starPoints,3)),new THREE.PointsMaterial({color:0xc5d3e3,size:.8,sizeAttenuation:false,transparent:true,opacity:.6})); scene.add(stars);
const lines = {};
for (const body of ['sun','earth']) for(const part of ['past','future']) { const material = part === 'past' ? new THREE.LineBasicMaterial({color:body==='sun'?0xe9b865:0x82bee3}) : new THREE.LineDashedMaterial({color:body==='sun'?0xe9b865:0x82bee3,dashSize:1.7,gapSize:1.2}); const line = new THREE.LineSegments(new THREE.BufferGeometry(),material); lines[body+part]=line; scene.add(line); }
let samples;
function updateTracks(state) {
 const window = lunarTrackWindow(time), key = `${window.start}:${lat}:${lon}`;
 if (key !== trackKey) { trackKey = key; samples={sun:[],earth:[]}; const count=360; for(let i=0;i<=count;i++) { const ms=window.start+(window.end-window.start)*i/count; const s=lunarSky(new Date(ms),lat,lon); for(const b of ['sun','earth']) samples[b].push({ms,position:s[b]}); } $('track-dates').textContent='本周期 UTC：'+new Date(window.start).toISOString().slice(0,10)+' — '+new Date(window.end).toISOString().slice(0,10); }
 for (const body of ['sun','earth']) { const split=splitVisibleTrack(samples[body],time.getTime(),state[body]); for(const part of ['past','future']) { const line=lines[body+part]; line.geometry.dispose(); line.geometry=new THREE.BufferGeometry().setFromPoints(split[part].map(p=>skyVector(p.azimuth,p.altitude,185))); line.computeLineDistances(); } }
}
function look(body) { const s=lunarSky(time,lat,lon)[body]; if(s.altitude<0) { $('notice').textContent=(body==='earth'?'地球':'太阳')+'在地平线下，当前地点不可见。'; return; } yaw=-s.azimuth*Math.PI/180; pitch=s.altitude*Math.PI/180; camera.fov=35; camera.updateProjectionMatrix(); $('notice').textContent=''; }
$('look-earth').onclick=()=>look('earth'); $('look-sun').onclick=()=>look('sun'); $('look-horizon').onclick=()=>{pitch=.15;camera.fov=80;camera.updateProjectionMatrix();};
let drag=null;
renderer.domElement.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return; yaw-=(e.clientX-drag.x)*.004;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-drag.y)*.004,-.4,Math.PI/2-.001);drag={x:e.clientX,y:e.clientY};});
for(const event of ['pointerup','pointercancel']) renderer.domElement.addEventListener(event,()=>{drag=null;});
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();camera.fov=THREE.MathUtils.clamp(camera.fov+e.deltaY*.025,8,100);camera.updateProjectionMatrix();},{passive:false});
$('site').onchange=()=>{if($('site').value==='custom')return;const pair=$('site').value.split(',');$('latitude').value=pair[0];$('longitude').value=pair[1];applyLocation();};
function applyLocation(){ if(!$('latitude').reportValidity()||!$('longitude').reportValidity())return;lat=Number($('latitude').value);lon=Number($('longitude').value);lastUI=-Infinity;eventKey='';$('notice').textContent='';const state=lunarSky(time,lat,lon);if(state.earth.altitude>=0)look('earth');else if(state.sun.altitude>=0)look('sun');else{pitch=.15;camera.fov=80;camera.updateProjectionMatrix();} }
$('apply').onclick=()=>{$('site').value='custom';applyLocation();};
$('lunar-time').onchange=()=>{ const value=new Date($('lunar-time').value+'Z');if(Number.isFinite(value.getTime())){time=value;eventKey='';lastUI=-Infinity;} };
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Ⅱ 暂停':'▶ 播放';};$('now').onclick=()=>{time=new Date();inputTime();eventKey='';lastUI=-Infinity;};
const formatEvent = ms => ms ? new Date(ms).toISOString().slice(0,16).replace('T',' ')+' UTC' : '前后 36 天未找到';
function readout(s){ const fmt=p=>`高度 ${p.altitude.toFixed(1)}° · 方位 ${p.azimuth.toFixed(1)}°`; $('earth-data').textContent=fmt(s.earth);$('sun-data').textContent=fmt(s.sun);$('earth-visible').textContent=s.earth.altitude>=0?'地球在地平线上方':'地球在地平线下方';$('phase').textContent=`地球受光 ${Math.round(s.illumination*100)}%`; $('heading').textContent=`朝向 ${((-yaw*180/Math.PI%360+360)%360).toFixed(0)}° · 仰角 ${(pitch*180/Math.PI).toFixed(0)}°`;
 const key=`${Math.floor(time.getTime()/3600000)}:${lat}:${lon}`;if(key!==eventKey){eventKey=key;const day=lunarDaylight(time,lat,lon);$('day-state').textContent=day.lit?'月昼 · 天空仍是黑色':'月夜';$('day-duration').textContent=day.days?`${day.lit?'本次':'下一次'}连续日照 ${day.days.toFixed(2)} 个地球日`:'此窗口无完整日照区间';$('events').textContent='日出 '+formatEvent(day.rise)+' / 日落 '+formatEvent(day.set);}
 updateTracks(s);if(playing)inputTime(); }
function positionLabel(id,object,altitude){const p=object.position.clone().project(camera);const el=$(id);el.hidden=altitude<0||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;el.style.left=(p.x*.5+.5)*host.clientWidth+'px';const radiusPixels=object.scale.x/(180*Math.tan(camera.fov*Math.PI/360))*host.clientHeight/2;el.style.top=(-p.y*.5+.5)*host.clientHeight-radiusPixels-12+'px';}
let last=0;
function render(now){requestAnimationFrame(render);const dt=Math.min((now-last)/1000,.1);last=now;if(playing)time=new Date(time.getTime()+dt*Number($('speed').value)*1000);const state=lunarSky(time,lat,lon);camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld();earth.position.copy(state.earth.direction).multiplyScalar(180);earth.quaternion.setFromRotationMatrix(state.earthOrientation);sun.position.copy(state.sun.direction).multiplyScalar(180);const mag=Number($('magnification').value);earth.scale.setScalar(180*Math.tan(.95*Math.PI/180)*mag);sun.scale.setScalar(180*Math.tan(.266*Math.PI/180)*mag);sunlight.position.copy(state.lightDirection).multiplyScalar(500);positionLabel('earth-label',earth,state.earth.altitude);positionLabel('sun-label',sun,state.sun.altitude);if(now-lastUI>200){readout(state);lastUI=now;}renderer.render(scene,camera);}
new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();}).observe(host);
look('earth');requestAnimationFrame(render);
