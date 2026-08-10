# CEM-S Studio

[简体中文](README.zh-CN.md)

`CEM-S Studio` is a Blockbench plugin for creating CEM-S models for Minecraft 1.21.6, 1.21.11, and 26.1+. It reuses Blockbench's normal outliner, transform tools, textures, and cube editor. Users work with a `.cemst` project file and do not need to write GLSL.

## User workflow

1. Build the plugin with `npm run build`.
2. In Blockbench, choose **File -> Plugins -> Load Plugin from File** and select `cem_s_studio.js`.
3. Create a new project using the **CEM-S Studio** format.
4. The first time a project is created, CEM-S Studio opens **Project Setup** automatically. Choose the Minecraft version, model ID, entity type, and resource-pack name. The entity selector is backed by a versioned database and automatically selects the CEM-S detection profile and reference rig. Pig, cold pig, sheep, arrow, and elytra profiles are verified; Player and Custom entity profiles intentionally open the advanced detection path because their marker rules depend on the source pack.
   Reference guides are created automatically when the selected profile provides one. For other entities, use **Import Vanilla Reference Model (.bbmodel)** or register an imported root Group with **Register Selected Group as Reference Model**. Drag an author Group into a reference anchor to attach it; the binding is synchronized automatically before saving or exporting.
5. Save the project as a `.cemst` file with **File -> Save CEM-S Studio Project**.
6. Open the **CEM-S Studio** top-level menu. Use **Build CEM-S Resource Pack: Create New** for a new pack or **Build CEM-S Resource Pack: Update Existing** for an existing pack. The commands create or update `pack.mcmeta`, the selected bundled runtime, model files, detection files, and `.cemst` metadata while preserving unmanaged user content.

The generated folder can be copied directly into Minecraft's `resourcepacks` directory. GLSL is an implementation detail of the generated pack, not an authoring requirement.

## Current scope

- Cubes export as `ADD_BOX`.
- Single-axis cube rotation exports as `ADD_BOX_ROTATE`.
- Parent-group and multi-axis rotations are baked into generated `mat3` transforms.
- Blockbench face UV rectangles are preserved in CEM-S face order.
- Bundled runtimes are provided for Minecraft 1.21.6, 1.21.11, and 26.1+ (the latter uses the 26.1.2 shader and pack-format profile). The current real-client verification evidence is for Fabric Minecraft 1.21.11; the other runtimes should be treated as release-candidate support until separately tested.
- The versioned entity database currently includes Pig, Cold Pig, Sheep, Arrow, Elytra, Player, and Custom profiles. Pig, Cold Pig, Sheep, Arrow, and Elytra automatically choose the CEM-S anchor rule. Player and Custom expose the expert detection controls without inventing unverified marker values.
- Presets include the CEM-S texture marker position and color. For Custom, put the configured marker pixel/color in the entity texture; the plugin generates the detection GLSL for you.
- Add a Player Reference model or register any imported mob Group, then bind attachment Groups to named anchors. Reference guide cubes are excluded automatically from export.
- Import arbitrary vanilla/community `.bbmodel` files as reference skeletons; no per-mob hardcoded model list is required.
- Reference guides stay visible in the editor but are excluded from Blockbench Create Texture templates and model export.
- Multiple user textures are collected into a PNG atlas during resource-pack build. Cube and square UVs are remapped, reference-guide textures are excluded, and the generated detection shader compensates the original entity UV size when the atlas is larger than the vanilla texture.
- Texture source can be `static_atlas`, `host_sampler0`, or `animated_sampler0`. Host mode samples the current entity/player texture without baking a copy; animated mode samples a vertical frame strip from `Sampler0` using `GameTime`. Cross-render-layer independent samplers still require a CEM-S/Fabric runtime extension.
- Choose an Entity/Mob or Armor/Equipment render target for body attachments, armor, elytra, and similar equipment layers.
- Arbitrary animated models and non-rectangular mesh faces are not exported. Cube rotation, parent transforms, square meshes, locators, disabled faces, and per-face UV rotation are supported; unsupported geometry is rejected with diagnostics.

## Development

Run `npm test` for the unit suite and `npm run check` for the build and syntax checks.

The plugin bundles CEM-S from commit `fb82f20698e8972f241574a9390413f385c8bddb` plus maintained compatibility shaders for Minecraft 1.21.11 and 26.1.2, so creating a pack does not require network access. The included CEM-S runtime is licensed under MIT; see `THIRD-PARTY-LICENSES/CEM-S-MIT.txt`.
