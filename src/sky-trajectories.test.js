import test from 'node:test';
import assert from 'node:assert/strict';
import { horizontalPosition, moonPassAt, sampleTrack, splitVisibleTrack } from './sky-trajectories.js';

const lat = 52.95, lon = -1.15;
test('one Moon pass spans local midnight without replacing its rise/set endpoints', () => {
  const before = Date.parse('2026-10-26T23:59:00Z'), after = before + 120000;
  assert.ok(horizontalPosition('moon', before, lat, lon).altitude > 0);
  const a = moonPassAt(before, lat, lon), b = moonPassAt(after, lat, lon);
  assert.equal(a.start, b.start); assert.equal(a.end, b.end);
  assert.ok(a.start < before && a.end > after);
});

test('the next Moon pass starts only after the current Moon has set', () => {
  const pass = moonPassAt(Date.parse('2026-10-26T23:59:00Z'), lat, lon);
  const descending = moonPassAt(pass.end - 60000, lat, lon);
  assert.equal(descending.end, pass.end);
  assert.ok(horizontalPosition('moon', pass.end - 60000, lat, lon).altitude > 0);
  const next = moonPassAt(pass.end + 60000, lat, lon);
  assert.ok(horizontalPosition('moon', pass.end + 60000, lat, lon).altitude < 0);
  assert.ok(next.start > pass.end + 60000 && next.end > next.start);
  const rising = moonPassAt(next.start + 60000, lat, lon);
  assert.equal(rising.start, next.start); assert.equal(rising.end, next.end);
});

test('a future pass is not joined to the current below-horizon position', () => {
  const samples = [{ms:100,position:{altitude:0,azimuth:80}}, {ms:200,position:{altitude:40,azimuth:130}}, {ms:300,position:{altitude:0,azimuth:260}}];
  const split = splitVisibleTrack(samples, 0, {altitude:-40,azimuth:350});
  assert.equal(split.past.length, 0);
  assert.deepEqual(split.future[0], samples[0].position);
  assert.equal(split.future.length, 4);
});

test('past and future portions meet at the current Moon; polar searches stay bounded', () => {
  const now = Date.parse('2026-10-26T23:59:00Z');
  const pass = moonPassAt(now, lat, lon), current = horizontalPosition('moon', now, lat, lon);
  const split = splitVisibleTrack(sampleTrack('moon', pass.start, pass.end, lat, lon), now, current);
  assert.deepEqual(split.past.at(-1), current); assert.deepEqual(split.future[0], current);
  const polar = moonPassAt(now, 89, 0);
  assert.ok(polar.end > polar.start);
  assert.ok(sampleTrack('moon', polar.start, polar.end, 89, 0).length <= 2050);
});
