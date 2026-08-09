const test = require('node:test');
const assert = require('node:assert/strict');
const {createProject} = require('../src/cemst.js');
const {toCemModel, toCemModels} = require('../src/blockbench-adapter.js');
const {exportModel, exportModels} = require('../src/cem-exporter.js');
const {buildPackFiles} = require('../src/pack-builder.js');

function cube(name, from, to, parent, extra = {}) {
  return {name, uuid: `${name}-uuid`, from, to, origin: from.map((value, axis) => (value + to[axis]) / 2), parent, ...extra};
}

test('covers a player-reference jetpack attached to an elytra host', () => {
  const project = createProject({
    name: 'Player Jetpack', modelId: 31, targetEntity: 'elytra', targetType: 'armor',
    referenceRig: 'player', detection: {preset: 'elytra'},
    reference: {rig: 'player', root: 'player-root', anchors: {body: 'player-body'}, bindings: {'jetpack-group-uuid': 'body'}, transforms: {}, guides: ['player-guide']}
  });
  const body = {name: 'player body', uuid: 'player-body', origin: [0, 18, 0], parent: null};
  const group = {name: 'Jetpack', uuid: 'jetpack-group-uuid', origin: [0, 18, 0], parent: body};
  const guide = {name: '[CEM-S Reference] body', uuid: 'player-guide', from: [-2, 16, -1], to: [2, 24, 1]};
  const pack = cube('thruster', [-3, 16, 1], [3, 22, 4], group);
  const model = toCemModel('player_jetpack', [guide, pack], {reference: project.project.reference});
  assert.deepEqual(model.parts.map(part => part.name), ['thruster']);
  assert.deepEqual(model.parts[0].origin, [0, 1, 2.5]);
  const exported = exportModel(model, project.project.modelId, project.project.cemVersion);
  assert.match(exported.glsl, /case 31:/);
  assert.match(exported.glsl, /ADD_BOX_ROTATE/);
  const files = buildPackFiles(project, exported.glsl);
  assert.match(files['assets/minecraft/shaders/include/cem_user/detection/armor/player_jetpack.glsl'], /ivec2\(1, 0\)/);
  assert.doesNotMatch(files['assets/minecraft/shaders/include/cem_user/models/armor/player_jetpack.glsl'], /Reference/);
});

test('covers a pig head attachment with anchor-local coordinates', () => {
  const project = createProject({
    name: 'Pig Head Charm', modelId: 32, targetEntity: 'pig', referenceRig: 'pig',
    reference: {rig: 'pig', root: 'pig-root', anchors: {head: 'pig-head'}, bindings: {'charm-group-uuid': 'head'}, transforms: {}, guides: []}
  });
  const head = {name: 'pig head', uuid: 'pig-head', origin: [0, 18, 0], parent: null};
  const group = {name: 'Charm', uuid: 'charm-group-uuid', origin: [0, 18, 0], parent: head};
  const charm = cube('bell', [-1, 18, -1], [1, 21, 1], group);
  const model = toCemModel('pig_head_attachment', [charm], {reference: project.project.reference});
  assert.deepEqual(model.parts[0].origin, [0, 1.5, 0]);
  assert.deepEqual(model.parts[0].pivot, [0, 0, 0]);
  const files = buildPackFiles(project, exportModel(model, 32).glsl);
  assert.match(files['assets/minecraft/shaders/include/cem_user/detection/entity/pig_head_charm.glsl'], /% 42 == 3/);
});

test('covers a full-body model split across head and arm detection branches', () => {
  const project = createProject({
    name: 'Full Body Companion', modelId: 40, targetEntity: 'custom', referenceRig: 'player',
    detection: {preset: 'custom', branches: [
      {id: 'head', anchor: 'head', modelIdOffset: 0, match: {mode: 'vertex_id', count: 8, index: 0}, reverse: false, corner: 'default', size: 1, modelScale: 8},
      {id: 'left_arm', anchor: 'left_arm', modelIdOffset: 1, match: {mode: 'vertex_id', count: 8, index: 1}, reverse: false, corner: 'default', size: 1, modelScale: 8},
      {id: 'right_arm', anchor: 'right_arm', modelIdOffset: 2, match: {mode: 'vertex_id', count: 8, index: 2}, reverse: false, corner: 'default', size: 1, modelScale: 8}
    ]},
    reference: {rig: 'player', root: 'player-root', anchors: {head: 'head-anchor', left_arm: 'left-arm-anchor', right_arm: 'right-arm-anchor'}, bindings: {'head-group': 'head', 'left-group': 'left_arm', 'right-group': 'right_arm'}, transforms: {}, guides: []}
  });
  const anchors = {
    head: {uuid: 'head-anchor', origin: [0, 24, 0], parent: null},
    left: {uuid: 'left-arm-anchor', origin: [5, 22, 0], parent: null},
    right: {uuid: 'right-arm-anchor', origin: [-5, 22, 0], parent: null}
  };
  const parts = [
    cube('head-piece', [-2, 24, -2], [2, 28, 2], {uuid: 'head-group', parent: anchors.head}),
    cube('left-piece', [4, 20, -1], [6, 24, 1], {uuid: 'left-group', parent: anchors.left}),
    cube('right-piece', [-6, 20, -1], [-4, 24, 1], {uuid: 'right-group', parent: anchors.right})
  ];
  const branches = project.project.detection.branches;
  const entries = toCemModels('full_body', parts, {reference: project.project.reference, branches});
  assert.deepEqual(entries.map(entry => entry.model.parts.length), [1, 1, 1]);
  assert.deepEqual(entries.map(entry => entry.model.parts[0].origin), [[0, 2, 0], [0, 0, 0], [0, 0, 0]]);
  const exported = exportModels(entries, project.project.modelId, project.project.cemVersion);
  assert.match(exported.glsl, /case 40:/);
  assert.match(exported.glsl, /case 41:/);
  assert.match(exported.glsl, /case 42:/);
  assert.equal(exported.manifest.models.length, 3);
});
