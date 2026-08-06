(function () {
  const {exportModel} = CemSExporter;
  const {toCemModel} = CemSBlockbenchAdapter;
  let exportAction;
  let exportDialog;

  function exportWithModelId(cubes, modelName, modelId) {
    try {
      const exported = exportModel(toCemModel(modelName, cubes), Number(modelId));
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

  function exportCurrentProject() {
    const cubes = Cube.all || [];
    if (!cubes.length) {
      Blockbench.showQuickMessage('CEM-S Studio: add at least one cube before exporting.');
      return;
    }

    const modelName = Project.name || 'cem_model';
    exportDialog = new Dialog({
      id: 'cem_s_studio_export',
      title: 'Export CEM-S 1.21.6 Model',
      form: {
        model_id: {
          label: 'Model ID',
          description: 'Use the same numeric ID in the CEM-S detection file.',
          type: 'number',
          value: 1,
          min: 0,
          step: 1
        }
      },
      onConfirm(result) {
        exportDialog.hide();
        exportWithModelId(cubes, modelName, result.model_id);
      }
    });
    exportDialog.show();
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
      exportAction = new Action('export_cem_s_studio', {name: 'Export CEM-S 1.21.6 Model', icon: 'save', click: exportCurrentProject});
      MenuBar.addAction(exportAction, 'file.export');
    },
    onunload() {
      if (exportAction) exportAction.delete();
      if (exportDialog) exportDialog.delete();
    }
  });
}());
