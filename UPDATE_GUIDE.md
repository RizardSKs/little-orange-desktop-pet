# 小橙子桌宠离线更新与发布运行手册

> 文档级别：`LIVING`  
> 修改权限：发布脚本、目录、验证步骤或工具链发生变化时，必须与实现同一任务更新；本手册不能覆盖或放宽 `LOCKED` 发布准则。  
> 适用版本：`1.1.0` 起的 Setup 与离线累积 Update 发布流程。  
> 最后核对日期：`2026-08-15`。  
> 权威来源：`package.json`、`package-lock.json`、`electron-builder.update.cjs`、`scripts/write_update_manifest.mjs`、实际发行物；策略以 [发布与兼容性准则](docs/governance/RELEASE_AND_COMPATIBILITY.md) 为准。  
> 更新触发：构建命令、产物名称、签名方式、清单字段、兼容验证、存档迁移或发布组合变化时。

## 1. 发布模型

每个正式版本应发布同一版本号的一组文件：

| 文件 | 面向用户 | 性质 |
| --- | --- | --- |
| `小橙子桌宠-Setup-x.y.z-x64.exe` | 新安装用户 | 最新完整 NSIS 安装包 |
| `小橙子桌宠-Update-x.y.z-x64.exe` | 已安装且处于声明兼容范围内的用户 | 完整、离线、可累积覆盖的 NSIS 安装包 |
| `update-manifest.json` | 发布校验 | Update 的身份、版本、大小和 SHA-256 清单 |

Update 不联网、不自动下载或安装，也不是二进制差分补丁。应用本身没有自动更新器，清单也不会被应用读取；下载、分发和校验均需在应用外完成。

`1.0.0 Portable` 仅作遗留归档，不再发布后续 Portable。当前 `npm.cmd run dist:win` 仍同时构建 Portable 与 NSIS Setup，项目尚无只构建 Setup 的 npm 命令；在构建脚本完成对齐前，新生成的 Portable 只能视为非正式构建副产物，不得加入正式发行组合。不得在手册中用未登记的临时命令假装该缺口已经解决。

## 2. 用户更新步骤

1. 确认当前安装版本位于目标版本快照声明的兼容范围内。
2. 正常退出小橙子桌宠，并确认托盘进程已经结束。
3. 核对 Update 文件名、大小和 SHA-256 与该版本的 `update-manifest.json` 一致。
4. 运行目标版本的 `Update`，保持原安装位置并完成覆盖安装。
5. 重新启动，核对程序版本以及等级、经验、金币、装扮拥有及装备状态、设置和位置。

存档位于 Electron `app.getPath('userData')` 对应目录，不在应用安装目录内。该位置与 `deleteAppDataOnUninstall: false` 是保留数据的实现基础，但不能替代真实覆盖安装和存档迁移测试。

## 3. 发布前准备

1. 根据变更范围选择语义化版本号，并让 `package.json` 与 `package-lock.json` 的根版本完全一致。
2. 不得修改稳定身份：`name = little-orange-desktop-pet`、`build.appId = cn.littleorange.desktop.pet`、`productName = 小橙子桌宠`。
3. 检查存档结构。新增必填字段或提高 `schemaVersion` 时，先实现从全部声明兼容版本迁移、备份和失败恢复，并补齐测试。
4. 使用 Node.js `22.12.0` 或更高版本，并从锁文件安装依赖。

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
```

任何测试或生产构建失败都阻止发布。

## 4. 构建发行物

先运行仓库当前存在的完整 Windows 打包命令：

```powershell
npm.cmd run dist:win
```

该命令实际执行 renderer/main 构建，并同时生成 Portable 与 NSIS Setup 到 `release/`。只选取以下同版本 Setup 作为正式发行候选：

```text
release/小橙子桌宠-Setup-x.y.z-x64.exe
```

然后构建同版本离线累积 Update 与清单：

```powershell
npm.cmd run dist:update
```

该命令会再次执行生产构建，使用 `electron-builder.update.cjs` 生成 NSIS Update，并运行 `scripts/write_update_manifest.mjs`：

```text
release/updates/小橙子桌宠-Update-x.y.z-x64.exe
release/updates/update-manifest.json
```

当前没有 Setup-only 命令，也没有自动清理旧产物的命令。核对时必须按目标版本精确选择文件，不能把目录中遗留的旧 EXE 当成本版产物。`release/` 已被 Git 忽略，正式文件还必须保存到项目外的受控归档或发布渠道。

## 5. 产物核对

将占位版本替换为本次目标版本后执行只读检查：

```powershell
$releaseVersion = 'x.y.z'
$setupPath = "release\小橙子桌宠-Setup-$releaseVersion-x64.exe"
$updatePath = "release\updates\小橙子桌宠-Update-$releaseVersion-x64.exe"

Get-Item -LiteralPath $setupPath, $updatePath |
  Select-Object Name, Length, @{Name='FileVersion';Expression={$_.VersionInfo.FileVersion}}, @{Name='ProductVersion';Expression={$_.VersionInfo.ProductVersion}}

Get-FileHash -LiteralPath $setupPath, $updatePath -Algorithm SHA256
Get-AuthenticodeSignature -FilePath $setupPath, $updatePath |
  Select-Object Path, Status

Get-Content -LiteralPath 'release\updates\update-manifest.json' -Encoding utf8
```

逐项确认：

- Setup、Update、`package.json`、`package-lock.json` 和清单版本完全一致。
- 清单中的 `product`、`appId`、`artifact`、`size` 和 `sha256` 与实际 Update 一致。
- `updateMode` 为 `offline-cumulative`，`preservesUserData` 为 `true`。
- `compatibleFrom` 只能填写已经完成实际升级验证的最早版本。当前生成脚本将其固定为 `1.0.0`；若实测范围不同，必须先修正实现和测试，不能手改生成后的清单掩盖差异。
- 当前历史产物为 `NotSigned`。在签名流程尚未建立时，应记录这一限制和 SmartScreen 风险，不能把未签名状态写成签名通过。

## 6. 安装与兼容验收

在隔离的 Windows 10/11 x64 环境完成并记录：

1. 使用本版 Setup 干净安装，验证启动、桌宠窗口、管理面板、托盘、退出和新建存档。
2. 从 `compatibleFrom` 声明的最早版本运行本版 Update。
3. 从最新上一正式版本运行本版 Update。
4. 两种升级源都准备包含非默认等级、经验、金币、已拥有及已装备装扮、设置和位置的存档，升级后逐项比对。
5. 验证应用版本、安装位置、快捷方式和卸载项没有产生并行副本。
6. 验证应用运行期间没有更新检查、下载或安装相关网络请求。

只有全部通过的来源版本才能写入 `compatibleFrom`。代码静态阅读、干净安装或“用户数据目录未删除”都不能替代跨版本实装。

## 7. 记录与发布

1. 根据 [发布快照模板](docs/releases/TEMPLATE.md) 创建 `docs/releases/vx.y.z.md`，记录真实产物、哈希、签名、环境、测试结果、兼容范围和限制。
2. 在 [CHANGELOG.md](CHANGELOG.md) 文件末尾追加用户可见变化和快照链接。
3. 快照一经写入即按 `APPEND_ONLY` 管理；以后发现错误只能在文末追加勘误。
4. 只分发同版本的 Setup、Update 和清单。不要分发 `dist:win` 额外生成的 Portable。

若验证失败，停止发布并保留证据。当前没有自动回滚机制；修复应使用新的语义化版本重新走完整流程，不能覆盖已记录版本的产物或回写历史快照。

## 8. 当前实现缺口

- `dist:win` 仍构建 Portable，尚无 Setup-only npm 命令。
- v1.1.0 本地归档中没有同版本 Setup，未形成完整正式发行组合。
- `compatibleFrom` 仍在脚本中固定为 `1.0.0`，发布流水线不会根据实测结果自动约束。
- 当前没有代码签名、发布服务、自动更新器或应用内清单验证。
- 当前存档加载器只接受 `schemaVersion === 1`，尚无 schema 迁移链。
