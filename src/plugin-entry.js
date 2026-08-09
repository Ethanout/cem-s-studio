(function () {
  const {exportModel, exportModels} = CemSExporter;
  const {toCemModels, isReferenceCube} = CemSBlockbenchAdapter;
  const {CURRENT_VERSION, SUPPORTED_CEM_VERSIONS, createProject, createWorkspace, parseProject, serializeProject, detectionForPreset} = CemSProject;
  const {REFERENCE_PREFIX, REFERENCE_CUBE_PREFIX, anchorsFor, guidesFor, isReferenceGroup} = CemSReferenceRigs;
  const {slugify, buildPackFiles, buildWorkspacePackFiles, mergePackFiles} = CemSPackBuilder;
  const {loadRuntimeFiles} = CemSRuntime;
  const {profileFor, optionsFor, categoryOptionsFor, searchProfiles} = CemSEntityDatabase;
  const {collectReferencedTextures, renderTextureAtlas} = CemSTextureAtlas;
  let exportAction;
  let exportDialog;
  let settingsAction;
  let advancedSettingsAction;
  let settingsDialog;
  let buildAction;
  let updateBuildAction;
  let buildDialog;
  let studioMenu;
  let studioPanel;
  let projectFormat;
  let projectCodec;
  let saveAction;
  let baseProjectCodec;
  let addReferenceAction;
  let importReferenceAction;
  let registerReferenceAction;
  let bindReferenceAction;
  let renderSettingsAction;
  let resetAttachmentAction;
  let addWorkspaceModelAction;
  const renderProperties = [];
  let originalGenerateTemplate;
  let originalGenerateColorMapTemplate;
  let bindingSyncInstalled = false;

  function defaultSettings() {
    return createProject({name: Project?.name || 'CEM-S Model'}).project;
  }

  function getSettings() {
    return Project.cem_studio ? JSON.parse(JSON.stringify(Project.cem_studio)) : defaultSettings();
  }

  function studioTextureState(settings, reference) {
    const elements = [...(globalThis.Cube?.all || []), ...(globalThis.Mesh?.all || [])];
    try {
      const textures = typeof Texture === 'function'
        ? collectReferencedTextures(elements, Texture.all || [], {isReference: element => isReferenceCube(element, reference)})
        : [];
      const profile = profileFor(settings.targetEntity, settings.cemVersion);
      const expected = profile.textureSize || [];
      const hasBaseTexture = textures.some(texture => texture.width === expected[0] && texture.height === expected[1]);
      let issue = null;
      if (textures.length && !(settings.texturePath || profile.texturePath)) issue = '当前实体使用动态纹理，需在高级设置指定资源包纹理路径';
      else if (textures.length && !hasBaseTexture) issue = `需要 ${expected[0]}×${expected[1]} 基础纹理`;
      return {count: textures.length, hasBaseTexture, issue, expected};
    } catch (error) {
      return {count: 0, hasBaseTexture: false, issue: error.message, expected: []};
    }
  }

  function studioPanelState() {
    const settings = getSettings();
    const reference = settings.reference || {};
    const anchorCount = Object.keys(reference.anchors || {}).length;
    const bindingCount = Object.keys(reference.bindings || {}).length;
    const hasReference = !!reference.root && reference.rig !== 'none';
    const modelCount = [...(globalThis.Cube?.all || []), ...(globalThis.Mesh?.all || [])].filter(element => !isReferenceCube(element, reference)).length;
    const texture = studioTextureState(settings, reference);
    return {settings, anchorCount, bindingCount, hasReference, modelCount, texture, selection: selectedAttachmentSummary(reference)};
  }

  function attachmentBindingFor(element, reference) {
    let current = element;
    while (current) {
      const key = current.uuid || current.name;
      if (key && reference.bindings?.[key]) {
        return {anchor: reference.bindings[key], owner: current, transform: reference.transforms?.[key] || null};
      }
      current = current.parent;
    }
    return null;
  }

  function selectedAttachmentElements() {
    const reference = getSettings().reference || {};
    const selected = (globalThis.Outliner?.selected || []).filter(element => {
      if (!element || !['group', 'cube', 'mesh'].includes(element.type)) return false;
      return !isReferenceGroup(element) && !isReferenceCube(element, reference);
    });
    return selected.filter(element => !selected.some(parent => parent !== element && parent.type === 'group' && isInsideGroup(element, parent)));
  }

  function formatVec3(values, fallback) {
    return (Array.isArray(values) ? values : fallback).map(value => {
      const rounded = Math.round(Number(value) * 1000) / 1000;
      return Object.is(rounded, -0) ? '0' : String(rounded);
    }).join(', ');
  }

  function selectedAttachmentSummary(reference) {
    const selected = selectedAttachmentElements();
    if (!selected.length) return {count: 0, label: '未选择用户部件', boundCount: 0, canRebind: false};
    const resolved = selected.map(element => ({element, binding: attachmentBindingFor(element, reference)}));
    const bound = resolved.filter(item => item.binding);
    if (!bound.length) return {count: selected.length, label: `${selected.length} 个部件 · 未绑定`, boundCount: 0, canRebind: true};
    const anchors = [...new Set(bound.map(item => item.binding.anchor))];
    const inherited = bound.filter(item => item.binding.owner !== item.element).length;
    const first = bound[0].binding;
    const transform = first.transform;
    return {
      count: selected.length,
      boundCount: bound.length,
      canRebind: true,
      label: `${selected.length} 个部件 · ${anchors.length === 1 ? anchors[0] : '多个锚点'}${inherited ? ` · ${inherited} 个继承绑定` : ''}`,
      position: formatVec3(transform?.position, [0, 0, 0]),
      rotation: formatVec3(transform?.rotation, [0, 0, 0]),
      scale: formatVec3(transform?.scale, [1, 1, 1]),
      mixed: bound.length !== selected.length || anchors.length > 1 || bound.some(item => JSON.stringify(item.binding.transform) !== JSON.stringify(transform))
    };
  }

  function refreshStudioPanel() {
    if (!studioPanel?.node) return;
    const state = studioPanelState();
    const {settings} = state;
    populateWorkspaceBrowser();
    const entityName = profileFor(settings.targetEntity, settings.cemVersion)?.name || settings.targetEntity || '未选择';
    const referenceLabel = state.hasReference ? `${state.anchorCount} 个锚点` : '未添加';
    const transformCount = Object.keys(settings.reference?.transforms || {}).length;
    const bindingLabel = state.bindingCount ? `${state.bindingCount} 个已绑定 · ${transformCount} 个偏移快照` : '暂无绑定';
    const textureLabel = state.texture.count ? `${state.texture.count} 张用户纹理${state.texture.hasBaseTexture ? '' : '（缺少基础纹理）'}` : '未指定用户纹理';
    const next = !state.hasReference ? '先添加参考模型' : !state.modelCount ? '创建一个 Cube 或 Mesh' : !state.bindingCount ? '把模型拖入参考锚点' : state.texture.issue || '可以创建资源包';
    const setText = (selector, value) => { const node = studioPanel.node.querySelector(selector); if (node) node.textContent = value; };
    setText('[data-cem-state="entity"]', `${entityName} · ${settings.cemVersion}`);
    setText('[data-cem-state="pack"]', settings.resourcePack?.name || '未设置资源包');
    setText('[data-cem-state="reference"]', referenceLabel);
    setText('[data-cem-state="binding"]', bindingLabel);
    setText('[data-cem-state="textures"]', textureLabel);
    setText('[data-cem-state="next"]', next);
    setText('[data-cem-selection="summary"]', state.selection.label);
    setText('[data-cem-selection="position"]', state.selection.mixed ? '多个值' : state.selection.position || '—');
    setText('[data-cem-selection="rotation"]', state.selection.mixed ? '多个值' : state.selection.rotation || '—');
    setText('[data-cem-selection="scale"]', state.selection.mixed ? '多个值' : state.selection.scale || '—');
    const selectionDetails = studioPanel.node.querySelector('[data-cem-selection="details"]');
    if (selectionDetails) selectionDetails.hidden = state.selection.boundCount === 0;
    const exportButton = studioPanel.node.querySelector('[data-cem-action="export"]');
    const buildButton = studioPanel.node.querySelector('[data-cem-action="build"]');
    const rebindButton = studioPanel.node.querySelector('[data-cem-action="rebind"]');
    const resetButton = studioPanel.node.querySelector('[data-cem-action="reset-anchor"]');
    if (exportButton) exportButton.disabled = state.modelCount === 0;
    if (buildButton) buildButton.disabled = state.modelCount === 0 || !!state.texture.issue;
    if (rebindButton) rebindButton.disabled = !state.selection.canRebind || !state.hasReference;
    if (resetButton) resetButton.disabled = state.selection.boundCount === 0;
    const entitySelect = studioPanel.node.querySelector('[data-cem-entity="profile"]');
    if (entitySelect && entitySelect.dataset.version !== settings.cemVersion) populateStudioEntityBrowser();
  }

  function populateWorkspaceBrowser() {
    const select = studioPanel?.node?.querySelector('[data-cem-workspace="model"]');
    const state = studioPanel?.node?.querySelector('[data-cem-workspace="state"]');
    if (!select || !state) return;
    const workspace = Project?.cem_workspace;
    if (!workspace?.models?.length) {
      const settings = getSettings();
      select.innerHTML = `<option value="__current">${settings.name || '当前模型'}</option>`;
      select.value = '__current';
      select.disabled = true;
      state.textContent = '单模型项目';
      return;
    }
    select.disabled = false;
    select.innerHTML = workspace.models.map(model => `<option value="${model.id}">${model.project.name} · ID ${model.project.modelId}</option>`).join('');
    select.value = workspace.activeModel;
    state.textContent = `${workspace.models.length} 个模型 · 当前 ${workspace.activeModel}`;
  }

  function populateStudioEntityBrowser() {
    if (!studioPanel?.node) return;
    const settings = getSettings();
    const categorySelect = studioPanel.node.querySelector('[data-cem-entity="category"]');
    const searchInput = studioPanel.node.querySelector('[data-cem-entity="search"]');
    const profileSelect = studioPanel.node.querySelector('[data-cem-entity="profile"]');
    if (!categorySelect || !searchInput || !profileSelect) return;
    if (categorySelect.dataset.version !== settings.cemVersion) {
      const categories = categoryOptionsFor(settings.cemVersion);
      categorySelect.innerHTML = '<option value="all">全部分类</option>' + Object.entries(categories).map(([id, label]) => `<option value="${id}">${label}</option>`).join('');
      categorySelect.dataset.version = settings.cemVersion;
      categorySelect.value = 'all';
    }
    const matches = searchProfiles(searchInput.value, settings.cemVersion, categorySelect.value || 'all');
    profileSelect.innerHTML = matches.map(profile => `<option value="${profile.id}">${profile.name}</option>`).join('');
    profileSelect.dataset.version = settings.cemVersion;
    if (matches.some(profile => profile.id === settings.targetEntity)) profileSelect.value = settings.targetEntity;
  }

  function applyStudioEntitySelection() {
    const select = studioPanel?.node?.querySelector('[data-cem-entity="profile"]');
    const profileId = select?.value;
    if (!profileId) {
      Blockbench.showQuickMessage('CEM-S Studio: no matching entity profile.');
      return;
    }
    const settings = getSettings();
    if (profileId === settings.targetEntity) return;
    const profile = profileFor(profileId, settings.cemVersion);
    const requestedRig = settings.referenceRig || profile.referenceRig;
    const reference = settings.reference || {};
    if (reference.root && reference.rig !== requestedRig) {
      const root = findGroupByReference(reference.root);
      const hasBindings = Object.keys(reference.bindings || {}).length > 0;
      const hasAuthorElements = root && [...(globalThis.Cube?.all || []), ...(globalThis.Mesh?.all || [])].some(element => isInsideGroup(element, root) && !isReferenceCube(element, reference));
      if (hasBindings || hasAuthorElements) {
        Blockbench.showMessageBox({title: 'CEM-S Studio entity switch', message: 'Move or unbind author model parts from the current reference model before switching entity type.'});
        return;
      }
      root?.remove?.();
      Project.cem_studio = Object.assign({}, settings, {reference: {rig: 'none', root: null, anchors: {}, bindings: {}, transforms: {}, guides: []}});
    }
    setSettings({entity_profile: profileId, minecraft_version: settings.cemVersion});
    if (requestedRig !== 'none' && !getSettings().reference?.root) addReferenceRig(requestedRig);
    populateStudioEntityBrowser();
    Blockbench.showQuickMessage(`CEM-S Studio: switched to ${profile.name}.`);
  }

  function installStudioPanel() {
    if (typeof Panel !== 'function' || studioPanel) return;
    studioPanel = new Panel('cem_s_studio_panel', {
      name: 'CEM-S Studio', icon: 'extension', category: 'sidebar',
      condition: () => Format === projectFormat && !!Project
    });
    studioPanel.node.innerHTML = `
      <div class="cem-s-studio-panel" style="padding: 8px">
        <div style="font-weight: 600; margin-bottom: 8px">项目状态</div>
        <div data-cem-state="entity" style="margin-bottom: 4px"></div>
        <div data-cem-state="pack" style="margin-bottom: 4px"></div>
        <div data-cem-state="reference" style="margin-bottom: 4px"></div>
        <div data-cem-state="binding" style="margin-bottom: 8px"></div>
        <div data-cem-state="textures" style="margin-bottom: 8px"></div>
        <div data-cem-state="next" style="margin-bottom: 8px; color: var(--color-bright)"></div>
        <div style="border-top: 1px solid var(--color-border); padding-top: 8px; margin-bottom: 8px">
          <div style="font-weight: 600; margin-bottom: 4px">CEM-S 工作区</div>
          <div data-cem-workspace="state" style="margin-bottom: 4px">单模型项目</div>
          <div style="display: grid; grid-template-columns: 1fr auto; gap: 4px">
            <select data-cem-workspace="model" aria-label="工作区模型"></select>
            <button data-cem-action="switch-workspace" title="切换工作区模型"><i class="material-icons">swap_horiz</i></button>
          </div>
          <button data-cem-action="add-workspace" title="添加模型到当前 .cemst 工作区" style="width: 100%; margin-top: 4px"><i class="material-icons">add</i> 添加模型</button>
        </div>
        <div style="border-top: 1px solid var(--color-border); padding-top: 8px; margin-bottom: 8px">
          <div style="font-weight: 600; margin-bottom: 4px">选中挂件</div>
          <div data-cem-selection="summary" style="margin-bottom: 4px">未选择用户部件</div>
          <div data-cem-selection="details" style="font-size: 0.9em; opacity: 0.8" hidden>
            <div>位置偏移：<span data-cem-selection="position"></span></div>
            <div>旋转偏移：<span data-cem-selection="rotation"></span></div>
            <div>缩放：<span data-cem-selection="scale"></span></div>
          </div>
        </div>
        <div style="display: grid; gap: 4px; margin-bottom: 8px">
          <input data-cem-entity="search" type="search" placeholder="搜索实体" aria-label="搜索实体">
          <select data-cem-entity="category" aria-label="实体分类"></select>
          <select data-cem-entity="profile" aria-label="实体类型"></select>
          <button data-cem-action="apply-entity" title="应用实体类型"><i class="material-icons">check</i> 应用实体</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px">
          <button data-cem-action="settings" title="项目设置"><i class="material-icons">settings</i> 设置</button>
          <button data-cem-action="reference" title="添加参考模型"><i class="material-icons">accessibility</i> 参考模型</button>
          <button data-cem-action="render" title="设置选中部件的渲染属性"><i class="material-icons">palette</i> 渲染属性</button>
          <button data-cem-action="rebind" title="将选中的挂件移动到另一个锚点"><i class="material-icons">link</i> 重新绑定</button>
          <button data-cem-action="reset-anchor" title="将选中挂件重置到当前锚点"><i class="material-icons">my_location</i> 重置到锚点</button>
          <button data-cem-action="export" title="导出模型"><i class="material-icons">save</i> 导出模型</button>
          <button data-cem-action="build" title="创建资源包"><i class="material-icons">create_new_folder</i> 创建资源包</button>
        </div>
      </div>`;
    studioPanel.node.querySelector('[data-cem-action="settings"]').addEventListener('click', () => showProjectSettings(false));
    studioPanel.node.querySelector('[data-cem-entity="search"]').addEventListener('input', populateStudioEntityBrowser);
    studioPanel.node.querySelector('[data-cem-entity="category"]').addEventListener('change', populateStudioEntityBrowser);
    studioPanel.node.querySelector('[data-cem-action="apply-entity"]').addEventListener('click', applyStudioEntitySelection);
    studioPanel.node.querySelector('[data-cem-action="reference"]').addEventListener('click', addConfiguredReference);
    studioPanel.node.querySelector('[data-cem-action="render"]').addEventListener('click', showRenderSettingsDialog);
    studioPanel.node.querySelector('[data-cem-action="rebind"]').addEventListener('click', showRebindAttachmentDialog);
    studioPanel.node.querySelector('[data-cem-action="reset-anchor"]').addEventListener('click', resetSelectedAttachments);
    studioPanel.node.querySelector('[data-cem-action="switch-workspace"]').addEventListener('click', () => {
      const id = studioPanel.node.querySelector('[data-cem-workspace="model"]')?.value;
      if (id && id !== '__current') switchWorkspaceModel(id);
    });
    studioPanel.node.querySelector('[data-cem-action="add-workspace"]').addEventListener('click', addWorkspaceModel);
    studioPanel.node.querySelector('[data-cem-action="export"]').addEventListener('click', exportCurrentProject);
    studioPanel.node.querySelector('[data-cem-action="build"]').addEventListener('click', () => buildResourcePack('new'));
    populateStudioEntityBrowser();
    refreshStudioPanel();
  }

  function currentSingleDocument() {
    const blockbench = baseProjectCodec.compile({raw: true});
    blockbench.meta = Object.assign({}, blockbench.meta, {model_format: 'cem_s_studio'});
    const settings = getSettings();
    return createProject({...settings, name: Project.name || settings.name, blockbench});
  }

  function currentDocument() {
    const document = currentSingleDocument();
    const workspace = Project?.cem_workspace ? JSON.parse(JSON.stringify(Project.cem_workspace)) : null;
    if (!workspace?.models?.length) return document;
    const active = workspace.models.find(model => model.id === workspace.activeModel);
    if (!active) throw new Error(`workspace.activeModel does not exist: ${workspace.activeModel}`);
    active.project = JSON.parse(JSON.stringify(document.project));
    active.blockbench = JSON.parse(JSON.stringify(document.blockbench));
    return {format: 'cemst', formatVersion: CURRENT_VERSION, workspace, project: document.project, blockbench: document.blockbench};
  }

  function ensureWorkspace() {
    if (Project?.cem_workspace?.models?.length) return Project.cem_workspace;
    const document = currentSingleDocument();
    const id = slugify(document.project.name);
    const workspace = createWorkspace([document], {modelIds: [id], activeModel: id}).workspace;
    Project.cem_workspace = workspace;
    Project.saved = false;
    return workspace;
  }

  function switchWorkspaceModel(id) {
    try {
      delete globalThis.__cemStudioLastWorkspaceError;
      const document = currentDocument();
      const workspace = document.workspace;
      const target = workspace.models.find(model => model.id === id);
      if (!target) throw new Error(`workspace model does not exist: ${id}`);
      workspace.activeModel = id;
      const loaded = parseProject({format: 'cemst', formatVersion: CURRENT_VERSION, workspace, project: target.project, blockbench: target.blockbench});
      baseProjectCodec.parse(loaded.blockbench, Project.save_path || 'cem_s_studio_workspace.bbmodel');
      Project.cem_studio = loaded.project;
      Project.cem_workspace = loaded.workspace;
      Project.name = loaded.project.name;
      Project.saved = false;
      setTimeout(() => { refreshStudioPanel(); globalThis.Canvas?.updateAll?.(); }, 0);
      Blockbench.showQuickMessage(`CEM-S Studio: 已切换到 ${target.project.name}。`);
    } catch (error) {
      Blockbench.showMessageBox({title: 'CEM-S Studio workspace switch failed', message: error.message});
    }
  }

  function addWorkspaceModel() {
    const workspace = ensureWorkspace();
    const current = getSettings();
    const form = {
      project_name: {label: '模型名称', type: 'text', value: 'New CEM-S Model'},
      minecraft_version: {label: 'Minecraft 版本', type: 'select', options: {'1.21.6': '1.21.6', '1.21.11': '1.21.11', '26.1+': '26.1+'}, value: current.cemVersion},
      model_id: {label: '模型 ID', type: 'number', value: Math.max(...workspace.models.map(model => model.project.modelId), 0) + 1, min: 0, step: 1},
      entity_profile: {label: '实体类型', type: 'select', options: optionsFor(current.cemVersion), value: current.targetEntity}
    };
    const dialog = new Dialog({
      id: 'cem_s_studio_add_workspace_model',
      title: '添加 CEM-S 模型',
      form,
      onConfirm(result) {
        dialog.hide();
        try {
          const name = String(result.project_name || '').trim();
          const modelId = Number(result.model_id);
          const version = result.minecraft_version || current.cemVersion;
          const entity = result.entity_profile || current.targetEntity;
          if (!name) throw new Error('模型名称不能为空。');
          if (workspace.models.some(model => model.project.modelId === modelId)) throw new Error(`模型 ID ${modelId} 已在工作区中使用。`);
          const blankBlockbench = JSON.parse(JSON.stringify(currentSingleDocument().blockbench));
          blankBlockbench.name = name;
          blankBlockbench.model_identifier = slugify(name);
          blankBlockbench.elements = [];
          blankBlockbench.groups = [];
          blankBlockbench.outliner = [];
          blankBlockbench.textures = [];
          const model = createProject({name, modelId, cemVersion: version, targetEntity: entity, blockbench: blankBlockbench});
          let id = slugify(name);
          let suffix = 2;
          while (workspace.models.some(existing => existing.id === id)) id = `${slugify(name)}_${suffix++}`;
          workspace.models.push({id, project: model.project, blockbench: model.blockbench});
          Project.cem_workspace = workspace;
          Project.saved = false;
          switchWorkspaceModel(id);
          const profile = profileFor(entity, version);
          const requestedRig = getSettings().referenceRig || profile.referenceRig;
          if (requestedRig !== 'none' && !getSettings().reference?.root) addReferenceRig(requestedRig);
        } catch (error) {
          Blockbench.showMessageBox({title: 'CEM-S Studio workspace model failed', message: error.message});
        }
      }
    });
    dialog.show();
  }

  function setSettings(result) {
    const current = getSettings();
    const value = (name, fallback) => result[name] === undefined || result[name] === '' ? fallback : result[name];
    const version = value('minecraft_version', current.cemVersion);
    const presetName = value('entity_profile', value('detection_preset', current.targetEntity));
    const profile = profileFor(presetName, version);
    const currentDetection = current.detection;
    const currentBranch = currentDetection.branches[0];
    const detection = presetName === 'custom' ? {
      preset: 'custom',
      channel: value('render_target', current.targetType),
      mode: 'texture_marker',
      pixel: [Number(value('marker_x', currentDetection.pixel[0])), Number(value('marker_y', currentDetection.pixel[1]))],
      color: [value('marker_r', currentDetection.color[0]), value('marker_g', currentDetection.color[1]), value('marker_b', currentDetection.color[2]), value('marker_a', currentDetection.color[3])].map(Number),
      branches: [{
        id: 'main', anchor: null, modelIdOffset: 0,
        match: {mode: 'vertex_id', count: Number(value('face_count', currentBranch.match.count)), index: Number(value('face_number', currentBranch.match.index))},
        reverse: result.reverse === undefined ? currentBranch.reverse : !!result.reverse,
        corner: result.corner_yx === undefined ? currentBranch.corner : (result.corner_yx ? 'yx' : 'default'),
        size: Number(value('cem_size', currentBranch.size)), modelScale: currentBranch.modelScale || 8
      }],
      hideUnmatched: result.hide_unmatched === undefined ? currentDetection.hideUnmatched : !!result.hide_unmatched
    } : detectionForPreset(presetName, version);
    const next = createProject({
      ...current,
      name: value('project_name', current.name),
      modelId: Number(value('model_id', current.modelId)),
      cemVersion: value('minecraft_version', current.cemVersion),
      targetEntity: presetName,
      targetType: presetName === 'custom' ? value('render_target', current.targetType) : profile.targetType,
      detection,
      referenceRig: value('reference_rig', current.referenceRig || profile.referenceRig || 'none'),
      texturePath: value('texture_path', current.texturePath || null),
      resourcePack: {name: value('pack_name', current.resourcePack.name), description: value('pack_description', current.resourcePack.description), packFormat: SUPPORTED_CEM_VERSIONS[version]}
    }).project;
    Project.cem_studio = next;
    Project.name = next.name;
    Project.saved = false;
    refreshStudioPanel();
  }

  function showProjectSettings(advanced = false) {
    const settings = getSettings();
    const primaryBranch = settings.detection.branches[0];
    const form = {
      project_name: {label: 'Project name', type: 'text', value: settings.name},
      minecraft_version: {label: 'Minecraft version', description: 'Selects the bundled CEM-S core shaders and resource-pack format.', type: 'select', options: {'1.21.6': '1.21.6', '1.21.11': '1.21.11', '26.1+': '26.1+ (26.1.2 runtime)'}, value: settings.cemVersion},
      model_id: {label: 'Model ID', description: 'Keep this ID unique in the target resource pack.', type: 'number', value: settings.modelId, min: 0, step: 1},
      entity_profile: {label: 'Entity type', description: 'Chooses the reference model and CEM-S detection profile.', type: 'select', options: optionsFor(settings.cemVersion), value: settings.targetEntity},
      reference_rig: {label: 'Reference model', description: 'Choose the coordinate skeleton used for positioning attachments. It can differ from the rendered host entity.', type: 'select', options: {none: 'None', player: 'Player', pig: 'Pig', elytra: 'Elytra / Armor', arrow: 'Arrow / Projectile', armor_stand: 'Armor Stand'}, value: settings.referenceRig || settings.reference?.rig || 'none'},
      pack_name: {label: 'Resource pack name', type: 'text', value: settings.resourcePack.name}
    };
    if (advanced) Object.assign(form, {
      render_target: {label: 'Render target', description: 'Use Armor / Equipment for elytra and armor attachments.', type: 'select', options: {entity: 'Entity / Mob', armor: 'Armor / Equipment'}, value: settings.targetType},
      marker_x: {label: 'Marker pixel X', type: 'number', value: settings.detection.pixel[0], min: 0, step: 1},
      marker_y: {label: 'Marker pixel Y', type: 'number', value: settings.detection.pixel[1], min: 0, step: 1},
      marker_r: {label: 'Marker red', type: 'number', value: settings.detection.color[0], min: 0, max: 255, step: 1},
      marker_g: {label: 'Marker green', type: 'number', value: settings.detection.color[1], min: 0, max: 255, step: 1},
      marker_b: {label: 'Marker blue', type: 'number', value: settings.detection.color[2], min: 0, max: 255, step: 1},
      marker_a: {label: 'Marker alpha', type: 'number', value: settings.detection.color[3], min: 0, max: 255, step: 1},
      face_count: {label: 'Faces per entity', description: 'Usually vanilla model cube count multiplied by 6.', type: 'number', value: primaryBranch.match.count || 1, min: 1, step: 1},
      face_number: {label: 'Anchor face', description: 'Zero-based face index used as the CEM-S anchor.', type: 'number', value: primaryBranch.match.index || 0, min: 0, step: 1},
      reverse: {label: 'Reverse model axes', type: 'checkbox', value: primaryBranch.reverse},
      corner_yx: {label: 'Transpose anchor corners', type: 'checkbox', value: primaryBranch.corner === 'yx'},
      cem_size: {label: 'CEM area size', type: 'number', value: primaryBranch.size, min: 0.01, step: 0.1},
      hide_unmatched: {label: 'Hide unmatched vanilla faces', type: 'checkbox', value: settings.detection.hideUnmatched},
      texture_path: {label: 'Target texture path', description: 'For dynamic or expert entities, e.g. assets/minecraft/textures/entity/custom.png.', type: 'text', value: settings.texturePath || ''},
      pack_description: {label: 'Resource pack description', type: 'text', value: settings.resourcePack.description}
    });
    settingsDialog = new Dialog({
      id: 'cem_s_studio_settings',
      title: advanced ? 'CEM-S Advanced Detection Settings' : 'CEM-S Studio Project Setup',
      form,
      onConfirm(result) {
        settingsDialog.hide();
        try {
          const currentSettings = getSettings();
          const selectedProfile = profileFor(result.entity_profile || result.detection_preset || currentSettings.targetEntity, result.minecraft_version || currentSettings.cemVersion);
          const requestedRig = result.reference_rig || currentSettings.referenceRig || selectedProfile.referenceRig || 'none';
          const currentReference = currentSettings.reference || {};
          if (currentReference.root && currentReference.rig !== requestedRig) {
            const root = findGroupByReference(currentReference.root);
            const hasBindings = Object.keys(currentReference.bindings || {}).length > 0;
            const hasAuthorElements = root && [...(globalThis.Cube?.all || []), ...(globalThis.Mesh?.all || [])].some(element => isInsideGroup(element, root) && !isReferenceCube(element, currentReference));
            if (hasBindings || hasAuthorElements) throw new Error('请先移出或解除当前参考模型中的挂件，再切换参考骨架。');
            root?.remove?.();
            Project.cem_studio = Object.assign({}, currentSettings, {reference: {rig: 'none', root: null, anchors: {}, bindings: {}, transforms: {}, guides: []}});
          }
          setSettings(result);
          if (requestedRig && requestedRig !== 'none' && !getSettings().reference?.root) addReferenceRig(requestedRig);
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

  function autoBindAttachments() {
    const settings = getSettings();
    const reference = settings.reference;
    if (!reference?.root || !reference.anchors) return;
    const root = findGroupByReference(reference.root);
    if (!root) return;
    const anchorByGroup = new Map(Object.entries(reference.anchors).map(([name, id]) => [id, name]));
    const bindings = {};
    const transforms = {};
    const candidates = [...(Group.all || []), ...(Cube.all || []), ...(globalThis.Mesh?.all || [])];
    for (const element of candidates) {
      if (element === root || isReferenceGroup(element) || isReferenceCube(element, reference)) continue;
      const parent = element.parent;
      const anchor = parent && (anchorByGroup.get(parent.uuid) || anchorByGroup.get(parent.name));
      if (anchor) {
        const key = element.uuid || element.name;
        bindings[key] = anchor;
        const elementOrigin = Array.isArray(element.origin) ? element.origin : [0, 0, 0];
        const anchorOrigin = Array.isArray(parent.origin) ? parent.origin : [0, 0, 0];
        const elementScale = Array.isArray(element.scale) ? element.scale : [1, 1, 1];
        transforms[key] = {
          position: elementOrigin.map((value, index) => Number(value) - Number(anchorOrigin[index] || 0)),
          rotation: (Array.isArray(element.rotation) ? element.rotation : [0, 0, 0]).map(Number),
          scale: elementScale.map(Number)
        };
      }
    }
    if (JSON.stringify(bindings) !== JSON.stringify(reference.bindings || {}) || JSON.stringify(transforms) !== JSON.stringify(reference.transforms || {})) {
      Project.cem_studio = Object.assign({}, settings, {reference: Object.assign({}, reference, {bindings, transforms})});
      Project.saved = false;
    }
  }

  function syncBindingsAfterEdit() {
    if (Format === projectFormat && Project?.cem_studio) autoBindAttachments();
    refreshStudioPanel();
  }

  function installBindingSync() {
    if (bindingSyncInstalled) return;
    Blockbench.on('finish_edit', syncBindingsAfterEdit);
    Blockbench.on('update_selection', syncBindingsAfterEdit);
    bindingSyncInstalled = true;
  }

  function uninstallBindingSync() {
    if (!bindingSyncInstalled) return;
    Blockbench.removeListener('finish_edit', syncBindingsAfterEdit);
    Blockbench.removeListener('update_selection', syncBindingsAfterEdit);
    bindingSyncInstalled = false;
  }

  function selectedGroup() {
    const group = Array.isArray(Group.selected) ? Group.selected[0] : Group.selected;
    if (group) return group;
    return (Outliner.selected || []).find(item => item && item.type === 'group') || null;
  }

  function selectedAuthorCubes() {
    const selected = globalThis.Outliner?.selected || [];
    const settings = getSettings();
    const cubes = new Set();
    const collect = item => {
      if (!item) return;
      if (item.type === 'cube') cubes.add(item);
      (item.children || []).forEach(collect);
    };
    selected.forEach(collect);
    return [...cubes].filter(cube => !isReferenceCube(cube, settings.reference));
  }

  function showRenderSettingsDialog() {
    const cubes = selectedAuthorCubes();
    if (!cubes.length) {
      Blockbench.showMessageBox({title: 'CEM-S Studio render properties', message: '请先在 Outliner 中选择一个用户 Cube 或包含 Cube 的 Group。'});
      return;
    }
    const first = cubes[0];
    const tint = /^#[0-9a-f]{8}$/i.test(first.cem_tint || '') ? first.cem_tint : '#ffffffff';
    const dialog = new Dialog({
      id: 'cem_s_studio_render_settings',
      title: `渲染属性（${cubes.length} 个 Cube）`,
      form: {
        emissive: {label: '发光', type: 'checkbox', value: !!first.cem_emissive},
        per_face_lighting: {label: '逐面光照', type: 'checkbox', value: first.cem_per_face_lighting !== false},
        tint: {label: '颜色乘算', type: 'color', value: tint.slice(0, 7)},
        alpha: {label: '透明度', type: 'number', value: parseInt(tint.slice(7), 16), min: 0, max: 255, step: 1}
      },
      onConfirm(result) {
        dialog.hide();
        const rgb = String(result.tint || '#ffffff').replace('#', '').padEnd(6, 'f').slice(0, 6);
        const alpha = Math.max(0, Math.min(255, Math.round(Number(result.alpha)))).toString(16).padStart(2, '0');
        Undo.initEdit({elements: cubes});
        cubes.forEach(cube => {
          cube.cem_emissive = !!result.emissive;
          cube.cem_per_face_lighting = !!result.per_face_lighting;
          cube.cem_tint = `#${rgb}${alpha}`;
        });
        Undo.finishEdit('Change CEM-S render properties', {elements: cubes});
        Project.saved = false;
        Blockbench.showQuickMessage(`CEM-S Studio: 已更新 ${cubes.length} 个 Cube 的渲染属性。`);
      }
    });
    dialog.show();
  }

  function showRebindAttachmentDialog() {
    autoBindAttachments();
    const selected = selectedAttachmentElements();
    if (!selected.length) {
      Blockbench.showMessageBox({title: 'CEM-S Studio attachment binding', message: '请先在 Outliner 中选择一个或多个用户 Cube、Mesh 或 Group。'});
      return;
    }
    const settings = getSettings();
    const reference = settings.reference || {};
    if (!reference.root || reference.rig === 'none' || !Object.keys(reference.anchors || {}).length) {
      Blockbench.showMessageBox({title: 'CEM-S Studio attachment binding', message: '请先为当前实体添加参考模型。'});
      return;
    }
    const options = Object.fromEntries(Object.keys(reference.anchors).map(anchor => [anchor, anchor.replace(/_/g, ' ')]));
    const currentAnchors = [...new Set(selected.map(element => attachmentBindingFor(element, reference)?.anchor).filter(Boolean))];
    const initialAnchor = currentAnchors.length === 1 ? currentAnchors[0] : Object.keys(options)[0];
    const dialog = new Dialog({
      id: 'cem_s_studio_rebind_attachment',
      title: `绑定挂件（${selected.length} 个部件）`,
      form: {anchor: {label: '目标锚点', type: 'select', options, value: initialAnchor}},
      onConfirm(result) {
        dialog.hide();
        const anchorGroup = findGroupByReference(reference.anchors[result.anchor]);
        if (!anchorGroup) {
          Blockbench.showMessageBox({title: 'CEM-S Studio attachment binding failed', message: `参考锚点“${result.anchor}”不存在，请重新添加参考模型。`});
          return;
        }
        if (selected.some(element => element.type === 'group' && isInsideGroup(anchorGroup, element))) {
          Blockbench.showMessageBox({title: 'CEM-S Studio attachment binding failed', message: '不能将 Group 绑定到自己的子级。'});
          return;
        }
        Undo.initEdit({outliner: true, elements: selected});
        selected.forEach(element => element.addTo(anchorGroup));
        autoBindAttachments();
        Project.saved = false;
        Undo.finishEdit('Bind CEM-S attachments', {outliner: true, elements: selected});
        globalThis.Canvas?.updateAll?.();
        refreshStudioPanel();
        Blockbench.showQuickMessage(`CEM-S Studio: 已将 ${selected.length} 个部件绑定到 ${result.anchor}。`);
      }
    });
    dialog.show();
  }

  function resetSelectedAttachments() {
    autoBindAttachments();
    const settings = getSettings();
    const reference = settings.reference || {};
    const selected = [...new Set(selectedAttachmentElements().map(element => attachmentBindingFor(element, reference)?.owner).filter(Boolean))];
    if (!selected.length) {
      Blockbench.showMessageBox({title: 'CEM-S Studio attachment reset', message: '请先选择一个已经拖入参考锚点的 Cube 或 Group。'});
      return;
    }
    const setVec3 = (target, property, values) => {
      if (target[property]?.V3_set) target[property].V3_set(values);
      else target[property] = values.slice();
    };
    Undo.initEdit({outliner: true, elements: selected});
    const transforms = Object.assign({}, reference.transforms || {});
    for (const element of selected) {
      const key = element.uuid || element.name;
      const anchorName = reference.bindings[key];
      const anchor = findGroupByReference(reference.anchors?.[anchorName]);
      if (!anchor) continue;
      setVec3(element, 'origin', Array.isArray(anchor.origin) ? anchor.origin : [0, 0, 0]);
      setVec3(element, 'rotation', [0, 0, 0]);
      if (element.scale !== undefined) setVec3(element, 'scale', [1, 1, 1]);
      transforms[key] = {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]};
    }
    Project.cem_studio = Object.assign({}, settings, {reference: Object.assign({}, reference, {transforms})});
    Project.saved = false;
    Undo.finishEdit('Reset CEM-S attachment to anchor', {outliner: true, elements: selected});
    globalThis.Canvas?.updateAll?.();
    refreshStudioPanel();
    Blockbench.showQuickMessage(`CEM-S Studio: 已将 ${selected.length} 个挂件重置到锚点。`);
  }

  function installRenderProperties() {
    if (typeof Property !== 'function' || typeof Cube !== 'function' || renderProperties.length) return;
    renderProperties.push(
      new Property(Cube, 'boolean', 'cem_emissive', {label: 'CEM-S Emissive', default: false}),
      new Property(Cube, 'boolean', 'cem_per_face_lighting', {label: 'CEM-S Per-face Lighting', default: true}),
      new Property(Cube, 'string', 'cem_tint', {label: 'CEM-S Tint', default: '#ffffffff'})
    );
  }

  function withoutReferenceGuides(callback) {
    if (Format !== projectFormat) return callback();
    const guides = (Cube.all || []).filter(cube => isReferenceCube(cube, getSettings().reference));
    const visibility = guides.map(cube => cube.visibility);
    guides.forEach(cube => { cube.visibility = false; });
    const restore = () => guides.forEach((cube, index) => { cube.visibility = visibility[index]; });
    try {
      const result = callback();
      if (result && typeof result.then === 'function') return result.finally(restore);
      restore();
      return result;
    } catch (error) {
      restore();
      throw error;
    }
  }

  function installTextureGeneratorGuard() {
    if (!globalThis.TextureGenerator || originalGenerateTemplate) return;
    originalGenerateTemplate = TextureGenerator.generateTemplate;
    originalGenerateColorMapTemplate = TextureGenerator.generateColorMapTemplate;
    TextureGenerator.generateTemplate = function (...args) {
      return withoutReferenceGuides(() => originalGenerateTemplate.apply(this, args));
    };
    TextureGenerator.generateColorMapTemplate = function (...args) {
      return withoutReferenceGuides(() => originalGenerateColorMapTemplate.apply(this, args));
    };
  }

  function uninstallTextureGeneratorGuard() {
    if (!globalThis.TextureGenerator || !originalGenerateTemplate) return;
    TextureGenerator.generateTemplate = originalGenerateTemplate;
    TextureGenerator.generateColorMapTemplate = originalGenerateColorMapTemplate;
    originalGenerateTemplate = null;
    originalGenerateColorMapTemplate = null;
  }

  function addReferenceRig(rig = 'player') {
    const settings = getSettings();
    const existing = settings.reference?.root && findGroupByReference(settings.reference.root);
    if (existing) {
      existing.select?.();
      Blockbench.showQuickMessage('CEM-S Studio: this project already has a reference model.');
      return;
    }
    const anchors = anchorsFor(rig);
    const guides = guidesFor(rig);
    Undo.initEdit({outliner: true, elements: []});
    const root = new Group({name: `${REFERENCE_PREFIX} / ${rig}`, origin: [0, 0, 0]}).init();
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
          box_uv: true,
          uv_offset: guide.uv.slice(),
          export: false,
          locked: true
        }).addTo(group).init();
        created.push(cube);
      }
    }
    Project.cem_studio = Object.assign({}, settings, {reference: {rig, root: root.uuid || root.name, anchors: anchorNames, bindings: {}, transforms: {}, guides: created.map(cube => cube.uuid).filter(Boolean)}});
    Project.saved = false;
    refreshStudioPanel();
    Undo.finishEdit(`Add CEM-S ${rig} Reference`, {outliner: true, elements: created});
    root.select?.();
    Blockbench.showQuickMessage(`CEM-S Studio: ${rig} reference added. Drag model groups into its anchors.`);
  }

  function addConfiguredReference() {
    const settings = getSettings();
    const profile = profileFor(settings.targetEntity, settings.cemVersion);
    const requestedRig = settings.referenceRig || profile.referenceRig;
    if (!requestedRig || requestedRig === 'none') {
      Blockbench.showMessageBox({title: 'CEM-S Studio reference', message: 'This entity has no bundled reference rig. Import or register a vanilla reference model instead.'});
      return;
    }
    addReferenceRig(requestedRig);
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
    guides.forEach(cube => { cube.export = false; });
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
        transforms: {},
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
            export: false,
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
          reference: {rig: 'custom', root: root.uuid || root.name, anchors, bindings: {}, transforms: {}, guides: createdGuides.map(cube => cube.uuid).filter(Boolean)}
        });
        Project.saved = false;
        root.select?.();
        Blockbench.showQuickMessage(`CEM-S Studio: imported ${sourceName} as a reference model.`);
      } catch (error) {
        Blockbench.showMessageBox({title: 'CEM-S Studio reference import failed', message: error.message});
      }
    });
  }

  function exportCurrentProject() {
    autoBindAttachments();
    const elements = [...(Cube.all || []), ...(globalThis.Mesh?.all || [])].filter(element => !isReferenceCube(element, getSettings().reference));
    if (!elements.length) {
      Blockbench.showQuickMessage('CEM-S Studio: add at least one cube or square mesh before exporting.');
      return;
    }
    const settings = getSettings();
    const referencedTextures = collectReferencedTextures(elements, Texture.all || [], {isReference: element => isReferenceCube(element, settings.reference)});
    if (referencedTextures.length > 1) {
      Blockbench.showMessageBox({title: 'CEM-S Studio export', message: 'This model uses multiple textures. Standalone GLSL cannot include a texture atlas; use Build CEM-S Resource Pack so Studio can generate and write the atlas automatically.'});
      return;
    }
    exportDialog = new Dialog({
      id: 'cem_s_studio_export',
      title: `Export CEM-S ${settings.cemVersion} Model`,
      form: {model_id: {label: 'Model ID', type: 'number', value: settings.modelId, min: 0, step: 1}},
      onConfirm(result) {
        exportDialog.hide();
        try {
          const document = currentDocument();
          const entries = toCemModels(document.project.name, elements, {reference: document.project.reference, branches: document.project.detection.branches});
          const exported = entries.length === 1
            ? exportModel(entries[0].model, Number(result.model_id), document.project.cemVersion, {modelScale: entries[0].branch.modelScale})
            : exportModels(entries, Number(result.model_id), document.project.cemVersion);
          Blockbench.export({resource_id: 'cem_s_studio_glsl', type: `CEM-S ${document.project.cemVersion} model`, extensions: ['glsl'], name: document.project.name, content: exported.glsl}, path => Blockbench.showQuickMessage(`CEM-S Studio: exported ${path || document.project.name}.`));
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
      if (content instanceof Uint8Array) fs.writeFileSync(target, content);
      else fs.writeFileSync(target, content, 'utf8');
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

  function exportCurrentPackModel(document) {
    autoBindAttachments();
    const elements = [...(Cube.all || []), ...(globalThis.Mesh?.all || [])];
    const referencedTextures = collectReferencedTextures(elements, Texture.all || [], {isReference: element => isReferenceCube(element, document.project.reference)});
    let textureAtlas = null;
    let textureFile = null;
    if (referencedTextures.length) {
      const profile = profileFor(document.project.targetEntity, document.project.cemVersion);
      const texturePath = document.project.texturePath || profile.texturePath;
      if (!texturePath) throw new Error(`${profile.name} uses a dynamic or custom Minecraft texture. Set Target texture path in Advanced Settings before building.`);
      const expected = profile.textureSize || [];
      const primaryTexture = referencedTextures.find(texture => texture.width === expected[0] && texture.height === expected[1]);
      if (!primaryTexture) throw new Error(`${profile.name} needs one referenced ${expected[0]}x${expected[1]} base entity texture before its additional Blockbench textures can be packed.`);
      textureAtlas = renderTextureAtlas(referencedTextures, {primaryTexture, marker: {pixel: document.project.detection.pixel, color: document.project.detection.color}});
      textureFile = {path: texturePath, content: textureAtlas.png, baseSize: expected.slice()};
    }
    const entries = toCemModels(document.project.name, elements, {reference: document.project.reference, branches: document.project.detection.branches, textureAtlas});
    const exported = entries.length === 1
      ? exportModel(entries[0].model, document.project.modelId, document.project.cemVersion, {modelScale: entries[0].branch.modelScale})
      : exportModels(entries, document.project.modelId, document.project.cemVersion);
    return {glsl: exported.glsl, textureFile};
  }

  async function buildResourcePack(mode) {
    try {
      const document = currentDocument();
      const selected = Blockbench.pickDirectory({title: mode === 'new' ? 'Choose where to create the resource pack' : 'Choose existing CEM-S resource pack folder', resource_id: 'cem_s_studio_pack'});
      if (!selected) return;
      const path = require('path');
      const root = mode === 'new' ? path.join(selected, slugify(document.project.resourcePack.name)) : selected;
      const fs = getFileSystem(selected);
      if (mode === 'new' && fs.existsSync(root) && fs.readdirSync(root).length) {
        throw new Error(`The folder "${root}" is not empty. Choose another location or use Update an existing CEM-S pack.`);
      }
      const runtimeFiles = mode === 'new' ? await loadRuntimeFiles(document.project.cemVersion) : {};
      const workspace = document.workspace;
      const modelGlslById = {};
      const textureFiles = {};
      const originalActive = workspace?.activeModel;
      const models = workspace?.models?.length ? workspace.models : [{id: '__current', project: document.project, blockbench: document.blockbench}];
      try {
        for (const model of models) {
          if (workspace && model.id !== originalActive) {
            const loaded = parseProject({format: 'cemst', formatVersion: CURRENT_VERSION, project: model.project, blockbench: model.blockbench});
            baseProjectCodec.parse(loaded.blockbench, Project.save_path || 'cem_s_studio_workspace.bbmodel');
            Project.cem_studio = loaded.project;
          }
          const current = currentSingleDocument();
          const exported = exportCurrentPackModel(current);
          modelGlslById[model.id] = exported.glsl;
          if (exported.textureFile) textureFiles[model.id] = exported.textureFile;
        }
      } finally {
        if (workspace && originalActive && workspace.models.find(model => model.id === originalActive)) switchWorkspaceModel(originalActive);
      }
      const generated = workspace?.models?.length
        ? buildWorkspacePackFiles(document, modelGlslById, {runtimeFiles, textureFiles})
        : buildPackFiles(document, modelGlslById['__current'], {runtimeFiles, textureFile: textureFiles['__current']});
      const aggregatorFiles = ['assets/minecraft/shaders/include/cem_user/models.glsl', 'assets/minecraft/shaders/include/cem_user/detection.glsl', 'pack.mcmeta'];
      const files = mode === 'new' ? generated : mergePackFiles(readExistingFiles(root, aggregatorFiles, fs), generated, document);
      writeFiles(root, files, fs);
      Project.saved = false;
      Blockbench.showQuickMessage(`CEM-S Studio: resource pack built at ${root}`);
    } catch (error) {
      Blockbench.showMessageBox({title: 'CEM-S Studio resource-pack build failed', message: error.message});
    }
  }

  function installProjectFormat() {
    installRenderProperties();
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
        Project.cem_workspace = document.formatVersion === CURRENT_VERSION ? document.workspace : null;
        Project.name = document.project.name;
      }
    });
    projectFormat = new ModelFormat('cem_s_studio', {
      name: 'CEM-S Studio',
      description: 'Blockbench project format for CEM-S shader models on Minecraft 1.21.6, 1.21.11, and 26.1+.',
      category: 'minecraft',
      target: 'Minecraft',
      icon: 'extension',
      show_on_start_screen: true,
      show_in_new_list: true,
      box_uv: false,
      optional_box_uv: true,
      single_texture: false,
      per_texture_uv_size: true,
      bone_rig: true,
      rotate_cubes: true,
      meshes: true,
      centered_grid: true,
      codec: projectCodec,
      onSetup() {
        if (!Project.cem_studio) {
          Project.cem_studio = defaultSettings();
          Project.cem_workspace = null;
          setTimeout(() => {
            if (Format === projectFormat && Project?.cem_studio) showProjectSettings(false);
          }, 0);
        }
      }
    });
    projectCodec.format = projectFormat;
    saveAction = new Action('save_cemst_project', {name: 'Save CEM-S Studio Project', icon: 'save', category: 'file', condition: () => Format === projectFormat && !!Project, click: () => projectCodec.export()});
    settingsAction = new Action('cem_s_studio_project_settings', {name: 'CEM-S Studio Project Setup', icon: 'settings', category: 'tools', condition: () => Format === projectFormat && !!Project, click: () => showProjectSettings(false)});
    advancedSettingsAction = new Action('cem_s_studio_advanced_detection', {name: 'Advanced Detection Settings', icon: 'tune', category: 'tools', condition: () => Format === projectFormat && !!Project, click: () => showProjectSettings(true)});
    buildAction = new Action('build_cem_s_resource_pack', {name: 'Build CEM-S Resource Pack: Create New', icon: 'create_new_folder', category: 'file', condition: () => Format === projectFormat && !!Project, click: () => buildResourcePack('new')});
    updateBuildAction = new Action('update_cem_s_resource_pack', {name: 'Build CEM-S Resource Pack: Update Existing', icon: 'system_update_alt', category: 'file', condition: () => Format === projectFormat && !!Project, click: () => buildResourcePack('update')});
    exportAction = new Action('export_cem_s_studio', {name: 'Export CEM-S Model', icon: 'save', category: 'file.export', condition: () => Format === projectFormat && !!Project, click: exportCurrentProject});
    addReferenceAction = new Action('cem_s_studio_add_reference', {name: 'Add Entity Reference Model', icon: 'accessibility', category: 'tools', condition: () => Format === projectFormat && !!Project, click: addConfiguredReference});
    importReferenceAction = new Action('cem_s_studio_import_reference', {name: 'Import Vanilla Reference Model (.bbmodel)', icon: 'folder_open', category: 'tools', condition: () => Format === projectFormat && !!Project, click: importReferenceModel});
    registerReferenceAction = new Action('cem_s_studio_register_reference', {name: 'Register Selected Group as Reference Model', icon: 'bookmark', category: 'tools', condition: () => Format === projectFormat && !!Project, click: registerSelectedReference});
    bindReferenceAction = new Action('cem_s_studio_bind_reference', {name: 'Bind or Move Selected Parts to Reference Anchor', icon: 'link', category: 'tools', condition: () => Format === projectFormat && !!Project, click: showRebindAttachmentDialog});
    renderSettingsAction = new Action('cem_s_studio_render_settings', {name: 'CEM-S Render Properties', icon: 'palette', category: 'tools', condition: () => Format === projectFormat && !!Project, click: showRenderSettingsDialog});
    resetAttachmentAction = new Action('cem_s_studio_reset_attachment', {name: 'Reset Attachment to Anchor', icon: 'my_location', category: 'tools', condition: () => Format === projectFormat && !!Project, click: resetSelectedAttachments});
    addWorkspaceModelAction = new Action('cem_s_studio_add_workspace_model', {name: 'Add Model to CEM-S Workspace', icon: 'add', category: 'tools', condition: () => Format === projectFormat && !!Project, click: addWorkspaceModel});
    studioMenu = new BarMenu('cem_s_studio', [
      settingsAction,
      addReferenceAction,
      importReferenceAction,
      registerReferenceAction,
      bindReferenceAction,
      renderSettingsAction,
      resetAttachmentAction,
      addWorkspaceModelAction,
      buildAction,
      updateBuildAction,
      advancedSettingsAction,
      saveAction
    ], {name: 'CEM-S Studio', icon: 'extension', condition: () => Format === projectFormat && !!Project});
    MenuBar.addMenu(studioMenu, 'tools');
    // Panel installation is deferred until the plugin has fully installed its
    // Blockbench event handlers, so it cannot interfere with binding events.
    setTimeout(installStudioPanel, 0);
  }

  Plugin.register('cem_s_studio', {
    title: 'CEM-S Studio',
    author: 'CEM-S Studio contributors',
    description: 'A Blockbench project format and resource-pack builder for CEM-S on Minecraft 1.21.6, 1.21.11, and 26.1+.',
    icon: 'extension',
    version: '0.7.0',
    min_version: '4.12.0',
    variant: 'desktop',
    onload() {
      installProjectFormat();
      installTextureGeneratorGuard();
      installBindingSync();
    },
    onunload() {
      uninstallBindingSync();
      uninstallTextureGeneratorGuard();
      [saveAction, settingsAction, advancedSettingsAction, buildAction, updateBuildAction, exportAction, addReferenceAction, importReferenceAction, registerReferenceAction, bindReferenceAction, renderSettingsAction, resetAttachmentAction, addWorkspaceModelAction].forEach(action => action && action.delete());
      if (studioMenu) studioMenu.delete?.();
      if (studioPanel) { studioPanel.delete?.(); studioPanel = null; }
      [exportDialog, settingsDialog, buildDialog].forEach(dialog => dialog && dialog.delete());
      if (projectCodec) projectCodec.delete();
      if (projectFormat) projectFormat.delete();
    }
  });
}());
