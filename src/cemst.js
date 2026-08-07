(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CemSProject = api;
}(typeof globalThis === 'undefined' ? this : globalThis, function () {
  const CURRENT_VERSION = 1;
  const DEFAULT_PIXEL = [63, 0];
  const DEFAULT_COLOR = [0, 0, 1, 255];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function assertModelId(value) {
    if (!Number.isInteger(value) || value < 0) throw new Error('modelId must be a non-negative integer');
  }

  function validateProject(document) {
    if (!document || document.format !== 'cemst') throw new Error('not a CEM-S Studio project');
    if (document.formatVersion !== CURRENT_VERSION) throw new Error(`unsupported cemst format version: ${document.formatVersion}`);
    if (!document.project || typeof document.project.name !== 'string' || !document.project.name.trim()) throw new Error('project.name is required');
    assertModelId(document.project.modelId);
    if (!document.project.detection || document.project.detection.mode !== 'texture_marker') throw new Error('only texture_marker detection is supported');
    const detection = document.project.detection;
    if (!Array.isArray(detection.pixel) || detection.pixel.length !== 2 || detection.pixel.some((value) => !Number.isInteger(value) || value < 0)) throw new Error('detection.pixel must be a non-negative ivec2');
    if (!Array.isArray(detection.color) || detection.color.length !== 4 || detection.color.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) throw new Error('detection.color must be an RGBA byte color');
    return document;
  }

  function createProject(options = {}) {
    const name = options.name || 'CEM-S Model';
    const modelId = options.modelId === undefined ? 1 : options.modelId;
    assertModelId(modelId);
    return {
      format: 'cemst',
      formatVersion: CURRENT_VERSION,
      project: {
        name,
        modelId,
        cemVersion: options.cemVersion || '1.21.6',
        targetType: options.targetType || 'entity',
        targetEntity: options.targetEntity || 'entity',
        detection: {
          mode: 'texture_marker',
          pixel: clone(options.detection?.pixel || DEFAULT_PIXEL),
          color: clone(options.detection?.color || DEFAULT_COLOR)
        },
        resourcePack: {
          name: options.resourcePack?.name || options.packName || `${name} Pack`,
          description: options.resourcePack?.description || options.packDescription || `CEM-S Studio resource pack for ${name}`,
          packFormat: options.resourcePack?.packFormat || options.packFormat || 63
        }
      },
      blockbench: options.blockbench || {meta: {model_format: 'cem_s_studio'}, outliner: []}
    };
  }

  function serializeProject(document) {
    validateProject(document);
    return JSON.stringify(document, null, 2);
  }

  function parseProject(content) {
    const document = typeof content === 'string' ? JSON.parse(content) : clone(content);
    return clone(validateProject(document));
  }

  return {CURRENT_VERSION, createProject, serializeProject, parseProject, validateProject};
}));
