# Minecraft 实机验证记录

本文件记录 CEM-S Studio 生成资源包在真实 Minecraft 客户端中的验证证据。没有截图、日志或明确版本信息的条目不能标记为“通过”。

## 生成验证包

脚本默认输出到系统临时目录，不会覆盖已有资源包：

```powershell
node scripts/build-minecraft-verification-pack.js 1.21.11
```

也可以指定输出目录：

```powershell
node scripts/build-minecraft-verification-pack.js 1.21.11 .\verification-output\1.21.11
```

生成结果包含：

- `pack.mcmeta` 和目标版本对应的 CEM-S runtime shader。
- Pig 检测 shader，模型 ID 为 `901`。
- `assets/minecraft/textures/entity/pig/temperate_pig.png`，像素 `(63, 0)` 为红色 marker `255,0,0,255`。
- 一个使用独立图集区域、并与猪头保持间距的蓝白验证方块。
- `cem-studio/verification.json` 和 `cem-studio/README.txt`。

将生成的目录复制到 Minecraft 的 `resourcepacks` 目录后，启用资源包并召唤猪。记录以下结果：

1. 资源包是否出现在列表中并能启用。
2. `latest.log` 是否出现 shader 编译错误。
3. 猪模型是否出现蓝色验证方块。
4. 方块是否位于猪头部，且 Y 轴向上、旋转方向正确。
5. 删除 marker 后模型是否不再被检测，以确认检测规则确实生效。

## 动态纹理验证

动态模式使用当前渲染层的 `Sampler0`，不需要把玩家皮肤或动画 PNG 重新打包进 atlas。

### 玩家宿主纹理

在 Blockbench 中选择 `Texture source = Host dynamic texture / Sampler0`。玩家目标项目会自动使用 `Direct UV / vertex detection`，因为真实玩家皮肤不应被写入 CEM marker。准备两个不同外观的玩家皮肤，进入同一世界后确认 CEM 部件的 UV 颜色随皮肤切换而变化。

### 动画 Sampler0

在资源包中准备一个竖向帧图，填写固定 `Target texture path`、`Animation frame count` 和 `Ticks per frame`，选择 `Animated Sampler0 frame strip`。确认模型颜色按帧变化，并检查 `latest.log` 没有 shader 编译错误。插件只生成采样元数据，不会覆盖用户提供的动画 PNG。

跨渲染层读取玩家皮肤（例如鞘翅宿主上的挂件使用玩家皮肤）需要额外的 CEM-S/Fabric 纹理绑定，当前不能仅由原版资源包验证通过。

## 状态

| Minecraft 版本 | 客户端 | 资源包加载 | Shader 编译 | 坐标/模型 | UV 90/270 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| `1.21.11` | Fabric 0.18.4 | 通过 | 通过（未发现 CEM-S shader 编译错误） | 通过：原版猪脸完整、方块位于头部外侧、前后关系正常 | 待验证 | `docs/evidence/1.21.11-pig-overlay.png`；`latest.log` 23:17:33/23:25:38/23:29:58 资源包重载记录 |
| `1.21.6` | 待执行 | 待验证 | 待验证 | 待验证 | 待验证 | 待补截图和日志 |
| `26.1+` | 待执行 | 待验证 | 待验证 | 待验证 | 待验证 | 待补截图和日志 |

实机验证完成后，只更新对应行和证据位置；不要把未测试版本写成兼容或通过。
