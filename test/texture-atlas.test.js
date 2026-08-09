const test = require('node:test');
const assert = require('node:assert/strict');
const {layoutTextures, remapUvRect, placementFor, collectReferencedTextures, dataUrlToBytes} = require('../src/texture-atlas.js');
const {toCemModel} = require('../src/blockbench-adapter.js');

test('lays out unique textures deterministically with padding', () => {
  const atlas = layoutTextures([
    {uuid: 'small', width: 4, height: 4},
    {uuid: 'large', width: 8, height: 2}
  ], 1);
  assert.deepEqual(atlas.placements.small, {x: 1, y: 1, width: 4, height: 4});
  assert.deepEqual(atlas.placements.large, {x: 1, y: 6, width: 8, height: 2});
  assert.deepEqual(remapUvRect([2, 3, 4, -5], atlas.placements.small), [3, 4, 4, -5]);
  assert.deepEqual(placementFor(atlas, 'large'), atlas.placements.large);
});

test('remaps cube UV rectangles into the selected texture atlas', () => {
  const atlas = {placements: {metal: {x: 16, y: 8, width: 8, height: 8}}};
  const cube = {name: 'pack', from: [0, 0, 0], to: [2, 2, 2], faces: {down: {texture: 'metal', uv: [1, 2, 5, 6]}}};
  const part = toCemModel('pack', [cube], {textureAtlas: atlas}).parts[0];
  assert.deepEqual(part.faces[0], [17, 10, 4, 4]);
});

test('keeps the primary entity texture at the original UV origin', () => {
  const primary = {uuid: 'entity', width: 64, height: 32};
  const atlas = layoutTextures([{uuid: 'detail', width: 8, height: 8}, primary], 1, primary);
  assert.deepEqual(atlas.placements.entity, {x: 0, y: 0, width: 64, height: 32});
  assert.deepEqual(atlas.placements.detail, {x: 0, y: 33, width: 8, height: 8});
  assert.equal(atlas.width, 64);
  assert.equal(atlas.height, 41);
});

test('collects only textures referenced by non-reference enabled faces', () => {
  const textures = [{uuid: 'body', id: '0', name: 'Body'}, {uuid: 'detail', id: '1', name: 'Detail'}, {uuid: 'guide', id: '2', name: 'Guide'}];
  const elements = [
    {name: 'Body cube', faces: {north: {texture: '0'}, south: {texture: 'detail'}, east: {texture: 'guide', enabled: false}}},
    {name: '[CEM-S Reference] head', faces: {north: {texture: 'guide'}}}
  ];
  const used = collectReferencedTextures(elements, textures, {isReference: element => element.name.startsWith('[CEM-S Reference]')});
  assert.deepEqual(used.map(texture => texture.uuid), ['body', 'detail']);
});

test('decodes PNG data URLs as binary bytes', () => {
  const bytes = dataUrlToBytes('data:image/png;base64,iVBORw0KGgo=');
  assert.deepEqual([...bytes], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('rejects an atlas reference that has no placement', () => {
  const cube = {name: 'missing', from: [0, 0, 0], to: [1, 1, 1], faces: {down: {texture: 'unknown', uv: [0, 0, 1, 1]}}};
  assert.throws(() => toCemModel('missing', [cube], {textureAtlas: {placements: {}}}), /missing from the atlas/);
});
