const test = require('node:test');
const assert = require('node:assert/strict');
const {SUPPORTED_VERSIONS, profilesFor, profileFor, optionsFor, detectionFor} = require('../src/entity-database.js');

test('provides versioned entity profiles for every supported runtime', () => {
  for (const version of SUPPORTED_VERSIONS) {
    const profiles = profilesFor(version);
    assert.ok(profiles.some(profile => profile.id === 'pig'));
    assert.ok(profiles.some(profile => profile.id === 'elytra'));
    assert.deepEqual(profileFor('elytra', version).targetType, 'armor');
    assert.equal(optionsFor(version).pig, 'Pig');
  }
});

test('keeps expert-only profiles explicit instead of inventing detection values', () => {
  const player = profileFor('player');
  assert.equal(player.referenceRig, 'player');
  assert.equal(player.expertDetection, true);
  assert.deepEqual(detectionFor('pig').face, {mode: 'vertex_id', count: 42, index: 3});
});
