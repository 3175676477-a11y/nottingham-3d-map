import { Vector3, Matrix4 } from 'three';
import { julianDay, sceneDirections } from './astronomy.js';
const DEG = Math.PI / 180;
export const SYNODIC_DAYS = 29.530588853;
const vector = v => new Vector3(v.x, v.y, v.z);

// IAU mean lunar pole and prime meridian, without periodic physical libration
// terms. Equatorial scene axes: X = vernal equinox, Y = north, Z = -RA 90°.
export function lunarFrame(date, latitude, longitude) {
  const d = julianDay(date) - 2451545;
  const ra = 269.9949 * DEG, dec = 66.5392 * DEG;
  const w = (38.3213 + 13.17635815 * d) * DEG;
  const pole = new Vector3(Math.cos(dec) * Math.cos(ra), Math.sin(dec), -Math.cos(dec) * Math.sin(ra));
  const node = new Vector3(-Math.sin(ra), 0, -Math.cos(ra));
  const meridian = node.clone().multiplyScalar(Math.cos(w)).addScaledVector(new Vector3().crossVectors(pole, node), Math.sin(w));
  const equatorEast = new Vector3().crossVectors(pole, meridian);
  const lat = latitude * DEG, lon = longitude * DEG;
  const up = meridian.clone().multiplyScalar(Math.cos(lat) * Math.cos(lon)).addScaledVector(equatorEast, Math.cos(lat) * Math.sin(lon)).addScaledVector(pole, Math.sin(lat));
  const east = meridian.clone().multiplyScalar(-Math.sin(lon)).addScaledVector(equatorEast, Math.cos(lon));
  const north = new Vector3().crossVectors(up, east);
  const worldToSky = new Matrix4().makeBasis(east, up, north.clone().negate()).transpose();
  return { up, east, north, worldToSky };
}

export function lunarSky(date, lat, lon) {
  const frame = lunarFrame(date, lat, lon), directions = sceneDirections(date);
  const moon = vector(directions.moonFromEarth).normalize().multiplyScalar(directions.moonDistanceEarthRadii);
  const observer = moon.clone().addScaledVector(frame.up, 1737.4 / 6378.137);
  const sunFromEarth = vector(directions.earthFromSun).negate().normalize();
  const earthDirection = observer.clone().negate().normalize();
  const sunDirection = sunFromEarth.clone().multiplyScalar(23455).sub(observer).normalize();
  function horizontal(direction) {
    const local = direction.clone().applyMatrix4(frame.worldToSky);
    return { altitude: Math.asin(Math.max(-1, Math.min(1, local.y))) / DEG, azimuth: (Math.atan2(local.x, -local.z) / DEG + 360) % 360, direction: local };
  }
  return {
    earth: horizontal(earthDirection), sun: horizontal(sunDirection),
    illumination: (1 + sunFromEarth.dot(observer.clone().normalize())) / 2,
    earthOrientation: frame.worldToSky.clone().multiply(new Matrix4().makeRotationY((directions.siderealSpin + 90) * DEG)),
    lightDirection: sunFromEarth.applyMatrix4(frame.worldToSky),
  };
}

// Sunrise/sunset refer to the centre crossing a level, airless horizon.
export function lunarDaylight(date, lat, lon) {
  const now = date.getTime(), step = 3 * 3600000;
  const altitude = t => lunarSky(new Date(t), lat, lon).sun.altitude;
  const events = [];
  let a = now - 36 * 86400000, ha = altitude(a);
  for (let b = a + step; b <= now + 36 * 86400000; b += step) {
    const hb = altitude(b);
    if ((ha >= 0) !== (hb >= 0)) {
      let left = a, right = b;
      for (let i = 0; i < 25; i++) { const mid = (left + right) / 2; if ((altitude(mid) >= 0) === (ha >= 0)) left = mid; else right = mid; }
      events.push({ time: (left + right) / 2, rising: hb > ha });
    }
    a = b; ha = hb;
  }
  const lit = altitude(now) >= 0;
  const rise = lit ? events.filter(e => e.rising && e.time <= now).at(-1) : events.find(e => e.rising && e.time > now);
  const set = rise && events.find(e => !e.rising && e.time > rise.time);
  return { lit, rise: rise?.time, set: set?.time, days: set && (set.time - rise.time) / 86400000 };
}

// One fixed synodic interval; playback cannot shift tomorrow's line each frame.
export function lunarTrackWindow(date) {
  const epoch = (2451550.1 - 2440587.5) * 86400000, span = SYNODIC_DAYS * 86400000;
  const start = epoch + Math.floor((date.getTime() - epoch) / span) * span;
  return { start, end: start + span };
}
