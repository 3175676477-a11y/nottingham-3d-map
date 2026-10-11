// Approximate J2000 Kepler elements (AU, degrees) and sidereal periods (days).
// Reference: JPL approximate positions and NASA planetary fact sheets.
// Elements are fixed for this educational diagram; no perturbations/precession.
export const PLANETS = [
  { id:'mercury', name:'水星', english:'MERCURY', a:.38709927, e:.20563593, i:7.00497902, node:48.33076593, peri:77.45779628, longitude:252.25032350, period:87.969, radius:1.05, orbit:24, color:'#b3aaa0', description:'离太阳最近的行星，公转最快；偏心率使轨道呈明显椭圆。' },
  { id:'venus', name:'金星', english:'VENUS', a:.72333566, e:.00677672, i:3.39467605, node:76.67984255, peri:131.60246718, longitude:181.97909950, period:224.701, radius:1.9, orbit:35, color:'#e5c498', description:'浓厚云层覆盖的类地行星，公转轨道接近圆形。' },
  { id:'earth', name:'地球', english:'EARTH', a:1.00000261, e:.01671123, i:-.00001531, node:0, peri:102.93768193, longitude:100.46457166, period:365.256, radius:2, orbit:48, color:'#79bee0', description:'我们的家园。月球随地球一起绕太阳运动，也绕地球公转。' },
  { id:'mars', name:'火星', english:'MARS', a:1.52371034, e:.09339410, i:1.84969142, node:49.55953891, peri:-23.94362959, longitude:-4.55343205, period:686.980, radius:1.5, orbit:65, color:'#d98962', description:'红色的类地行星，一个火星年约为 1.88 个地球年。' },
  { id:'jupiter', name:'木星', english:'JUPITER', a:5.20288700, e:.04838624, i:1.30439695, node:100.47390909, peri:14.72847983, longitude:34.39644051, period:4332.589, radius:6, orbit:94, color:'#d7b597', description:'太阳系最大的行星。云带与大红斑以程序纹理示意。' },
  { id:'saturn', name:'土星', english:'SATURN', a:9.53667594, e:.05386179, i:2.48599187, node:113.66242448, peri:92.59887831, longitude:49.95424423, period:10759.22, radius:5, orbit:125, color:'#dfc998', description:'拥有显著的环系统。行星环随土星运动，不是另一条公转轨道。' },
  { id:'uranus', name:'天王星', english:'URANUS', a:19.18916464, e:.04725744, i:.77263783, node:74.01692503, peri:170.95427630, longitude:313.23810451, period:30685.4, radius:3.6, orbit:158, color:'#94d5d7', description:'浅蓝色冰巨星，公转一周约需 84 个地球年。' },
  { id:'neptune', name:'海王星', english:'NEPTUNE', a:30.06992276, e:.00859048, i:1.77004347, node:131.78422574, peri:44.96476227, longitude:-55.12002969, period:60189, radius:3.5, orbit:190, color:'#598acb', description:'八大行星中最远的一颗，公转一周约需 165 个地球年。' },
];
const R = Math.PI / 180;
const TAU = Math.PI * 2;
export function eccentricAnomaly(mean, eccentricity) {
  const m = ((mean % TAU) + TAU) % TAU;
  let e = m;
  for (let k=0;k<10;k++) e -= (e-eccentricity*Math.sin(e)-m)/(1-eccentricity*Math.cos(e));
  return e;
}
export function pointOnOrbit(planet, anomaly, schematic=true) {
  const a = schematic ? planet.orbit : planet.a;
  const x = a*(Math.cos(anomaly)-planet.e), y=a*Math.sqrt(1-planet.e**2)*Math.sin(anomaly);
  const w=(planet.peri-planet.node)*R, n=planet.node*R, i=planet.i*R;
  const xp=x*Math.cos(w)-y*Math.sin(w), yp=x*Math.sin(w)+y*Math.cos(w);
  // Ecliptic X = equinox, Y = ecliptic north, Z = -ecliptic longitude 90°.
  return {x:xp*Math.cos(n)-yp*Math.cos(i)*Math.sin(n),y:yp*Math.sin(i),z:-(xp*Math.sin(n)+yp*Math.cos(i)*Math.cos(n))};
}
export function planetPosition(planet,date,schematic=true) {
  const days=(date.getTime()-Date.UTC(2000,0,1,12))/86400000;
  const mean=(planet.longitude-planet.peri)*R+TAU*days/planet.period;
  return pointOnOrbit(planet,eccentricAnomaly(mean,planet.e),schematic);
}
