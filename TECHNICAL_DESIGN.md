# 小橙子桌面宠物技术设计概览

| 控制项 | 内容 |
| --- | --- |
| 文档级别 | `LIVING` |
| 修改权限 | 可随高层架构更新；受保护准则必须另行获得用户明确授权 |
| 适用版本 | 1.2.3 |
| 最后核对 | 2026-08-23 |
| 权威来源 | [开发文档地图](docs/README.md)、当前源码、构建配置与测试 |
| 更新触发 | 高层模块职责、进程边界、原生依赖、支持平台或文档导航变化 |

本文只保留高层技术入口。成长公式、经济价格、动作参数、IPC、存档字段和素材目录由 `docs/reference/` 中的领域文档维护。

## 产品与平台

小橙子面向 Windows 10/11 x64，核心功能完全离线。应用使用本地存档，不包含账号、广告、遥测、云存档、远程素材或联网自动更新。不可擅自更改的边界见：

- [产品底线](docs/governance/PRODUCT_GUARDRAILS.md)
- [发布与兼容准则](docs/governance/RELEASE_AND_COMPATIBILITY.md)
- [架构与安全准则](docs/governance/ARCHITECTURE_SECURITY.md)
- [Git 与 GitHub 准则](docs/governance/GIT_VERSION_CONTROL.md)

## 进程和模块

### 主进程

- `src/main/main.ts`：应用生命周期、桌宠/面板/解锁窗口、托盘、菜单、IPC 校验、系统电源事件、全屏检测和状态广播。
- `src/main/store.ts`：schema 2 存档、schema 1 迁移、临时文件、常规备份、迁移前版本化备份与失败恢复。
- `src/main/motion.ts`：自动移动规划与插值。
- `src/main/interaction-controller.ts`：点击、拖动、鼠标、键盘动作的运行时状态、优先级、冷却和打扰上限。
- `src/main/runtime-scheduler.ts`：统一登记并停止在线推进、轮询、散步、移动和短时反馈定时器，避免退出后访问已销毁对象。
- `src/main/keyboard-worker.ts`：独立 utility process 内的原生键盘次数时间桶；只发送 `count` 与 `endedAt`，不发送按键内容。

主进程内的 `SaveData` 是持久状态唯一权威。桌面位置、设置、照顾、背包、探索和效果只能经校验后的专用 IPC 修改，再由主进程保存并广播。

### preload 与渲染层

- preload 使用 `contextBridge` 暴露类型化、白名单 `OrangePetApi`；桌宠、管理面板和独立解锁窗口都保持 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`。
- React 入口按 `?view=pet|panel` 分流；`pet-view.tsx` 负责桌宠素材、表情、互动和拖动，`panel-view.tsx` 负责状态、照顾、生活和设置。
- 渲染层不访问 Node.js、文件系统、原生钩子或存档路径，只提交用户意图并展示主进程返回状态。

### 共享领域层

- `growth.ts`：50 级经验、称号、阶段、闪耀星和里程碑。
- `game.ts`：照顾、在线奖励、离线属性变化、完整校验和 schema 迁移。
- `economy-types.ts`、`economy.ts`、`catalog.ts`：背包、用品、服务、FIFO 限时效果、探索、旅行故事、永久装扮和稳定 ID。
- `interaction.ts`、`expression.ts`：输入节奏判定、互动优先级、阶段个性和表情解析。

共享层保持无 Electron、文件系统和网络依赖，供主进程、渲染层和 Vitest 复用。

## 时间语义

项目区分三类时间：

1. 在线照顾与挂机时间：应用正常运行时由主进程周期推进，可产生金币、经验和属性变化。
2. 离线/挂起时间：应用关闭或 Windows 进入睡眠、休眠等系统挂起期间不产生金币或经验；恢复时只结算最多 8 小时的属性变化。
3. 实际运行时：用品、服务和探索倒计时使用独立运行时基线。退出或系统挂起会冻结，恢复时重新建立基线，不能从存档的墙钟时间补扣。仅锁定 Windows 屏幕不会停止仍在运行的在线奖励、效果或探索；锁屏会暂停原生键盘钩子与光标采样、收束鼠标环境位移互动并停止自动散步。

这一拆分防止离线时错误消耗付费效果，也防止系统恢复瞬间重复发放挂机奖励。

探索出发由主进程提供选择种子，优先选取尚未收集的故事；对应 `selectedStoryId` 随活动委托立即持久化。故事池收齐后才按该种子轮换。完成时，旅行册、待确认故事、返程庆典和主题奖励在同一次领域变更中原子写入，不返还金币，也不增加经验或属性。

## 本地输入和隐私

- 鼠标环境互动使用 Electron 的全局光标坐标，只读取坐标，不控制、锁定或重定位系统鼠标。
- 键盘陪打默认关闭并要求用户确认。`uiohook-napi` 只在 utility process 内监听 `keydown` 次数，每 250 毫秒发送聚合时间桶；字符、键码、密码、输入法内容和窗口标题均不进入主进程或存档。
- 原生组件启动超时、异常或退出时，状态降级为 `unavailable`，应用继续运行。关闭设置、应用退出、系统挂起或锁屏会停止 worker。
- `uiohook-napi` 被列入 `asarUnpack`，因此正式安装包必须额外验证原生二进制随包加载和退出清理。

## 视觉与持久化

- 四阶段运行时素材固定为 80 张 512×512 RGBA PNG：四张中性整图 fallback、四阶段各五张身体/手脚分层，以及每阶段 14 张图片表情。
- 表情由 PNG 层叠加；八件永久装扮使用 512×512 RGBA 本地 PNG 和四阶段布局，置于角色运动/朝向节点内。成长星、旅行装和互动道具继续由 DOM/CSS 表现。
- schema 2 在原 `pet`、`growth`、`economy`、`settings` 分区上向后兼容扩展。旧等级、经验、金币、装扮、设置和位置在迁移后保留；新增背包、效果、探索和互动设置使用安全默认值。

## 构建与发行

- Vite 构建渲染层，TypeScript 构建主进程、preload 与 utility process，electron-builder 生成 Windows NSIS 产物。
- `dist:setup`（及兼容别名 `dist:win`）生成固定名 `Little-Orange-Desktop-Pet-Setup-x64.exe`；`dist:update` 生成固定名 `Little-Orange-Desktop-Pet-Update-x64.exe` 和 `update-manifest.json`。v1.2.3 不构建或发布 Portable。
- 正式发行仍须完成真实 Setup/Update 安装、schema 迁移、原生键盘组件、SHA-256、不可变标签和 GitHub Release 远端核对。
- 当前安装程序未签名，必须如实披露 SmartScreen 风险。

## 领域导航

- [当前实现状态](docs/status/CURRENT_IMPLEMENTATION.md)
- [配置与变量总账](docs/reference/CONFIGURATION_REGISTRY.md)
- [成长与经验](docs/reference/GROWTH_AND_EXPERIENCE.md)
- [照顾、动作与收益](docs/reference/CARE_ACTIONS_AND_REWARDS.md)
- [装扮与素材](docs/reference/OUTFITS_AND_ASSETS.md)
- [动作、行为与表情](docs/reference/MOTION_BEHAVIOR_AND_EXPRESSIONS.md)
- [架构与数据流](docs/reference/ARCHITECTURE_AND_DATA_FLOW.md)
- [存档结构与迁移](docs/reference/SAVE_SCHEMA_AND_MIGRATIONS.md)
- [测试与验收](docs/reference/TESTING_AND_ACCEPTANCE.md)

当前源码版本为 1.2.3；正式发布完成前，最近一份已完成的 GitHub Release、三件套、远端摘要和实装升级证据仍见 [v1.2.2 发布快照](docs/releases/v1.2.2.md)。任何代理开始开发前必须先阅读根目录 [AGENTS.md](AGENTS.md)。
