const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('bundled CEM-S runtime exposes per-part render property macros', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'vendor', 'cem-s', 'assets', 'minecraft', 'shaders', 'include', 'cem', 'frag_funcs.glsl'), 'utf8');
  assert.match(source, /#define ADD_BOX_RENDER\(/);
  assert.match(source, /#define ADD_BOX_RENDER_UV\(/);
  assert.match(source, /#define ADD_BOX_ROTATE_RENDER\(/);
  assert.match(source, /sBoxWithRotationsRender/);
  assert.match(source, /cem_lightMapColor/);
});
