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

  const SHARED_SOURCES = {
    'assets/minecraft/shaders/include/cem/frag_funcs.glsl': 'assets/minecraft/shaders/include/cem/frag_funcs.glsl',
    'assets/minecraft/shaders/include/cem/frag_main_setup.glsl': 'assets/minecraft/shaders/include/cem/frag_main_setup.glsl',
    'assets/minecraft/shaders/include/cem/vert_setup.glsl': 'assets/minecraft/shaders/include/cem/vert_setup.glsl'
  };
  const RUNTIME_PROFILES = {
    '1.21.6': {gameVersion: '1.21.6', label: 'Minecraft 1.21.6', packFormat: 63, coreBase: ''},
    '1.21.11': {gameVersion: '1.21.11', label: 'Minecraft 1.21.11', packFormat: 75, coreBase: '1.21.11/'},
    '26.1+': {gameVersion: '26.1.2', label: 'Minecraft 26.1+ (26.1.2 runtime)', packFormat: 84, coreBase: '26.1.2/'}
  };

  function sourcesFor(version = '1.21.6') {
    const profile = RUNTIME_PROFILES[version];
    if (!profile) throw new Error(`unsupported Minecraft runtime: ${version}`);
    return Object.assign({
      'assets/minecraft/shaders/core/entity.fsh': `${profile.coreBase}assets/minecraft/shaders/core/entity.fsh`,
      'assets/minecraft/shaders/core/entity.vsh': `${profile.coreBase}assets/minecraft/shaders/core/entity.vsh`
    }, SHARED_SOURCES);
  }

  function profileFor(version = '1.21.6') {
    const profile = RUNTIME_PROFILES[version];
    if (!profile) throw new Error(`unsupported Minecraft runtime: ${version}`);
    return Object.assign({}, profile);
  }

  async function loadRuntimeFiles(version = '1.21.6') {
    const profile = profileFor(version);
    const bundled = root.CemSBundledRuntime && root.CemSBundledRuntime[version];
    if (!bundled) throw new Error(`CEM-S Studio is missing its bundled ${profile.label} runtime`);
    return Object.assign({}, bundled, {'THIRD-PARTY-LICENSES/CEM-S-MIT.txt': LICENSE});
  }

  const SOURCES = sourcesFor('1.21.6');
  const UPSTREAM_SOURCES = {
    'assets/minecraft/shaders/core/entity.fsh': '1.21.6/assets/minecraft/shaders/core/entity.fsh',
    'assets/minecraft/shaders/core/entity.vsh': '1.21.6/assets/minecraft/shaders/core/entity.vsh',
    'assets/minecraft/shaders/include/cem/frag_funcs.glsl': 'include/cem/frag_funcs.glsl',
    'assets/minecraft/shaders/include/cem/frag_main_setup.glsl': 'include/cem/frag_main_setup.glsl',
    'assets/minecraft/shaders/include/cem/vert_setup.glsl': 'include/cem/vert_setup.glsl'
  };

  return {REVISION, BASE, SOURCES, UPSTREAM_SOURCES, RUNTIME_PROFILES, LICENSE, sourcesFor, profileFor, loadRuntimeFiles};
}));
