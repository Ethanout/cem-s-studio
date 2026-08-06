const test = require('node:test');
const assert = require('node:assert/strict');
const { exportModel } = require('../src/cem-exporter.js');
const { toCemModel } = require('../src/blockbench-adapter.js');

test('emits a CEM-S ADD_BOX call for a cube', () => {
  const result = exportModel({name: 'demo', parts: [{name: 'body', type: 'cube', origin: [0, 0, 0], size: [2, 3, 4]}]}, 7);
  assert.match(result.glsl, /ADD_BOX\(vec3\(0\.0, 0\.0, 0\.0\), vec3\(2\.0, 3\.0, 4\.0\)/);
  assert.match(result.glsl, /case 7:/);
  assert.equal(result.manifest.model, 'demo');
});

test('uses supplied Blockbench face UV rectangles', () => {
  const result = exportModel({name: 'demo', parts: [{name: 'body', type: 'cube', origin: [0, 0, 0], size: [1, 1, 1], faces: [[1, 2, 3, 4], [5, 6, 7, 8]]}]});
  assert.match(result.glsl, /vec4\(1\.0, 2\.0, 3\.0, 4\.0\), vec4\(5\.0, 6\.0, 7\.0, 8\.0\)/);
});

test('emits rotated cubes with a rotation matrix and pivot', () => {
  const result = exportModel({name: 'demo', parts: [{name: 'ear', type: 'cube', origin: [1, 2, 3], size: [4, 1, 2], rotation: [0, 25, 0], pivot: [1, 2, 3]}]});
  assert.match(result.glsl, /ADD_BOX_ROTATE/);
  assert.match(result.glsl, /Rotate3\(radians\(25\.0\), Y\)/);
  assert.match(result.glsl, /vec3\(1\.0, 2\.0, 3\.0\)/);
});

test('produces byte-identical output for the same model', () => {
  const model = {name: 'demo', parts: [{name: 'b', type: 'cube', origin: [0, 0, 0], size: [1, 1, 1]}]};
  assert.equal(exportModel(model).glsl, exportModel(model).glsl);
});

test('rejects unsupported parts and malformed vectors', () => {
  assert.throws(() => exportModel({name: 'bad', parts: [{name: 'mesh', type: 'mesh'}]}), /unsupported part type/);
  assert.throws(() => exportModel({name: 'bad', parts: [{name: 'cube', type: 'cube', origin: [0], size: [1, 1, 1]}]}), /origin must be a vec3/);
});

test('converts a Blockbench cube to the exporter model', () => {
  const model = toCemModel('pig_ears', [{name: 'ear', from: [-2, 0, 1], to: [2, 3, 5], origin: [0, 1, 2], rotation: [0, 15, 0], faces: {down: {uv: [4, 5, 10, 13]}}}]);
  assert.deepEqual(model, {name: 'pig_ears', parts: [{name: 'ear', type: 'cube', origin: [0, 1.5, 3], size: [2, 1.5, 2], pivot: [0, -1, -2], rotation: [0, 15, 0], faces: [[4, 5, 6, 8], undefined, undefined, undefined, undefined, undefined]}]});
});

test('supports cubes inside rotated Blockbench groups', () => {
  const group = {name: 'head', rotation: [0, 30, 0], parent: null};
  const model = toCemModel('pig', [{from: [0, 0, 0], to: [1, 1, 1], parent: group}]);
  assert.equal(model.parts[0].rotationMatrix.length, 9);
});

test('rejects unsupported rotated or disabled Blockbench faces', () => {
  const cube = {from: [0, 0, 0], to: [1, 1, 1], faces: {down: {uv: [0, 0, 1, 1], rotation: 90}}};
  assert.throws(() => toCemModel('pig', [cube]), /rotated face "down"/);
  cube.faces.down = {uv: [0, 0, 1, 1], enabled: false};
  assert.throws(() => toCemModel('pig', [cube]), /disabled face "down"/);
});

test('converts multi-axis cube rotation to a rotation matrix', () => {
  const model = toCemModel('pig', [{from: [0, 0, 0], to: [1, 1, 1], origin: [0, 0, 0], rotation: [10, 20, 30]}]);
  assert.equal(model.parts[0].rotationMatrix.length, 9);
  assert.deepEqual(model.parts[0].pivot, [0, 0, 0]);
});

test('bakes a rotated parent group into the cube transform', () => {
  const group = {name: 'head', origin: [0, 0, 0], rotation: [0, 90, 0], parent: null};
  const model = toCemModel('pig', [{from: [1, 0, 0], to: [3, 2, 2], parent: group}]);
  assert.deepEqual(model.parts[0].origin, [2, 1, 1]);
  assert.equal(model.parts[0].rotationMatrix.length, 9);
  assert.match(exportModel(model).glsl, /ADD_BOX_ROTATE[\s\S]*mat3\(/);
});

test('rejects non-uniform parent scale', () => {
  const group = {name: 'head', origin: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 2, 1], parent: null};
  assert.throws(() => toCemModel('pig', [{from: [0, 0, 0], to: [1, 1, 1], parent: group}]), /non-uniform scale/);
});
