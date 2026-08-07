const test = require('node:test');
const assert = require('node:assert/strict');
const {createProject, serializeProject, parseProject} = require('../src/cemst.js');
const {buildPackFiles, mergePackFiles, upsertManagedSection} = require('../src/pack-builder.js');
const {loadRuntimeFiles} = require('../src/cem-runtime.js');

test('creates a versioned CEM-S Studio project with usable defaults', () => {
  const project = createProject({name: 'Pig Ears', modelId: 7, targetEntity: 'pig'});
  assert.equal(project.format, 'cemst');
  assert.equal(project.formatVersion, 1);
  assert.equal(project.project.modelId, 7);
  assert.deepEqual(project.project.detection.pixel, [63, 0]);
});

test('serializes and parses a CEM-S Studio project without losing Blockbench data', () => {
  const input = createProject({name: 'Demo', modelId: 2, blockbench: {meta: {model_format: 'cem_s_studio'}, outliner: []}});
  const output = parseProject(serializeProject(input));
  assert.deepEqual(output, input);
});

test('rejects unsupported project versions and invalid IDs', () => {
  assert.throws(() => parseProject(JSON.stringify({format: 'cemst', formatVersion: 99})), /unsupported cemst format version/);
  assert.throws(() => createProject({modelId: -1}), /modelId must be/);
});

test('builds a new resource pack with managed model and detection files', () => {
  const project = createProject({name: 'Pig Ears', modelId: 7, targetEntity: 'pig'});
  const files = buildPackFiles(project, 'case 7: { }', {runtimeFiles: {'assets/minecraft/shaders/core/entity.fsh': 'runtime'}});
  assert.equal(JSON.parse(files['pack.mcmeta']).pack.pack_format, 63);
  assert.equal(files['assets/minecraft/shaders/core/entity.fsh'], 'runtime');
  assert.match(files['assets/minecraft/shaders/include/cem_user/models.glsl'], /#moj_import <cem_user\/models\/entity\/pig_ears\.glsl>/);
  assert.match(files['assets/minecraft/shaders/include/cem_user/detection/entity/pig_ears.glsl'], /ivec2\(63, 0\)/);
  assert.match(files['assets/minecraft/shaders/include/cem_user/models/entity/pig_ears.glsl'], /case 7/);
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

test('loads the pinned CEM-S runtime files for a new pack', async () => {
  const fetched = [];
  const files = await loadRuntimeFiles(async (url) => {
    fetched.push(url);
    return {ok: true, text: async () => `runtime:${url}`};
  });
  assert.ok(Object.keys(files).some((file) => file.endsWith('/entity.fsh')));
  assert.match(files['THIRD-PARTY-LICENSES/CEM-S-MIT.txt'], /Copyright \(c\) 2024 DartCat25/);
  assert.equal(fetched.length, 5);
  assert.ok(fetched.every((url) => url.includes('/fb82f20698e8972f241574a9390413f385c8bddb/')));
  assert.ok(fetched.every((url) => !url.endsWith('/noise.glsl')));
});

test('uses the runtime bundled with the plugin without network access', async () => {
  globalThis.CemSBundledRuntime = {'assets/minecraft/shaders/core/entity.fsh': 'bundled runtime'};
  try {
    const files = await loadRuntimeFiles();
    assert.equal(files['assets/minecraft/shaders/core/entity.fsh'], 'bundled runtime');
    assert.match(files['THIRD-PARTY-LICENSES/CEM-S-MIT.txt'], /MIT License/);
  } finally {
    delete globalThis.CemSBundledRuntime;
  }
});
