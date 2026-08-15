# 存档结构与迁移

| 控制项 | 内容 |
| --- | --- |
| 文档级别 | `LIVING` |
| 修改权限 | 存档字段、校验、路径、备份或迁移实现变化时同步更新；兼容底线不得在此放宽 |
| 适用版本 | 1.1.0 / schema 1 |
| 最后核对 | 2026-08-15 |
| 权威源码 | `src/shared/types.ts`、`src/shared/game.ts`、`src/main/store.ts`、`src/main/main.ts` |
| 更新触发 | 任何持久字段、默认值、稳定 ID、校验、迁移、备份或恢复策略变化 |

强制兼容要求见[发布与兼容准则](../governance/RELEASE_AND_COMPATIBILITY.md)。本文记录当前实现，不代表当前迁移能力已经满足未来 schema 升级需要。

## 当前已实现

### 路径与文件

存档目录为 Electron `app.getPath('userData')`：

- `save.json`：正式存档。
- `save.backup.json`：保存前从上一份正式存档复制的备份。
- `save.tmp.json`：新状态的临时写入文件。

保存顺序为写临时文件、备份现有正式文件、将临时文件重命名为正式文件。加载顺序为正式文件、备份、默认档；获得状态后执行离线结算并立即保存。

### schema 1

```text
SaveData
├─ schemaVersion: 1
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
│  └─ equippedItem
└─ settings
   ├─ autoWalk
   ├─ alwaysOnTop
   ├─ launchAtLogin
   ├─ animationIntensity
   └─ petPosition
```

字段类型和默认值见 `src/shared/types.ts`、`createDefaultSave()` 以及[变量登记表](CONFIGURATION_REGISTRY.md)。

### 当前校验范围

`validateSave()` 当前只确认：

- 顶层值是对象且 `schemaVersion === 1`。
- `pet`、`growth`、`economy`、`settings` 四个分区存在。
- 名称是长度 1–12 的字符串。
- `lastUpdatedAt` 是有限数值。
- 等级是 1–20 的整数。
- `ownedItems` 是数组。

装扮 ID 已持久化到 `ownedItems` 和 `equippedItem`。发布过的 ID 是兼容标识，不得改名、复用为其他含义或在无迁移时删除。

## 待批准规划

项目尚无迁移器。未来若经单独任务批准增加 schema，至少需要：

1. 保留旧 schema 的解析和完整运行时校验。
2. 以明确的逐版函数执行 `N -> N+1`，不得跨过未知版本静默猜测。
3. 迁移前保留可恢复备份，迁移失败不得用默认档覆盖唯一可用旧档。
4. 重算或验证可派生字段，例如等级与成长阶段的一致性。
5. 迁移稳定装扮 ID、设置默认值和新增字段。
6. 使用真实旧版存档测试，再更新 `compatibleFrom` 声明。
7. 在对应版本快照记录输入 schema、输出 schema、回退方式和验收结果。

上述是既有兼容准则的实现要求，不表示 schema 2 已获批准或已经存在。

## 失败与边界情况

- 当前校验不验证四项属性、金币、经验、阶段、挂机余数、装扮数组元素、当前装备和设置值的类型或范围。
- 加载时不验证 `growth.stage` 是否与 `growth.level` 一致；阶段只在升级时重算。
- 无法通过 schema 1 浅层校验的未来存档会被视为无效，随后尝试备份或创建默认档。
- 备份是上一轮保存的正式档，不是多代历史，也不是事务日志。
- 系统时钟倒退时不发放收益；正常向前时间会在加载期间结算并立即写回，避免重复领取。
- `settleOffline()` 会生成摘要，但 `SaveStore.load()` 当前只保留结算后的状态，没有把摘要交给界面。

## 相关测试

- `src/main/store.test.ts`：首次创建默认档、主档损坏时读取备份。
- `src/shared/game.test.ts`：默认档、离线结算、时钟倒退和 8 小时上限的领域行为。
- 当前缺少完整字段校验、未知 schema、逐版迁移、迁移中断和跨版本真实存档测试。

