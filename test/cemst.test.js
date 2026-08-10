const test = require('node:test');
const assert = require('node:assert/strict');
const {SUPPORTED_CEM_VERSIONS, createProject, createWorkspace, serializeProject, parseProject, detectionForPreset} = require('../src/cemst.js');
const {buildPackFiles, buildWorkspacePackFiles, mergePackFiles, upsertManagedSection} = require('../src/pack-builder.js');
const {RUNTIME_PROFILES, loadRuntimeFiles, sourcesFor} = require('../src/cem-runtime.js');

test('creates a versioned CEM-S Studio project with usable defaults', () => {
  const project = createProject({name: 'Pig Ears', modelId: 7, targetEntity: 'pig'});
  assert.equal(project.format, 'cemst');
  assert.equal(project.formatVersion, 2);
  assert.equal(project.project.modelId, 7);
  assert.deepEqual(project.project.detection.pixel, [63, 0]);
  assert.equal(project.project.detection.preset, 'pig');
  assert.deepEqual(project.project.detection.branches[0].match, {mode: 'vertex_id', count: 42, index: 3});
  assert.equal(project.project.detection.branches[0].reverse, true);
  assert.equal(project.project.detection.branches[0].anchor, 'head');
});

test('persists an explicit target texture path for dynamic entities', () => {
  const project = createProject({name: 'Dynamic', targetEntity: 'player', texturePath: 'assets/minecraft/textures/entity/custom/player.png'});
  assert.equal(project.project.texturePath, 'assets/minecraft/textures/entity/custom/player.png');
  assert.equal(parseProject(serializeProject(project)).project.texturePath, 'assets/minecraft/textures/entity/custom/player.png');
  assert.throws(() => createProject({texturePath: 'textures/invalid.png'}), /project.texturePath/);
});

test('persists host and animated Sampler0 texture modes', () => {
  const host = createProject({name: 'Player Skin', targetEntity: 'player', textureSource: 'host_sampler0'});
  assert.equal(host.project.textureSource, 'host_sampler0');
  assert.equal(host.project.detection.mode, 'direct');
  assert.equal(host.project.detection.markerMode, 'none');
  assert.deepEqual(parseProject(serializeProject(host)).project.textureAnimation, {frameCount: 1, frameDurationTicks: 1});
  const animated = createProject({name: 'Animated Pig', targetEntity: 'pig', textureSource: 'animated_sampler0', texturePath: 'assets/minecraft/textures/entity/pig/animated.png', textureAnimation: {frameCount: 4, frameDurationTicks: 3}});
  const parsed = parseProject(serializeProject(animated));
  assert.equal(parsed.project.textureSource, 'animated_sampler0');
  assert.deepEqual(parsed.project.textureAnimation, {frameCount: 4, frameDurationTicks: 3});
  assert.throws(() => createProject({textureSource: 'animated_sampler0'}), /frameCount/);
});

test('supports multiple static texture targets for entity variants', () => {
  const project = createProject({
    name: 'Pig Variants', targetEntity: 'pig',
    texturePath: 'assets/minecraft/textures/entity/pig/temperate_pig.png',
    texturePaths: [
      'assets/minecraft/textures/entity/pig/custom_pig.png',
      'assets/minecraft/textures/entity/pig/custom_pig.png'
    ]
  });
  assert.deepEqual(project.project.texturePaths, [
    'assets/minecraft/textures/entity/pig/temperate_pig.png',
    'assets/minecraft/textures/entity/pig/custom_pig.png'
  ]);
  assert.equal(parseProject(serializeProject(project)).project.texturePath, project.project.texturePaths[0]);
  assert.throws(() => createProject({texturePaths: ['textures/not-an-asset.png']}), /texturePaths/);
});

test('allows a host entity to use a different reference skeleton', () => {
  const project = createProject({name: 'Player Reference Jetpack', targetEntity: 'elytra', targetType: 'armor', referenceRig: 'player', detection: {preset: 'elytra'}});
  assert.equal(project.project.targetEntity, 'elytra');
  assert.equal(project.project.targetType, 'armor');
  assert.equal(project.project.referenceRig, 'player');
  const parsed = parseProject(serializeProject(project));
  assert.equal(parsed.project.referenceRig, 'player');
});

test('serializes and parses a CEM-S Studio project without losing Blockbench data', () => {
  const input = createProject({name: 'Demo', modelId: 2, blockbench: {meta: {model_format: 'cem_s_studio'}, outliner: []}});
  const output = parseProject(serializeProject(input));
  assert.deepEqual(output, input);
});

test('creates and round-trips a multi-model cemst workspace', () => {
  const pig = createProject({name: 'Pig Jetpack', modelId: 7, targetEntity: 'pig'});
  const elytra = createProject({name: 'Elytra Jetpack', modelId: 8, targetEntity: 'elytra', targetType: 'armor', detection: {preset: 'elytra'}});
  const workspace = createWorkspace([pig, elytra], {modelIds: ['pig', 'elytra'], activeModel: 'elytra'});
  assert.equal(workspace.formatVersion, 3);
  assert.equal(workspace.workspace.activeModel, 'elytra');
  assert.deepEqual(workspace.workspace.models.map(model => model.id), ['pig', 'elytra']);
  assert.equal(workspace.project.modelId, 8);
  const parsed = parseProject(serializeProject(workspace));
  assert.equal(parsed.formatVersion, 3);
  assert.equal(parsed.project.targetEntity, 'elytra');
  assert.equal(parsed.workspace.models[0].project.targetEntity, 'pig');
});

test('rejects duplicate model IDs inside a cemst workspace', () => {
  const workspace = createWorkspace([
    createProject({name: 'One', modelId: 1}),
    createProject({name: 'Two', modelId: 2})
  ], {modelIds: ['one', 'two']});
  workspace.workspace.models[1].project.modelId = workspace.workspace.models[0].project.modelId;
  assert.throws(() => serializeProject(workspace), /duplicate workspace modelId/);
});

test('builds one resource pack from all workspace models and writes model manifests', () => {
  const workspace = createWorkspace([
    createProject({name: 'Pig Ears', modelId: 7, targetEntity: 'pig'}),
    createProject({name: 'Elytra Pack', modelId: 8, targetEntity: 'elytra', targetType: 'armor', detection: {preset: 'elytra'}})
  ], {modelIds: ['pig', 'elytra']});
  const files = buildWorkspacePackFiles(workspace, {pig: 'case 7: { }', elytra: 'case 8: { }'});
  assert.match(files['assets/minecraft/shaders/include/cem_user/models.glsl'], /CEM-S Studio BEGIN 7/);
  assert.match(files['assets/minecraft/shaders/include/cem_user/models.glsl'], /CEM-S Studio BEGIN 8/);
  assert.match(files['assets/minecraft/shaders/include/cem_user/detection.glsl'], /CEM-S Studio BEGIN 7/);
  assert.match(files['assets/minecraft/shaders/include/cem_user/detection.glsl'], /CEM-S Studio BEGIN 8/);
  assert.match(files['cem-studio/workspace.json'], /"activeModel"/);
  assert.match(files['cem-studio/models/pig.json'], /Pig Ears/);
  assert.match(files['cem-studio/models/elytra.json'], /Elytra Pack/);
});

test('rejects workspace models targeting different Minecraft runtimes', () => {
  const workspace = createWorkspace([
    createProject({name: 'Legacy', modelId: 1, cemVersion: '1.21.6'}),
    createProject({name: 'Modern', modelId: 2, cemVersion: '1.21.11'})
  ], {modelIds: ['legacy', 'modern']});
  assert.throws(() => buildWorkspacePackFiles(workspace, {legacy: 'case 1: {}', modern: 'case 2: {}'}), /same Minecraft runtime/);
});

test('selects pack formats for Minecraft 1.21.11 and 26.1+', () => {
  assert.equal(createProject({cemVersion: '1.21.11'}).project.resourcePack.packFormat, 75);
  assert.equal(createProject({cemVersion: '26.1+'}).project.resourcePack.packFormat, 84);
  assert.equal(SUPPORTED_CEM_VERSIONS['1.21.6'], 63);
  assert.throws(() => createProject({cemVersion: 'unsupported'}), /unsupported Minecraft runtime/);
  assert.throws(() => createProject({cemVersion: '1.21.11', targetEntity: 'armor_stand'}), /not verified/);
});

test('rejects unsupported project versions and invalid IDs', () => {
  assert.throws(() => parseProject(JSON.stringify({format: 'cemst', formatVersion: 99})), /unsupported cemst format version/);
  assert.throws(() => createProject({modelId: -1}), /modelId must be/);
});

test('migrates 0.2.0 cemst detection settings without losing project data', () => {
  const legacy = createProject({name: 'Legacy', modelId: 4});
  legacy.formatVersion = 1;
  legacy.project.detection = {mode: 'texture_marker', pixel: [31, 0], color: [0, 0, 1, 255]};
  const migrated = parseProject(JSON.stringify(legacy));
  assert.equal(migrated.project.detection.preset, 'custom');
  assert.deepEqual(migrated.project.detection.pixel, [31, 0]);
  assert.equal(migrated.formatVersion, 2);
  assert.deepEqual(migrated.project.detection.branches[0].match, {mode: 'vertex_id', count: 1, index: 0});
});

test('provides CEM-S detection presets for common entity models', () => {
  const arrow = detectionForPreset('arrow');
  assert.deepEqual(arrow.pixel, [31, 0]);
  assert.deepEqual(arrow.branches[0].match, {mode: 'vertex_id', count: 9, index: 0});
  assert.equal(arrow.branches[0].reverse, true);
  assert.equal(arrow.branches[0].corner, 'yx');
  assert.equal(arrow.hideUnmatched, true);
  const elytra = detectionForPreset('elytra');
  assert.equal(elytra.channel, 'armor');
  assert.deepEqual(elytra.pixel, [1, 0]);
  assert.deepEqual(elytra.branches[0].match, {mode: 'vertex_id', count: 12, index: 5});
});

test('stores original model visibility as a clear compatibility mode', () => {
  const keep = createProject({detection: {preset: 'pig', originalMode: 'keep'}});
  const hide = createProject({detection: {preset: 'pig', originalMode: 'hide_unmatched'}});
  const replace = createProject({detection: {preset: 'pig', matchedFaceMode: 'replace'}});
  assert.equal(keep.project.detection.originalMode, 'keep');
  assert.equal(keep.project.detection.hideUnmatched, false);
  assert.equal(keep.project.detection.matchedFaceMode, 'overlay');
  assert.equal(hide.project.detection.originalMode, 'hide_unmatched');
  assert.equal(hide.project.detection.hideUnmatched, true);
  assert.equal(replace.project.detection.matchedFaceMode, 'replace');
  assert.throws(() => createProject({detection: {preset: 'pig', originalMode: 'overlay'}}), /originalMode/);
  assert.throws(() => createProject({detection: {preset: 'pig', matchedFaceMode: 'invalid'}}), /matchedFaceMode/);
});

test('round-trips multi-part detection branches with UV matching', () => {
  const project = createProject({
    name: 'Multipart',
    modelId: 20,
    detection: {
      preset: 'custom',
      pixel: [63, 0],
      color: [0, 0, 240, 255],
      branches: [
        {id: 'head', anchor: 'head', modelIdOffset: 0, match: {mode: 'uv', cornerSet: 'corners', cornerOffset: 3, scale: [2, 7], offset: [2, 2]}, reverse: true, corner: 'default', size: 1},
        {id: 'left_arm', anchor: 'left_arm', modelIdOffset: 1, match: {mode: 'uv', cornerSet: 'corners2', cornerOffset: 2, scale: [2, 12], offset: [34, 18]}, reverse: false, corner: 'default', size: 1}
      ],
      hideUnmatched: true
    }
  });
  const parsed = parseProject(serializeProject(project));
  assert.deepEqual(parsed.project.detection.branches, project.project.detection.branches);
  const source = buildPackFiles(parsed, 'case 20: { }')['assets/minecraft/shaders/include/cem_user/detection/entity/multipart.glsl'];
  assert.match(source, /cem = 20;/);
  assert.match(source, /cem = 21;/);
  assert.match(source, /uv - corners\[\(gl_VertexID \+ 3\) % 4\] \* vec2\(2, 7\) == vec2\(2, 2\)/);
  assert.match(source, /else if \(uv - corners2\[\(gl_VertexID \+ 2\) % 4\] \* vec2\(2, 12\) == vec2\(34, 18\)\)/);
  assert.match(source, /gl_Position = vec4\(0\)/);
});

test('rejects ambiguous detection branch identifiers and model IDs', () => {
  const duplicate = createProject({name: 'Duplicate'});
  duplicate.project.detection.branches.push({...duplicate.project.detection.branches[0]});
  assert.throws(() => serializeProject(duplicate), /duplicate detection branch id/);
  duplicate.project.detection.branches[1].id = 'second';
  duplicate.project.detection.branches[1].anchor = 'second';
  assert.throws(() => serializeProject(duplicate), /duplicate detection modelIdOffset/);
});

test('round-trips a custom reference rig and attachment bindings', () => {
  const project = createProject({
    name: 'Jetpack',
    targetType: 'armor',
    targetEntity: 'elytra',
    detection: {preset: 'elytra'},
    reference: {rig: 'custom', root: 'root-uuid', anchors: {body: 'body-uuid'}, bindings: {'pack-uuid': 'body'}, transforms: {'pack-uuid': {position: [0, 2, 1], rotation: [0, 15, 0], scale: [1, 1, 1]}}, guides: ['body-cube-uuid']}
  });
  const parsed = parseProject(serializeProject(project));
  assert.equal(parsed.project.targetType, 'armor');
  assert.equal(parsed.project.reference.rig, 'custom');
  assert.deepEqual(parsed.project.reference.bindings, {'pack-uuid': 'body'});
  assert.deepEqual(parsed.project.reference.transforms['pack-uuid'], {position: [0, 2, 1], rotation: [0, 15, 0], scale: [1, 1, 1]});
  assert.deepEqual(parsed.project.reference.guides, ['body-cube-uuid']);
});

test('builds a new resource pack with managed model and detection files', () => {
  const project = createProject({name: 'Pig Ears', modelId: 7, targetEntity: 'pig'});
  const files = buildPackFiles(project, 'case 7: { }', {runtimeFiles: {'assets/minecraft/shaders/core/entity.fsh': 'runtime'}});
  assert.equal(JSON.parse(files['pack.mcmeta']).pack.pack_format, 63);
  assert.equal(JSON.parse(files['pack.mcmeta']).pack.min_format, undefined);
  assert.equal(files['assets/minecraft/shaders/core/entity.fsh'], 'runtime');
  assert.match(files['assets/minecraft/shaders/include/cem_user/models.glsl'], /#moj_import <cem_user\/models\/entity\/pig_ears\.glsl>/);
  assert.match(files['assets/minecraft/shaders/include/cem_user/detection/entity/pig_ears.glsl'], /ivec2\(63, 0\)/);
  assert.match(files['assets/minecraft/shaders/include/cem_user/detection/entity/pig_ears.glsl'], /gl_VertexID \/ 4 % 42 == 3/);
  assert.match(files['assets/minecraft/shaders/include/cem_user/detection/entity/pig_ears.glsl'], /cem_reverse = 1/);
  assert.match(files['assets/minecraft/shaders/include/cem_user/detection/entity/pig_ears.glsl'], /cem_keep_original = 1/);
  assert.match(files['assets/minecraft/shaders/include/cem_user/models/entity/pig_ears.glsl'], /case 7/);
});

test('builds direct detection without requiring a marker pixel', () => {
  const project = createProject({name: 'Player Skin', targetEntity: 'player', textureSource: 'host_sampler0'});
  const files = buildPackFiles(project, 'case 1: { }');
  const detection = files['assets/minecraft/shaders/include/cem_user/detection/entity/player_skin.glsl'];
  assert.match(detection, /if \(true\)/);
  assert.doesNotMatch(detection, /texelFetch\(Sampler0, ivec2\(63, 0\)/);
});

test('adds generated texture atlases as binary resource-pack files', () => {
  const project = createProject({name: 'Pig Details', targetEntity: 'pig'});
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const texturePath = 'assets/minecraft/textures/entity/pig/temperate_pig.png';
  const files = buildPackFiles(project, 'case 1: { }', {textureFile: {path: texturePath, content: png, baseSize: [64, 32]}});
  assert.equal(files[texturePath], png);
  assert.deepEqual([...files[texturePath]], [...png]);
  const detection = files['assets/minecraft/shaders/include/cem_user/detection/entity/pig_details.glsl'];
  assert.match(detection, /uv = floor\(UV0 \* vec2\(64, 32\)\)/);
  assert.match(detection, /texCoord0 = UV0 \* vec2\(64, 32\) \/ vec2\(textureSize\(Sampler0, 0\)\)/);
});

test('writes one generated atlas to all configured variant texture paths', () => {
  const project = createProject({name: 'Pig Variants', targetEntity: 'pig'});
  const png = new Uint8Array([137, 80, 78, 71]);
  const paths = [
    'assets/minecraft/textures/entity/pig/temperate_pig.png',
    'assets/minecraft/textures/entity/pig/custom_pig.png'
  ];
  const files = buildPackFiles(project, 'case 1: { }', {textureFile: {paths, content: png, baseSize: [64, 32]}});
  for (const path of paths) assert.deepEqual([...files[path]], [...png]);
  const mapping = JSON.parse(files['cem-studio/texture-mappings/pig_variants.json']);
  assert.deepEqual(mapping.paths, paths);
  assert.deepEqual(mapping.baseSize, [64, 32]);
});

test('records host and animated Sampler0 texture mappings without generating a fake atlas', () => {
  const host = createProject({name: 'Player Skin', targetEntity: 'player', textureSource: 'host_sampler0'});
  const hostFiles = buildPackFiles(host, 'case 1: { }', {textureSettings: {baseSize: [64, 64], paths: []}});
  assert.equal(hostFiles['cem-studio/texture-mappings/player_skin.json'] !== undefined, true);
  assert.equal(Object.keys(hostFiles).some(path => path.endsWith('.png')), false);
  const animated = createProject({name: 'Animated Pig', targetEntity: 'pig', textureSource: 'animated_sampler0', texturePath: 'assets/minecraft/textures/entity/pig/animated.png', textureAnimation: {frameCount: 4, frameDurationTicks: 2}});
  const animatedFiles = buildPackFiles(animated, 'case 1: { }', {textureSettings: {path: animated.project.texturePath, paths: [animated.project.texturePath], baseSize: [64, 64], animation: animated.project.textureAnimation}});
  const mapping = JSON.parse(animatedFiles['cem-studio/texture-mappings/animated_pig.json']);
  assert.equal(mapping.source, 'animated_sampler0');
  assert.deepEqual(mapping.animation, {frameCount: 4, frameDurationTicks: 2});
  assert.match(animatedFiles['assets/minecraft/shaders/include/cem_user/detection/entity/animated_pig.glsl'], /texCoord0 = UV0 \* vec2\(64, 64\)/);
});

test('declares the modern resource-pack format range for 1.21.11 and 26.1+', () => {
  for (const [cemVersion, expectedFormat] of [['1.21.11', 75], ['26.1+', 84]]) {
    const project = createProject({name: 'Modern', cemVersion});
    const pack = JSON.parse(buildPackFiles(project, 'case 1: { }')['pack.mcmeta']).pack;
    assert.equal(pack.pack_format, expectedFormat);
    assert.equal(pack.min_format, expectedFormat);
    assert.equal(pack.max_format, expectedFormat);
  }
});

test('builds armor-target paths and detection files', () => {
  const project = createProject({name: 'Jetpack', targetType: 'armor', targetEntity: 'elytra', detection: {preset: 'elytra'}});
  const files = buildPackFiles(project, 'case 1: { }');
  assert.match(files['assets/minecraft/shaders/include/cem_user/models.glsl'], /cem_user\/models\/armor\/jetpack\.glsl/);
  assert.match(files['assets/minecraft/shaders/include/cem_user/detection/armor/jetpack.glsl'], /ivec2\(1, 0\)/);
  assert.match(files['assets/minecraft/shaders/include/cem_user/detection/armor/jetpack.glsl'], /% 12 == 5/);
});

test('upserts managed sections without deleting user content', () => {
  const original = '// user header\n// CEM-S Studio BEGIN demo\nold\n// CEM-S Studio END demo\n// user footer';
  const updated = upsertManagedSection(original, 'demo', 'new');
  assert.equal(updated, '// user header\n// CEM-S Studio BEGIN demo\nnew\n// CEM-S Studio END demo\n// user footer');
});

test('updates an existing pack while preserving user aggregator content and pack metadata', () => {
  const project = createProject({name: 'Pig Ears', modelId: 7, targetEntity: 'pig'});
  const generated = buildPackFiles(project, 'case 7: { updated(); }');
  const existing = {
    'pack.mcmeta': '{"pack":{"pack_format":99,"description":"User pack"}}',
    'assets/minecraft/shaders/include/cem_user/models.glsl': '// user model header\n// CEM-S Studio BEGIN 7\n#moj_import <old/path.glsl>\n// CEM-S Studio END 7\n// user model footer',
    'assets/minecraft/shaders/include/cem_user/detection.glsl': '// user detection header\n// CEM-S Studio BEGIN 7\n#moj_import <old/detection.glsl>\n// CEM-S Studio END 7\n// user detection footer'
  };
  const merged = mergePackFiles(existing, generated, project);
  const models = merged['assets/minecraft/shaders/include/cem_user/models.glsl'];
  assert.equal(merged['pack.mcmeta'], existing['pack.mcmeta']);
  assert.match(models, /user model header/);
  assert.match(models, /#moj_import <cem_user\/models\/entity\/pig_ears\.glsl>/);
  assert.match(models, /user model footer/);
  assert.doesNotMatch(models, /old\/path/);
  assert.equal((models.match(/CEM-S Studio BEGIN 7/g) || []).length, 1);
  assert.match(merged['assets/minecraft/shaders/include/cem_user/models/entity/pig_ears.glsl'], /case 7: \{ updated\(\); \}/);
  assert.match(merged['assets/minecraft/shaders/include/cem_user/detection.glsl'], /user detection footer/);
  assert.equal(Object.keys(merged).filter((file) => file.endsWith('pig_ears.glsl')).length, 2);
});

test('defines version-specific CEM-S runtime profiles', () => {
  assert.deepEqual(Object.keys(RUNTIME_PROFILES), ['1.21.6', '1.21.11', '26.1+']);
  assert.equal(RUNTIME_PROFILES['1.21.11'].packFormat, 75);
  assert.equal(RUNTIME_PROFILES['26.1+'].gameVersion, '26.1.2');
  assert.match(sourcesFor('1.21.11')['assets/minecraft/shaders/core/entity.vsh'], /^1\.21\.11\//);
  assert.match(sourcesFor('26.1+')['assets/minecraft/shaders/core/entity.fsh'], /^26\.1\.2\//);
});

test('uses the runtime bundled with the plugin without network access', async () => {
  globalThis.CemSBundledRuntime = {
    '1.21.6': {'assets/minecraft/shaders/core/entity.fsh': 'legacy runtime'},
    '1.21.11': {'assets/minecraft/shaders/core/entity.fsh': 'bundled runtime'},
    '26.1+': {'assets/minecraft/shaders/core/entity.fsh': 'future runtime'}
  };
  try {
    const files = await loadRuntimeFiles('1.21.11');
    assert.equal(files['assets/minecraft/shaders/core/entity.fsh'], 'bundled runtime');
    assert.match(files['THIRD-PARTY-LICENSES/CEM-S-MIT.txt'], /MIT License/);
  } finally {
    delete globalThis.CemSBundledRuntime;
  }
});
