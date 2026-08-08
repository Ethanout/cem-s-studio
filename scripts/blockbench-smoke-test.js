const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const port = Number(process.env.BLOCKBENCH_DEBUG_PORT || 9223);
const root = path.resolve(__dirname, '..');

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

async function main() {
  const client = await connect();
  const packPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cem-s-studio-smoke-'));
  const newPackPath = path.join(packPath, 'new-pack');
  const createdPackPath = path.join(newPackPath, 'smoke_pack');
  fs.mkdirSync(newPackPath);
  try {
    const exceptions = [];
    await client.call('Runtime.enable');
    await client.call('Log.enable');
    console.log('Blockbench smoke: loading plugin');
    const pluginPath = path.join(root, 'cem_s_studio.js');
    const load = await client.call('Runtime.evaluate', {
      expression: `(async () => { try { await new Plugin().loadFromFile({path: ${JSON.stringify(pluginPath)}, name: ${JSON.stringify(pluginPath)}, content: ''}, false); return {ok: true}; } catch (error) { return {ok: false, message: error.stack || error.message}; } })()`,
      returnByValue: true,
      awaitPromise: true
    });
    const loadValue = load.result.value;
    if (!loadValue?.ok) throw new Error(`Plugin load failed: ${loadValue?.message || 'unknown error'}`);
    const bundleProbe = await client.call('Runtime.evaluate', {
      expression: `(async () => { const files = await CemSRuntime.loadRuntimeFiles(); return {runtimeFileCount: Object.keys(globalThis.CemSBundledRuntime || {}).length, loadedFileCount: Object.keys(files).length, hasEntityShader: !!files['assets/minecraft/shaders/core/entity.fsh']}; })()`,
      returnByValue: true,
      awaitPromise: true
    });
    console.log(`Blockbench smoke: bundled runtime ${JSON.stringify(bundleProbe.result.value)}`);
    console.log('Blockbench smoke: probing project and resource-pack workflow');

    let probe;
    try {
      probe = await client.call('Runtime.evaluate', {
      expression: `(async () => {
        globalThis.__cemSmokeStage = 'setup';
        const format = Formats.cem_s_studio;
        if (!format) return {ok: false, message: 'CEM-S Studio format is not registered'};
        format.new();
        if (Dialog.open) Dialog.open.hide();
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

        globalThis.__cemSmokeStage = 'update_pack';
        BarItems.build_cem_s_resource_pack.click();
        const packDialog = Dialog.open;
        const buildModes = Object.keys(packDialog.form?.form_config?.mode?.options || {});
        const originalPickDirectory = Blockbench.pickDirectory;
        Blockbench.pickDirectory = () => ${JSON.stringify(packPath)};
        await packDialog.onConfirm({mode: 'update'});

        globalThis.__cemSmokeStage = 'new_pack';
        Project.cem_studio.resourcePack.name = 'Smoke Pack';
        BarItems.build_cem_s_resource_pack.click();
        const newPackDialog = Dialog.open;
        Blockbench.pickDirectory = () => ${JSON.stringify(newPackPath)};
        await newPackDialog.onConfirm({mode: 'new'});
        globalThis.__cemSmokeStage = 'new_pack_done';
        const newPackDialogState = Dialog.open ? {
          id: Dialog.open.id,
          title: Dialog.open.title,
          text: Dialog.open.node?.innerText || ''
        } : null;
        Blockbench.pickDirectory = originalPickDirectory;
        return {
          ok: true,
          blockbenchVersion: Blockbench.version,
          formatSelected: Format === format,
          codecRegistered: !!Codecs.cemst,
          actions: {
            save: !!BarItems.save_cemst_project,
            settings: !!BarItems.cem_s_studio_project_settings,
            buildPack: !!BarItems.build_cem_s_resource_pack,
            addReference: !!BarItems.cem_s_studio_add_player_reference,
            importReference: !!BarItems.cem_s_studio_import_reference,
            registerReference: !!BarItems.cem_s_studio_register_reference,
            bindReference: !!BarItems.cem_s_studio_bind_reference
          },
          rawFormat: raw.format,
          parsedFormat: parsed.format,
          formatVersion: parsed.formatVersion,
          projectName: parsed.project.name,
          projectHasSettings: !!Project.cem_studio,
          cubeCountAfterOpen: Cube.all.length,
          settingsFields,
          buildModes,
          newPackDialogState
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
    const required = [result.formatSelected, result.codecRegistered, result.actions.save, result.actions.settings, result.actions.buildPack, result.actions.addReference, result.actions.importReference, result.actions.registerReference, result.actions.bindReference, result.rawFormat === 'cemst', result.parsedFormat === 'cemst', result.formatVersion === 1, result.projectName === 'Smoke Pig', result.projectHasSettings, result.cubeCountAfterOpen === 1, result.settingsFields.includes('model_id'), result.settingsFields.includes('target_entity'), result.settingsFields.includes('render_target'), result.settingsFields.includes('detection_preset'), result.settingsFields.includes('face_count'), result.settingsFields.includes('face_number'), result.buildModes.includes('new'), result.buildModes.includes('update')];
    if (required.some(value => !value)) throw new Error(`Blockbench probe returned incomplete state: ${JSON.stringify(result)}`);
    const expectedPackFiles = [
      'assets/minecraft/shaders/include/cem_user/models.glsl',
      'assets/minecraft/shaders/include/cem_user/detection.glsl',
      'cem-studio/project.json'
    ];
    for (const relative of expectedPackFiles) {
      if (!fs.existsSync(path.join(packPath, relative))) throw new Error(`Resource-pack build did not create ${relative}`);
    }
    const expectedNewPackFiles = [
      ...expectedPackFiles,
      'pack.mcmeta',
      'assets/minecraft/shaders/core/entity.fsh',
      'assets/minecraft/shaders/core/entity.vsh',
      'THIRD-PARTY-LICENSES/CEM-S-MIT.txt'
    ];
    for (const relative of expectedNewPackFiles) {
      if (!fs.existsSync(path.join(createdPackPath, relative))) throw new Error(`New resource-pack build did not create ${relative}: ${JSON.stringify(result.newPackDialogState)}`);
    }

    const screenshot = await client.call('Page.captureScreenshot', {format: 'png'});
    const screenshotPath = path.join(os.tmpdir(), 'cem-s-studio-blockbench-smoke.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(JSON.stringify({...result, screenshot: screenshotPath}, null, 2));
  } finally {
    client.close();
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
