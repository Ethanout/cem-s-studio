const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');

const {createProject, serializeProject} = require('../src/cemst.js');
const {exportModel} = require('../src/cem-exporter.js');
const {buildPackFiles} = require('../src/pack-builder.js');
const {sourcesFor, profileFor, LICENSE} = require('../src/cem-runtime.js');
const {profileFor: entityProfileFor} = require('../src/entity-database.js');

const ROOT = path.resolve(__dirname, '..');

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const payload = Buffer.concat([name, data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(payload), 0);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, payload, checksum]);
}

function verificationTexture(width = 64, height = 32) {
  const atlasHeight = height + 5;
  const rows = [];
  for (let y = 0; y < atlasHeight; y++) {
    const row = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x++) {
      const offset = 1 + x * 4;
      const isPadding = y === height;
      const isAttachment = y > height && y <= height + 4 && x < 4;
      row[offset] = isAttachment ? ((x + y) % 2 ? 30 : 230) : 210;
      row[offset + 1] = isAttachment ? ((x + y) % 2 ? 120 : 245) : 150;
      row[offset + 2] = isAttachment ? 255 : 90;
      row[offset + 3] = isPadding || (y > height && !isAttachment) ? 0 : 255;
      if (x === 63 && y === 0) [row[offset], row[offset + 1], row[offset + 2], row[offset + 3]] = [255, 0, 0, 255];
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(atlasHeight, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function runtimeFiles(version) {
  const sources = sourcesFor(version);
  return Object.fromEntries(Object.entries(sources).map(([destination, vendorPath]) => {
    const source = path.join(ROOT, 'vendor', 'cem-s', vendorPath);
    if (!fs.existsSync(source)) throw new Error(`Missing bundled runtime file: ${source}`);
    return [destination, fs.readFileSync(source, 'utf8')];
  }).concat([['THIRD-PARTY-LICENSES/CEM-S-MIT.txt', LICENSE]]));
}

function writePack(files, output) {
  fs.mkdirSync(output, {recursive: true});
  for (const [relative, content] of Object.entries(files)) {
    const destination = path.join(output, relative);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.writeFileSync(destination, content);
  }
}

function buildVerificationPack(version = '1.21.11', requestedOutput = null) {
  const output = path.resolve(requestedOutput || path.join(os.tmpdir(), 'cem-s-studio-verification', version));
  const profile = profileFor(version);
  const entityProfile = entityProfileFor('pig', version);
  const attachmentUv = [0, entityProfile.textureSize[1] + 1, 4, 4];
  const project = createProject({
    name: 'CEM-S Studio Verification Pig',
    modelId: 901,
    targetEntity: 'pig',
    cemVersion: version,
    texturePath: 'assets/minecraft/textures/entity/pig/temperate_pig.png',
    resourcePack: {
      name: 'CEM-S Studio Verification',
      description: `CEM-S Studio verification pack for ${profile.label}`,
      packFormat: profile.packFormat
    }
  });
  const model = {
    name: project.project.name,
    parts: [{
      name: 'verification_marker',
      type: 'cube',
      origin: [-2, 0, 3],
      size: [1, 1, 1],
      faces: [attachmentUv, attachmentUv, attachmentUv, attachmentUv, attachmentUv, attachmentUv]
    }]
  };
  const exported = exportModel(model, project.project.modelId, version, {modelScale: 8});
  const files = buildPackFiles(project, exported.glsl, {
    runtimeFiles: runtimeFiles(version),
    textureFile: {path: project.project.texturePath, content: verificationTexture(...entityProfile.textureSize), baseSize: entityProfile.textureSize}
  });
  files['cem-studio/verification.json'] = `${JSON.stringify({version, entity: 'minecraft:pig', modelId: project.project.modelId, marker: {pixel: [63, 0], rgba: [255, 0, 0, 255]}, expected: ['resource pack loads without shader compile errors', 'red marker texture is detected', 'verification cube appears on the pig head', 'positive Y points upward in-game']}, null, 2)}\n`;
  files['cem-studio/README.txt'] = `CEM-S Studio Verification\n\nMinecraft runtime: ${version}\nEntity: minecraft:pig\nModel ID: ${project.project.modelId}\n\nEnable this pack, summon a pig, and check the small blue-and-white verification cube beside its head.\nThe cube is intentionally separated from the original head surface so depth clipping can be tested without coplanar z-fighting.\nThe red marker at texture pixel (63, 0) is required for detection.\nRecord shader logs and screenshots in docs/minecraft-runtime-verification.md.\n`;
  writePack(files, output);
  fs.writeFileSync(path.join(output, 'cem-studio-project.cemst'), serializeProject(project));
  return {output, version, fileCount: Object.keys(files).length + 1, modelId: project.project.modelId};
}

if (require.main === module) console.log(JSON.stringify(buildVerificationPack(process.argv[2] || '1.21.11', process.argv[3]), null, 2));

module.exports = {buildVerificationPack, verificationTexture};
