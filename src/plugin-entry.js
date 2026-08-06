(function () {
  const {exportModel} = CemSExporter;
  const {toCemModel} = CemSBlockbenchAdapter;
  let exportAction;

  function exportCurrentProject() {
    const cubes = Cube.all || [];
    if (!cubes.length) {
      Blockbench.showQuickMessage('CEM-S Studio: add at least one cube before exporting.');
      return;
    }

    try {
      const modelName = Project.name || 'cem_model';
      const value = window.prompt('CEM-S model ID (must match the detection file)', '1');
      if (value === null) return;
      const modelId = Number(value);
      const exported = exportModel(toCemModel(modelName, cubes), modelId);
      Blockbench.export({
    resource_id: 'cem_s_studio_glsl',
        type: 'CEM-S 1.21.6 model',
        extensions: ['glsl'],
        name: modelName
      }, (path) => {
        if (!path) return;
        Blockbench.writeFile(path, {content: exported.glsl});
        Blockbench.showQuickMessage('CEM-S Studio: GLSL model exported.');
      });
    } catch (error) {
      Blockbench.showMessageBox({title: 'CEM-S Studio export failed', message: error.message});
    }
  }

  Plugin.register('cem_s_studio', {
    title: 'CEM-S Studio',
    author: 'CEM-S Studio contributors',
    description: 'Exports Blockbench cubes to CEM-S 1.21.6 GLSL.',
    icon: 'extension',
    version: '0.1.0',
    min_version: '4.12.0',
    variant: 'desktop',
    onload() {
      exportAction = new Action('export_cem_s_forge', {name: 'Export CEM-S 1.21.6 Model', icon: 'save', click: exportCurrentProject});
      MenuBar.addAction(exportAction, 'file.export');
    },
    onunload() {
      if (exportAction) exportAction.delete();
    }
  });
}());
