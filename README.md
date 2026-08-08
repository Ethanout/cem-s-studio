# CEM-S Studio

[简体中文](README.zh-CN.md)

`CEM-S Studio` is a Blockbench plugin for creating CEM-S 1.21.6 models. It reuses Blockbench's normal outliner, transform tools, textures, and cube editor. Users work with a `.cemst` project file and do not need to write GLSL.

## User workflow

1. Build the plugin with `npm run build`.
2. In Blockbench, choose **File -> Plugins -> Load Plugin from File** and select `cem_s_studio.js`.
3. Create a new project using the **CEM-S Studio** format.
4. Use **Tools -> CEM-S Studio Project Settings** to set the project name, model ID, target entity, texture marker pixel, and resource-pack metadata.
   For attachments, use **Tools -> Add Player Reference Model** or **Tools -> Import Vanilla Reference Model (.bbmodel)**. The latter accepts a model exported by a vanilla/entity-model importer, adds it to the current project without replacing it, and registers its cubes as guides. You can also register any already imported root Group with **Register Selected Group as Reference Model**.
5. Save the project as a `.cemst` file with **File -> Save CEM-S Studio Project**.
6. Choose **File -> Build CEM-S Resource Pack**:
   - **Create a new resource pack** asks for a parent directory, then creates a named pack folder containing `pack.mcmeta`, the pinned CEM-S 1.21.6 runtime, model files, detection files, and the `.cemst` metadata copy. It refuses to overwrite a non-empty pack folder.
   - **Update an existing CEM-S pack** writes the model files and updates only the CEM-S Studio managed sections in the aggregators. Other user content is preserved.

The generated folder can be copied directly into Minecraft's `resourcepacks` directory. GLSL is an implementation detail of the generated pack, not an authoring requirement.

## Current scope

- Cubes export as `ADD_BOX`.
- Single-axis cube rotation exports as `ADD_BOX_ROTATE`.
- Parent-group and multi-axis rotations are baked into generated `mat3` transforms.
- Blockbench face UV rectangles are preserved in CEM-S face order.
- CEM-S 1.21.6 is the current target.
- Detection presets for Pig, Cold Pig, Arrow, and Sheep automatically choose the CEM-S anchor face. Custom detection exposes face count/index and orientation controls without requiring GLSL edits.
- Presets include the CEM-S texture marker position and color. For Custom, put the configured marker pixel/color in the entity texture; the plugin generates the detection GLSL for you.
- Add a Player Reference model or register any imported mob Group, then bind attachment Groups to named anchors. Reference guide cubes are excluded automatically from export.
- Import arbitrary vanilla/community `.bbmodel` files as reference skeletons; no per-mob hardcoded model list is required.
- Choose an Entity/Mob or Armor/Equipment render target for body attachments, armor, elytra, and similar equipment layers.
- Non-uniform scale, meshes, disabled/rotated faces, locators, and animation export are rejected with diagnostics.

## Development

Run `npm test` for the unit suite and `npm run check` for the build and syntax checks.

The plugin bundles the CEM-S 1.21.6 runtime from commit `fb82f20698e8972f241574a9390413f385c8bddb`, so creating a pack does not require network access. The included runtime is licensed under MIT; see `THIRD-PARTY-LICENSES/CEM-S-MIT.txt`.
