# 小橙子桌宠离线更新与发布运行手册

> 文档级别：`LIVING`  
> 修改权限：发布脚本、目录、验证步骤或工具链变化时与实现同步；本手册不能覆盖或放宽 `LOCKED` 发布准则。  
> 适用版本：`1.2.1` 起的 Setup 与离线累积 Update 发布流程。  
> 最后核对日期：`2026-08-22`。  
> 权威来源：`package.json`、`package-lock.json`、`electron-builder.update.cjs`、`scripts/write_update_manifest.mjs`、实际发行物与 GitHub Release；策略以[发布与兼容性准则](docs/governance/RELEASE_AND_COMPATIBILITY.md)和[Git 与 GitHub 版本控制准则](docs/governance/GIT_VERSION_CONTROL.md)为准。  
> 更新触发：构建命令、产物组合、原生依赖、签名、清单、兼容验证、存档迁移或 GitHub Release 流程变化时。

## 1. 正式发行组合

每个正式版本只发布同一版本号的三件套：

| 文件 | 面向用户 | 性质 |
| --- | --- | --- |
| `Little-Orange-Desktop-Pet-Setup-x64.exe` | 新安装用户 | 最新完整 NSIS 安装包 |
| `Little-Orange-Desktop-Pet-Update-x64.exe` | 声明兼容范围内的已安装用户 | 完整、离线、可累积覆盖的 NSIS 安装包 |
| `update-manifest.json` | 发布校验 | Update 身份、版本、大小和 SHA-256 清单 |

应用不联网检查、下载或安装更新，清单也不由应用读取。Update 不是差分补丁或下载器；用户必须完全退出应用后手动运行。

`dist:setup` 只生成 Setup，`dist:win` 是它的兼容别名；两者均不再生成 Portable。`1.0.0 Portable` 只作历史归档，v1.2.0 及后续版本不得创建或上传 Portable。GitHub 会改写包含特殊或非 ASCII 字符的 Release Asset 名称，所以安装包从 v1.2.1 起必须使用上表中的 ASCII 文件名；中文产品名继续保留在程序身份、界面与 Release 标题中。

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
release/Little-Orange-Desktop-Pet-Setup-x64.exe
```

构建同版本离线累积 Update 和清单：

```powershell
npm.cmd run dist:update
```

预期文件：

```text
release/updates/Little-Orange-Desktop-Pet-Update-x64.exe
release/updates/update-manifest.json
```

`release/` 被 Git 忽略且不会自动清理旧文件。必须按目标版本精确选取三件套；目录中如出现 Portable，则视为历史或异常产物，不得上传。

## 5. 本地产物核对

按固定文件名核对候选产物；版本身份来自包元数据和清单，而不是文件名：

```powershell
$setupPath = 'release\Little-Orange-Desktop-Pet-Setup-x64.exe'
$updatePath = 'release\updates\Little-Orange-Desktop-Pet-Update-x64.exe'
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
4. 必须使用 `gh` CLI 创建 Release 和上传资产。先检查登录；若未登录，运行 Device Flow。必须先把 `gh` 输出的一次性 code 明确交给授权人，再让其访问设备登录页，不能只打开网页或让命令无提示等待：

```powershell
gh auth status
gh auth login --hostname github.com --git-protocol https --web --scopes repo
```

5. 登录完成后创建标题为 `小橙子桌宠 vX.Y.Z`、绑定同版本标签的 Release，只上传 ASCII 固定名三件套：

```powershell
$releaseVersion = 'vX.Y.Z'
gh release create $releaseVersion `
  'release\Little-Orange-Desktop-Pet-Setup-x64.exe' `
  'release\updates\Little-Orange-Desktop-Pet-Update-x64.exe' `
  'release\updates\update-manifest.json' `
  --repo RizardSKs/little-orange-desktop-pet `
  --title "小橙子桌宠 $releaseVersion" `
  --notes-file '<已审查的 Release 说明文件>' `
  --verify-tag
```

6. 立即用 `gh` 回读标题、标签、草稿状态、资产名、大小和 GitHub 提供的摘要。名称只要被 GitHub 改写、任一资产缺失或摘要不一致，就把 Release 转为草稿并停止，不得宣称正式发布：

```powershell
gh release view $releaseVersion `
  --repo RizardSKs/little-orange-desktop-pet `
  --json url,tagName,name,isDraft,isPrerelease,targetCommitish,assets
```

需要将失败 Release 转为草稿时，先读取 release id，再通过 `gh api` 更新；不得删除或移动已经推送的版本标签：

```powershell
$releaseId = gh api "repos/RizardSKs/little-orange-desktop-pet/releases/tags/$releaseVersion" --jq '.id'
gh api --method PATCH "repos/RizardSKs/little-orange-desktop-pet/releases/$releaseId" -F draft=true
```

7. 把三项远端资产重新下载到全新的隔离目录，逐项核对 SHA-256，不复用本地上传源文件冒充远端证据：

```powershell
$remoteEvidenceDir = "tmp\release-evidence\$releaseVersion"
New-Item -ItemType Directory -Path $remoteEvidenceDir -Force | Out-Null
gh release download $releaseVersion `
  --repo RizardSKs/little-orange-desktop-pet `
  --dir $remoteEvidenceDir `
  --pattern 'Little-Orange-Desktop-Pet-Setup-x64.exe' `
  --pattern 'Little-Orange-Desktop-Pet-Update-x64.exe' `
  --pattern 'update-manifest.json'
Get-FileHash -LiteralPath `
  "$remoteEvidenceDir\Little-Orange-Desktop-Pet-Setup-x64.exe", `
  "$remoteEvidenceDir\Little-Orange-Desktop-Pet-Update-x64.exe", `
  "$remoteEvidenceDir\update-manifest.json" -Algorithm SHA256
```

8. 把 Release URL、资产 URL、大小、签名状态和远端哈希结果补入草稿。证据齐全后，才首次创建 `docs/releases/vx.y.z.md` 并标记 `APPEND_ONLY`。
9. 提交并推送正式快照，确认该证据提交存在于 GitHub；到此才能宣称正式发布闭环完成。

凭据只能存放在 `gh` 自身凭据存储中，不得把令牌写入仓库、命令参数日志、Release 说明或文档。`gh release create` 返回 URL 不代表闭环完成，远端回读和重新下载验哈希不可省略。

## 8. v1.2.1 当前状态

- v1.2.1 已于 2026-08-22 正式发布：[GitHub Release](https://github.com/RizardSKs/little-orange-desktop-pet/releases/tag/v1.2.1)；不可变标签指向合并提交 `7de465c77f189b2a3a7760a9d3ce2d97d50a781c`。
- 本版 78 项自动化测试、生产构建、固定名 Setup/Update/清单、PE 内部版本、哈希、清单字段及两份解包后的 `uiohook-napi` 原生二进制均已通过。
- v1.2.1 已重新执行全新 Setup、v1.0.0→v1.2.1 直升和 v1.0.0→v1.1.0→v1.2.1 累计升级，并使用丰富 schema 1 存档核对迁移与备份。
- 使用启用锁定与键盘互动的隔离 schema 2 存档启动安装版时，主窗口与键盘 Node utilityProcess 均保持存活，证明原生组件可从安装包加载；真实按键节奏和点击穿透仍不由此自动检查替代。
- 打包后桌面点击穿透、托盘、全局键盘钩子、Windows 10 客户端、SmartScreen、多显示器、DPI 和系统电源事件仍属于人工验证边界。
- v1.2.0 的中文资产名被 GitHub 自动改写，错误 Release 已删除且不可变标签保留；它不是正式版本。v1.2.1 的远端名称、大小和 GitHub 服务器 SHA-256 已与本地最终构建一致；清单完成实际回下载，大文件全量回下载受当前网络带宽限制，详见[正式快照](docs/releases/v1.2.1.md)。
- 安装程序当前未签名，发布时必须明确披露 SmartScreen 风险。
