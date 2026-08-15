# 小橙子桌面宠物技术设计概览

| 控制项 | 内容 |
| --- | --- |
| 文档级别 | `LIVING` |
| 修改权限 | 可随高层架构更新；受保护准则必须另行获得用户明确授权 |
| 适用版本 | 1.1.0 |
| 最后核对 | 2026-08-15 |
| 权威来源 | [开发文档地图](docs/README.md)、当前源码与测试 |
| 更新触发 | 高层模块职责、支持平台或文档导航变化 |

本文只保留高层技术入口。成长公式、平衡数值、装扮目录、动作参数、IPC 和存档字段不再在这里重复维护，统一由 `docs/reference/` 中的领域文档负责。

## 产品与平台

小橙子是一款面向 Windows 10/11 x64 的完全离线桌面宠物。应用使用本地存档，不包含账号、广告、遥测、云存档或联网自动更新。不可擅自更改的产品、发布与安全边界见：

- [产品底线](docs/governance/PRODUCT_GUARDRAILS.md)
- [发布与兼容准则](docs/governance/RELEASE_AND_COMPATIBILITY.md)
- [架构与安全准则](docs/governance/ARCHITECTURE_SECURITY.md)

## 高层架构

- Electron 主进程拥有窗口、托盘、系统设置、运行时状态和文件持久化权限。
- preload 使用 `contextBridge` 暴露白名单 `OrangePetApi`。
- React 渲染层通过 `?view=pet|panel` 共用入口，不直接访问 Node.js。
- `src/shared/` 使用 TypeScript 纯函数承载成长、收益、互动、装扮目录和表情规则。
- Vite 构建渲染层，TypeScript 构建主进程和 preload，electron-builder 生成 Windows 安装产物。

完整模块边界、启动顺序和数据流见[架构与数据流](docs/reference/ARCHITECTURE_AND_DATA_FLOW.md)。

## 领域导航

- [变量登记表](docs/reference/CONFIGURATION_REGISTRY.md)
- [成长与经验](docs/reference/GROWTH_AND_EXPERIENCE.md)
- [照顾、动作与收益](docs/reference/CARE_ACTIONS_AND_REWARDS.md)
- [装扮与素材](docs/reference/OUTFITS_AND_ASSETS.md)
- [动作、行为与表情](docs/reference/MOTION_BEHAVIOR_AND_EXPRESSIONS.md)
- [界面、窗口、设置与 IPC](docs/reference/UI_WINDOWS_SETTINGS_AND_IPC.md)
- [存档结构与迁移](docs/reference/SAVE_SCHEMA_AND_MIGRATIONS.md)
- [测试与验收](docs/reference/TESTING_AND_ACCEPTANCE.md)

## 当前状态

当前源码版本为 1.1.0。实现能力、已知差距和明确未实现的候选方向见[当前实现状态](docs/status/CURRENT_IMPLEMENTATION.md)。版本历史见[CHANGELOG](CHANGELOG.md)。

任何子代理开始开发前必须先阅读根目录 [AGENTS.md](AGENTS.md)。

