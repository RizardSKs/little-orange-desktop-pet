# 测试与验收

| 控制项 | 内容 |
| --- | --- |
| 文档级别 | `LIVING` |
| 修改权限 | 测试结构、支持环境、原生依赖、发布方式或验收要求变化时同步更新 |
| 适用版本 | 1.2.0 |
| 最后核对 | 2026-08-22 |
| 权威来源 | `package.json`、`.github/workflows/windows-release.yml`、`src/**/*.test.ts`、构建配置、实际安装结果和 GitHub Release |
| 更新触发 | 行为变化、新缺陷回归、测试增删、Node/Electron/原生组件基线、CI 门禁或正式发布变化 |

## 本地自动化基线

- 支持目标：Windows 10/11 x64。
- Node.js：`22.12.0` 或更高版本。
- 可复现安装：`npm.cmd ci`，不得跳过 `package-lock.json`。
- 单元与静态回归：`npm.cmd test`。
- 生产构建：`npm.cmd run build`。
- 全局键盘节奏依赖 `uiohook-napi@1.5.4` 原生组件；构建配置将其从 asar 解包，但自动类型检查不能证明安装包内原生二进制可正常加载。

2026-08-22 已通过 `npm.cmd test`（12 个测试文件、77 项测试）和完整 `npm.cmd run build`；`npm.cmd run verify:release` 也已核对本地三件套、PE 内部版本、清单哈希及 Setup/Update 两份原生键盘二进制。

## GitHub Actions Windows 门禁

`.github/workflows/windows-release.yml` 在拉取请求、`main` 分支推送、`v*` 标签推送和手动触发时运行，使用只读仓库权限：

- `windows-2022` 与 `windows-2025` 分别以 Node.js 22.12.0 执行 `npm ci`、`npm test` 和 `npm run build`，覆盖当前声明的最低 Node 基线及两代 Windows 托管运行器。
- 独立包装作业在上述矩阵全部通过后，于 `windows-2022` 顺序执行 `npm run dist:setup`、`npm run dist:update` 和 `npm run verify:release`，核对 Setup、Update、更新清单及解包后的 `uiohook-napi` Windows x64 原生二进制。
- 工作流不上传产物、不创建标签、不创建 GitHub Release，也不发布安装包；门禁通过只证明当前提交可构建并通过脚本校验，不能代替正式安装、升级矩阵或远端发行核对。

## 自动测试清单

| 文件 | 当前覆盖 |
| --- | --- |
| `src/shared/growth.test.ts` | 50 级曲线、阶段、称号、闪耀星与升级里程碑 |
| `src/shared/game.test.ts` | 默认档、照顾、有效恢复、在线奖励、离线零收益、深校验与迁移 |
| `src/shared/catalog.test.ts` | 稳定装扮 ID、用品/服务/探索/故事目录、价格、属性和时长 |
| `src/shared/economy.test.ts` | 原子购买、99 堆叠、服务使用、FIFO 效果、运行时推进、故事选择持久化和探索原子完成 |
| `src/shared/interaction.test.ts` | 光标靠近、逗趣、绕圈、键盘节奏、优先级和阶段个性 |
| `src/shared/expression.test.ts` | 行为、低需求、待机表情和优先级 |
| `src/main/interaction-controller.test.ts` | 点击、拖动、键盘、光标动作、冷却和打扰上限 |
| `src/main/interaction-integration.test.ts` | IPC 白名单、锁定窗口、隐私时间桶、原生组件降级、恢复路径与原子启动静态集成 |
| `src/main/motion.test.ts` | 方向、速度、时长边界、缓动和落点 |
| `src/main/store.test.ts` | 默认档、备份恢复、schema 1→2、迁移备份、未知或无效 schema 2 和离线加载 |
| `src/main/release-config.test.ts` | 1.2.0 身份、固定名 Setup/Update、用户数据保留和原生组件解包 |
| `src/renderer/ui-regressions.test.ts` | 透明窗口、分层素材、消费效果视觉、成长/生活/锁定/隐私控件和中文菜单 |

## 变更所需最小验证

| 变更类型 | 至少执行 |
| --- | --- |
| 纯文档 | 链接和源码引用检查；`npm.cmd test`；`npm.cmd run build` |
| 成长、照顾、收益或商品规则 | 对应共享领域测试、全量测试、变量登记与领域文档同步 |
| 用品、服务、探索或效果时钟 | 目录/经济测试；退出和系统挂起暂停、仅锁屏继续推进的人工检查 |
| 动作、鼠标、键盘或桌面锁定 | 领域/控制器/集成测试；开发环境和打包环境人工操作 |
| 阶段素材或 CSS | UI 静态测试；四阶段、左右朝向、拖动和降级素材人工截图 |
| 存档字段或 schema | 真实旧档迁移、迁移前备份、损坏档和未知 schema 测试；覆盖安装验证 |
| 发布配置 | 全部测试和构建、Setup/Update/清单、SHA-256、旧版覆盖安装及 GitHub Release 远端核对 |

## v1.2.0 Windows 功能验收

正式发行候选至少人工验证：

1. 单击抚摸、双击开面板、连续点击躲闪；拖动姿态、落地动作和重启后位置一致。
2. 开启桌面锁定后主体强制置顶且点击穿透，不能拖动、点击、打开面板或散步；独立小锁和托盘都能恢复，重启后仍保持锁定。
3. 鼠标互动开关能停止环境动作但不破坏基本拖动；注视、靠近、扒拉、拖行、追逐和转晕不会控制或锁住系统光标。
4. 键盘陪打初始关闭，首次开启显示隐私确认；只产生次数/时间桶，不出现字符、键名、窗口标题或持久日志。关闭后停止原生组件，组件加载失败时状态显示“不可用”且应用仍能启动退出。
5. Windows 挂起、恢复和解锁不会让键盘监听或限时效果重复运行；退出与睡眠/休眠等系统挂起期间，效果及探索倒计时不减少。仅锁定 Windows 屏幕时原生键盘监听停止，但在线奖励、效果和探索继续推进。
6. 用品与服务券购买后进入背包，重启仍在；满属性基础用品不被消耗，满属性服务券仍播放仪式；FIFO 队列按顺序切换，全部消费庆典、主题和光环都在桌宠上呈现。
7. 探索期间显示旅行装且原永久装扮存档不变，大部分互动继续可用；出发即持久化选中的故事，未收齐时优先新故事、收齐后按主进程种子轮换。正常完成时待确认故事、旅行册、返程庆典和主题奖励原子写入且均有桌面反馈，不返币、不加经验、不加属性；提前返程不发奖励。
8. 四阶段各自加载对应整图和五层素材，轮廓差异清晰；任一层失败时切换整图 fallback。
9. 关闭应用或让 Windows 睡眠/休眠后再返回，金币与经验不增加，只发生最多 8 小时的属性变化，效果和探索保持原剩余运行时；仅锁屏但不挂起时，在线奖励、效果和探索继续推进。

## 正式安装与升级矩阵

每个正式版本至少检查：

1. 在干净 Windows 10/11 x64 环境运行本版 Setup，验证启动、桌宠、管理面板、托盘、完全退出和新建 schema 2 存档。
2. 从 `compatibleFrom` 声明的最早版本运行同版本 Update，并从最新上一正式版本再执行一次独立 Update 路径。
3. 升级前准备非默认等级、经验、大额金币、已拥有及已装备装扮、设置和位置；升级后逐项核对，并确认新增背包、效果、探索和隐私设置使用安全默认值。
4. 确认迁移前版本化备份存在；损坏主档时不会覆盖唯一有效备份，未知未来 schema 不会被默认档替换。
5. 核对正式三件套固定名为 `小橙子桌宠-Setup-x64.exe`、`小橙子桌宠-Update-x64.exe`、`update-manifest.json`，其包版本和清单版本一致；Update 是完整离线累积 NSIS 安装包，不联网、不自动下载，也不是差分补丁。
6. 确认本版没有生成或上传 Portable；检查安装位置、快捷方式、卸载项和用户数据目录没有产生并行副本。
7. 核对不可变 `vX.Y.Z` 标签指向发行提交，GitHub Release 完整包含 Setup、Update 和清单；从远端核对名称、大小和三项 SHA-256。

2026-08-22 在 Windows x64 `10.0.26200` 上使用仓库内隔离安装目录完成：

- v1.2.0 Setup 全新静默安装、程序启动及 schema 2 新档创建。
- v1.0.0 Setup → v1.2.0 Update 直升。
- v1.0.0 Setup → v1.1.0 Update → v1.2.0 Update 累计升级。
- 两条升级路径均使用 19 级、部分经验、大额金币、全部八件稳定装扮、已装备皇冠、非默认设置与位置的 schema 1 存档；验证经验三倍换算、阶段修复、金币/装扮/装备/设置/位置保留及一次性迁移备份。
- 使用预先开启桌面锁定与键盘互动的 schema 2 存档启动安装版 6 秒；主进程、顶层窗口和独立 `node.mojom.NodeService` utilityProcess 均保持存活，随后静默卸载成功。该检查证明打包后的原生组件可加载，不等同于真实按键节奏、点击穿透或托盘人工操作。

## 风险与未覆盖范围

- 自动测试没有启动真实打包后的 Electron 窗口，也不会操作 Windows 全局钩子、托盘、SmartScreen、多显示器、DPI 或系统电源事件。
- 当前安装程序没有代码签名，预计可能显示 SmartScreen“未知发布者”；必须记录为 `NotSigned`，不能描述为签名通过。
- `compatibleFrom: 1.0.0` 已通过上述本地真实安装链验证；Windows 10 客户端和 Windows 11 的桌面点击穿透、托盘、全局钩子、SmartScreen、多显示器、DPI 与电源事件仍需人工补充冒烟或作为已知验证边界披露。
- 本地测试和构建通过不代表 v1.2.0 已正式发布；Setup、Update、清单、标签、GitHub Release 及远端哈希任一缺失都阻止正式发布结论。
- v1.2.0 正式发布快照必须等远端三件套证据齐全后首次创建；本次源码与文档同步不能提前代替该证据。

## 相关文档

- [配置与变量总账](CONFIGURATION_REGISTRY.md)
- [存档结构与迁移](SAVE_SCHEMA_AND_MIGRATIONS.md)
- [装扮与素材](OUTFITS_AND_ASSETS.md)
- [发布与兼容准则](../governance/RELEASE_AND_COMPATIBILITY.md)
- [更新操作手册](../../UPDATE_GUIDE.md)
