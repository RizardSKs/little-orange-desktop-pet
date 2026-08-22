# 存档结构与迁移

| 控制项 | 内容 |
| --- | --- |
| 文档级别 | `LIVING` |
| 修改权限 | 存档字段、校验、路径、备份或迁移实现变化时同步更新；兼容底线不得在此放宽 |
| 适用版本 | 1.2.0 / schema 2 |
| 最后核对 | 2026-08-16 |
| 权威源码 | `src/shared/types.ts`、`src/shared/economy-types.ts`、`src/shared/game.ts`、`src/main/store.ts` |
| 更新触发 | 任何持久字段、默认值、稳定 ID、校验、迁移、备份或恢复策略变化 |

强制兼容要求见[发布与兼容准则](../governance/RELEASE_AND_COMPATIBILITY.md)。本文记录 1.2.0 的 schema 2 实现、schema 1 兼容迁移和恢复边界。

## 当前文件与写入流程

存档目录为 Electron `app.getPath('userData')`：

- `save.json`：正式存档。
- `save.backup.json`：通常是保存前上一份正式存档，只保留一代。
- `save.tmp.json`：新状态的临时写入文件。
- `save.schema1.backup.json`：首次执行 schema 1 → 2 迁移时创建的一次性旧档备份；存在后不会覆盖。

每次保存都先对内存状态执行 schema 2 深校验，再写入 `save.tmp.json`，重新读取并再次深校验。需要保留当前正式档时，先复制为 `save.backup.json`，最后把已验证临时文件原子重命名为 `save.json`。无效状态不会进入正式存档。

加载顺序为正式档、普通备份、仅首次启动时的默认档：

1. 正式档是有效 schema 2 时直接使用；是有效 schema 1 时准备迁移。
2. 正式档不可用时尝试 `save.backup.json`，同样支持有效 schema 1 或 2。
3. 任一现有存档文件存在但正式档和备份都无效时，加载报错并保留原文件，不创建默认档覆盖。
4. 正式档声明高于 2 的未来 schema 时立即报错并保留原文件，不尝试降级或覆盖。
5. 只有正式档和普通备份都不存在时才创建 schema 2 默认档。
6. 选出状态后执行离线属性结算，再按已验证写入流程保存。

## schema 2

```text
SaveData
├─ schemaVersion: 2
├─ pet
│  ├─ name
│  ├─ behavior
│  ├─ stats { satiety, mood, energy, cleanliness }
│  └─ lastUpdatedAt
├─ growth
│  ├─ level
│  ├─ experience
│  ├─ stage
│  ├─ totalOnlineMs
│  └─ rewardRemainderMs
├─ economy
│  ├─ coins
│  ├─ ownedItems[]
│  ├─ equippedItem
│  ├─ inventory { [InventoryItemId]: quantity }
│  ├─ effectQueues { celebration[], keyboard[], mouse[], theme[], aura[] }
│  ├─ activeExpedition
│  ├─ travelJournal[]
│  └─ pendingExpeditionReward
└─ settings
   ├─ autoWalk
   ├─ alwaysOnTop
   ├─ launchAtLogin
   ├─ animationIntensity
   ├─ petPosition
   ├─ desktopLocked
   ├─ mouseInteractionsEnabled
   ├─ keyboardInteractionEnabled
   └─ keyboardConsentVersion
```

称号、星级、成长里程碑以及鼠标或键盘采样、互动动作、冷却、注视坐标和运行时键盘状态均为派生或运行时数据，不写入存档。

### 非持久启动快照

渲染层通过 `state:bootstrap` 一次取得统一 `StartupSnapshot`：

```text
StartupSnapshot
├─ state: SaveData
├─ runtime: PetRuntimeState
├─ offlineSummary: OfflineSummary
└─ growthProgress: GrowthProgressEvent | null
```

只有 `state` 属于本页描述的 schema 2 持久数据；其余三个字段是本次进程的运行时或结算结果。`offlineSummary` 只含 elapsed 和属性前后值。`growthProgress` 当前启动时为 `null`，后续升级通过 `growth:progress` 推送，事件来源只允许 `online` 或 `care`。

## schema 2 深校验

`validateSave()` 拒绝任何不满足下列契约的状态：

- `pet`：名称长度 1–12；行为属于稳定枚举；时间戳是非负安全整数；四项属性是有限非负数且不超过当前等级上限。
- `growth`：等级为 1–50；当前级经验是非负安全整数且严格小于下一级需求，50 级经验必须为 0；阶段与等级一致；在线累计时间和奖励余数是非负安全整数，余数小于五分钟。
- 稳定装扮：`ownedItems` 只含已发布装扮 ID 且不重复；`equippedItem` 必须为 `null` 或已拥有的有效装扮。
- `economy`：金币是非负安全整数；背包键必须为目录 ID，数量为 1–99；旅行册故事 ID 有效且不重复。
- 效果队列：恰有五个固定槽；每槽最多 32 段、总剩余运行时不超过 14 天；每段的效果、来源和正整数剩余时长均有效。
- 探索：活动任务和待领取奖励互斥；探索、故事及其归属关系有效；活动任务剩余时长为正安全整数，完成时间为非负安全整数。
- `settings`：旧有布尔值、动画强度和有限位置坐标有效；四个新字段类型正确；键盘同意版本为 0–1 的安全整数，启用键盘互动时必须等于当前版本 1。

稳定装扮、背包物品、探索、故事、效果和效果槽 ID 都是兼容标识，发布后不得改名、复用为其他含义或在无迁移时删除。

## schema 1 → 2 迁移

`SaveStore` 只迁移通过 `validateLegacySave()` 深校验的 schema 1：

1. 在内存中构造 schema 2，并再次执行完整深校验。
2. 正式写入前，把迁移来源原样复制到 `save.schema1.backup.json`；若该文件已经存在，则必须仍是有效 schema 1，否则停止迁移且不覆盖它。
3. 等级、宠物、四项属性、行为、名称、时间、在线累计、奖励余数、金币、稳定装扮、装备、原有设置和桌宠位置保持原值。
4. 1–19 级当前级经验乘以 3；旧曲线每级需求正好也是新曲线的三分之一，因此该级进度比例保持不变。旧满级 20 级经验保持 0。
5. 阶段按等级重新计算，修复旧档中允许存在的不一致阶段。
6. 新经济字段使用空默认值：空背包、五个空效果队列、无活动探索、空旅行册、无待领取奖励。
7. 新设置使用安全默认值：`desktopLocked=false`、`mouseInteractionsEnabled=true`、`keyboardInteractionEnabled=false`、`keyboardConsentVersion=0`。
8. 迁移后的 schema 2 执行最多八小时的离线属性衰减；金币和经验均不增加，也不推进在线余数或累计在线时间。
9. 临时文件重新读取并验证后才原子替换正式档；任一步失败都抛错并保留迁移来源及旧档备份。

## 回退与恢复

- `save.backup.json` 是滚动的一代普通备份，不等于迁移快照或多代历史。
- `save.schema1.backup.json` 是升级前的只写一次快照。需要回退到 1.1.x 时，应完全退出应用，另行保留当前 schema 2 文件，再用该快照恢复旧版识别的 `save.json`。
- 旧版应用不能读取 schema 2；回退快照不包含迁移后在 1.2.0 中产生的等级、金币、背包、效果、探索、互动设置或其他进度。
- 当前正式档损坏但普通备份有效时，可从普通备份恢复并重新写入正式档。
- 未来 schema、无效 schema 1、无效 schema 2 或无效迁移备份都不会被默认档静默覆盖。

## 当前边界

- 原子重命名保护单次写入，但普通备份只有一代，不提供历史版本、事务日志或云端同步。
- 加载失败会由调用方处理；存档层本身不会尝试猜测、裁剪或修复未通过深校验的 schema 2。
- `settleOffline()` 生成属性前后摘要；`SaveStore.loadWithSummary()` 将其连同状态返回，主进程纳入启动快照，但渲染层当前不展示。
- OS lock-screen 本身不触发离线结算；进程退出后的停机段或系统 suspend/sleep/hibernate 间隔才在下次启动或 resume 时按离线规则处理。
- 迁移备份一旦存在不会刷新，因此它始终代表第一次成功迁移前的 schema 1 状态。
- schema 1 的阶段不要求与等级一致，以便迁移时统一重算；其余旧字段仍必须通过完整范围和稳定 ID 校验。

## 相关测试

- `src/main/store.test.ts`：首次默认档、主档损坏恢复、无效档保留、未来 schema 拒绝、临时文件验证、schema 1 一次性备份、迁移失败保护及原子落盘。
- `src/shared/game.test.ts`：schema 1 和 schema 2 深校验、稳定装扮、阶段与经验边界、经济队列与探索约束、设置同意版本、迁移默认值和离线属性结算。
- `src/shared/growth.test.ts`：新旧经验比例、50 级曲线、阶段和属性上限。
