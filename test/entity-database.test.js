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
  assert.deepEqual(detectionFor('pig').branches[0].match, {mode: 'vertex_id', count: 42, index: 3});
});

test('models official armor stand UV branches only in verified versions', () => {
  const profile = profileFor('armor_stand', '1.21.6');
  assert.equal(profile.referenceRig, 'armor_stand');
  assert.equal(profile.detection.branches.length, 6);
  assert.deepEqual(profile.detection.branches.map(branch => branch.modelScale), [7, 7, 12, 12, 11, 11]);
  assert.deepEqual(profile.detection.branches[2].match, {mode: 'uv', cornerSet: 'corners2', cornerOffset: 2, scale: [2, 12], offset: [34, 18]});
  assert.equal(optionsFor('1.21.6').armor_stand, 'Armor Stand');
  assert.equal(optionsFor('1.21.11').armor_stand, undefined);
  assert.throws(() => profileFor('armor_stand', '26.1+'), /not verified/);
});
