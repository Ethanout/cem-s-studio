(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CemSEntityDatabase = api;
}(typeof globalThis === 'undefined' ? this : globalThis, function () {
  const SUPPORTED_VERSIONS = ['1.21.6', '1.21.11', '26.1+'];
  function singleDetection(channel, pixel, color, match, options = {}) {
    return {
      channel, pixel, color,
      branches: [{
        id: 'main', anchor: options.anchor || null, modelIdOffset: 0, match,
        reverse: !!options.reverse, corner: options.corner || 'default', size: options.size || 1, modelScale: options.modelScale || 8
      }],
      hideUnmatched: !!options.hideUnmatched
    };
  }
  const CUSTOM_DETECTION = singleDetection('entity', [63, 0], [0, 0, 1, 255], {mode: 'vertex_id', count: 1, index: 0}, {corner: 'yx'});
  const PROFILES = {
    armor_stand: {
      name: 'Armor Stand', category: 'humanoid', targetType: 'entity', referenceRig: 'armor_stand', textureSize: [64, 64], versions: ['1.21.6'],
      detection: {
        channel: 'entity', pixel: [63, 0], color: [0, 0, 240, 255], hideUnmatched: true,
        branches: [
          {id: 'head', anchor: 'head', modelIdOffset: 0, match: {mode: 'uv', cornerSet: 'corners', cornerOffset: 3, scale: [2, 7], offset: [2, 2]}, reverse: true, corner: 'default', size: 1, modelScale: 7},
          {id: 'body', anchor: 'body', modelIdOffset: 1, match: {mode: 'uv', cornerSet: 'corners', cornerOffset: 3, scale: [2, 7], offset: [18, 2]}, reverse: true, corner: 'default', size: 1, modelScale: 7},
          {id: 'left_arm', anchor: 'left_arm', modelIdOffset: 2, match: {mode: 'uv', cornerSet: 'corners2', cornerOffset: 2, scale: [2, 12], offset: [34, 18]}, reverse: false, corner: 'default', size: 1, modelScale: 12},
          {id: 'right_arm', anchor: 'right_arm', modelIdOffset: 3, match: {mode: 'uv', cornerSet: 'corners', cornerOffset: 3, scale: [2, 12], offset: [26, 2]}, reverse: true, corner: 'default', size: 1, modelScale: 12},
          {id: 'left_leg', anchor: 'left_leg', modelIdOffset: 4, match: {mode: 'uv', cornerSet: 'corners2', cornerOffset: 2, scale: [2, 11], offset: [42, 18]}, reverse: false, corner: 'default', size: 1, modelScale: 11},
          {id: 'right_leg', anchor: 'right_leg', modelIdOffset: 5, match: {mode: 'uv', cornerSet: 'corners', cornerOffset: 3, scale: [2, 11], offset: [10, 2]}, reverse: true, corner: 'default', size: 1, modelScale: 11}
        ]
      }
    },
    pig: {
      name: 'Pig', category: 'quadruped', targetType: 'entity', referenceRig: 'pig', textureSize: [64, 32],
      detection: singleDetection('entity', [63, 0], [255, 0, 0, 255], {mode: 'vertex_id', count: 42, index: 3}, {anchor: 'head', reverse: true})
    },
    cold_pig: {
      name: 'Cold Pig', category: 'quadruped', targetType: 'entity', referenceRig: 'pig', textureSize: [64, 64],
      detection: singleDetection('entity', [63, 0], [3, 0, 0, 255], {mode: 'vertex_id', count: 84, index: 3}, {anchor: 'head', reverse: true})
    },
    sheep: {
      name: 'Sheep', category: 'quadruped', targetType: 'entity', referenceRig: 'pig', textureSize: [64, 32],
      detection: singleDetection('entity', [63, 0], [2, 0, 0, 255], {mode: 'all'}, {anchor: 'body', size: 1.2})
    },
    arrow: {
      name: 'Arrow', category: 'projectile', targetType: 'entity', referenceRig: 'arrow', textureSize: [32, 32],
      detection: singleDetection('entity', [31, 0], [0, 0, 1, 255], {mode: 'vertex_id', count: 9, index: 0}, {anchor: 'shaft', reverse: true, corner: 'yx', size: 1.5, hideUnmatched: true})
    },
    elytra: {
      name: 'Elytra / Wings', category: 'equipment', targetType: 'armor', referenceRig: 'elytra', textureSize: [64, 32],
      detection: singleDetection('armor', [1, 0], [0, 0, 4, 255], {mode: 'vertex_id', count: 12, index: 5}, {anchor: 'body', reverse: true, size: 2, hideUnmatched: true})
    },
    player: {
      name: 'Player (custom detection)', category: 'humanoid', targetType: 'entity', referenceRig: 'player', textureSize: [64, 64], expertDetection: true,
      detection: CUSTOM_DETECTION
    },
    custom: {
      name: 'Custom entity', category: 'custom', targetType: 'entity', referenceRig: 'none', textureSize: [64, 64], expertDetection: true,
      detection: CUSTOM_DETECTION
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function assertVersion(version) {
    if (!SUPPORTED_VERSIONS.includes(version)) throw new Error(`unsupported entity database version: ${version}`);
  }

  function profileFor(id, version = '1.21.6') {
    assertVersion(version);
    const profile = PROFILES[id];
    if (!profile) throw new Error(`unsupported entity profile: ${id}`);
    const versions = profile.versions || SUPPORTED_VERSIONS;
    if (!versions.includes(version)) throw new Error(`entity profile ${id} is not verified for ${version}`);
    return {id, ...clone(profile), versions: versions.slice()};
  }

  function profilesFor(version = '1.21.6') {
    assertVersion(version);
    return Object.keys(PROFILES).filter(id => (PROFILES[id].versions || SUPPORTED_VERSIONS).includes(version)).map(id => profileFor(id, version));
  }

  function detectionFor(id, version = '1.21.6') {
    const profile = profileFor(id, version);
    return {preset: id, ...clone(profile.detection)};
  }

  function optionsFor(version = '1.21.6') {
    return Object.fromEntries(profilesFor(version).map(profile => [profile.id, profile.name]));
  }

  return {
    SUPPORTED_VERSIONS: SUPPORTED_VERSIONS.slice(),
    ENTITY_PROFILES: clone(PROFILES),
    profileFor,
    profilesFor,
    detectionFor,
    optionsFor
  };
}));
