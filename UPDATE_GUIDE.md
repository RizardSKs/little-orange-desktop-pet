# 小橙子桌宠离线更新与发布运行手册

> 文档级别：`LIVING`  
> 修改权限：发布脚本、目录、验证步骤或工具链发生变化时，必须与实现同一任务更新；本手册不能覆盖或放宽 `LOCKED` 发布准则。  
> 适用版本：`1.1.0` 起的 Setup 与离线累积 Update 发布流程。  
> 最后核对日期：`2026-08-16`。  
> 权威来源：`package.json`、`package-lock.json`、`electron-builder.update.cjs`、`scripts/write_update_manifest.mjs`、实际发行物与 GitHub Release；策略以 [发布与兼容性准则](docs/governance/RELEASE_AND_COMPATIBILITY.md) 和 [Git 与 GitHub 版本控制准则](docs/governance/GIT_VERSION_CONTROL.md) 为准。  
> 更新触发：构建命令、产物名称、签名方式、清单字段、兼容验证、存档迁移、GitHub Release 或发布组合变化时。

## 1. 发布模型

每个正式版本应发布同一版本号的一组文件：

| 文件 | 面向用户 | 性质 |
| --- | --- | --- |
| `小橙子桌宠-Setup-x.y.z-x64.exe` | 新安装用户 | 最新完整 NSIS 安装包 |
| `小橙子桌宠-Update-x.y.z-x64.exe` | 已安装且处于声明兼容范围内的用户 | 完整、离线、可累积覆盖的 NSIS 安装包 |
| `update-manifest.json` | 发布校验 | Update 的身份、版本、大小和 SHA-256 清单 |

Update 不联网、不自动下载或安装，也不是二进制差分补丁。应用本身没有自动更新器，清单也不会被应用读取；下载、分发和校验均需在应用外完成。

每个通过全部门槛的正式版本必须在 GitHub 创建绑定同版本 `vX.Y.Z` 标签的 Release，并上传 Setup、Update 和 `update-manifest.json`。普通源码推送不创建 Release，也不上传 EXE。

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

当前没有 Setup-only 命令，也没有自动清理旧产物的命令。核对时必须按目标版本精确选择文件，不能把目录中遗留的旧 EXE 当成本版产物。`release/` 已被 Git 忽略；正式三件套必须上传到对应 GitHub Release，并建议另存于项目外的受控归档。

## 5. 产物核对

将占位版本替换为本次目标版本后执行只读检查：

```powershell
$releaseVersion = 'x.y.z'
$setupPath = "release\小橙子桌宠-Setup-$releaseVersion-x64.exe"
$updatePath = "release\updates\小橙子桌宠-Update-$releaseVersion-x64.exe"
$manifestPath = 'release\updates\update-manifest.json'

Get-Item -LiteralPath $setupPath, $updatePath |
  Select-Object Name, Length, @{Name='FileVersion';Expression={$_.VersionInfo.FileVersion}}, @{Name='ProductVersion';Expression={$_.VersionInfo.ProductVersion}}

Get-FileHash -LiteralPath $setupPath, $updatePath, $manifestPath -Algorithm SHA256
Get-AuthenticodeSignature -FilePath $setupPath, $updatePath |
  Select-Object Path, Status

Get-Content -LiteralPath $manifestPath -Encoding utf8
```

逐项确认：

- Setup、Update、`package.json`、`package-lock.json` 和清单版本完全一致。
- 清单中的 `product`、`appId`、`artifact`、`size` 和 `sha256` 与实际 Update 一致。
- `updateMode` 为 `offline-cumulative`，`preservesUserData` 为 `true`。
- `compatibleFrom` 只能填写已经完成实际升级验证的最早版本。当前生成脚本将其固定为 `1.0.0`；若实测范围不同，必须先修正实现和测试，不能手改生成后的清单掩盖差异。
- 当前历史产物为 `NotSigned`。在用户尚未建立强制代码签名门槛时，`NotSigned` 本身不自动阻止发布，但必须记录这一限制和 SmartScreen 风险，不能把未签名状态写成签名通过。

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

1. 根据 [发布快照模板](docs/releases/TEMPLATE.md) 在 `tmp/release-drafts/` 或仓库外准备未入库证据草稿；此时不得提前创建或提交 `docs/releases/vx.y.z.md`，因为远端证据尚未产生。
2. 在 [CHANGELOG.md](CHANGELOG.md) 文件末尾追加用户可见变化和预定快照链接。
3. 提交版本和更新日志，推送实际生成发行物的发行提交，并确认远端提交与本地一致。
4. 创建新的带说明 `vX.Y.Z` 标签，使其指向发行提交，然后将该标签推送到 `origin`；不得移动或复用已发布标签。
5. 在 GitHub 创建绑定该标签、标题固定为 `小橙子桌宠 vX.Y.Z` 的同版本 Release，上传且只上传同版本 Setup、Update 和 `update-manifest.json`；不要上传 `dist:win` 额外生成的 Portable。
6. 从 GitHub Release 页面或授权 API 回读标题、标签和资产列表，核对三项资产名称与大小。重新下载全部三项远端资产或使用可信远端摘要核对 SHA-256，确认与本地证据一致。
7. 将 Release URL、标签、远端资产 URL、大小和哈希核对结果补入草稿；证据齐全后才把它作为 `docs/releases/vx.y.z.md` 首次正式写入，并在文件头标记为 `APPEND_ONLY`。
8. 提交并推送正式快照，核对该证据提交已经存在于 GitHub。快照从首次正式提交起只允许在文末追加勘误；完成这一步后，才可宣称本版正式发布闭环完成。

当前仓库没有自动创建或上传 GitHub Release 的脚本，也没有可依赖的 `gh` 命令。正式发布任务必须使用已经授权的 GitHub 网页或 API 完成人工上传和回读，且不得把访问令牌写入项目、命令日志或快照。

若验证、上传或远端核对失败，停止发布并保留证据。仅远端回读或证据提交中断、且已核验资产没有变化时，可以在同版本继续完成缺失步骤；若已发布资产内容或版本错误，则必须使用新的语义化版本重新走完整流程，不能覆盖已发布产物、移动标签或回写历史快照。

## 8. 当前实现缺口

- `dist:win` 仍构建 Portable，尚无 Setup-only npm 命令。
- v1.1.0 本地归档中没有同版本 Setup，未形成完整正式发行组合。
- `compatibleFrom` 仍在脚本中固定为 `1.0.0`，发布流水线不会根据实测结果自动约束。
- 当前没有代码签名、发布服务、自动更新器或应用内清单验证。
- 当前没有 GitHub Release 自动创建、资产上传或远端哈希复核脚本。
- 当前存档加载器只接受 `schemaVersion === 1`，尚无 schema 迁移链。
