import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, planetPosition, pointOnOrbit, eccentricAnomaly } from './planet-orbits.js';
const length=p=>Math.hypot(p.x,p.y,p.z);
test('eight distinct planets in increasing solar distance and orbital period',()=>{
 assert.equal(PLANETS.length,8);assert.equal(new Set(PLANETS.map(p=>p.id)).size,8);
 for(let i=1;i<8;i++){assert.ok(PLANETS[i].a>PLANETS[i-1].a);assert.ok(PLANETS[i].period>PLANETS[i-1].period);}
});
test('Kepler solver, perihelion/aphelion and closed orbit preserve eccentricity',()=>{
 for(const p of PLANETS){
  for(const m of [.1,1,3,5]){const e=eccentricAnomaly(m,p.e);assert.ok(Math.abs(e-p.e*Math.sin(e)-m)<1e-10);}
  assert.ok(Math.abs(length(pointOnOrbit(p,0,false))-p.a*(1-p.e))<1e-10);
  assert.ok(Math.abs(length(pointOnOrbit(p,Math.PI,false))-p.a*(1+p.e))<1e-10);
  const start=pointOnOrbit(p,0),end=pointOnOrbit(p,Math.PI*2);assert.ok(Math.hypot(start.x-end.x,start.y-end.y,start.z-end.z)<1e-10);
 }
});
test('each body completes its own period; display scaling preserves directions',()=>{
 const date=new Date('2026-10-11T00:00:00Z');
 for(const p of PLANETS){
  const a=planetPosition(p,date),b=planetPosition(p,new Date(date.getTime()+p.period*86400000));
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-7);
  const physical=planetPosition(p,date,false),scale=p.orbit/p.a;for(const key of ['x','y','z']) assert.ok(Math.abs(a[key]-physical[key]*scale)<1e-9);
 }
});
test('Earth starts near J2000 vernal-axis coordinates and all planets move prograde',()=>{
 const date=new Date('2000-01-01T12:00:00Z'),earth=planetPosition(PLANETS[2],date,false);
 assert.ok(earth.x<-.17&&earth.x>-.19);assert.ok(earth.z<-.96&&earth.z>-.98);
 for(const p of PLANETS){const a=planetPosition(p,date),b=planetPosition(p,new Date(date.getTime()+86400000));assert.ok(a.z*b.x-a.x*b.z>0);}
});
