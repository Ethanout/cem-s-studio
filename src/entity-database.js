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
  function expertProfile(name, category, keywords, referenceRig = 'none', textureSize = [64, 64]) {
    return {
      name: `${name} (expert detection)`, category, keywords, targetType: 'entity', referenceRig,
      textureSize, expertDetection: true, detection: CUSTOM_DETECTION
    };
  }
  const PROFILES = {
    armor_stand: {
      name: 'Armor Stand', category: 'humanoid', keywords: ['armor stand', '盔甲架'], targetType: 'entity', referenceRig: 'armor_stand', textureSize: [64, 64], texturePath: 'assets/minecraft/textures/entity/armorstand/wood.png', versions: ['1.21.6'],
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
      name: 'Pig', category: 'quadruped', keywords: ['pig', '猪'], targetType: 'entity', referenceRig: 'pig', textureSize: [64, 32], textureSizeByVersion: {'1.21.11': [64, 64], '26.1+': [64, 64]}, texturePath: 'assets/minecraft/textures/entity/pig/temperate_pig.png',
      detection: singleDetection('entity', [63, 0], [255, 0, 0, 255], {mode: 'vertex_id', count: 42, index: 3}, {anchor: 'head', reverse: true})
    },
    cold_pig: {
      name: 'Cold Pig', category: 'quadruped', keywords: ['cold pig', '寒冷猪'], targetType: 'entity', referenceRig: 'pig', textureSize: [64, 64], texturePath: 'assets/minecraft/textures/entity/pig/cold_pig.png',
      detection: singleDetection('entity', [63, 0], [3, 0, 0, 255], {mode: 'vertex_id', count: 84, index: 3}, {anchor: 'head', reverse: true})
    },
    sheep: {
      name: 'Sheep', category: 'quadruped', keywords: ['sheep', '羊'], targetType: 'entity', referenceRig: 'pig', textureSize: [64, 32], texturePath: 'assets/minecraft/textures/entity/sheep/sheep.png',
      detection: singleDetection('entity', [63, 0], [2, 0, 0, 255], {mode: 'all'}, {anchor: 'body', size: 1.2})
    },
    arrow: {
      name: 'Arrow', category: 'projectile', keywords: ['arrow', '箭'], targetType: 'entity', referenceRig: 'arrow', textureSize: [32, 32], texturePath: 'assets/minecraft/textures/entity/projectiles/arrow.png',
      detection: singleDetection('entity', [31, 0], [0, 0, 1, 255], {mode: 'vertex_id', count: 9, index: 0}, {anchor: 'shaft', reverse: true, corner: 'yx', size: 1.5, hideUnmatched: true})
    },
    elytra: {
      name: 'Elytra / Wings', category: 'equipment', keywords: ['elytra', 'wings', '鞘翅'], targetType: 'armor', referenceRig: 'elytra', textureSize: [64, 32], texturePath: 'assets/minecraft/textures/entity/equipment/wings/elytra.png',
      detection: singleDetection('armor', [1, 0], [0, 0, 4, 255], {mode: 'vertex_id', count: 12, index: 5}, {anchor: 'body', reverse: true, size: 2, hideUnmatched: true})
    },
    player: {
      name: 'Player (custom detection)', category: 'humanoid', keywords: ['player', 'human', '玩家'], targetType: 'entity', referenceRig: 'player', textureSize: [64, 64], expertDetection: true,
      detection: CUSTOM_DETECTION
    },
    custom: {
      name: 'Custom entity', category: 'custom', keywords: ['custom', '自定义'], targetType: 'entity', referenceRig: 'none', textureSize: [64, 64], expertDetection: true,
      detection: CUSTOM_DETECTION
    },
    cow: expertProfile('Cow', 'quadruped', ['cow', '牛'], 'pig', [64, 32]),
    chicken: expertProfile('Chicken', 'quadruped', ['chicken', '鸡'], 'pig', [64, 32]),
    wolf: expertProfile('Wolf', 'quadruped', ['wolf', '狼'], 'pig', [64, 32]),
    cat: expertProfile('Cat', 'quadruped', ['cat', '猫'], 'pig', [64, 32]),
    horse: expertProfile('Horse', 'quadruped', ['horse', '马'], 'pig', [64, 32]),
    zombie: expertProfile('Zombie', 'humanoid', ['zombie', '僵尸'], 'player', [64, 64]),
    skeleton: expertProfile('Skeleton', 'humanoid', ['skeleton', '骷髅'], 'player', [64, 32]),
    villager: expertProfile('Villager', 'humanoid', ['villager', '村民'], 'player', [64, 64]),
    boat: expertProfile('Boat', 'vehicle', ['boat', '船'], 'none', [64, 32]),
    minecart: expertProfile('Minecart', 'vehicle', ['minecart', '矿车'], 'none', [64, 32]),
    snowball: expertProfile('Snowball', 'projectile', ['snowball', '雪球'], 'arrow', [16, 16]),
    fireball: expertProfile('Fireball', 'projectile', ['fireball', '火球'], 'arrow', [16, 16])
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
    const resolved = clone(profile);
    if (resolved.textureSizeByVersion && resolved.textureSizeByVersion[version]) {
      resolved.textureSize = resolved.textureSizeByVersion[version].slice();
    }
    return {id, ...resolved, versions: versions.slice()};
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

  function categoryOptionsFor(version = '1.21.6') {
    const labels = {humanoid: 'Humanoid / 人形', quadruped: 'Quadruped / 四足', projectile: 'Projectile / 投射物', equipment: 'Equipment / 装备', vehicle: 'Vehicle / 载具', custom: 'Custom / 自定义'};
    const categories = new Set(profilesFor(version).map(profile => profile.category || 'custom'));
    return Object.fromEntries([...categories].sort().map(category => [category, labels[category] || category]));
  }

  function searchProfiles(query = '', version = '1.21.6', category = 'all') {
    const normalized = String(query).trim().toLocaleLowerCase();
    return profilesFor(version)
      .filter(profile => category === 'all' || (profile.category || 'custom') === category)
      .filter(profile => !normalized || [profile.id, profile.name, ...(profile.keywords || [])].join(' ').toLocaleLowerCase().includes(normalized))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  return {
    SUPPORTED_VERSIONS: SUPPORTED_VERSIONS.slice(),
    ENTITY_PROFILES: clone(PROFILES),
    profileFor,
    profilesFor,
    detectionFor,
    optionsFor,
    categoryOptionsFor,
    searchProfiles
  };
}));
