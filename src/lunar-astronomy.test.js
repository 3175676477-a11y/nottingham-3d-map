import test from 'node:test';
import assert from 'node:assert/strict';
import { lunarSky, lunarDaylight, lunarFrame } from './lunar-astronomy.js';
test('near-side Earth stays overhead over a month; far side never sees Earth', () => {
  for (let day = 1; day <= 30; day++) {
    const date = new Date(Date.UTC(2026, 9, day));
    assert.ok(lunarSky(date, 0, 0).earth.altitude > 75);
    assert.ok(lunarSky(date, 0, 180).earth.altitude < -75);
    const f = lunarFrame(date, 30, 40);
    assert.ok(Math.abs(f.east.dot(f.up)) < 1e-12);
    assert.ok(Math.abs(f.worldToSky.determinant() - 1) < 1e-12);
  }
});
test('lunar daylight is around half a synodic month, crossing events bracket the light', () => {
  const result = lunarDaylight(new Date('2026-10-11T12:00:00Z'), 0, 0);
  assert.ok(result.days > 13 && result.days < 16);
  assert.ok(lunarSky(new Date(result.rise - 60000), 0, 0).sun.altitude < 0);
  assert.ok(lunarSky(new Date(result.rise + 60000), 0, 0).sun.altitude > 0);
  assert.ok(lunarSky(new Date(result.set + 60000), 0, 0).sun.altitude < 0);
});
test('Earth phase changes and continents rotate during a terrestrial day', () => {
  const a = lunarSky(new Date('2026-10-11T00:00:00Z'), 0, 0);
  const b = lunarSky(new Date('2026-10-11T06:00:00Z'), 0, 0);
  const c = lunarSky(new Date('2026-10-26T00:00:00Z'), 0, 0);
  assert.ok(a.illumination > .9);
  assert.ok(c.illumination < .1);
  assert.notDeepEqual(a.earthOrientation.elements, b.earthOrientation.elements);
  assert.ok(Math.abs(a.earth.altitude - b.earth.altitude) < 4);
});
