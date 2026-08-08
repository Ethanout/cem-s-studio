# CEM-S Studio

CEM-S Studio 是面向 CEM-S 1.21.6 的 Blockbench 插件。建模、层级、旋转和 UV 都使用 Blockbench 原生界面；项目保存为 `.cemst`，用户不需要创建或编辑 GLSL 文件。

## 安装

1. 下载 `cem_s_studio.js`。
2. 在桌面版 Blockbench 中选择 **文件 -> 插件 -> 从文件加载插件**。
3. 选择 `cem_s_studio.js`。文件名必须保持不变。

## 使用

1. 在 Blockbench 新建页面选择 **CEM-S Studio** 项目类型。
2. 像普通 Blockbench 项目一样创建 Group、Cube、纹理和 UV。
3. 通过 **工具 -> CEM-S Studio Project Settings** 设置模型 ID、目标实体、检测 preset、纹理标记像素和资源包信息。Pig、Cold Pig、Arrow、Sheep 会自动配置 CEM-S 所需的锚点面；其他实体选择 Custom 后填写 vanilla 模型的面数与锚点面编号。
4. 如果要制作挂件、盔甲或喷气背包，先导入/创建参考模型：
   - 常用玩家模型可用 **工具 -> Add Player Reference Model**。
   - 其他任意生物可先使用原版/实体模型导入插件导出 `.bbmodel`，再使用 **工具 -> Import Vanilla Reference Model (.bbmodel)** 导入；模型会加入当前工程，不会替换当前项目，并自动登记方块为参考 guide。
   - 也可以直接在 Blockbench 中导入模型，选中根 Group 后使用 **工具 -> Register Selected Group as Reference Model**。
   - 将自定义部件放进自己的 Group，选中该 Group，使用 **工具 -> Bind Selected Group to Reference Anchor** 选择 `body`、`head`、`left_arm` 等锚点。之后移动、旋转或统一缩放锚点，挂件会跟随，参考方块不会导出。
5. 通过 **文件 -> Save CEM-S Studio Project** 保存 `.cemst` 项目，以后可以直接重新打开继续编辑。
6. 通过 **文件 -> 导出 -> Build CEM-S Resource Pack** 选择：
   - **Create a new resource pack**：选择存放位置后，插件按资源包名称自动创建子文件夹和完整资源包；不会覆盖同名的非空文件夹。
   - **Update an existing CEM-S pack**：更新已有包中的模型与检测规则，并保留不属于 CEM-S Studio 的内容。

第一次写入某个文件夹时，Blockbench 5 会显示 **Plugin Permission** 系统对话框。确认允许 CEM-S Studio 访问刚才选择的资源包文件夹即可。

新建资源包不依赖网络。插件已经内置固定版本的 CEM-S 1.21.6 runtime，生成后的文件夹可直接放入 Minecraft 的 `resourcepacks` 目录。

预设已经包含 CEM-S 使用的纹理标记位置和颜色，通常不需要修改。Custom 只在你要适配其他实体或自定义纹理标记时使用：把设置中的标记像素/颜色画到该实体的纹理上即可，插件会负责生成检测 GLSL，不需要你编写 GLSL。

`Render target` 可以选择 `Entity / Mob` 或 `Armor / Equipment`。鞘翅、胸甲上的喷气背包等使用后者；普通生物模型和生物身上的挂件使用前者。参考模型只是 Blockbench 中的定位骨架，不会写入生成的 GLSL。

## 当前支持范围

- Cube 与逐面 UV。
- 单轴和多轴旋转。
- 旋转父 Group 和多层 Group 变换。
- `.cemst` 项目的保存与重新打开。
- 新建完整资源包或更新已有 CEM-S 资源包。
- 常见实体 detection preset，以及不需要手写 GLSL 的 Custom 检测参数。
- 玩家参考模型和任意生物参考 Group 的挂件绑定。
- 从 `.bbmodel` 导入任意原版/社区生物模型作为参考骨架。
- `Entity / Mob` 与 `Armor / Equipment` 输出目标。

暂不支持 Mesh、动画、禁用/旋转面和非统一 Group 缩放。遇到这些内容时，插件会停止导出并给出错误，而不会静默生成错误模型。

## 开发验证

- `npm test`：单元测试。
- `npm run check`：构建和语法检查。
- `npm run test:blockbench`：连接以 `--remote-debugging-port=9223` 启动的 Blockbench，验证真实插件工作流。
- `npm run vendor:runtime`：从固定 CEM-S commit 重新同步内置 runtime。
