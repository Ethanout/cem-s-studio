const test = require('node:test');
const assert = require('node:assert/strict');
const {anchorsFor, guidesFor} = require('../src/reference-rigs');

test('lays out the player reference upright in Blockbench Y-up coordinates', () => {
  const anchors = anchorsFor('player');
  const guides = guidesFor('player');

  assert.equal(guides.left_leg.from[1], 0);
  assert.equal(guides.body.from[1], guides.left_leg.to[1]);
  assert.equal(guides.head.from[1], guides.body.to[1]);
  assert.equal(anchors.head.origin[1], guides.head.from[1]);
  assert.equal(anchors.left_arm.origin[1], 22);
  assert.deepEqual(guides.head.uv, [0, 0]);
  assert.deepEqual(guides.body.uv, [16, 16]);
});

test('provides a six-part armor stand binding rig', () => {
  const anchors = anchorsFor('armor_stand');
  const guides = guidesFor('armor_stand');
  assert.deepEqual(Object.keys(anchors), ['head', 'body', 'left_arm', 'right_arm', 'left_leg', 'right_leg']);
  assert.equal(Object.keys(guides).length, 6);
  assert.deepEqual(anchors.head.origin, [0, 24, 0]);
});
