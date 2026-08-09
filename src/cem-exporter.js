(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CemSExporter = api;
}(typeof globalThis === 'undefined' ? this : globalThis, function () {
  const AXES = ['X', 'Y', 'Z'];
  const EMPTY_FACE = 'vec4(0.0)';

  function assertVec3(value, label) {
    if (!Array.isArray(value) || value.length !== 3 || value.some((item) => !Number.isFinite(item))) {
      throw new Error(`${label} must be a vec3 of finite numbers`);
    }
  }

  function formatNumber(value) {
    return Number(value).toFixed(1);
  }

  function formatVec3(value) {
    return `vec3(${value.map(formatNumber).join(', ')})`;
  }

  function formatVec4(value) {
    return `vec4(${value.map(formatNumber).join(', ')})`;
  }

  function validateModel(model) {
    if (!model || typeof model.name !== 'string' || !model.name.trim()) throw new Error('model name is required');
    if (!Array.isArray(model.parts)) throw new Error('parts must be an array');
    model.parts.forEach((part, index) => {
      if (!part || !['cube', 'square'].includes(part.type)) throw new Error(`part ${index}: unsupported part type`);
      if (part.type === 'square') {
        if (!Array.isArray(part.points) || part.points.length !== 3) throw new Error(`part ${index} points must contain three vertices`);
        part.points.forEach((point, pointIndex) => assertVec3(point, `part ${index} point ${pointIndex}`));
        if (!Array.isArray(part.uv) || part.uv.length !== 4 || part.uv.some(value => !Number.isFinite(value))) throw new Error(`part ${index} uv must be a finite vec4`);
        return;
      }
      assertVec3(part.origin, `part ${index} origin`);
      assertVec3(part.size, `part ${index} size`);
      if (part.rotation) assertVec3(part.rotation, `part ${index} rotation`);
      if (part.pivot) assertVec3(part.pivot, `part ${index} pivot`);
      if (part.rotationMatrix && (!Array.isArray(part.rotationMatrix) || part.rotationMatrix.length !== 9 || part.rotationMatrix.some((value) => !Number.isFinite(value)))) {
        throw new Error(`part ${index} rotationMatrix must contain 9 finite numbers`);
      }
      if (part.faces && (!Array.isArray(part.faces) || part.faces.some((face) => face !== undefined && (!Array.isArray(face) || face.length !== 4 || face.some((item) => !Number.isFinite(item)))))) {
        throw new Error(`part ${index} faces must contain vec4 values`);
      }
      if (part.faceRotations && (!Array.isArray(part.faceRotations) || part.faceRotations.length !== 6 || part.faceRotations.some((rotation) => !Number.isInteger(rotation) || ![0, 1, 3].includes(rotation)))) {
        throw new Error(`part ${index} faceRotations must contain six values from 0, 1, or 3`);
      }
    });
  }

  function emitRotation(rotation) {
    return rotation
      .map((angle, index) => angle === 0 ? null : `Rotate3(radians(${formatNumber(angle)}), ${AXES[index]})`)
      .filter(Boolean)
      .join(' * ') || 'mat3(1.0)';
  }

  function formatMat3(matrix) {
    // Internal matrices are row-major; GLSL mat3 constructors are column-major.
    const values = [matrix[0], matrix[3], matrix[6], matrix[1], matrix[4], matrix[7], matrix[2], matrix[5], matrix[8]];
    return `mat3(${values.map(formatNumber).join(', ')})`;
  }

  function emitPart(part) {
    if (part.type === 'square') return `    ADD_SQUARE(${part.points.map(formatVec3).join(', ')}, ${formatVec4(part.uv)})`;
    const faces = Array.from({length: 6}, (_, index) => part.faces && part.faces[index] ? formatVec4(part.faces[index]) : EMPTY_FACE).join(', ');
    const rotations = part.faceRotations || Array(6).fill(0);
    const rotationArgs = rotations.join(', ');
    const uvRotate = rotations.some(Boolean);
    if (!part.rotationMatrix && (!part.rotation || part.rotation.every((angle) => angle === 0))) {
      return `    ${uvRotate ? 'ADD_BOX_UV_ROTATE' : 'ADD_BOX'}(${formatVec3(part.origin)}, ${formatVec3(part.size)}, ${faces}${uvRotate ? `, ${rotationArgs}` : ''})`;
    }
    const pivot = part.pivot || part.origin;
    const rotation = part.rotationMatrix ? formatMat3(part.rotationMatrix) : emitRotation(part.rotation);
    return `    ${uvRotate ? 'ADD_BOX_ROTATE_UV' : 'ADD_BOX_ROTATE'}(${formatVec3(part.origin)}, ${formatVec3(part.size)}, ${rotation}, ${formatVec3(pivot)}, ${faces}${uvRotate ? `, ${rotationArgs}` : ''})`;
  }

  function emitModelCase(model, modelId, modelScale) {
    validateModel(model);
    if (!Number.isInteger(modelId) || modelId < 0) throw new Error('model ID must be a non-negative integer');
    if (!Number.isFinite(modelScale) || modelScale <= 0) throw new Error('model scale must be positive');
    return [
      `case ${modelId}:`,
      '{',
      `    modelSize /= ${formatNumber(modelScale)};`,
      ...model.parts.map(emitPart),
      '}',
      'break;'
    ].join('\n');
  }

  function assertCemVersion(cemVersion) {
    if (!['1.21.6', '1.21.11', '26.1+'].includes(cemVersion)) throw new Error(`unsupported Minecraft runtime: ${cemVersion}`);
  }

  function exportModel(model, modelId = 1, cemVersion = '1.21.6', options = {}) {
    assertCemVersion(cemVersion);
    const glsl = `// Generated by CEM-S Studio for ${model.name}.\n${emitModelCase(model, modelId, options.modelScale ?? 8)}`;
    return {glsl, manifest: {format: 'cem-s-studio/1', model: model.name, target: `cem-s/${cemVersion}`}};
  }

  function exportModels(entries, baseModelId = 1, cemVersion = '1.21.6') {
    if (!Array.isArray(entries) || !entries.length) throw new Error('at least one model entry is required');
    assertCemVersion(cemVersion);
    const ids = new Set();
    const cases = entries.map(entry => {
      const offset = entry.branch?.modelIdOffset || 0;
      const modelId = baseModelId + offset;
      if (ids.has(modelId)) throw new Error(`duplicate exported model ID: ${modelId}`);
      ids.add(modelId);
      return emitModelCase(entry.model, modelId, entry.branch?.modelScale ?? 8);
    });
    return {
      glsl: `// Generated by CEM-S Studio for ${entries.map(entry => entry.model.name).join(', ')}.\n${cases.join('\n')}`,
      manifest: {format: 'cem-s-studio/2', models: entries.map(entry => entry.model.name), target: `cem-s/${cemVersion}`}
    };
  }

  return {exportModel, exportModels, formatVec3, validateModel};
}));
