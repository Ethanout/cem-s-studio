const test = require('node:test');
const assert = require('node:assert/strict');
const {SUPPORTED_VERSIONS, profilesFor, profileFor, optionsFor, categoryOptionsFor, searchProfiles, detectionFor} = require('../src/entity-database.js');

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

test('searches versioned entity profiles by name, id, keyword, and category', () => {
  assert.deepEqual(searchProfiles('猪', '1.21.6').map(profile => profile.id), ['cold_pig', 'pig']);
  assert.deepEqual(searchProfiles('elytra', '1.21.11').map(profile => profile.id), ['elytra']);
  assert.deepEqual(searchProfiles('', '1.21.6', 'projectile').map(profile => profile.id), ['arrow', 'fireball', 'snowball']);
  assert.equal(searchProfiles('armor', '1.21.11').length, 0);
  assert.equal(categoryOptionsFor('1.21.6').quadruped, 'Quadruped / 四足');
});

test('lists common expert entity profiles without claiming verified detection rules', () => {
  for (const id of ['cow', 'chicken', 'wolf', 'zombie', 'skeleton', 'villager', 'boat', 'minecart', 'snowball']) {
    const profile = profileFor(id, '1.21.11');
    assert.equal(profile.expertDetection, true);
    assert.match(profile.name, /expert detection/);
  }
  assert.equal(categoryOptionsFor('1.21.6').vehicle, 'Vehicle / 载具');
  assert.ok(searchProfiles('村民', '1.21.6').some(profile => profile.id === 'villager'));
});
