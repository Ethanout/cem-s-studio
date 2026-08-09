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

## 状态

| Minecraft 版本 | 客户端 | 资源包加载 | Shader 编译 | 坐标/模型 | UV 90/270 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| `1.21.11` | Fabric 0.18.4 | 通过 | 通过（未发现 CEM-S shader 编译错误） | 通过：原版猪脸完整、方块位于头部外侧、前后关系正常 | 待验证 | `docs/evidence/1.21.11-pig-overlay.png`；`latest.log` 23:17:33/23:25:38/23:29:58 资源包重载记录 |
| `1.21.6` | 待执行 | 待验证 | 待验证 | 待验证 | 待验证 | 待补截图和日志 |
| `26.1+` | 待执行 | 待验证 | 待验证 | 待验证 | 待验证 | 待补截图和日志 |

实机验证完成后，只更新对应行和证据位置；不要把未测试版本写成兼容或通过。
