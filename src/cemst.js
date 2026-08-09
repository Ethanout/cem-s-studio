(function (root, factory) {
  const database = typeof module === 'object' && module.exports ? require('./entity-database.js') : root.CemSEntityDatabase;
  const api = factory(database);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CemSProject = api;
}(typeof globalThis === 'undefined' ? this : globalThis, function (entityDatabase) {
  const CURRENT_VERSION = 3;
  const LEGACY_VERSION = 2;
  const SUPPORTED_CEM_VERSIONS = {'1.21.6': 63, '1.21.11': 75, '26.1+': 84};
  if (!entityDatabase) throw new Error('CEM-S entity database is required');
  const DETECTION_PRESETS = Object.fromEntries(Object.keys(entityDatabase.ENTITY_PROFILES).map(id => [id, entityDatabase.ENTITY_PROFILES[id].detection]));

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function assertModelId(value) {
    if (!Number.isInteger(value) || value < 0) throw new Error('modelId must be a non-negative integer');
  }

  function assertWorkspaceId(value) {
    if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(value)) throw new Error('workspace model id must be a lowercase identifier');
  }

  function detectionForPreset(name, version = '1.21.6') {
    return entityDatabase.detectionFor(name, version);
  }

  function normalizeDetectionBranch(input, fallback, index) {
    const source = input || {};
    const legacyFace = source.face || fallback.face || {mode: 'vertex_id', count: 1, index: 0};
    const match = clone(source.match || legacyFace);
    return {
      id: source.id || (index === 0 ? 'main' : `part_${index + 1}`),
      anchor: source.anchor === undefined ? null : source.anchor,
      modelIdOffset: source.modelIdOffset === undefined ? index : source.modelIdOffset,
      match,
      reverse: source.reverse === undefined ? fallback.reverse : source.reverse,
      corner: source.corner === undefined ? fallback.corner : source.corner,
      size: source.size === undefined ? fallback.size : source.size,
      modelScale: source.modelScale === undefined ? (fallback.modelScale || 8) : source.modelScale
    };
  }

  function normalizeDetection(input, fallbackPreset = 'pig', version = '1.21.6') {
    const source = input || {};
    const presetName = source.preset || (source.face ? fallbackPreset : 'custom');
    const detection = detectionForPreset(presetName, version);
    if (source.pixel) detection.pixel = clone(source.pixel);
    if (source.color) detection.color = clone(source.color);
    if (source.channel !== undefined) detection.channel = source.channel;
    const presetBranch = Array.isArray(detection.branches) ? detection.branches[0] : {};
    const fallbackBranch = {
      face: source.face || detection.face || presetBranch.match,
      reverse: source.reverse === undefined ? (detection.reverse === undefined ? presetBranch.reverse : detection.reverse) : source.reverse,
      corner: source.corner === undefined ? (detection.corner === undefined ? presetBranch.corner : detection.corner) : source.corner,
      size: source.size === undefined ? (detection.size === undefined ? presetBranch.size : detection.size) : source.size,
      modelScale: presetBranch.modelScale || 8
    };
    const usesLegacyBranch = source.face || source.reverse !== undefined || source.corner !== undefined || source.size !== undefined;
    const branchSources = Array.isArray(source.branches) && source.branches.length
      ? source.branches
      : (!usesLegacyBranch && Array.isArray(detection.branches) && detection.branches.length ? detection.branches : [fallbackBranch]);
    detection.branches = branchSources.map((branch, index) => normalizeDetectionBranch(branch, fallbackBranch, index));
    delete detection.face;
    delete detection.reverse;
    delete detection.corner;
    delete detection.size;
    if (source.hideUnmatched !== undefined) detection.hideUnmatched = source.hideUnmatched;
    detection.mode = 'texture_marker';
    return detection;
  }

  function validateProject(document) {
    if (!document || document.format !== 'cemst') throw new Error('not a CEM-S Studio project');
    if (![LEGACY_VERSION, CURRENT_VERSION].includes(document.formatVersion)) throw new Error(`unsupported cemst format version: ${document.formatVersion}`);
    if (!document.project || typeof document.project.name !== 'string' || !document.project.name.trim()) throw new Error('project.name is required');
    assertModelId(document.project.modelId);
    if (!Object.prototype.hasOwnProperty.call(SUPPORTED_CEM_VERSIONS, document.project.cemVersion)) throw new Error(`unsupported Minecraft runtime: ${document.project.cemVersion}`);
    if (!document.project.detection || document.project.detection.mode !== 'texture_marker') throw new Error('only texture_marker detection is supported');
    const detection = document.project.detection;
    if (!Array.isArray(detection.pixel) || detection.pixel.length !== 2 || detection.pixel.some((value) => !Number.isInteger(value) || value < 0)) throw new Error('detection.pixel must be a non-negative ivec2');
    if (!Array.isArray(detection.color) || detection.color.length !== 4 || detection.color.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) throw new Error('detection.color must be an RGBA byte color');
    if (!Object.prototype.hasOwnProperty.call(DETECTION_PRESETS, detection.preset)) throw new Error(`unsupported detection preset: ${detection.preset}`);
    entityDatabase.profileFor(detection.preset, document.project.cemVersion);
    if (!['entity', 'armor'].includes(detection.channel)) throw new Error('detection.channel must be entity or armor');
    if (!Array.isArray(detection.branches) || !detection.branches.length) throw new Error('detection.branches must contain at least one branch');
    const branchIds = new Set();
    const modelIdOffsets = new Set();
    const branchAnchors = new Set();
    detection.branches.forEach((branch, index) => {
      const label = `detection.branches[${index}]`;
      if (!branch || typeof branch.id !== 'string' || !/^[a-z0-9_]+$/.test(branch.id)) throw new Error(`${label}.id must be a lowercase identifier`);
      if (branchIds.has(branch.id)) throw new Error(`duplicate detection branch id: ${branch.id}`);
      branchIds.add(branch.id);
      if (branch.anchor !== null && (typeof branch.anchor !== 'string' || !branch.anchor)) throw new Error(`${label}.anchor must be a string or null`);
      if (branch.anchor !== null && branchAnchors.has(branch.anchor)) throw new Error(`duplicate detection branch anchor: ${branch.anchor}`);
      if (branch.anchor !== null) branchAnchors.add(branch.anchor);
      if (!Number.isInteger(branch.modelIdOffset) || branch.modelIdOffset < 0) throw new Error(`${label}.modelIdOffset must be a non-negative integer`);
      if (modelIdOffsets.has(branch.modelIdOffset)) throw new Error(`duplicate detection modelIdOffset: ${branch.modelIdOffset}`);
      modelIdOffsets.add(branch.modelIdOffset);
      if (!branch.match || !['vertex_id', 'all', 'uv'].includes(branch.match.mode)) throw new Error(`${label}.match.mode must be vertex_id, all, or uv`);
      if (branch.match.mode === 'all' && detection.branches.length > 1) throw new Error(`${label}.match.mode all cannot be combined with other branches`);
      if (branch.match.mode === 'vertex_id') {
        if (!Number.isInteger(branch.match.count) || branch.match.count < 1) throw new Error(`${label}.match.count must be a positive integer`);
        if (!Number.isInteger(branch.match.index) || branch.match.index < 0 || branch.match.index >= branch.match.count) throw new Error(`${label}.match.index must be within the face count`);
      }
      if (branch.match.mode === 'uv') {
        if (!['corners', 'corners2'].includes(branch.match.cornerSet)) throw new Error(`${label}.match.cornerSet must be corners or corners2`);
        if (!Number.isInteger(branch.match.cornerOffset)) throw new Error(`${label}.match.cornerOffset must be an integer`);
        for (const property of ['scale', 'offset']) {
          if (!Array.isArray(branch.match[property]) || branch.match[property].length !== 2 || branch.match[property].some(value => !Number.isFinite(value))) throw new Error(`${label}.match.${property} must be a finite vec2`);
        }
      }
      if (typeof branch.reverse !== 'boolean') throw new Error(`${label}.reverse must be boolean`);
      if (!['default', 'yx'].includes(branch.corner)) throw new Error(`${label}.corner must be default or yx`);
      if (!Number.isFinite(branch.size) || branch.size <= 0) throw new Error(`${label}.size must be positive`);
      if (!Number.isFinite(branch.modelScale) || branch.modelScale <= 0) throw new Error(`${label}.modelScale must be positive`);
    });
    if (typeof detection.hideUnmatched !== 'boolean') throw new Error('detection.hideUnmatched must be boolean');
    if (!['entity', 'armor'].includes(document.project.targetType)) throw new Error('project.targetType must be entity or armor');
    if (document.project.targetType !== detection.channel) throw new Error('project.targetType must match detection.channel');
    if (document.project.referenceRig !== undefined && !['none', 'player', 'pig', 'elytra', 'arrow', 'armor_stand', 'custom'].includes(document.project.referenceRig)) throw new Error('project.referenceRig is unsupported');
    if (document.project.texturePath !== null && document.project.texturePath !== undefined && (typeof document.project.texturePath !== 'string' || !document.project.texturePath.startsWith('assets/') || !document.project.texturePath.endsWith('.png'))) throw new Error('project.texturePath must be an assets PNG path or null');
    const reference = document.project.reference || {rig: 'none', root: null, anchors: {}, bindings: {}, transforms: {}, guides: []};
    if (!['none', 'player', 'pig', 'elytra', 'arrow', 'armor_stand', 'custom'].includes(reference.rig)) throw new Error('project.reference.rig is unsupported');
    if (reference.root !== null && typeof reference.root !== 'string') throw new Error('project.reference.root must be a string or null');
    if (!reference.anchors || typeof reference.anchors !== 'object' || Array.isArray(reference.anchors)) throw new Error('project.reference.anchors must be an object');
    if (reference.bindings !== undefined && (!reference.bindings || typeof reference.bindings !== 'object' || Array.isArray(reference.bindings))) throw new Error('project.reference.bindings must be an object');
    for (const [element, anchor] of Object.entries(reference.bindings || {})) {
      if (!element || typeof anchor !== 'string' || !Object.prototype.hasOwnProperty.call(reference.anchors, anchor)) throw new Error(`project.reference.bindings contains an unknown anchor: ${anchor}`);
    }
    if (reference.transforms !== undefined && (!reference.transforms || typeof reference.transforms !== 'object' || Array.isArray(reference.transforms))) throw new Error('project.reference.transforms must be an object');
    for (const [element, transform] of Object.entries(reference.transforms || {})) {
      if (!Object.prototype.hasOwnProperty.call(reference.bindings || {}, element) || !transform || typeof transform !== 'object') throw new Error(`project.reference.transforms contains an unknown binding: ${element}`);
      for (const property of ['position', 'rotation', 'scale']) {
        if (!Array.isArray(transform[property]) || transform[property].length !== 3 || transform[property].some(value => !Number.isFinite(value))) throw new Error(`project.reference.transforms.${element}.${property} must be a finite vec3`);
      }
      if (transform.scale.some(value => value === 0)) throw new Error(`project.reference.transforms.${element}.scale cannot contain zero`);
    }
    if (reference.guides !== undefined && (!Array.isArray(reference.guides) || reference.guides.some(value => typeof value !== 'string'))) throw new Error('project.reference.guides must be an array of UUIDs');
    document.project.reference = {rig: reference.rig, root: reference.root || null, anchors: clone(reference.anchors), bindings: clone(reference.bindings || {}), transforms: clone(reference.transforms || {}), guides: clone(reference.guides || [])};
    if (document.formatVersion === CURRENT_VERSION) validateWorkspace(document);
    return document;
  }

  function validateWorkspace(document) {
    const workspace = document.workspace;
    if (!workspace || workspace.version !== 1) throw new Error('workspace.version must be 1');
    if (!Array.isArray(workspace.models) || workspace.models.length < 1) throw new Error('workspace.models must contain at least one model');
    assertWorkspaceId(workspace.activeModel);
    const ids = new Set();
    const modelIds = new Set();
    for (const [index, model] of workspace.models.entries()) {
      if (!model || typeof model !== 'object') throw new Error(`workspace.models[${index}] must be an object`);
      assertWorkspaceId(model.id);
      if (ids.has(model.id)) throw new Error(`duplicate workspace model id: ${model.id}`);
      ids.add(model.id);
      if (!model.project || !model.blockbench) throw new Error(`workspace.models[${index}] must contain project and blockbench`);
      assertModelId(model.project.modelId);
      if (modelIds.has(model.project.modelId)) throw new Error(`duplicate workspace modelId: ${model.project.modelId}`);
      modelIds.add(model.project.modelId);
      validateProject({format: 'cemst', formatVersion: LEGACY_VERSION, project: model.project, blockbench: model.blockbench});
    }
    if (!ids.has(workspace.activeModel)) throw new Error(`workspace.activeModel does not exist: ${workspace.activeModel}`);
    const active = workspace.models.find(model => model.id === workspace.activeModel);
    if (active.project.modelId !== document.project.modelId) throw new Error('workspace.activeModel must match project.modelId');
  }

  function workspaceEntry(document, id) {
    return {id, project: clone(document.project), blockbench: clone(document.blockbench)};
  }

  function createProject(options = {}) {
    const name = options.name || 'CEM-S Model';
    const modelId = options.modelId === undefined ? 1 : options.modelId;
    const targetEntity = options.targetEntity || 'pig';
    const cemVersion = options.cemVersion || '1.21.6';
    if (!Object.prototype.hasOwnProperty.call(SUPPORTED_CEM_VERSIONS, cemVersion)) throw new Error(`unsupported Minecraft runtime: ${cemVersion}`);
    const inferredPreset = Object.prototype.hasOwnProperty.call(DETECTION_PRESETS, targetEntity) ? targetEntity : 'pig';
    const detection = normalizeDetection(options.detection || {preset: inferredPreset}, inferredPreset, cemVersion);
    const targetType = options.targetType || (detection.channel === 'armor' ? 'armor' : 'entity');
    const texturePath = options.texturePath || null;
    if (texturePath !== null && (typeof texturePath !== 'string' || !texturePath.startsWith('assets/') || !texturePath.endsWith('.png'))) throw new Error('project.texturePath must be an assets PNG path or null');
    assertModelId(modelId);
    return {
      format: 'cemst',
      formatVersion: LEGACY_VERSION,
      project: {
        name,
        modelId,
        cemVersion,
        targetType,
        targetEntity,
        referenceRig: options.referenceRig || (entityDatabase.profileFor(inferredPreset, cemVersion).referenceRig || 'none'),
        texturePath,
        detection,
        reference: options.reference ? clone(options.reference) : {rig: 'none', root: null, anchors: {}, bindings: {}, transforms: {}, guides: []},
        resourcePack: {
          name: options.resourcePack?.name || options.packName || `${name} Pack`,
          description: options.resourcePack?.description || options.packDescription || `CEM-S Studio resource pack for ${name}`,
          packFormat: options.resourcePack?.packFormat || options.packFormat || SUPPORTED_CEM_VERSIONS[cemVersion]
        }
      },
      blockbench: options.blockbench || {meta: {model_format: 'cem_s_studio'}, outliner: []}
    };
  }

  function createWorkspace(models, options = {}) {
    if (!Array.isArray(models) || !models.length) throw new Error('workspace requires at least one model');
    const documents = models.map(model => model?.format === 'cemst' ? parseProject(model) : createProject(model));
    const ids = new Set();
    const entries = documents.map((document, index) => {
      const requested = options.modelIds?.[index] || document.project.workspaceId || document.project.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || `model_${index + 1}`;
      let id = requested;
      let suffix = 2;
      while (ids.has(id)) id = `${requested}_${suffix++}`;
      assertWorkspaceId(id);
      ids.add(id);
      return workspaceEntry(document, id);
    });
    const activeModel = options.activeModel || entries[0].id;
    if (!ids.has(activeModel)) throw new Error(`workspace.activeModel does not exist: ${activeModel}`);
    const active = entries.find(model => model.id === activeModel);
    return {
      format: 'cemst',
      formatVersion: CURRENT_VERSION,
      workspace: {version: 1, activeModel, models: entries},
      project: clone(active.project),
      blockbench: clone(active.blockbench)
    };
  }

  function serializeProject(document) {
    const normalized = clone(document);
    if (normalized.formatVersion === CURRENT_VERSION && normalized.workspace) {
      const active = normalized.workspace.models.find(model => model.id === normalized.workspace.activeModel);
      if (!active) throw new Error(`workspace.activeModel does not exist: ${normalized.workspace.activeModel}`);
      active.project = clone(normalized.project);
      active.blockbench = clone(normalized.blockbench);
    }
    validateProject(normalized);
    return JSON.stringify(normalized, null, 2);
  }

  function parseProject(content) {
    const document = typeof content === 'string' ? JSON.parse(content) : clone(content);
    if (document?.format === 'cemst' && document.formatVersion === 1) document.formatVersion = LEGACY_VERSION;
    if (document?.format === 'cemst' && document.formatVersion === CURRENT_VERSION && document.workspace) {
      const active = document.workspace.models?.find(model => model.id === document.workspace.activeModel);
      if (!active) throw new Error(`workspace.activeModel does not exist: ${document.workspace.activeModel}`);
      document.project = clone(active.project);
      document.blockbench = clone(active.blockbench);
    }
    if (document?.project && !document.project.cemVersion) document.project.cemVersion = '1.21.6';
    if (document?.project?.detection) document.project.detection = normalizeDetection(document.project.detection, 'custom', document.project.cemVersion || '1.21.6');
    return clone(validateProject(document));
  }

  return {CURRENT_VERSION, SUPPORTED_CEM_VERSIONS: clone(SUPPORTED_CEM_VERSIONS), DETECTION_PRESETS: clone(DETECTION_PRESETS), detectionForPreset, createProject, createWorkspace, serializeProject, parseProject, validateProject, validateWorkspace};
}));
