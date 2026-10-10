import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { daylight, sceneDirections, skyState } from './astronomy.js';

const location = { latitude: 52.95, longitude: -1.15, zone: 'Europe/London' };

test('daylight returns ordered local sunrise and sunset and longer summer days', () => {
  const summer = daylight(new Date('2026-06-21T12:00:00Z'), location.latitude, location.longitude, location.zone, DateTime);
  const winter = daylight(new Date('2026-12-21T12:00:00Z'), location.latitude, location.longitude, location.zone, DateTime);
  assert.equal(summer.state, '日出至日落');
  assert.ok(summer.sunrise.isValid && summer.sunset.isValid);
  assert.ok(summer.sunrise < summer.sunset);
  assert.ok(summer.minutes > winter.minutes);
  assert.equal(summer.sunrise.zoneName, location.zone);
});

test('sky state produces finite, bounded positions, illumination, and phase', () => {
  const sky = skyState(new Date('2026-10-10T20:00:00Z'), location.latitude, location.longitude);
  for (const body of [sky.sun, sky.moon]) {
    assert.ok(Number.isFinite(body.altitude) && body.altitude >= -90 && body.altitude <= 90);
    assert.ok(Number.isFinite(body.azimuth) && body.azimuth >= 0 && body.azimuth < 360);
  }
  assert.ok(sky.illumination >= 0 && sky.illumination <= 1);
  assert.ok(sky.ageDays >= 0 && sky.ageDays < 29.531);
  assert.ok(typeof sky.phase === 'string' && sky.phase.length > 0);
});

test('scene directions are finite and preserve the Earth and Moon orbital vectors', () => {
  const directions = sceneDirections(new Date('2026-10-10T20:00:00Z'));
  for (const vector of [directions.earthFromSun, directions.moonFromEarth, directions.moonOrbitNormal]) {
    assert.ok(Object.values(vector).every(Number.isFinite));
    const length = Math.hypot(vector.x, vector.y, vector.z);
    assert.ok(length > 0);
    if (vector !== directions.moonFromEarth) assert.ok(Math.abs(length - 1) < 1e-9);
    else assert.ok(Math.abs(length * 60.2666 - directions.moonDistanceEarthRadii) < 1e-6);
  }
  assert.ok(directions.moonDistanceEarthRadii > 50 && directions.moonDistanceEarthRadii < 70);
});
