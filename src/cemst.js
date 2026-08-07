(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CemSProject = api;
}(typeof globalThis === 'undefined' ? this : globalThis, function () {
  const CURRENT_VERSION = 1;
  const DETECTION_PRESETS = {
    pig: {pixel: [63, 0], color: [255, 0, 0, 255], face: {mode: 'vertex_id', count: 42, index: 3}, reverse: true, corner: 'default', size: 1, hideUnmatched: false},
    cold_pig: {pixel: [63, 0], color: [3, 0, 0, 255], face: {mode: 'vertex_id', count: 84, index: 3}, reverse: true, corner: 'default', size: 1, hideUnmatched: false},
    arrow: {pixel: [31, 0], color: [0, 0, 1, 255], face: {mode: 'vertex_id', count: 9, index: 0}, reverse: true, corner: 'yx', size: 1.5, hideUnmatched: true},
    sheep: {pixel: [63, 0], color: [2, 0, 0, 255], face: {mode: 'all', count: 1, index: 0}, reverse: false, corner: 'default', size: 1.2, hideUnmatched: false},
    custom: {pixel: [63, 0], color: [0, 0, 1, 255], face: {mode: 'vertex_id', count: 1, index: 0}, reverse: false, corner: 'yx', size: 1, hideUnmatched: false}
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function assertModelId(value) {
    if (!Number.isInteger(value) || value < 0) throw new Error('modelId must be a non-negative integer');
  }

  function detectionForPreset(name) {
    if (!Object.prototype.hasOwnProperty.call(DETECTION_PRESETS, name)) throw new Error(`unsupported detection preset: ${name}`);
    return {preset: name, ...clone(DETECTION_PRESETS[name])};
  }

  function normalizeDetection(input, fallbackPreset = 'pig') {
    const source = input || {};
    const presetName = source.preset || (source.face ? fallbackPreset : 'custom');
    const detection = detectionForPreset(presetName);
    if (source.pixel) detection.pixel = clone(source.pixel);
    if (source.color) detection.color = clone(source.color);
    if (source.face) detection.face = Object.assign({}, detection.face, clone(source.face));
    if (source.reverse !== undefined) detection.reverse = source.reverse;
    if (source.corner !== undefined) detection.corner = source.corner;
    if (source.size !== undefined) detection.size = source.size;
    if (source.hideUnmatched !== undefined) detection.hideUnmatched = source.hideUnmatched;
    detection.mode = 'texture_marker';
    return detection;
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
    if (!Object.prototype.hasOwnProperty.call(DETECTION_PRESETS, detection.preset)) throw new Error(`unsupported detection preset: ${detection.preset}`);
    if (!detection.face || !['vertex_id', 'all'].includes(detection.face.mode)) throw new Error('detection.face.mode must be vertex_id or all');
    if (!Number.isInteger(detection.face.count) || detection.face.count < 1) throw new Error('detection.face.count must be a positive integer');
    if (!Number.isInteger(detection.face.index) || detection.face.index < 0 || detection.face.index >= detection.face.count) throw new Error('detection.face.index must be within the face count');
    if (typeof detection.reverse !== 'boolean') throw new Error('detection.reverse must be boolean');
    if (!['default', 'yx'].includes(detection.corner)) throw new Error('detection.corner must be default or yx');
    if (!Number.isFinite(detection.size) || detection.size <= 0) throw new Error('detection.size must be positive');
    if (typeof detection.hideUnmatched !== 'boolean') throw new Error('detection.hideUnmatched must be boolean');
    return document;
  }

  function createProject(options = {}) {
    const name = options.name || 'CEM-S Model';
    const modelId = options.modelId === undefined ? 1 : options.modelId;
    const targetEntity = options.targetEntity || 'pig';
    const inferredPreset = Object.prototype.hasOwnProperty.call(DETECTION_PRESETS, targetEntity) ? targetEntity : 'pig';
    const detection = normalizeDetection(options.detection || {preset: inferredPreset}, inferredPreset);
    assertModelId(modelId);
    return {
      format: 'cemst',
      formatVersion: CURRENT_VERSION,
      project: {
        name,
        modelId,
        cemVersion: options.cemVersion || '1.21.6',
        targetType: options.targetType || 'entity',
        targetEntity,
        detection,
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
    if (document?.project?.detection) document.project.detection = normalizeDetection(document.project.detection, 'custom');
    return clone(validateProject(document));
  }

  return {CURRENT_VERSION, DETECTION_PRESETS: clone(DETECTION_PRESETS), detectionForPreset, createProject, serializeProject, parseProject, validateProject};
}));
