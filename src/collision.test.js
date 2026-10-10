import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canOccupy,movePlayer} from './collision.js';
const buildings=[{x:0,z:0,w:10,d:10}];
test('building footprint and player clearance block entry',()=>{assert.equal(canOccupy(0,0,buildings),false);assert.equal(canOccupy(5.5,0,buildings),false);assert.equal(canOccupy(6,0,buildings),true);});
test('large movement cannot tunnel through a building',()=>{const p={x:-12,z:0};movePlayer(p,24,0,buildings);assert.ok(p.x<=-5.7);});
test('movement slides along walls and respects campus boundary',()=>{const p={x:-6,z:0};movePlayer(p,2,3,buildings);assert.ok(p.x<=-5.7);assert.ok(Math.abs(p.z-3)<1e-9);assert.equal(canOccupy(116,0,[]),false);});
