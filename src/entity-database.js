(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CemSEntityDatabase = api;
}(typeof globalThis === 'undefined' ? this : globalThis, function () {
  const SUPPORTED_VERSIONS = ['1.21.6', '1.21.11', '26.1+'];
  const CUSTOM_DETECTION = {channel: 'entity', pixel: [63, 0], color: [0, 0, 1, 255], face: {mode: 'vertex_id', count: 1, index: 0}, reverse: false, corner: 'yx', size: 1, hideUnmatched: false};
  const PROFILES = {
    pig: {
      name: 'Pig', category: 'quadruped', targetType: 'entity', referenceRig: 'pig', textureSize: [64, 32],
      detection: {channel: 'entity', pixel: [63, 0], color: [255, 0, 0, 255], face: {mode: 'vertex_id', count: 42, index: 3}, reverse: true, corner: 'default', size: 1, hideUnmatched: false}
    },
    cold_pig: {
      name: 'Cold Pig', category: 'quadruped', targetType: 'entity', referenceRig: 'pig', textureSize: [64, 64],
      detection: {channel: 'entity', pixel: [63, 0], color: [3, 0, 0, 255], face: {mode: 'vertex_id', count: 84, index: 3}, reverse: true, corner: 'default', size: 1, hideUnmatched: false}
    },
    sheep: {
      name: 'Sheep', category: 'quadruped', targetType: 'entity', referenceRig: 'pig', textureSize: [64, 32],
      detection: {channel: 'entity', pixel: [63, 0], color: [2, 0, 0, 255], face: {mode: 'all', count: 1, index: 0}, reverse: false, corner: 'default', size: 1.2, hideUnmatched: false}
    },
    arrow: {
      name: 'Arrow', category: 'projectile', targetType: 'entity', referenceRig: 'arrow', textureSize: [32, 32],
      detection: {channel: 'entity', pixel: [31, 0], color: [0, 0, 1, 255], face: {mode: 'vertex_id', count: 9, index: 0}, reverse: true, corner: 'yx', size: 1.5, hideUnmatched: true}
    },
    elytra: {
      name: 'Elytra / Wings', category: 'equipment', targetType: 'armor', referenceRig: 'elytra', textureSize: [64, 32],
      detection: {channel: 'armor', pixel: [1, 0], color: [0, 0, 4, 255], face: {mode: 'vertex_id', count: 12, index: 5}, reverse: true, corner: 'default', size: 2, hideUnmatched: true}
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
    return {id, versions: SUPPORTED_VERSIONS.slice(), ...clone(profile)};
  }

  function profilesFor(version = '1.21.6') {
    assertVersion(version);
    return Object.keys(PROFILES).map(id => profileFor(id, version));
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
