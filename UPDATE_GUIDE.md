# 小橙子桌宠离线更新与发布运行手册

> 文档级别：`LIVING`  
> 修改权限：发布脚本、目录、验证步骤或工具链变化时与实现同步；本手册不能覆盖或放宽 `LOCKED` 发布准则。  
> 适用版本：`1.2.0` 起的 Setup 与离线累积 Update 发布流程。  
> 最后核对日期：`2026-08-22`。  
> 权威来源：`package.json`、`package-lock.json`、`electron-builder.update.cjs`、`scripts/write_update_manifest.mjs`、实际发行物与 GitHub Release；策略以[发布与兼容性准则](docs/governance/RELEASE_AND_COMPATIBILITY.md)和[Git 与 GitHub 版本控制准则](docs/governance/GIT_VERSION_CONTROL.md)为准。  
> 更新触发：构建命令、产物组合、原生依赖、签名、清单、兼容验证、存档迁移或 GitHub Release 流程变化时。

## 1. 正式发行组合

每个正式版本只发布同一版本号的三件套：

| 文件 | 面向用户 | 性质 |
| --- | --- | --- |
| `小橙子桌宠-Setup-x64.exe` | 新安装用户 | 最新完整 NSIS 安装包 |
| `小橙子桌宠-Update-x64.exe` | 声明兼容范围内的已安装用户 | 完整、离线、可累积覆盖的 NSIS 安装包 |
| `update-manifest.json` | 发布校验 | Update 身份、版本、大小和 SHA-256 清单 |

应用不联网检查、下载或安装更新，清单也不由应用读取。Update 不是差分补丁或下载器；用户必须完全退出应用后手动运行。

`dist:setup` 只生成 Setup，`dist:win` 是它的兼容别名；两者均不再生成 Portable。`1.0.0 Portable` 只作历史归档，v1.2.0 及后续版本不得创建或上传 Portable。

## 2. 用户更新步骤

1. 在目标版本的正式快照中确认当前版本位于兼容范围内。
2. 从托盘选择“退出”，确认小橙子和独立解锁按钮均已消失。
3. 核对 Update 文件名、大小和 SHA-256 与 `update-manifest.json` 一致。
4. 运行目标版本 Update，保持原安装位置完成覆盖安装。
5. 启动应用，核对版本、等级、经验、金币、永久装扮、设置和位置；第一次 schema 1→2 升级还要确认背包、效果、探索和新互动设置使用安全默认值。

用户数据位于 Electron `app.getPath('userData')` 对应目录，不在安装目录内。`deleteAppDataOnUninstall: false` 只是保留数据的实现基础，不能替代真实升级验证。

## 3. 发布前准备

1. 选择语义化版本，并同步 `package.json`、`package-lock.json` 根版本和 `CHANGELOG.md` 新条目。
2. 保持稳定身份：`little-orange-desktop-pet`、`cn.littleorange.desktop.pet`、`小橙子桌宠`。
3. 核对 `releaseMetadata.compatibleFrom`。当前配置为 `1.0.0`，只有实际覆盖安装通过后才能作为最终声明。
4. 核对 schema 2 深校验、schema 1 迁移、迁移前版本化备份和失败恢复测试。
5. 核对 `uiohook-napi` 锁定版本和 `asarUnpack` 配置；不得为修复打包临时关闭 Electron 隔离或沙箱。
6. 在 Node.js `22.12.0` 或更高版本使用锁文件安装，并执行完整检查：

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
```

任何测试或构建失败都阻止发行。

## 4. 构建 Setup、Update 与清单

构建带目标版本身份、使用固定文件名的 Setup：

```powershell
npm.cmd run dist:setup
```

兼容入口 `npm.cmd run dist:win` 执行相同脚本。预期候选文件：

```text
release/小橙子桌宠-Setup-x64.exe
```

构建同版本离线累积 Update 和清单：

```powershell
npm.cmd run dist:update
```

预期文件：

```text
release/updates/小橙子桌宠-Update-x64.exe
release/updates/update-manifest.json
```

`release/` 被 Git 忽略且不会自动清理旧文件。必须按目标版本精确选取三件套；目录中如出现 Portable，则视为历史或异常产物，不得上传。

## 5. 本地产物核对

按固定文件名核对候选产物；版本身份来自包元数据和清单，而不是文件名：

```powershell
$setupPath = 'release\小橙子桌宠-Setup-x64.exe'
$updatePath = 'release\updates\小橙子桌宠-Update-x64.exe'
$manifestPath = 'release\updates\update-manifest.json'

Get-Item -LiteralPath $setupPath, $updatePath |
  Select-Object Name, Length, @{Name='FileVersion';Expression={$_.VersionInfo.FileVersion}}, @{Name='ProductVersion';Expression={$_.VersionInfo.ProductVersion}}

Get-FileHash -LiteralPath $setupPath, $updatePath, $manifestPath -Algorithm SHA256
Get-AuthenticodeSignature -FilePath $setupPath, $updatePath |
  Select-Object Path, Status

Get-Content -LiteralPath $manifestPath -Encoding utf8
```

必须确认：

- Setup、Update、包版本和清单版本完全一致。
- 清单的 `product`、`appId`、`artifact`、`size`、`sha256` 与实际 Update 一致。
- `updateMode` 为 `offline-cumulative`，`preservesUserData` 为 `true`，`compatibleFrom` 与已验证范围一致。
- 两个 EXE 都包含运行时所需文件，尤其是从 asar 解包的 `uiohook-napi` 原生模块。
- 当前预期签名状态为 `NotSigned`。这不自动阻止本版发布，但必须在 Release 和正式快照披露 SmartScreen 风险，不能写成签名通过。
- 输出中没有本版 Portable。

## 6. Windows 安装与兼容验收

在隔离的 Windows 10/11 x64 环境记录以下路径：

1. 使用本版 Setup 干净安装，验证桌宠、管理面板、独立解锁按钮、托盘、完全退出和新建 schema 2 存档。
2. 从 `compatibleFrom` 指定的最早版本运行本版 Update。
3. 从最新上一正式版本运行本版 Update。
4. 两条升级路径都使用包含非默认等级、经验、大额金币、已拥有及已装备装扮、设置和位置的旧档；升级后逐项比对，并检查迁移前备份。
5. 验证 50 级成长、桌面锁定、鼠标互动、用品/服务/探索、限时效果在应用退出或睡眠/休眠时暂停且仅锁屏时继续，以及离线零金币/经验。
6. 首次启用键盘陪打必须显示隐私确认；打包后的原生组件应能进入“已就绪”，只产生次数时间桶，关闭、挂起、锁屏和退出后停止。另验证组件不可用时应用安全降级。
7. 检查安装位置、快捷方式、卸载项和用户数据目录没有产生并行副本；运行期间没有更新检查、下载、遥测或其他新增网络请求。

只有真实通过的来源版本才能保留在 `compatibleFrom`。静态阅读、单元测试或干净安装不能代替跨版本覆盖安装。

## 7. GitHub 正式发布与快照

1. 在 `tmp/release-drafts/` 或仓库外准备证据草稿；远端证据出现前，不得创建或提交 `docs/releases/vx.y.z.md`。
2. 完成源码、LIVING 文档和 `CHANGELOG.md` 的版本条目，运行检查，提交并推送实际用于构建发行物的发行提交。
3. 创建并推送新的不可变 `vX.Y.Z` 标签，确认它指向发行提交；不得移动或复用旧标签。
4. 在 GitHub 创建标题为 `小橙子桌宠 vX.Y.Z`、绑定该标签的 Release，只上传 `小橙子桌宠-Setup-x64.exe`、`小橙子桌宠-Update-x64.exe` 和 `update-manifest.json`。
5. 从 GitHub 回读标题、标签、资产名和大小；重新下载三项资产或使用可信远端摘要，核对远端 SHA-256 与本地一致。
6. 把 Release URL、资产 URL、大小、签名状态和远端哈希结果补入草稿。证据齐全后，才首次创建 `docs/releases/vx.y.z.md` 并标记 `APPEND_ONLY`。
7. 提交并推送正式快照，确认该证据提交存在于 GitHub；到此才能宣称正式发布闭环完成。

仓库当前没有自动创建 GitHub Release、上传资产或回读远端哈希的脚本。必须使用已授权的 GitHub 网页或 API，不得把令牌写入仓库、命令日志或文档。

## 8. v1.2.0 当前状态

- 源码版本、78 项自动化测试和生产构建已对齐到 1.2.0。
- 本版固定名 Setup、Update 与清单已完成本地构建，PE 内部版本、哈希、清单字段及两份解包后的 `uiohook-napi` 原生二进制均已通过 `verify:release`。
- 已在 Windows x64 `10.0.26200` 的仓库内隔离目录通过全新 Setup、v1.0.0→v1.2.0 直升和 v1.0.0→v1.1.0→v1.2.0 累计升级，并使用丰富 schema 1 存档核对迁移与备份。
- 使用启用锁定与键盘互动的隔离 schema 2 存档启动安装版时，主窗口与键盘 Node utilityProcess 均保持存活，证明原生组件可从安装包加载；真实按键节奏和点击穿透仍不由此自动检查替代。
- 打包后桌面点击穿透、托盘、全局键盘钩子、Windows 10 客户端、SmartScreen、多显示器、DPI 和系统电源事件仍属于人工验证边界；远端 GitHub Release 证据尚未取得。
- 远端证据齐全前不创建 `docs/releases/v1.2.0.md`，也不得把本地构建描述为已经正式发布。
- 安装程序当前未签名，发布时必须明确披露 SmartScreen 风险。
