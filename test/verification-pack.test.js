const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const {test} = require('node:test');
const {buildVerificationPack} = require('../scripts/build-minecraft-verification-pack.js');

function readPngPixel(file, x, y) {
  const bytes = fs.readFileSync(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let offset = 8;
  let width;
  let height;
  const imageData = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') imageData.push(data);
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  assert.equal(width, 64);
  assert.equal(height, 32);
  const raw = zlib.inflateSync(Buffer.concat(imageData));
  const row = raw.subarray(y * (1 + width * 4) + 1, (y + 1) * (1 + width * 4));
  return [...row.subarray(x * 4, x * 4 + 4)];
}

test('builds a self-contained 1.21.11 Minecraft verification pack', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'cem-s-studio-pack-test-'));
  try {
    const result = buildVerificationPack('1.21.11', output);
    assert.equal(result.modelId, 901);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'pack.mcmeta'), 'utf8')).pack.pack_format, 75);
    assert.deepEqual(readPngPixel(path.join(output, 'assets/minecraft/textures/entity/pig/temperate_pig.png'), 63, 0), [255, 0, 0, 255]);
    const detection = fs.readFileSync(path.join(output, 'assets/minecraft/shaders/include/cem_user/detection/entity/cem_s_studio_verification_pig.glsl'), 'utf8');
    assert.match(detection, /ivec2\(63, 0\)/);
    assert.match(detection, /% 42 == 3/);
    assert.match(detection, /cem_keep_original = 1/);
    const model = fs.readFileSync(path.join(output, 'assets/minecraft/shaders/include/cem_user/models/entity/cem_s_studio_verification_pig.glsl'), 'utf8');
    assert.match(model, /case 901:/);
    assert.match(model, /ADD_BOX/);
  } finally {
    fs.rmSync(output, {recursive: true, force: true});
  }
});
