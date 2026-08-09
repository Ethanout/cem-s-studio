(function (root, factory) {
  const database = typeof module === 'object' && module.exports ? require('./entity-database.js') : root.CemSEntityDatabase;
  const api = factory(database);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CemSProject = api;
}(typeof globalThis === 'undefined' ? this : globalThis, function (entityDatabase) {
  const CURRENT_VERSION = 1;
  const SUPPORTED_CEM_VERSIONS = {'1.21.6': 63, '1.21.11': 75, '26.1+': 84};
  if (!entityDatabase) throw new Error('CEM-S entity database is required');
  const DETECTION_PRESETS = Object.fromEntries(Object.keys(entityDatabase.ENTITY_PROFILES).map(id => [id, entityDatabase.ENTITY_PROFILES[id].detection]));

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function assertModelId(value) {
    if (!Number.isInteger(value) || value < 0) throw new Error('modelId must be a non-negative integer');
  }

  function detectionForPreset(name) {
    return entityDatabase.detectionFor(name);
  }

  function normalizeDetection(input, fallbackPreset = 'pig') {
    const source = input || {};
    const presetName = source.preset || (source.face ? fallbackPreset : 'custom');
    const detection = detectionForPreset(presetName);
    if (source.pixel) detection.pixel = clone(source.pixel);
    if (source.color) detection.color = clone(source.color);
    if (source.channel !== undefined) detection.channel = source.channel;
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
    if (!Object.prototype.hasOwnProperty.call(SUPPORTED_CEM_VERSIONS, document.project.cemVersion)) throw new Error(`unsupported Minecraft runtime: ${document.project.cemVersion}`);
    if (!document.project.detection || document.project.detection.mode !== 'texture_marker') throw new Error('only texture_marker detection is supported');
    const detection = document.project.detection;
    if (!Array.isArray(detection.pixel) || detection.pixel.length !== 2 || detection.pixel.some((value) => !Number.isInteger(value) || value < 0)) throw new Error('detection.pixel must be a non-negative ivec2');
    if (!Array.isArray(detection.color) || detection.color.length !== 4 || detection.color.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) throw new Error('detection.color must be an RGBA byte color');
    if (!Object.prototype.hasOwnProperty.call(DETECTION_PRESETS, detection.preset)) throw new Error(`unsupported detection preset: ${detection.preset}`);
    if (!['entity', 'armor'].includes(detection.channel)) throw new Error('detection.channel must be entity or armor');
    if (!detection.face || !['vertex_id', 'all'].includes(detection.face.mode)) throw new Error('detection.face.mode must be vertex_id or all');
    if (!Number.isInteger(detection.face.count) || detection.face.count < 1) throw new Error('detection.face.count must be a positive integer');
    if (!Number.isInteger(detection.face.index) || detection.face.index < 0 || detection.face.index >= detection.face.count) throw new Error('detection.face.index must be within the face count');
    if (typeof detection.reverse !== 'boolean') throw new Error('detection.reverse must be boolean');
    if (!['default', 'yx'].includes(detection.corner)) throw new Error('detection.corner must be default or yx');
    if (!Number.isFinite(detection.size) || detection.size <= 0) throw new Error('detection.size must be positive');
    if (typeof detection.hideUnmatched !== 'boolean') throw new Error('detection.hideUnmatched must be boolean');
    if (!['entity', 'armor'].includes(document.project.targetType)) throw new Error('project.targetType must be entity or armor');
    if (document.project.targetType !== detection.channel) throw new Error('project.targetType must match detection.channel');
    const reference = document.project.reference || {rig: 'none', root: null, anchors: {}, bindings: {}, guides: []};
    if (!['none', 'player', 'pig', 'elytra', 'arrow', 'custom'].includes(reference.rig)) throw new Error('project.reference.rig must be none, player, pig, elytra, arrow, or custom');
    if (reference.root !== null && typeof reference.root !== 'string') throw new Error('project.reference.root must be a string or null');
    if (!reference.anchors || typeof reference.anchors !== 'object' || Array.isArray(reference.anchors)) throw new Error('project.reference.anchors must be an object');
    if (reference.bindings !== undefined && (!reference.bindings || typeof reference.bindings !== 'object' || Array.isArray(reference.bindings))) throw new Error('project.reference.bindings must be an object');
    if (reference.guides !== undefined && (!Array.isArray(reference.guides) || reference.guides.some(value => typeof value !== 'string'))) throw new Error('project.reference.guides must be an array of UUIDs');
    document.project.reference = {rig: reference.rig, root: reference.root || null, anchors: clone(reference.anchors), bindings: clone(reference.bindings || {}), guides: clone(reference.guides || [])};
    return document;
  }

  function createProject(options = {}) {
    const name = options.name || 'CEM-S Model';
    const modelId = options.modelId === undefined ? 1 : options.modelId;
    const targetEntity = options.targetEntity || 'pig';
    const inferredPreset = Object.prototype.hasOwnProperty.call(DETECTION_PRESETS, targetEntity) ? targetEntity : 'pig';
    const detection = normalizeDetection(options.detection || {preset: inferredPreset}, inferredPreset);
    const targetType = options.targetType || (detection.channel === 'armor' ? 'armor' : 'entity');
    const cemVersion = options.cemVersion || '1.21.6';
    if (!Object.prototype.hasOwnProperty.call(SUPPORTED_CEM_VERSIONS, cemVersion)) throw new Error(`unsupported Minecraft runtime: ${cemVersion}`);
    assertModelId(modelId);
    return {
      format: 'cemst',
      formatVersion: CURRENT_VERSION,
      project: {
        name,
        modelId,
        cemVersion,
        targetType,
        targetEntity,
        detection,
        reference: options.reference ? clone(options.reference) : {rig: 'none', root: null, anchors: {}, bindings: {}, guides: []},
        resourcePack: {
          name: options.resourcePack?.name || options.packName || `${name} Pack`,
          description: options.resourcePack?.description || options.packDescription || `CEM-S Studio resource pack for ${name}`,
          packFormat: options.resourcePack?.packFormat || options.packFormat || SUPPORTED_CEM_VERSIONS[cemVersion]
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
    if (document?.project && !document.project.cemVersion) document.project.cemVersion = '1.21.6';
    if (document?.project?.detection) document.project.detection = normalizeDetection(document.project.detection, 'custom');
    return clone(validateProject(document));
  }

  return {CURRENT_VERSION, SUPPORTED_CEM_VERSIONS: clone(SUPPORTED_CEM_VERSIONS), DETECTION_PRESETS: clone(DETECTION_PRESETS), detectionForPreset, createProject, serializeProject, parseProject, validateProject};
}));
