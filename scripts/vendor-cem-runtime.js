const fs = require('node:fs');
const path = require('node:path');
const {REVISION, SOURCES} = require('../src/cem-runtime.js');

const root = path.resolve(__dirname, '..');

async function download(source) {
  const url = `https://api.github.com/repos/DartCat25/CEM-S/contents/${source}?ref=${REVISION}`;
  const response = await fetch(url, {headers: {'Accept': 'application/vnd.github+json', 'User-Agent': 'cem-s-studio-vendor-script'}});
  if (!response.ok) throw new Error(`Failed to fetch ${source}: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.encoding !== 'base64' || typeof payload.content !== 'string') throw new Error(`Unexpected GitHub response for ${source}`);
  return Buffer.from(payload.content.replace(/\s/g, ''), 'base64');
}

async function main() {
  for (const [destination, source] of Object.entries(SOURCES)) {
    const target = path.join(root, 'vendor', 'cem-s', destination);
    const content = await download(source);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, content);
    console.log(`${source} -> ${path.relative(root, target)}`);
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
