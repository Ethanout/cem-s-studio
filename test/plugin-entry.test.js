const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('uses a Blockbench dialog instead of the unsupported browser prompt', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'plugin-entry.js'), 'utf8');
  assert.doesNotMatch(source, /\.prompt\s*\(/);
  assert.match(source, /new Dialog\s*\(/);
});
