const test = require('node:test');
const assert = require('node:assert/strict');
const { exportModel, exportModels } = require('../src/cem-exporter.js');
const { toCemModel, toCemModels } = require('../src/blockbench-adapter.js');

test('emits a CEM-S ADD_BOX call for a cube', () => {
  const result = exportModel({name: 'demo', parts: [{name: 'body', type: 'cube', origin: [0, 0, 0], size: [2, 3, 4]}]}, 7);
  assert.match(result.glsl, /ADD_BOX\(vec3\(0\.0, 0\.0, 0\.0\), vec3\(2\.0, 3\.0, 4\.0\)/);
  assert.match(result.glsl, /case 7:/);
  assert.equal(result.manifest.model, 'demo');
  assert.equal(result.manifest.target, 'cem-s/1.21.6');
});

test('records the selected Minecraft runtime in the export manifest', () => {
  const model = {name: 'modern', parts: []};
  assert.equal(exportModel(model, 1, '1.21.11').manifest.target, 'cem-s/1.21.11');
  assert.equal(exportModel(model, 1, '26.1+').manifest.target, 'cem-s/26.1+');
  assert.throws(() => exportModel(model, 1, '1.22'), /unsupported Minecraft runtime/);
});

test('uses supplied Blockbench face UV rectangles', () => {
  const result = exportModel({name: 'demo', parts: [{name: 'body', type: 'cube', origin: [0, 0, 0], size: [1, 1, 1], faces: [[1, 2, 3, 4], [5, 6, 7, 8]]}]});
  assert.match(result.glsl, /vec4\(1\.0, 2\.0, 3\.0, 4\.0\), vec4\(5\.0, 6\.0, 7\.0, 8\.0\)/);
});

test('exports per-cube render properties and combines them with rotated UVs', () => {
  const model = {name: 'rendered', parts: [{
    name: 'glow', type: 'cube', origin: [0, 0, 0], size: [1, 1, 1],
    faceRotations: [1, 0, 0, 0, 0, 0],
    render: {emissive: true, perFaceLighting: false, tint: [0.5, 1, 0.25, 1]}
  }]};
  const glsl = exportModel(model).glsl;
  assert.match(glsl, /ADD_BOX_RENDER_UV/);
  assert.match(glsl, /true, false, vec4\(0\.5, 1\.0, 0\.3, 1\.0\)/);
  assert.throws(() => exportModel({name: 'bad', parts: [{type: 'cube', origin: [0, 0, 0], size: [1, 1, 1], render: {emissive: true, perFaceLighting: true, tint: [2, 0, 0, 1]}}]}), /render\.tint/);
});

test('converts rectangular Blockbench mesh faces to ADD_SQUARE', () => {
  const mesh = {
    name: 'cape',
    vertices: {a: [0, 0, 0], b: [4, 0, 0], c: [0, 6, 0], d: [4, 6, 0]},
    faces: {front: {vertices: ['d', 'b', 'a', 'c'], uv: {a: [8, 16], b: [12, 16], c: [8, 22], d: [12, 22]}}}
  };
  const model = toCemModel('cape', [mesh]);
  assert.deepEqual(model.parts[0], {
    name: 'cape/front', type: 'square',
    points: [[0, 0, 0], [4, 0, 0], [0, 6, 0]],
    uv: [8, 16, 4, 6]
  });
  assert.match(exportModel(model).glsl, /ADD_SQUARE\(vec3\(0\.0, 0\.0, 0\.0\), vec3\(4\.0, 0\.0, 0\.0\), vec3\(0\.0, 6\.0, 0\.0\), vec4\(8\.0, 16\.0, 4\.0, 6\.0\)\)/);
});

test('preserves rectangular UV rotation through mesh vertex mapping', () => {
  const mesh = {
    name: 'rotated_uv',
    vertices: {a: [0, 0, 0], b: [2, 0, 0], c: [0, 3, 0], d: [2, 3, 0]},
    faces: {front: {vertices: ['a', 'b', 'd', 'c'], uv: {a: [4, 8], b: [4, 10], c: [7, 8], d: [7, 10]}}}
  };
  const square = toCemModel('rotated', [mesh]).parts[0];
  assert.deepEqual(square.points, [[0, 0, 0], [0, 3, 0], [2, 0, 0]]);
  assert.deepEqual(square.uv, [4, 8, 3, 2]);
});

test('rejects mesh faces that ADD_SQUARE cannot represent', () => {
  const triangle = {name: 'triangle', vertices: {a: [0, 0, 0], b: [1, 0, 0], c: [0, 1, 0]}, faces: {front: {vertices: ['a', 'b', 'c'], uv: {a: [0, 0], b: [1, 0], c: [0, 1]}}}};
  assert.throws(() => toCemModel('triangle', [triangle]), /must have four vertices/);
  const warped = {
    name: 'warped',
    vertices: {a: [0, 0, 0], b: [2, 0, 0], c: [0, 2, 0], d: [3, 2, 0]},
    faces: {front: {vertices: ['a', 'b', 'd', 'c'], uv: {a: [0, 0], b: [2, 0], c: [0, 2], d: [2, 2]}}}
  };
  assert.throws(() => toCemModel('warped', [warped]), /must be a parallelogram/);
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

test('converts Blockbench CEM-S render properties without affecting default cubes', () => {
  const plain = toCemModel('plain', [{from: [0, 0, 0], to: [1, 1, 1]}]);
  assert.equal(plain.parts[0].render, undefined);
  const rendered = toCemModel('rendered', [{from: [0, 0, 0], to: [1, 1, 1], cem_emissive: true, cem_per_face_lighting: false, cem_tint: '#80ff4080'}]);
  assert.deepEqual(rendered.parts[0].render, {emissive: true, perFaceLighting: false, tint: [128 / 255, 1, 64 / 255, 128 / 255]});
});

test('inherits Group render properties while allowing Cube overrides', () => {
  const group = {name: 'Glow group', cem_s_render: {emissive: true, perFaceLighting: false, tint: '#80ff4080'}, parent: null};
  const inherited = toCemModel('inherited', [{from: [0, 0, 0], to: [1, 1, 1], parent: group}]);
  assert.deepEqual(inherited.parts[0].render, {emissive: true, perFaceLighting: false, tint: [128 / 255, 1, 64 / 255, 128 / 255]});
  const override = toCemModel('override', [{from: [0, 0, 0], to: [1, 1, 1], parent: group, cem_s_render: {emissive: false, perFaceLighting: true, tint: '#ffffffff'}}]);
  assert.equal(override.parts[0].render, undefined);
});

test('does not export registered reference guide cubes', () => {
  const model = toCemModel('pig', [
    {name: '[CEM-S Reference] body', uuid: 'guide-1', from: [0, 0, 0], to: [4, 4, 4]},
    {name: 'jetpack', uuid: 'part-1', from: [0, 0, 0], to: [1, 1, 1]}
  ], {reference: {guides: ['guide-1']}});
  assert.deepEqual(model.parts.map(part => part.name), ['jetpack']);
});

test('converts bound cubes into reference-anchor local coordinates', () => {
  const anchor = {name: 'head anchor', uuid: 'anchor-head', origin: [0, 24, 0], parent: null};
  const attachment = {name: 'hat', uuid: 'attachment', origin: [0, 24, 0], parent: anchor};
  const cube = {name: 'brim', uuid: 'brim', from: [-4, 24, -4], to: [4, 26, 4], origin: [0, 24, 0], parent: attachment};
  const reference = {anchors: {head: 'anchor-head'}, bindings: {attachment: 'head'}, guides: []};
  const model = toCemModel('hat', [cube], {reference});
  assert.deepEqual(model.parts[0].origin, [0, 1, 0]);
  assert.deepEqual(model.parts[0].pivot, [0, 0, 0]);
});

test('splits bound cubes into detection branch models', () => {
  const headAnchor = {uuid: 'head-anchor', origin: [0, 24, 0], parent: null};
  const bodyAnchor = {uuid: 'body-anchor', origin: [0, 18, 0], parent: null};
  const headGroup = {uuid: 'hat', parent: headAnchor};
  const bodyGroup = {uuid: 'pack', parent: bodyAnchor};
  const cubes = [
    {name: 'hat cube', from: [-1, 24, -1], to: [1, 26, 1], parent: headGroup},
    {name: 'pack cube', from: [-2, 16, 1], to: [2, 20, 3], parent: bodyGroup}
  ];
  const branches = [
    {id: 'head', anchor: 'head', modelIdOffset: 0, modelScale: 7},
    {id: 'body', anchor: 'body', modelIdOffset: 1, modelScale: 12}
  ];
  const reference = {anchors: {head: 'head-anchor', body: 'body-anchor'}, bindings: {hat: 'head', pack: 'body'}, guides: []};
  const entries = toCemModels('armor_stand', cubes, {reference, branches});
  assert.deepEqual(entries.map(entry => entry.model.parts.map(part => part.name)), [['hat cube'], ['pack cube']]);
  assert.deepEqual(entries[0].model.parts[0].origin, [0, 1, 0]);
  assert.deepEqual(entries[1].model.parts[0].origin, [0, 0, 2]);
  const exported = exportModels(entries, 20);
  assert.match(exported.glsl, /case 20:[\s\S]*modelSize \/= 7\.0;/);
  assert.match(exported.glsl, /case 21:[\s\S]*modelSize \/= 12\.0;/);
});

test('requires explicit bindings for multi-part exports', () => {
  const branches = [{id: 'head', anchor: 'head'}, {id: 'body', anchor: 'body'}];
  assert.throws(() => toCemModels('multipart', [{name: 'loose', from: [0, 0, 0], to: [1, 1, 1]}], {reference: {bindings: {}}, branches}), /not inside a detection anchor/);
});

test('supports cubes inside rotated Blockbench groups', () => {
  const group = {name: 'head', rotation: [0, 30, 0], parent: null};
  const model = toCemModel('pig', [{from: [0, 0, 0], to: [1, 1, 1], parent: group}]);
  assert.equal(model.parts[0].rotationMatrix.length, 9);
});

test('exports disabled faces and 180-degree UV rotation', () => {
  const cube = {from: [0, 0, 0], to: [1, 1, 1], faces: {down: {uv: [0, 0, 4, 6], rotation: 180}, up: {uv: [0, 0, 4, 6], enabled: false}}};
  const model = toCemModel('pig', [cube]);
  assert.deepEqual(model.parts[0].faces[0], [4, 6, -4, -6]);
  assert.equal(model.parts[0].faces[1], undefined);
  const glsl = exportModel(model).glsl;
  assert.match(glsl, /vec4\(4\.0, 6\.0, -4\.0, -6\.0\), vec4\(0\.0\)/);
});

test('exports Cube 90 and 270 degree UV rotations with the runtime extension', () => {
  const cube = {from: [0, 0, 0], to: [1, 1, 1], faces: {down: {uv: [0, 0, 1, 1], rotation: 90}}};
  const model = toCemModel('pig', [cube]);
  assert.deepEqual(model.parts[0].faceRotations, [1, 0, 0, 0, 0, 0]);
  assert.match(exportModel(model).glsl, /ADD_BOX_UV_ROTATE/);
  cube.faces.down.rotation = 270;
  const rotated = toCemModel('pig', [cube]);
  assert.deepEqual(rotated.parts[0].faceRotations, [3, 0, 0, 0, 0, 0]);
  assert.match(exportModel(rotated).glsl, /ADD_BOX_UV_ROTATE/);
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

test('bakes non-uniform parent scale into cube geometry', () => {
  const group = {name: 'head', origin: [0, 0, 0], rotation: [0, 90, 0], scale: [2, 3, 4], parent: null};
  const model = toCemModel('pig', [{from: [-1, -1, -1], to: [1, 1, 1], parent: group}]);
  assert.deepEqual(model.parts[0].size, [2, 3, 4]);
  assert.equal(model.parts[0].rotationMatrix.length, 9);
});

test('rejects nested transforms that introduce shear', () => {
  const scaled = {name: 'scaled', origin: [0, 0, 0], rotation: [0, 0, 0], scale: [2, 1, 1], parent: null};
  const rotated = {name: 'rotated', origin: [0, 0, 0], rotation: [0, 0, 45], parent: scaled};
  assert.throws(() => toCemModel('pig', [{name: 'sheared', from: [-1, -1, -1], to: [1, 1, 1], parent: rotated}]), /sheared transform/);
});
