(function () {
  const {exportModel} = CemSExporter;
  const {toCemModel, isReferenceCube} = CemSBlockbenchAdapter;
  const {createProject, parseProject, serializeProject, detectionForPreset} = CemSProject;
  const {REFERENCE_PREFIX, REFERENCE_CUBE_PREFIX, anchorsFor, guidesFor, isReferenceGroup} = CemSReferenceRigs;
  const {slugify, buildPackFiles, mergePackFiles} = CemSPackBuilder;
  const {loadRuntimeFiles} = CemSRuntime;
  let exportAction;
  let exportDialog;
  let settingsAction;
  let settingsDialog;
  let buildAction;
  let buildDialog;
  let projectFormat;
  let projectCodec;
  let saveAction;
  let baseProjectCodec;
  let addReferenceAction;
  let importReferenceAction;
  let registerReferenceAction;
  let bindReferenceAction;

  function defaultSettings() {
    return createProject({name: Project?.name || 'CEM-S Model'}).project;
  }

  function getSettings() {
    return Project.cem_studio ? JSON.parse(JSON.stringify(Project.cem_studio)) : defaultSettings();
  }

  function currentDocument() {
    const blockbench = baseProjectCodec.compile({raw: true});
    blockbench.meta = Object.assign({}, blockbench.meta, {model_format: 'cem_s_studio'});
    const settings = getSettings();
    return createProject({...settings, name: Project.name || settings.name, blockbench});
  }

  function setSettings(result) {
    const current = getSettings();
    const presetName = result.detection_preset;
    const detection = presetName === 'custom' ? {
      preset: 'custom',
      channel: result.render_target,
      mode: 'texture_marker',
      pixel: [Number(result.marker_x), Number(result.marker_y)],
      color: [result.marker_r, result.marker_g, result.marker_b, result.marker_a].map(Number),
      face: {mode: 'vertex_id', count: Number(result.face_count), index: Number(result.face_number)},
      reverse: !!result.reverse,
      corner: result.corner_yx ? 'yx' : 'default',
      size: Number(result.cem_size),
      hideUnmatched: !!result.hide_unmatched
    } : detectionForPreset(presetName);
    const next = createProject({
      ...current,
      name: result.project_name,
      modelId: Number(result.model_id),
      targetEntity: presetName === 'custom' ? result.target_entity : presetName,
      targetType: presetName === 'custom' ? result.render_target : detection.channel,
      detection,
      resourcePack: {name: result.pack_name, description: result.pack_description, packFormat: current.resourcePack.packFormat}
    }).project;
    Project.cem_studio = next;
    Project.name = next.name;
    Project.saved = false;
  }

  function showProjectSettings() {
    const settings = getSettings();
    settingsDialog = new Dialog({
      id: 'cem_s_studio_settings',
      title: 'CEM-S Studio Project Settings',
      form: {
        project_name: {label: 'Project name', type: 'text', value: settings.name},
        model_id: {label: 'Model ID', description: 'This ID must match the generated detection rule.', type: 'number', value: settings.modelId, min: 0, step: 1},
        target_entity: {label: 'Target entity', description: 'Minecraft entity identifier, for example pig.', type: 'text', value: settings.targetEntity},
        render_target: {label: 'Render target', description: 'Entity for mobs and attachments; Armor for equipment and elytra.', type: 'select', options: {entity: 'Entity / Mob', armor: 'Armor / Equipment'}, value: settings.targetType},
        detection_preset: {label: 'Detection preset', description: 'Presets configure the CEM-S anchor face automatically.', type: 'select', options: {pig: 'Pig', cold_pig: 'Cold Pig', arrow: 'Arrow', sheep: 'Sheep', elytra: 'Elytra / Wings', custom: 'Custom'}, value: settings.detection.preset},
        marker_x: {label: 'Marker pixel X', type: 'number', value: settings.detection.pixel[0], min: 0, step: 1},
        marker_y: {label: 'Marker pixel Y', type: 'number', value: settings.detection.pixel[1], min: 0, step: 1},
        marker_r: {label: 'Marker red', type: 'number', value: settings.detection.color[0], min: 0, max: 255, step: 1},
        marker_g: {label: 'Marker green', type: 'number', value: settings.detection.color[1], min: 0, max: 255, step: 1},
        marker_b: {label: 'Marker blue', type: 'number', value: settings.detection.color[2], min: 0, max: 255, step: 1},
        marker_a: {label: 'Marker alpha', type: 'number', value: settings.detection.color[3], min: 0, max: 255, step: 1},
        face_count: {label: 'Faces per entity', description: 'Custom preset: usually the vanilla model cube count multiplied by 6.', type: 'number', value: settings.detection.face.count, min: 1, step: 1},
        face_number: {label: 'Anchor face', description: 'Custom preset: zero-based face index used as the CEM-S anchor.', type: 'number', value: settings.detection.face.index, min: 0, step: 1},
        reverse: {label: 'Reverse model axes', type: 'checkbox', value: settings.detection.reverse},
        corner_yx: {label: 'Transpose anchor corners', type: 'checkbox', value: settings.detection.corner === 'yx'},
        cem_size: {label: 'CEM area size', type: 'number', value: settings.detection.size, min: 0.01, step: 0.1},
        hide_unmatched: {label: 'Hide unmatched vanilla faces', type: 'checkbox', value: settings.detection.hideUnmatched},
        pack_name: {label: 'Resource pack name', type: 'text', value: settings.resourcePack.name},
        pack_description: {label: 'Resource pack description', type: 'text', value: settings.resourcePack.description}
      },
      onConfirm(result) {
        settingsDialog.hide();
        try {
          setSettings(result);
          Blockbench.showQuickMessage('CEM-S Studio: project settings updated.');
        } catch (error) {
          Blockbench.showMessageBox({title: 'CEM-S Studio settings failed', message: error.message});
        }
      }
    });
    settingsDialog.show();
  }

  function findGroupByReference(reference) {
    return (Group.all || []).find(group => group.uuid === reference || group.name === reference);
  }

  function selectedGroup() {
    const group = Array.isArray(Group.selected) ? Group.selected[0] : Group.selected;
    if (group) return group;
    return (Outliner.selected || []).find(item => item && item.type === 'group') || null;
  }

  function addPlayerReference() {
    const settings = getSettings();
    const existing = settings.reference?.root && findGroupByReference(settings.reference.root);
    if (existing) {
      existing.select?.();
      Blockbench.showQuickMessage('CEM-S Studio: this project already has a Player Reference model.');
      return;
    }
    const anchors = anchorsFor('player');
    const guides = guidesFor('player');
    Undo.initEdit({outliner: true, elements: []});
    const root = new Group({name: `${REFERENCE_PREFIX} / Player`, origin: [0, 0, 0]}).init();
    const anchorNames = {};
    const created = [];
    for (const [anchorName, spec] of Object.entries(anchors)) {
      const group = new Group({name: `${REFERENCE_PREFIX} / ${anchorName}`, origin: spec.origin.slice()}).addTo(root).init();
      anchorNames[anchorName] = group.uuid || group.name;
      const guide = guides[anchorName];
      if (guide) {
        const cube = new Cube({
          name: `${REFERENCE_CUBE_PREFIX} ${anchorName}`,
          from: guide.from.slice(),
          to: guide.to.slice(),
          origin: guide.origin.slice(),
          locked: true
        }).addTo(group).init();
        created.push(cube);
      }
    }
    Project.cem_studio = Object.assign({}, settings, {reference: {rig: 'player', root: root.uuid || root.name, anchors: anchorNames, bindings: {}, guides: created.map(cube => cube.uuid).filter(Boolean)}});
    Project.saved = false;
    Undo.finishEdit('Add CEM-S Player Reference', {outliner: true, elements: created});
    root.select?.();
    Blockbench.showQuickMessage('CEM-S Studio: Player Reference added. Bind custom groups to its anchors.');
  }

  function isInsideGroup(element, root) {
    let parent = element;
    while (parent) {
      if (parent === root) return true;
      parent = parent.parent;
    }
    return false;
  }

  function registerSelectedReference() {
    const root = selectedGroup();
    if (!root) {
      Blockbench.showMessageBox({title: 'CEM-S Studio reference', message: 'Import or create a reference model, then select its root Group in the Outliner.'});
      return;
    }
    const groups = (Group.all || []).filter(group => isInsideGroup(group, root));
    const guides = (Cube.all || []).filter(cube => isInsideGroup(cube, root));
    if (!guides.length) {
      Blockbench.showMessageBox({title: 'CEM-S Studio reference', message: 'The selected reference Group does not contain any cubes.'});
      return;
    }
    const anchors = {};
    for (const group of groups) {
      const base = slugify(group.name || 'anchor');
      let key = base;
      let suffix = 2;
      while (Object.prototype.hasOwnProperty.call(anchors, key)) key = `${base}_${suffix++}`;
      anchors[key] = group.uuid || group.name;
    }
    const settings = getSettings();
    Project.cem_studio = Object.assign({}, settings, {
      reference: {
        rig: 'custom',
        root: root.uuid || root.name,
        anchors,
        bindings: {},
        guides: guides.map(cube => cube.uuid).filter(Boolean)
      }
    });
    Project.saved = false;
    Blockbench.showQuickMessage(`CEM-S Studio: registered ${root.name} with ${Object.keys(anchors).length} anchors.`);
  }

  function importReferenceModel() {
    if (!Blockbench.import) {
      Blockbench.showMessageBox({title: 'CEM-S Studio reference', message: 'This Blockbench version does not provide a model file picker.'});
      return;
    }
    Blockbench.import({extensions: ['bbmodel'], type: 'Blockbench Model', multiple: false}, files => {
      const file = Array.isArray(files) ? files[0] : files;
      if (!file) return;
      try {
        const data = typeof file.content === 'string' ? JSON.parse(file.content) : file.content;
        const sourceName = String(file.name || file.path || 'Vanilla Reference').replace(/\\.bbmodel$/i, '');
        const root = new Group({name: `${REFERENCE_PREFIX} / ${sourceName}`}).init();
        const elements = new Map((Array.isArray(data.elements) ? data.elements : []).map(element => [element.uuid, element]));
        const createdGuides = [];
        const createdGroups = new Map();
        const makeGroup = (element, parent) => {
          const group = new Group({
            name: element.name || 'anchor',
            origin: Array.isArray(element.origin) ? element.origin.slice() : [0, 0, 0],
            rotation: Array.isArray(element.rotation) ? element.rotation.slice() : [0, 0, 0]
          }).addTo(parent).init();
          createdGroups.set(element.uuid, group);
          return group;
        };
        const makeCube = (element, parent) => {
          const cube = new Cube({
            name: `${REFERENCE_CUBE_PREFIX} ${element.name || 'guide'}`,
            from: Array.isArray(element.from) ? element.from.slice() : [0, 0, 0],
            to: Array.isArray(element.to) ? element.to.slice() : [0, 0, 0],
            origin: Array.isArray(element.origin) ? element.origin.slice() : undefined,
            rotation: Array.isArray(element.rotation) ? element.rotation.slice() : [0, 0, 0],
            locked: true
          }).addTo(parent).init();
          createdGuides.push(cube);
          return cube;
        };
        const visit = (id, parent) => {
          const element = elements.get(id);
          if (!element) return;
          const target = Array.isArray(element.children) ? makeGroup(element, parent) : makeCube(element, parent);
          if (Array.isArray(element.children)) element.children.forEach(child => visit(child, target));
        };
        const roots = Array.isArray(data.outliner) ? data.outliner : [];
        roots.forEach(id => visit(typeof id === 'string' ? id : id?.uuid, root));
        if (!createdGuides.length) {
          root.remove?.();
          throw new Error('The selected model contains no cubes to use as a reference.');
        }
        const anchors = {};
        for (const group of createdGroups.values()) {
          const base = slugify(group.name || 'anchor');
          let key = base;
          let suffix = 2;
          while (Object.prototype.hasOwnProperty.call(anchors, key)) key = `${base}_${suffix++}`;
          anchors[key] = group.uuid || group.name;
        }
        const settings = getSettings();
        Project.cem_studio = Object.assign({}, settings, {
          reference: {rig: 'custom', root: root.uuid || root.name, anchors, bindings: {}, guides: createdGuides.map(cube => cube.uuid).filter(Boolean)}
        });
        Project.saved = false;
        root.select?.();
        Blockbench.showQuickMessage(`CEM-S Studio: imported ${sourceName} as a reference model.`);
      } catch (error) {
        Blockbench.showMessageBox({title: 'CEM-S Studio reference import failed', message: error.message});
      }
    });
  }

  function showBindReferenceDialog() {
    const group = selectedGroup();
    if (!group || isReferenceGroup(group)) {
      Blockbench.showMessageBox({title: 'CEM-S Studio binding', message: 'Select a custom Group in the Outliner before binding it. Reference groups cannot be bound.'});
      return;
    }
    const settings = getSettings();
    const reference = settings.reference;
    if (!reference || reference.rig === 'none' || !reference.root) {
      Blockbench.showMessageBox({title: 'CEM-S Studio binding', message: 'Add a Player Reference model before binding a group.'});
      return;
    }
    const options = Object.fromEntries(Object.keys(reference.anchors).map(anchor => [anchor, anchor.replace(/_/g, ' ')]));
    const dialog = new Dialog({
      id: 'cem_s_studio_bind_reference',
      title: 'Bind Group to Reference Anchor',
      form: {anchor: {label: 'Anchor', type: 'select', options, value: 'body'}},
      onConfirm(result) {
        dialog.hide();
        const anchorGroup = findGroupByReference(reference.anchors[result.anchor]);
        if (!anchorGroup) {
          Blockbench.showMessageBox({title: 'CEM-S Studio binding failed', message: `Reference anchor "${result.anchor}" is missing. Register the reference model again.`});
          return;
        }
        if (isInsideGroup(anchorGroup, group)) {
          Blockbench.showMessageBox({title: 'CEM-S Studio binding failed', message: 'A group cannot be bound to one of its own descendants.'});
          return;
        }
        Undo.initEdit({outliner: true, elements: []});
        group.addTo(anchorGroup);
        const bindings = Object.assign({}, reference.bindings || {}, {[group.uuid || group.name]: result.anchor});
        Project.cem_studio = Object.assign({}, settings, {reference: Object.assign({}, reference, {bindings})});
        Project.saved = false;
        Undo.finishEdit('Bind CEM-S attachment', {outliner: true, elements: []});
        group.select?.();
        Blockbench.showQuickMessage(`CEM-S Studio: bound ${group.name} to ${result.anchor}.`);
      }
    });
    dialog.show();
  }

  function exportCurrentProject() {
    const cubes = (Cube.all || []).filter(cube => !isReferenceCube(cube, getSettings().reference));
    if (!cubes.length) {
      Blockbench.showQuickMessage('CEM-S Studio: add at least one cube before exporting.');
      return;
    }
    const settings = getSettings();
    exportDialog = new Dialog({
      id: 'cem_s_studio_export',
      title: 'Export CEM-S 1.21.6 Model',
      form: {model_id: {label: 'Model ID', type: 'number', value: settings.modelId, min: 0, step: 1}},
      onConfirm(result) {
        exportDialog.hide();
        try {
          const document = currentDocument();
      const exported = exportModel(toCemModel(document.project.name, cubes, {reference: document.project.reference}), Number(result.model_id));
          Blockbench.export({resource_id: 'cem_s_studio_glsl', type: 'CEM-S 1.21.6 model', extensions: ['glsl'], name: document.project.name, content: exported.glsl}, path => Blockbench.showQuickMessage(`CEM-S Studio: exported ${path || document.project.name}.`));
        } catch (error) {
          Blockbench.showMessageBox({title: 'CEM-S Studio export failed', message: error.message});
        }
      }
    });
    exportDialog.show();
  }

  function getFileSystem(scope) {
    const fs = require('fs', {scope, message: 'CEM-S Studio needs access to build the selected resource pack.'});
    if (!fs) throw new Error('File access was not granted. Choose the resource-pack folder again and allow access.');
    return fs;
  }

  function writeFiles(root, files, fs) {
    const path = require('path');
    for (const [relative, content] of Object.entries(files)) {
      const target = path.resolve(root, relative);
      const fromRoot = path.relative(path.resolve(root), target);
      if (fromRoot === '..' || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot)) throw new Error(`refusing to write outside resource pack: ${relative}`);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, content, 'utf8');
    }
  }

  function readExistingFiles(root, files, fs) {
    const path = require('path');
    const existing = {};
    for (const relative of files) {
      const target = path.join(root, relative);
      if (fs.existsSync(target)) existing[relative] = fs.readFileSync(target, 'utf8');
    }
    return existing;
  }

  async function buildResourcePack(mode) {
    try {
      const document = currentDocument();
      const model = toCemModel(document.project.name, Cube.all || [], {reference: document.project.reference});
      const exported = exportModel(model, document.project.modelId);
      const selected = Blockbench.pickDirectory({title: mode === 'new' ? 'Choose where to create the resource pack' : 'Choose existing CEM-S resource pack folder', resource_id: 'cem_s_studio_pack'});
      if (!selected) return;
      const path = require('path');
      const root = mode === 'new' ? path.join(selected, slugify(document.project.resourcePack.name)) : selected;
      const fs = getFileSystem(selected);
      if (mode === 'new' && fs.existsSync(root) && fs.readdirSync(root).length) {
        throw new Error(`The folder "${root}" is not empty. Choose another location or use Update an existing CEM-S pack.`);
      }
      const runtimeFiles = mode === 'new' ? await loadRuntimeFiles() : {};
      const generated = buildPackFiles(document, exported.glsl, {runtimeFiles});
      const aggregatorFiles = ['assets/minecraft/shaders/include/cem_user/models.glsl', 'assets/minecraft/shaders/include/cem_user/detection.glsl', 'pack.mcmeta'];
      const files = mode === 'new' ? generated : mergePackFiles(readExistingFiles(root, aggregatorFiles, fs), generated, document);
      writeFiles(root, files, fs);
      Project.saved = false;
      Blockbench.showQuickMessage(`CEM-S Studio: resource pack built at ${root}`);
    } catch (error) {
      Blockbench.showMessageBox({title: 'CEM-S Studio resource-pack build failed', message: error.message});
    }
  }

  function showBuildDialog() {
    buildDialog = new Dialog({
      id: 'cem_s_studio_build',
      title: 'Build CEM-S Resource Pack',
      form: {
        mode: {label: 'Output', type: 'select', options: {new: 'Create a new resource pack', update: 'Update an existing CEM-S pack'}, value: 'new'}
      },
      onConfirm(result) {
        buildDialog.hide();
        return buildResourcePack(result.mode);
      }
    });
    buildDialog.show();
  }

  function installProjectFormat() {
    baseProjectCodec = Codecs.project;
    projectCodec = new Codec('cemst', {
      name: 'CEM-S Studio Project',
      extension: 'cemst',
      remember: true,
      load_filter: {type: 'json', extensions: ['cemst']},
      compile(options = {}) {
        const document = currentDocument();
        return options.raw ? document : serializeProject(document);
      },
      parse(data, path) {
        const document = parseProject(data);
        document.blockbench.meta = Object.assign({}, document.blockbench.meta, {model_format: 'cem_s_studio'});
        baseProjectCodec.parse(document.blockbench, path);
        Project.cem_studio = document.project;
        Project.name = document.project.name;
      }
    });
    projectFormat = new ModelFormat('cem_s_studio', {
      name: 'CEM-S Studio',
      description: 'Blockbench project format for CEM-S shader models.',
      category: 'minecraft',
      target: 'Minecraft',
      icon: 'extension',
      show_on_start_screen: true,
      show_in_new_list: true,
      box_uv: false,
      optional_box_uv: true,
      single_texture: true,
      bone_rig: true,
      rotate_cubes: true,
      centered_grid: true,
      codec: projectCodec,
      onSetup() {
        if (!Project.cem_studio) Project.cem_studio = defaultSettings();
      }
    });
    projectCodec.format = projectFormat;
    saveAction = new Action('save_cemst_project', {name: 'Save CEM-S Studio Project', icon: 'save', category: 'file', condition: () => Format === projectFormat && !!Project, click: () => projectCodec.export()});
    settingsAction = new Action('cem_s_studio_project_settings', {name: 'CEM-S Studio Project Settings', icon: 'settings', category: 'tools', condition: () => Format === projectFormat && !!Project, click: showProjectSettings});
    buildAction = new Action('build_cem_s_resource_pack', {name: 'Build CEM-S Resource Pack', icon: 'folder_zip', category: 'file', condition: () => Format === projectFormat && !!Project, click: showBuildDialog});
    exportAction = new Action('export_cem_s_studio', {name: 'Export CEM-S 1.21.6 Model', icon: 'save', category: 'file.export', condition: () => Format === projectFormat && !!Project, click: exportCurrentProject});
    addReferenceAction = new Action('cem_s_studio_add_player_reference', {name: 'Add Player Reference Model', icon: 'accessibility', category: 'tools', condition: () => Format === projectFormat && !!Project, click: addPlayerReference});
    importReferenceAction = new Action('cem_s_studio_import_reference', {name: 'Import Vanilla Reference Model (.bbmodel)', icon: 'folder_open', category: 'tools', condition: () => Format === projectFormat && !!Project, click: importReferenceModel});
    registerReferenceAction = new Action('cem_s_studio_register_reference', {name: 'Register Selected Group as Reference Model', icon: 'bookmark', category: 'tools', condition: () => Format === projectFormat && !!Project, click: registerSelectedReference});
    bindReferenceAction = new Action('cem_s_studio_bind_reference', {name: 'Bind Selected Group to Reference Anchor', icon: 'link', category: 'tools', condition: () => Format === projectFormat && !!Project, click: showBindReferenceDialog});
    MenuBar.addAction(saveAction, 'file');
    MenuBar.addAction(settingsAction, 'tools');
    MenuBar.addAction(buildAction, 'file.export');
    MenuBar.addAction(exportAction, 'file.export');
    MenuBar.addAction(addReferenceAction, 'tools');
    MenuBar.addAction(importReferenceAction, 'tools');
    MenuBar.addAction(registerReferenceAction, 'tools');
    MenuBar.addAction(bindReferenceAction, 'tools');
  }

  Plugin.register('cem_s_studio', {
    title: 'CEM-S Studio',
    author: 'CEM-S Studio contributors',
    description: 'A Blockbench project format and resource-pack builder for CEM-S 1.21.6.',
    icon: 'extension',
    version: '0.3.0',
    min_version: '4.12.0',
    variant: 'desktop',
    onload() { installProjectFormat(); },
    onunload() {
      [saveAction, settingsAction, buildAction, exportAction, addReferenceAction, importReferenceAction, registerReferenceAction, bindReferenceAction].forEach(action => action && action.delete());
      [exportDialog, settingsDialog, buildDialog].forEach(dialog => dialog && dialog.delete());
      if (projectCodec) projectCodec.delete();
      if (projectFormat) projectFormat.delete();
    }
  });
}());
