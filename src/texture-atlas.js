(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CemSTextureAtlas = api;
}(typeof globalThis === 'undefined' ? this : globalThis, function () {
  function finitePositive(value, label) {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
    return value;
  }

  function finiteNonNegative(value, label) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
    return value;
  }

  function textureKey(texture) {
    if (texture === undefined || texture === null || texture === false) return null;
    if (typeof texture === 'string' || typeof texture === 'number') return String(texture);
    return texture.uuid || texture.id || texture.name || null;
  }

  function layoutTextures(textures, padding = 1, primaryTexture = null) {
    if (!Array.isArray(textures)) throw new Error('textures must be an array');
    finiteNonNegative(padding, 'padding');
    const seen = new Set();
    let entries = textures.map((texture, index) => {
      const key = textureKey(texture);
      if (!key) throw new Error(`texture ${index + 1} is missing an id`);
      if (seen.has(key)) throw new Error(`duplicate texture id: ${key}`);
      seen.add(key);
      return {key, width: finitePositive(texture.width, `texture ${key} width`), height: finitePositive(texture.height, `texture ${key} height`)};
    }).sort((left, right) => right.height - left.height || right.width - left.width || left.key.localeCompare(right.key));
    if (!entries.length) return {width: 1, height: 1, padding, placements: {}};
    const primaryKey = textureKey(primaryTexture);
    if (primaryKey) {
      const primaryIndex = entries.findIndex(entry => entry.key === primaryKey);
      if (primaryIndex < 0) throw new Error(`primary texture is missing from the atlas: ${primaryKey}`);
      entries = [entries[primaryIndex], ...entries.slice(0, primaryIndex), ...entries.slice(primaryIndex + 1)];
    }
    const anchored = Boolean(primaryKey);
    const width = Math.max(...entries.map(entry => entry.width + (anchored ? 0 : padding * 2)));
    let y = anchored ? 0 : padding;
    const placements = {};
    for (const entry of entries) {
      placements[entry.key] = {x: anchored ? 0 : padding, y, width: entry.width, height: entry.height};
      y += entry.height + padding;
    }
    return {width, height: anchored ? y - padding : y, padding, placements, primaryKey: primaryKey || null};
  }

  function remapUvRect(uv, placement) {
    if (!Array.isArray(uv) || uv.length !== 4 || uv.some(value => !Number.isFinite(value))) throw new Error('uv must be a finite vec4');
    if (!placement || !Number.isFinite(placement.x) || !Number.isFinite(placement.y)) throw new Error('texture placement is missing');
    return [placement.x + uv[0], placement.y + uv[1], uv[2], uv[3]];
  }

  function placementFor(atlas, texture) {
    const key = textureKey(texture);
    return key && atlas?.placements?.[key] ? atlas.placements[key] : null;
  }

  function collectReferencedTextures(elements, textures, options = {}) {
    if (!Array.isArray(elements)) throw new Error('elements must be an array');
    if (!Array.isArray(textures)) throw new Error('textures must be an array');
    const byKey = new Map();
    for (const texture of textures) {
      for (const key of [textureKey(texture), texture?.uuid, texture?.id, texture?.name].filter(value => value !== undefined && value !== null && value !== '')) {
        byKey.set(String(key), texture);
      }
    }
    const result = [];
    const seen = new Set();
    for (const element of elements) {
      if (options.isReference?.(element)) continue;
      for (const [faceName, face] of Object.entries(element?.faces || {})) {
        if (!face || face.enabled === false || face.texture === undefined || face.texture === null || face.texture === false) continue;
        const requestedKey = textureKey(face.texture);
        const texture = requestedKey && byKey.get(requestedKey);
        if (!texture) throw new Error(`element "${element.name || 'unnamed'}" face "${faceName}" references a missing texture`);
        const key = textureKey(texture);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(texture);
        }
      }
    }
    return result;
  }

  function dataUrlToBytes(dataUrl) {
    if (typeof dataUrl !== 'string' || !/^data:image\/png;base64,/.test(dataUrl)) throw new Error('atlas canvas did not produce PNG data');
    const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(encoded, 'base64'));
    if (typeof atob !== 'function') throw new Error('this Blockbench environment cannot decode PNG data');
    const binary = atob(encoded);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }

  function renderTextureAtlas(textures, options = {}) {
    if (!Array.isArray(textures) || !textures.length) throw new Error('at least one referenced texture is required');
    const documentApi = options.document || globalThis.document;
    if (!documentApi?.createElement) throw new Error('texture atlas rendering requires Blockbench canvas support');
    const primaryTexture = options.primaryTexture || textures[0];
    const layout = layoutTextures(textures, options.padding === undefined ? 1 : options.padding, primaryTexture);
    const canvas = documentApi.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('could not create the texture atlas canvas');
    context.imageSmoothingEnabled = false;
    for (const texture of textures) {
      const placement = placementFor(layout, texture);
      const image = texture.canvas || texture.img || texture.image;
      if (!image || !Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0) {
        throw new Error(`texture "${texture.name || textureKey(texture)}" is not loaded and cannot be added to the atlas`);
      }
      context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
    }
    if (options.marker) {
      const {pixel, color} = options.marker;
      if (!Array.isArray(pixel) || pixel.length !== 2 || pixel.some(value => !Number.isInteger(value) || value < 0)) throw new Error('texture marker pixel must be a non-negative ivec2');
      if (!Array.isArray(color) || color.length !== 4 || color.some(value => !Number.isInteger(value) || value < 0 || value > 255)) throw new Error('texture marker color must be RGBA bytes');
      if (pixel[0] >= canvas.width || pixel[1] >= canvas.height) throw new Error(`texture atlas ${canvas.width}x${canvas.height} is too small for marker pixel ${pixel.join(', ')}`);
      context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
      context.fillRect(pixel[0], pixel[1], 1, 1);
    }
    const dataUrl = canvas.toDataURL('image/png');
    return {...layout, dataUrl, png: dataUrlToBytes(dataUrl)};
  }

  return {textureKey, layoutTextures, remapUvRect, placementFor, collectReferencedTextures, dataUrlToBytes, renderTextureAtlas};
}));
