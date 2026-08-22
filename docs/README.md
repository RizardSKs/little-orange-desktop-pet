# 小橙子桌宠开发文档地图

| 控制项 | 内容 |
| --- | --- |
| 文档级别 | `LIVING` |
| 修改权限 | 可随项目演进更新；相关代码变化时必须在同一次修改中同步 |
| 适用版本 | 1.2.3 |
| 最后核对 | 2026-08-23 |
| 权威来源 | 根目录 `AGENTS.md`、本目录下的治理与参考文档、当前源码与发布产物 |
| 更新触发 | 新增、移动或改变文档职责；版本发布；文档控制规则经用户批准后变化 |

## 从哪里开始

任何开发代理进入项目后，按以下顺序阅读：

1. [根目录代理规则](../AGENTS.md)。
2. [文档控制规则](governance/DOCUMENT_CONTROL.md)以及与任务有关的 `LOCKED` 准则。
3. [Git 与 GitHub 版本控制准则](governance/GIT_VERSION_CONTROL.md)。
4. [当前实现状态](status/CURRENT_IMPLEMENTATION.md)，确认现状、缺口和未批准规划。
5. [架构与数据流](reference/ARCHITECTURE_AND_DATA_FLOW.md)。
6. 与任务对应的领域规格，以及[测试与验收](reference/TESTING_AND_ACCEPTANCE.md)。
7. 涉及交付时，再阅读[更新操作手册](../UPDATE_GUIDE.md)和对应版本快照。

若代码、文档和用户指示互相矛盾，必须使用 `AGENTS.md` 规定的权威顺序处理，不得自行修改受保护准则。

## 文档级别

| 级别 | 含义 | 修改方式 |
| --- | --- | --- |
| `LOCKED` | 产品、兼容和安全底线 | 只有用户在当前任务中明确授权对应准则时才可修改 |
| `LIVING` | 当前实现的可维护说明 | 与相关代码、配置或素材在同一次修改中同步 |
| `APPEND_ONLY` | 已发布历史 | 不删除、不改写既有内容；只新增版本或在末尾追加勘误 |

完整定义见[文档控制规则](governance/DOCUMENT_CONTROL.md)。

## 受保护治理文档

- [文档控制](governance/DOCUMENT_CONTROL.md)
- [产品底线](governance/PRODUCT_GUARDRAILS.md)
- [发布与兼容](governance/RELEASE_AND_COMPATIBILITY.md)
- [架构与安全边界](governance/ARCHITECTURE_SECURITY.md)
- [Git 与 GitHub 版本控制](governance/GIT_VERSION_CONTROL.md)

根目录 `AGENTS.md` 同样属于受保护文档。上面的列表仅用于导航；权威受保护清单以 `AGENTS.md` 为准。

## 当前实现参考

| 领域 | 文档 | 主要权威源码 |
| --- | --- | --- |
| 总体架构 | [架构与数据流](reference/ARCHITECTURE_AND_DATA_FLOW.md) | `src/main/`、`src/preload/`、`src/shared/`、`src/renderer/` |
| 全部可调量 | [变量登记表](reference/CONFIGURATION_REGISTRY.md) | 领域源码、`package.json`、CSS |
| 成长 | [成长与经验](reference/GROWTH_AND_EXPERIENCE.md) | `src/shared/growth.ts`、`src/shared/game.ts` |
| 照顾、经济、探索和收益 | [照顾、动作与收益](reference/CARE_ACTIONS_AND_REWARDS.md) | `src/shared/game.ts`、`src/shared/economy.ts`、`src/shared/catalog.ts` |
| 装扮和素材 | [装扮与素材](reference/OUTFITS_AND_ASSETS.md) | `src/shared/catalog.ts`、`src/renderer/outfit-layout.ts`、`assets/pet/`、`assets/outfits/` |
| 行为、移动和表情 | [动作、行为与表情](reference/MOTION_BEHAVIOR_AND_EXPRESSIONS.md) | `src/shared/interaction.ts`、`src/main/interaction-controller.ts`、`src/shared/expression.ts` |
| 窗口、设置和 IPC | [界面、窗口、设置与 IPC](reference/UI_WINDOWS_SETTINGS_AND_IPC.md) | `src/main/main.ts`、`src/preload/preload.ts`、`src/shared/types.ts` |
| 存档 | [存档结构与迁移](reference/SAVE_SCHEMA_AND_MIGRATIONS.md) | `src/shared/types.ts`、`src/shared/game.ts`、`src/main/store.ts` |
| 验证 | [测试与验收](reference/TESTING_AND_ACCEPTANCE.md) | `src/**/*.test.ts`、构建配置 |

精确数值以[变量登记表](reference/CONFIGURATION_REGISTRY.md)为文档内统一索引；领域文档解释含义、数据流和边界，不应另建互相矛盾的数值来源。

## 状态与历史

- [当前实现状态](status/CURRENT_IMPLEMENTATION.md)：持续更新的 1.2.3 源码实现与发行边界。
- [版本索引](../CHANGELOG.md)：只追加的发布入口。
- [1.0.0 快照](releases/v1.0.0.md)：依据遗留发布包重建。
- [1.1.0 快照](releases/v1.1.0.md)：依据当前更新包、清单和归档差异重建。
- [1.2.1 快照](releases/v1.2.1.md)：正式 Release、三件套、实装升级与远端摘要证据。
- [1.2.2 快照](releases/v1.2.2.md)：四阶段形象、PNG 表情、三件套、安装升级与远端摘要证据。
- [版本快照模板](releases/TEMPLATE.md)：后续正式发布必须使用。

v1.2.0 因 GitHub 自动改写中文资产名而停止，错误 Release 已删除且标签保留。v1.2.1 与 v1.2.2 均使用固定 ASCII 三件套，并已完成不可变标签、GitHub Release、远端 SHA-256 核对和正式发布快照。

## 当前根目录入口

- [用户说明](../README.md)：安装、运行和本地开发入口。
- [技术设计概览](../TECHNICAL_DESIGN.md)：高层架构摘要，不承担参数总账职责。
- [更新操作手册](../UPDATE_GUIDE.md)：当前可执行的离线发布和安装步骤。

## 仓库级技能

- [项目治理基线技能](../.agents/skills/bootstrap-project-governance/SKILL.md)：在其他项目中建立或审查 `LOCKED` / `LIVING` / `APPEND_ONLY` 文档、Git/GitHub 闭环和正式 Release 门槛。
