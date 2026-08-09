const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('uses a Blockbench dialog instead of the unsupported browser prompt', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'plugin-entry.js'), 'utf8');
  assert.doesNotMatch(source, /\.prompt\s*\(/);
  assert.match(source, /new Dialog\s*\(/);
});

test('registers the CEM-S Studio project format and resource-pack workflow', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'plugin-entry.js'), 'utf8');
  assert.match(source, /new ModelFormat\(['"]cem_s_studio/);
  assert.match(source, /new Codec\(['"]cemst/);
  assert.match(source, /Build CEM-S Resource Pack/);
  assert.match(source, /Add Entity Reference Model/);
  assert.match(source, /profile\.referenceRig/);
  assert.match(source, /Import Vanilla Reference Model \(\.bbmodel\)/);
  assert.match(source, /Register Selected Group as Reference Model/);
  assert.match(source, /Bind Selected Group to Reference Anchor/);
  assert.match(source, /addReferenceRig/);
  assert.match(source, /entity_profile/);
  assert.match(source, /optionsFor/);
  assert.match(source, /withoutReferenceGuides/);
  assert.match(source, /export: false/);
  assert.match(source, /meshes: true/);
  assert.match(source, /globalThis\.Mesh\?\.all/);
  assert.match(source, /new Panel\(['"]cem_s_studio_panel/);
  assert.match(source, /data-cem-state="entity"/);
  assert.match(source, /data-cem-state="textures"/);
  assert.match(source, /studioTextureState/);
  assert.match(source, /缺少基础纹理/);
  assert.match(source, /data-cem-action="reference"/);
  assert.match(source, /data-cem-action="render"/);
  assert.match(source, /data-cem-action="reset-anchor"/);
  assert.match(source, /Reset Attachment to Anchor/);
  assert.match(source, /cem_emissive/);
  assert.match(source, /cem_per_face_lighting/);
  assert.match(source, /cem_tint/);
  assert.match(source, /data-cem-entity="search"/);
  assert.match(source, /data-cem-entity="category"/);
  assert.match(source, /searchProfiles/);
  assert.match(source, /reference\.transforms/);
  assert.match(source, /偏移快照/);
  assert.match(source, /detectionForPreset\(presetName, version\)/);
  assert.match(source, /texture_path/);
  assert.match(source, /Target texture path/);
});

test('keeps the standalone CEM-S export action inside CEM-S Studio projects', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'plugin-entry.js'), 'utf8');
  assert.match(source, /export_cem_s_studio[\s\S]*condition: \(\) => Format === projectFormat && !!Project/);
});
