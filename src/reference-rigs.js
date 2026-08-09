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

  const PIG_ANCHORS = {
    root: {origin: [0, 0, 0]},
    body: {origin: [0, 12, 0]},
    head: {origin: [0, 12, -8]},
    left_front_leg: {origin: [3, 6, -5]},
    right_front_leg: {origin: [-3, 6, -5]},
    left_hind_leg: {origin: [3, 6, 5]},
    right_hind_leg: {origin: [-3, 6, 5]}
  };

  const PIG_GUIDES = {
    body: {from: [-5, 6, -8], to: [5, 14, 8], origin: [0, 12, 0], uv: [28, 8]},
    head: {from: [-4, 8, -14], to: [4, 16, -6], origin: [0, 12, -8], uv: [0, 0]},
    left_front_leg: {from: [1, 0, -7], to: [5, 6, -3], origin: [3, 6, -5], uv: [0, 16]},
    right_front_leg: {from: [-5, 0, -7], to: [-1, 6, -3], origin: [-3, 6, -5], uv: [0, 16]},
    left_hind_leg: {from: [1, 0, 3], to: [5, 6, 7], origin: [3, 6, 5], uv: [0, 16]},
    right_hind_leg: {from: [-5, 0, 3], to: [-1, 6, 7], origin: [-3, 6, 5], uv: [0, 16]}
  };

  const ELYTRA_ANCHORS = {
    root: {origin: [0, 0, 0]},
    body: {origin: [0, 24, 2]},
    left_wing: {origin: [2, 23, 2]},
    right_wing: {origin: [-2, 23, 2]}
  };

  const ELYTRA_GUIDES = {
    body: {from: [-4, 12, -2], to: [4, 24, 2], origin: [0, 24, 0], uv: [16, 16]},
    left_wing: {from: [0, 3, 2], to: [10, 23, 3], origin: [2, 23, 2], uv: [22, 0]},
    right_wing: {from: [-10, 3, 2], to: [0, 23, 3], origin: [-2, 23, 2], uv: [22, 0]}
  };

  const ARROW_ANCHORS = {root: {origin: [0, 0, 0]}, shaft: {origin: [0, 8, 0]}};
  const ARROW_GUIDES = {shaft: {from: [-0.5, 0, -0.5], to: [0.5, 16, 0.5], origin: [0, 8, 0], uv: [0, 0]}};
  const ARMOR_STAND_ANCHORS = {
    head: {origin: [0, 24, 0]},
    body: {origin: [0, 18, 0]},
    left_arm: {origin: [3, 24, 0]},
    right_arm: {origin: [-3, 24, 0]},
    left_leg: {origin: [1, 18, 0]},
    right_leg: {origin: [-1, 18, 0]}
  };
  const ARMOR_STAND_GUIDES = {
    head: {from: [-2, 24, -2], to: [2, 28, 2], origin: [0, 24, 0], uv: [0, 0]},
    body: {from: [-2, 18, -1], to: [2, 24, 1], origin: [0, 18, 0], uv: [16, 16]},
    left_arm: {from: [2, 18, -1], to: [4, 24, 1], origin: [3, 24, 0], uv: [32, 48]},
    right_arm: {from: [-4, 18, -1], to: [-2, 24, 1], origin: [-3, 24, 0], uv: [40, 16]},
    left_leg: {from: [0, 12, -1], to: [2, 18, 1], origin: [1, 18, 0], uv: [16, 48]},
    right_leg: {from: [-2, 12, -1], to: [0, 18, 1], origin: [-1, 18, 0], uv: [0, 16]}
  };
  const RIGS = {
    player: {anchors: PLAYER_ANCHORS, guides: PLAYER_GUIDES},
    pig: {anchors: PIG_ANCHORS, guides: PIG_GUIDES},
    elytra: {anchors: ELYTRA_ANCHORS, guides: ELYTRA_GUIDES},
    arrow: {anchors: ARROW_ANCHORS, guides: ARROW_GUIDES},
    armor_stand: {anchors: ARMOR_STAND_ANCHORS, guides: ARMOR_STAND_GUIDES}
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
    if (!RIGS[rig]) throw new Error(`unsupported reference rig: ${rig}`);
    return clone(RIGS[rig].anchors);
  }

  function guidesFor(rig = 'player') {
    if (!RIGS[rig]) throw new Error(`unsupported reference rig: ${rig}`);
    return clone(RIGS[rig].guides);
  }

  return {REFERENCE_PREFIX, REFERENCE_CUBE_PREFIX, PLAYER_ANCHORS: clone(PLAYER_ANCHORS), PLAYER_GUIDES: clone(PLAYER_GUIDES), RIGS: clone(RIGS), anchorsFor, guidesFor, isReferenceCube, isReferenceGroup};
}));
