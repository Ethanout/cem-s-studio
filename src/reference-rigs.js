(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CemSReferenceRigs = api;
}(typeof globalThis === 'undefined' ? this : globalThis, function () {
  const REFERENCE_PREFIX = 'CEM-S Reference';
  const REFERENCE_CUBE_PREFIX = '[CEM-S Reference]';

  // Coordinates follow the conventional Blockbench player pose: head above the
  // body, arms on X, and legs below it. Anchor groups are intentionally empty;
  // attached author geometry can be parented to them without exporting guides.
  const PLAYER_ANCHORS = {
    root: {origin: [0, 0, 0]},
    body: {origin: [0, 24, 0]},
    head: {origin: [0, 24, 0]},
    left_arm: {origin: [5, 22, 0]},
    right_arm: {origin: [-5, 22, 0]},
    left_leg: {origin: [1.9, 12, 0]},
    right_leg: {origin: [-1.9, 12, 0]}
  };

  const PLAYER_GUIDES = {
    body: {from: [-4, 12, -2], to: [4, 24, 2], origin: [0, 24, 0], uv: [16, 16]},
    head: {from: [-4, 24, -4], to: [4, 32, 4], origin: [0, 24, 0], uv: [0, 0]},
    left_arm: {from: [4, 12, -2], to: [8, 24, 2], origin: [5, 22, 0], uv: [32, 48]},
    right_arm: {from: [-8, 12, -2], to: [-4, 24, 2], origin: [-5, 22, 0], uv: [40, 16]},
    left_leg: {from: [0, 0, -2], to: [4, 12, 2], origin: [1.9, 12, 0], uv: [16, 48]},
    right_leg: {from: [-4, 0, -2], to: [0, 12, 2], origin: [-1.9, 12, 0], uv: [0, 16]}
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isReferenceCube(cube) {
    return typeof cube?.name === 'string' && cube.name.startsWith(REFERENCE_CUBE_PREFIX);
  }

  function isReferenceGroup(group) {
    return typeof group?.name === 'string' && group.name.startsWith(REFERENCE_PREFIX);
  }

  function anchorsFor(rig = 'player') {
    if (rig !== 'player') throw new Error(`unsupported reference rig: ${rig}`);
    return clone(PLAYER_ANCHORS);
  }

  function guidesFor(rig = 'player') {
    if (rig !== 'player') throw new Error(`unsupported reference rig: ${rig}`);
    return clone(PLAYER_GUIDES);
  }

  return {REFERENCE_PREFIX, REFERENCE_CUBE_PREFIX, PLAYER_ANCHORS: clone(PLAYER_ANCHORS), PLAYER_GUIDES: clone(PLAYER_GUIDES), anchorsFor, guidesFor, isReferenceCube, isReferenceGroup};
}));
