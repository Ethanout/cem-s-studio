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
  assert.match(source, /Add Player Reference Model/);
  assert.match(source, /Import Vanilla Reference Model \(\.bbmodel\)/);
  assert.match(source, /Register Selected Group as Reference Model/);
  assert.match(source, /Bind Selected Group to Reference Anchor/);
  assert.match(source, /CEM-S Player Reference/);
  assert.match(source, /withoutReferenceGuides/);
  assert.match(source, /export: false/);
});

test('keeps the standalone CEM-S export action inside CEM-S Studio projects', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'plugin-entry.js'), 'utf8');
  assert.match(source, /export_cem_s_studio[\s\S]*condition: \(\) => Format === projectFormat && !!Project/);
});
