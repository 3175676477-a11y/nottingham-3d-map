import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
import { createGlobeTexture } from './globe-texture.js';

test('globe longitude samples wrap across the shifted image edge instead of stretching one column', () => {
  const texture = createGlobeTexture({ width: 2048, height: 1024 });
  texture.updateMatrix();
  for (const [u, expected] of [[.5, .75], [.76, .01], [.85, .10], [.95, .20]]) {
    const uv = texture.transformUv(new Vector2(u, .5));
    assert.ok(Math.abs(uv.x - expected) < 1e-10, `U=${u}: expected ${expected}, got ${uv.x}`);
  }
  texture.dispose();
});

test('globe latitude clamps at the poles without repeating the opposite hemisphere', () => {
  const texture = createGlobeTexture({ width: 2048, height: 1024 });
  texture.updateMatrix();
  assert.equal(texture.transformUv(new Vector2(.5, -0.1)).y, 1);
  assert.equal(texture.transformUv(new Vector2(.5, 1.1)).y, 0);
  texture.dispose();
});
