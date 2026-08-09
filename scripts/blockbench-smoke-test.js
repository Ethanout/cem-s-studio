const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');

const port = Number(process.env.BLOCKBENCH_DEBUG_PORT || 9235);
const root = path.resolve(__dirname, '..');
let spawnedBlockbench;
let spawnedProfile;

async function endpointReady() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    if (!response.ok) return false;
    const pages = await response.json();
    return pages.some(entry => entry.type === 'page' && /Blockbench/i.test(entry.title));
  } catch {
    return false;
  }
}

async function launchInstalledBlockbench() {
  if (process.env.BLOCKBENCH_DEBUG_PORT) return;
  const executable = process.env.BLOCKBENCH_PATH || path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Blockbench', 'Blockbench.exe');
  if (!fs.existsSync(executable)) throw new Error(`Latest installed Blockbench was not found at ${executable}. Set BLOCKBENCH_PATH to the current executable.`);
  spawnedProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'cem-s-studio-blockbench-'));
  spawnedBlockbench = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${spawnedProfile}`], {stdio: 'ignore'});
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await endpointReady()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Installed Blockbench did not open debug port ${port}`);
}

async function connect() {
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  const page = pages.find(entry => entry.type === 'page' && /Blockbench/i.test(entry.title));
  if (!page) throw new Error(`No Blockbench page found on debug port ${port}`);
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, {once: true});
    socket.addEventListener('error', reject, {once: true});
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const {resolve, reject, timer} = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(timer);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  return {
    call(method, params = {}, timeoutMs = 10000) {
      const requestId = ++id;
      socket.send(JSON.stringify({id: requestId, method, params}));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error(`Timed out waiting for Blockbench CDP method ${method}`));
        }, timeoutMs);
        pending.set(requestId, {resolve, reject, timer});
      });
    },
    close() { socket.close(); }
  };
}

async function loadPluginWhenReady(client, pluginPath) {
  let lastMessage = 'Blockbench plugin API did not become ready';
  for (let attempt = 0; attempt < 40; attempt++) {
    const load = await client.call('Runtime.evaluate', {
      expression: `(async () => { try { await new Plugin('cem_s_studio').loadFromFile({path: ${JSON.stringify(pluginPath)}, name: ${JSON.stringify(pluginPath)}, content: ''}, false); return {ok: true}; } catch (error) { return {ok: false, message: error.stack || error.message}; } })()`,
      returnByValue: true,
      awaitPromise: true
    });
    const value = load.result.value;
    if (value?.ok) return;
    lastMessage = value?.message || lastMessage;
    if (!/Illegal constructor|not defined|not a constructor/i.test(lastMessage)) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Plugin load failed: ${lastMessage}`);
}

async function main() {
  if (!(await endpointReady())) await launchInstalledBlockbench();
  const client = await connect();
  const packPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cem-s-studio-smoke-'));
  const newPackPath = path.join(packPath, 'new-pack');
  const createdPackPaths = {
    '1.21.11': path.join(newPackPath, 'smoke_1_21_11'),
    '26.1+': path.join(newPackPath, 'smoke_26_1')
  };
  fs.mkdirSync(newPackPath);
  try {
    const exceptions = [];
    await client.call('Runtime.enable');
    await client.call('Log.enable');
    console.log('Blockbench smoke: loading plugin');
    const pluginPath = path.join(root, 'cem_s_studio.js');
    await loadPluginWhenReady(client, pluginPath);
    const bundleProbe = await client.call('Runtime.evaluate', {
      expression: `(async () => { const versions = ['1.21.6', '1.21.11', '26.1+']; const loaded = {}; for (const version of versions) { const files = await CemSRuntime.loadRuntimeFiles(version); loaded[version] = {fileCount: Object.keys(files).length, hasEntityShader: !!files['assets/minecraft/shaders/core/entity.fsh']}; } return {runtimeVersionCount: Object.keys(globalThis.CemSBundledRuntime || {}).length, loaded}; })()`,
      returnByValue: true,
      awaitPromise: true
    });
    const bundleState = bundleProbe.result.value;
    if (bundleState?.runtimeVersionCount !== 3 || !['1.21.6', '1.21.11', '26.1+'].every(version => bundleState.loaded?.[version]?.hasEntityShader)) {
      throw new Error(`Bundled runtime probe returned incomplete state: ${JSON.stringify(bundleState)}`);
    }
    console.log(`Blockbench smoke: bundled runtime ${JSON.stringify(bundleState)}`);
    console.log('Blockbench smoke: probing project and resource-pack workflow');

    let probe;
    try {
      probe = await client.call('Runtime.evaluate', {
      expression: `(async () => {
        globalThis.__cemSmokeStage = 'setup';
        const format = Formats.cem_s_studio;
        if (!format) return {ok: false, message: 'CEM-S Studio format is not registered'};
        format.new();
        await new Promise(resolve => setTimeout(resolve, 20));
        const initialSetupFields = Object.keys(Dialog.open?.form?.form_config || {});
        if (Dialog.open) Dialog.open.hide();
        BarItems.cem_s_studio_project_settings.click();
        const setupDialog = Dialog.open;
        await setupDialog.onConfirm({project_name: 'Smoke Pig', minecraft_version: '1.21.6', model_id: 1, entity_profile: 'pig', pack_name: 'Smoke Pack'});
        const autoReferenceRig = Project.cem_studio.reference?.rig;
        Project.name = 'Smoke Pig';
        new Cube({name: 'body', from: [0, 0, 0], to: [4, 4, 4]}).init();
        const raw = Codecs.cemst.compile({raw: true});
        const text = Codecs.cemst.compile();
        const parsed = JSON.parse(text);
        Codecs.cemst.load(parsed, {path: ${JSON.stringify(path.join(packPath, 'smoke.cemst'))}, name: 'smoke.cemst', content: text});

        globalThis.__cemSmokeStage = 'settings_dialog';
        BarItems.cem_s_studio_project_settings.click();
        const settingsDialog = Dialog.open;
        const settingsFields = Object.keys(settingsDialog.form?.form_config || {});
        settingsDialog.hide();
        BarItems.cem_s_studio_advanced_detection.click();
        const advancedSettingsDialog = Dialog.open;
        const advancedSettingsFields = Object.keys(advancedSettingsDialog.form?.form_config || {});
        advancedSettingsDialog.hide();

        globalThis.__cemSmokeStage = 'player_reference';
        BarItems.cem_s_studio_add_reference.click();
        const referenceGuides = Cube.all.filter(cube => cube.name.startsWith('[CEM-S Reference]'));
        const referenceState = {
          guideCount: referenceGuides.length,
          allVisible: referenceGuides.every(cube => cube.visibility),
          allExcludedFromExport: referenceGuides.every(cube => cube.export === false),
          allUntextured: referenceGuides.every(cube => Object.values(cube.faces).every(face => !face.texture)),
          referenceTextureAbsent: !Texture.all.some(texture => texture.name === 'CEM-S Player Reference')
        };
        const authorCube = Cube.all.find(cube => cube.name === 'body' && !cube.name.startsWith('[CEM-S Reference]'));
        const bodyAnchor = Group.all.find(group => group.uuid === Project.cem_studio.reference.anchors.body);
        authorCube.addTo(bodyAnchor);
        Blockbench.dispatchEvent('update_selection');
        await new Promise(resolve => setTimeout(resolve, 0));
        const realtimeBound = Project.cem_studio.reference.bindings[authorCube.uuid] === 'body';
        const authorRoot = new Group({name: 'Author Model'}).init();
        authorCube.addTo(authorRoot);
        Blockbench.dispatchEvent('update_selection');
        await new Promise(resolve => setTimeout(resolve, 0));
        const realtimeUnbound = !Project.cem_studio.reference.bindings[authorCube.uuid];

        globalThis.__cemSmokeStage = 'square_mesh';
        const squareMesh = new Mesh({name: 'Smoke Square', vertices: {}, faces: {}}).init();
        const squareVertices = squareMesh.addVertices([0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]);
        const squareFace = new MeshFace(squareMesh, {vertices: squareVertices});
        squareFace.uv[squareVertices[0]] = [0, 0];
        squareFace.uv[squareVertices[1]] = [4, 0];
        squareFace.uv[squareVertices[2]] = [4, 4];
        squareFace.uv[squareVertices[3]] = [0, 4];
        squareMesh.addFaces(squareFace);
        const squareModel = CemSBlockbenchAdapter.toCemModel('smoke_square', [squareMesh]);
        const meshSquareExported = squareModel.parts.length === 1 && squareModel.parts[0].type === 'square';
        const meshSquareState = {vertexCount: Object.keys(squareMesh.vertices).length, faceCount: Object.keys(squareMesh.faces).length, parts: squareModel.parts.map(part => ({name: part.name, type: part.type}))};
        squareMesh.remove();

        const studioMenu = MenuBar.menus.cem_s_studio;
        const studioPanel = Panels?.cem_s_studio_panel;
        const formatSelected = Format === format;
        const primaryTexture = new Texture({name: 'Smoke Entity Texture', width: 64, height: 32}).add(false);
        primaryTexture.canvas.width = 64;
        primaryTexture.canvas.height = 32;
        primaryTexture.canvas.getContext('2d').fillRect(0, 0, 64, 32);
        const detailTexture = new Texture({name: 'Smoke Detail Texture', width: 4, height: 4}).add(false);
        detailTexture.canvas.width = 4;
        detailTexture.canvas.height = 4;
        detailTexture.canvas.getContext('2d').fillRect(0, 0, 4, 4);
        authorCube.faces.north.texture = primaryTexture.uuid;
        authorCube.faces.north.uv = [0, 0, 4, 4];
        authorCube.faces.south.texture = detailTexture.uuid;
        authorCube.faces.south.uv = [0, 0, 4, 4];
        const usedTextures = CemSTextureAtlas.collectReferencedTextures([authorCube, ...referenceGuides], Texture.all, {isReference: element => CemSBlockbenchAdapter.isReferenceCube(element, Project.cem_studio.reference)});
        const smokeAtlas = CemSTextureAtlas.renderTextureAtlas(usedTextures, {primaryTexture, marker: {pixel: [63, 0], color: [255, 0, 0, 255]}});
        const atlasModel = CemSBlockbenchAdapter.toCemModel('smoke_atlas', [authorCube], {textureAtlas: smokeAtlas});
        const textureAtlasState = {
          usedTextureCount: usedTextures.length,
          width: smokeAtlas.width,
          height: smokeAtlas.height,
          pngSignature: [...smokeAtlas.png.slice(0, 8)],
          primaryPlacement: smokeAtlas.placements[primaryTexture.uuid],
          detailPlacement: smokeAtlas.placements[detailTexture.uuid],
          northUv: atlasModel.parts[0].faces[2],
          southUv: atlasModel.parts[0].faces[4]
        };
        primaryTexture.remove(false);
        detailTexture.remove(false);
        const entitySearch = studioPanel?.node?.querySelector('[data-cem-entity="search"]');
        const entityProfileSelect = studioPanel?.node?.querySelector('[data-cem-entity="profile"]');
        entitySearch.value = '猪';
        entitySearch.dispatchEvent(new Event('input'));
        const searchResultIds = [...entityProfileSelect.options].map(option => option.value);
        return {
          ok: true,
          blockbenchVersion: Blockbench.version,
          studioMenuName: studioMenu?.name,
          studioMenuLabel: studioMenu?.label?.textContent,
          studioPanelRegistered: !!studioPanel,
          studioPanelText: studioPanel?.node?.textContent?.replace(/\s+/g, ' ').trim(),
          textureAtlasState,
          searchResultIds,
          formatSelected,
          meshFormatEnabled: !!format.meshes,
          meshApiAvailable: typeof Mesh === 'function' && typeof MeshFace === 'function',
          codecRegistered: !!Codecs.cemst,
          actions: {
            save: !!BarItems.save_cemst_project,
            settings: !!BarItems.cem_s_studio_project_settings,
            advancedDetection: !!BarItems.cem_s_studio_advanced_detection,
            buildPack: !!BarItems.build_cem_s_resource_pack,
            updatePack: !!BarItems.update_cem_s_resource_pack,
            addReference: !!BarItems.cem_s_studio_add_reference,
            importReference: !!BarItems.cem_s_studio_import_reference,
            registerReference: !!BarItems.cem_s_studio_register_reference,
            bindReference: !!BarItems.cem_s_studio_bind_reference
          },
          rawFormat: raw.format,
          parsedFormat: parsed.format,
          formatVersion: parsed.formatVersion,
          projectName: parsed.project.name,
          projectHasSettings: !!Project.cem_studio,
          autoReferenceRig,
          initialSetupFields,
          cubeCountAfterOpen: Cube.all.length,
          referenceState,
          realtimeBound,
          realtimeUnbound,
          meshSquareExported,
          meshSquareState,
          settingsFields,
          advancedSettingsFields
        };
      })()`,
      returnByValue: true,
      awaitPromise: true
      }, 60000);
    } catch (error) {
      const stage = await client.call('Runtime.evaluate', {expression: 'globalThis.__cemSmokeStage', returnByValue: true});
      throw new Error(`${error.message}; stage=${stage.result.value || 'unknown'}`);
    }
    if (probe.exceptionDetails) exceptions.push(probe.exceptionDetails.text);
    const result = probe.result.value;
    if (!result?.ok) throw new Error(result?.message || exceptions.join('\n') || 'Blockbench probe failed');
    const required = [result.blockbenchVersion === '5.1.6', result.studioMenuName === 'CEM-S Studio', result.studioMenuLabel === 'CEM-S Studio', result.studioPanelRegistered, /项目状态/.test(result.studioPanelText || ''), result.searchResultIds.includes('pig'), result.searchResultIds.includes('cold_pig'), !result.searchResultIds.includes('arrow'), result.formatSelected, result.meshFormatEnabled, result.meshApiAvailable, result.meshSquareExported, result.textureAtlasState?.usedTextureCount === 2, result.textureAtlasState?.width === 64, result.textureAtlasState?.height === 37, JSON.stringify(result.textureAtlasState?.pngSignature) === JSON.stringify([137,80,78,71,13,10,26,10]), result.textureAtlasState?.primaryPlacement?.x === 0, result.textureAtlasState?.primaryPlacement?.y === 0, result.textureAtlasState?.detailPlacement?.y === 33, result.textureAtlasState?.northUv?.[0] === 0, result.textureAtlasState?.southUv?.[1] === 33, result.codecRegistered, result.actions.save, result.actions.settings, result.actions.advancedDetection, result.actions.buildPack, result.actions.updatePack, result.actions.addReference, result.actions.importReference, result.actions.registerReference, result.actions.bindReference, result.rawFormat === 'cemst', result.parsedFormat === 'cemst', result.formatVersion === 2, result.projectName === 'Smoke Pig', result.projectHasSettings, result.autoReferenceRig === 'pig', result.initialSetupFields.length === 5, result.initialSetupFields.includes('entity_profile'), result.cubeCountAfterOpen === 7, result.referenceState?.guideCount === 6, result.referenceState?.allVisible, result.referenceState?.allExcludedFromExport, result.referenceState?.allUntextured, result.referenceState?.referenceTextureAbsent, result.realtimeBound, result.realtimeUnbound, result.settingsFields.length === 5, result.settingsFields.includes('minecraft_version'), result.settingsFields.includes('model_id'), result.settingsFields.includes('entity_profile'), result.advancedSettingsFields.includes('render_target'), result.advancedSettingsFields.includes('marker_x'), result.advancedSettingsFields.includes('face_count'), result.advancedSettingsFields.includes('face_number')];
    if (required.some(value => !value)) throw new Error(`Blockbench probe returned incomplete state: ${JSON.stringify(result)}`);
    const screenshot = await client.call('Page.captureScreenshot', {format: 'png'});
    const screenshotPath = path.join(os.tmpdir(), 'cem-s-studio-blockbench-smoke.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(JSON.stringify({...result, screenshot: screenshotPath}, null, 2));
  } finally {
    client.close();
    if (spawnedBlockbench) {
      spawnedBlockbench.kill();
      await new Promise(resolve => {
        spawnedBlockbench.once('exit', resolve);
        setTimeout(resolve, 2000);
      });
    }
    if (spawnedProfile && fs.existsSync(spawnedProfile)) {
      try {
        fs.rmSync(spawnedProfile, {recursive: true, force: true});
      } catch (error) {
        console.warn(`Blockbench test profile cleanup deferred: ${error.message}`);
      }
    }
    const safePrefix = path.join(os.tmpdir(), 'cem-s-studio-smoke-');
    if (path.resolve(packPath).startsWith(path.resolve(safePrefix))) fs.rmSync(packPath, {recursive: true, force: true});
  }
}

main().then(() => {
  process.exit(0);
}).catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
