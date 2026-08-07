(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CemSRuntime = api;
}(typeof globalThis === 'undefined' ? this : globalThis, function (root) {
  const REVISION = 'fb82f20698e8972f241574a9390413f385c8bddb';
  const BASE = `https://raw.githubusercontent.com/DartCat25/CEM-S/${REVISION}/`;
  const LICENSE = `MIT License

Copyright (c) 2024 DartCat25

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
  const SOURCES = {
    'assets/minecraft/shaders/core/entity.fsh': '1.21.6/assets/minecraft/shaders/core/entity.fsh',
    'assets/minecraft/shaders/core/entity.vsh': '1.21.6/assets/minecraft/shaders/core/entity.vsh',
    'assets/minecraft/shaders/include/cem/frag_funcs.glsl': 'include/cem/frag_funcs.glsl',
    'assets/minecraft/shaders/include/cem/frag_main_setup.glsl': 'include/cem/frag_main_setup.glsl',
    'assets/minecraft/shaders/include/cem/vert_setup.glsl': 'include/cem/vert_setup.glsl'
  };

  async function loadRuntimeFiles(fetcher) {
    if (!fetcher && root.CemSBundledRuntime) {
      return Object.assign({}, root.CemSBundledRuntime, {'THIRD-PARTY-LICENSES/CEM-S-MIT.txt': LICENSE});
    }
    const request = fetcher || (typeof fetch === 'function' ? fetch : null);
    if (!request) throw new Error('CEM-S Studio needs network access to download the CEM-S 1.21.6 runtime');
    const result = {};
    for (const [destination, source] of Object.entries(SOURCES)) {
      const response = await request(BASE + source);
      if (!response.ok) throw new Error(`failed to download CEM-S runtime file: ${source}`);
      result[destination] = await response.text();
    }
    result['THIRD-PARTY-LICENSES/CEM-S-MIT.txt'] = LICENSE;
    return result;
  }

  return {REVISION, BASE, SOURCES, LICENSE, loadRuntimeFiles};
}));
