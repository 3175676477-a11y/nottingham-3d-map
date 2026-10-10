import { localPosition, moonCoordinates, sunCoordinates } from './astronomy.js';

const MINUTE = 60000;
const SEARCH_STEP = 20 * MINUTE;
const SEARCH_LIMIT = 35 * 24 * 60 * MINUTE;

export function horizontalPosition(body, ms, latitude, longitude) {
  const date = new Date(ms);
  const equatorial = body === 'moon' ? moonCoordinates(date) : sunCoordinates(date);
  return localPosition(equatorial.ra, equatorial.dec, date, latitude, longitude);
}

function crossing(from, direction, rising, latitude, longitude) {
  const altitude = ms => horizontalPosition('moon', ms, latitude, longitude).altitude;
  let a = from, ha = altitude(a);
  for (let elapsed = SEARCH_STEP; elapsed <= SEARCH_LIMIT; elapsed += SEARCH_STEP) {
    const b = from + direction * elapsed, hb = altitude(b);
    const leftHeight = direction > 0 ? ha : hb, rightHeight = direction > 0 ? hb : ha;
    if (rising ? leftHeight <= 0 && rightHeight > 0 : leftHeight >= 0 && rightHeight < 0) {
      let lo = Math.min(a, b), hi = Math.max(a, b);
      for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2;
        if ((altitude(mid) > 0) === rising) hi = mid; else lo = mid;
      }
      return Math.round((lo + hi) / 2);
    }
    a = b; ha = hb;
  }
  return null;
}

// A pass belongs to one moonrise/moonset pair, not to a calendar date.
// While below the horizon, show the next pass. Midnight never ends a pass.
export function moonPassAt(now, latitude, longitude) {
  const above = horizontalPosition('moon', now, latitude, longitude).altitude >= 0;
  const start = crossing(now, above ? -1 : 1, true, latitude, longitude);
  const end = crossing(above ? now : (start ?? now) + 1000, 1, false, latitude, longitude);
  // Bound work even for polar observations without an event in the search range.
  const fallbackStart = Math.floor(now / 86400000) * 86400000;
  return { start: start ?? fallbackStart, end: end ?? fallbackStart + 86400000, validFrom: now, bounded: start !== null && end !== null };
}

export function sampleTrack(body, start, end, latitude, longitude) {
  const step = Math.max(2 * MINUTE, Math.ceil((end - start) / 2048));
  const sample = ms => ({ ms, position: horizontalPosition(body, ms, latitude, longitude) });
  const samples = [sample(start)];
  for (let ms = Math.ceil((start + 1) / step) * step; ms < end; ms += step) samples.push(sample(ms));
  samples.push(sample(end));
  return samples;
}

function interpolate(a, b, fraction) {
  const delta = ((b.azimuth - a.azimuth + 540) % 360) - 180;
  return { azimuth: (a.azimuth + delta * fraction + 360) % 360, altitude: a.altitude + (b.altitude - a.altitude) * fraction };
}

export function splitVisibleTrack(samples, now, currentPosition) {
  const split = { past: [], future: [] };
  if (samples.length < 2) return split;
  const points = samples.slice();
  // Never join the current, below-horizon Moon to tomorrow's track.
  if (now > points[0].ms && now < points.at(-1).ms && !points.some(p => p.ms === now)) {
    const index = points.findIndex(p => p.ms > now);
    points.splice(index, 0, { ms: now, position: currentPosition });
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], pa = a.position, pb = b.position;
    if (pa.altitude < 0 && pb.altitude < 0) continue;
    let start = pa, end = pb;
    if (pa.altitude < 0) start = { ...interpolate(pa, pb, -pa.altitude / (pb.altitude - pa.altitude)), altitude: 0 };
    if (pb.altitude < 0) end = { ...interpolate(pa, pb, -pa.altitude / (pb.altitude - pa.altitude)), altitude: 0 };
    split[b.ms <= now ? 'past' : 'future'].push(start, end);
  }
  return split;
}
