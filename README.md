# CEM-S Studio

`CEM-S Studio` is a Blockbench plugin that converts native Blockbench cubes into a CEM-S 1.21.6 model GLSL switch case. It deliberately reuses Blockbench's own outliner, transform tools, textures and cube editor rather than replacing them with custom panels.

## Current scope

- Exports cubes as `ADD_BOX`.
- Exports a single-axis cube rotation and its Blockbench pivot as `ADD_BOX_ROTATE`.
- Preserves Blockbench face UV rectangles in CEM-S face order: down, up, north, east, south, west.
- Targets CEM-S 1.21.6 only.

The exporter asks for a numeric model ID. Use the same ID in the matching CEM-S detection file, then add the generated `case <ID>` block to the appropriate `models.glsl` switch.

## Development installation

1. Clone or download this repository.
2. Run `npm run build`.
3. In desktop Blockbench, choose **File â†?Plugins â†?Load Plugin from File**.
4. Select the generated `plugin.js`.
5. Model with ordinary Blockbench cubes, then choose **File â†?Export â†?Export CEM-S 1.21.6 Model**.

## Deliberately not in 0.1

- Meshes, locator-only parts, animation and animation export.
- Non-uniform group scale, rotated/disabled faces, meshes and animation. The exporter stops with a diagnostic instead of silently producing a different model.
- Automatic detection-file generation and model ID allocation.
- Automatic installation into a Minecraft resource pack.

These are planned only after validating the generated GLSL against live CEM-S 1.21.6 packs.
