const fs = require('node:fs');
const path = require('node:path');
const {REVISION, UPSTREAM_SOURCES} = require('../src/cem-runtime.js');

const root = path.resolve(__dirname, '..');

async function download(source) {
  const url = `https://api.github.com/repos/DartCat25/CEM-S/contents/${source}?ref=${REVISION}`;
  const response = await fetch(url, {headers: {'Accept': 'application/vnd.github+json', 'User-Agent': 'cem-s-studio-vendor-script'}});
  if (!response.ok) throw new Error(`Failed to fetch ${source}: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.encoding !== 'base64' || typeof payload.content !== 'string') throw new Error(`Unexpected GitHub response for ${source}`);
  return Buffer.from(payload.content.replace(/\s/g, ''), 'base64');
}

function replaceOnce(source, pattern, replacement, label) {
  const probe = new RegExp(pattern.source, pattern.flags.replace('g', ''));
  const match = probe.exec(source);
  if (!match || probe.test(source.slice(match.index + match[0].length))) throw new Error(`Upstream compatibility patch did not match exactly once: ${label}`);
  return source.replace(pattern, replacement);
}

function applyCompatibilityPatches(destination, content) {
  let source = content.toString('utf8');
  if (destination === 'assets/minecraft/shaders/core/entity.fsh') {
    source = replaceOnce(source, /#moj_import <minecraft:matf\.glsl>\r?\n#moj_import <minecraft:noise\.glsl>\r?\n/, '', 'remove obsolete fragment imports');
    source = replaceOnce(source, /(#moj_import <cem\/frag_funcs\.glsl>)/, '#define CEM_VERTEX_COLOR vertexColor\n$1', 'define legacy vertex color');
  } else if (destination === 'assets/minecraft/shaders/include/cem/frag_funcs.glsl') {
    source = replaceOnce(source, /p3 \* modelSize, vertexColor, color, minT, uv/, 'p3 * modelSize, CEM_VERTEX_COLOR, color, minT, uv', 'use version-neutral vertex color');
  } else if (destination === 'assets/minecraft/shaders/include/cem/vert_setup.glsl') {
    source = replaceOnce(source,
      /vertexColor = minecraft_mix_light\(Light0_Direction, Light1_Direction, Normal, vec4\(1\.0\)\);\r?\ncem_lightMapColor = texelFetch\(Sampler2, UV2 \/ 16, 0\);/,
      '#ifdef PER_FACE_LIGHTING\nvec2 cem_face_light = minecraft_compute_light(Light0_Direction, Light1_Direction, Normal);\nvertexPerFaceColorBack = minecraft_mix_light_separate(-cem_face_light, vec4(1.0));\nvertexPerFaceColorFront = minecraft_mix_light_separate(cem_face_light, vec4(1.0));\n#else\nvertexColor = minecraft_mix_light(Light0_Direction, Light1_Direction, Normal, vec4(1.0));\n#endif\n#ifndef EMISSIVE\ncem_lightMapColor = texelFetch(Sampler2, UV2 / 16, 0);\n#else\ncem_lightMapColor = vec4(1.0);\n#endif',
      'support modern lighting variants');
  }
  const patchedDestinations = [
    'assets/minecraft/shaders/core/entity.fsh',
    'assets/minecraft/shaders/include/cem/frag_funcs.glsl',
    'assets/minecraft/shaders/include/cem/vert_setup.glsl'
  ];
  return patchedDestinations.includes(destination) ? source.replace(/\r\n/g, '\n').replace(/^(\*\/)[ \t]+$/gm, '$1') : source;
}

async function main() {
  for (const [destination, source] of Object.entries(UPSTREAM_SOURCES)) {
    const target = path.join(root, 'vendor', 'cem-s', destination);
    const content = applyCompatibilityPatches(destination, await download(source));
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, content, 'utf8');
    console.log(`${source} -> ${path.relative(root, target)}`);
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
