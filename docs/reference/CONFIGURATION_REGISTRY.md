# 配置与变量总账

> 文档级别：LIVING（随实现持续维护）  
> 修改权限：子代理可在对应代码或测试已经变更并完成核对时修改；不得仅为设想改写“当前值”，不得重排、复用或删除既有 CFG 编号。  
> 适用版本：1.2.3  
> 最后核对：2026-08-23  
> 权威源码：src/shared/types.ts、src/shared/growth.ts、src/shared/game.ts、src/shared/catalog.ts、src/shared/economy-types.ts、src/shared/economy.ts、src/shared/expression.ts、src/shared/interaction.ts、src/main/store.ts、src/main/main.ts、src/main/motion.ts、src/main/interaction-controller.ts、src/renderer  
> 更新触发：默认存档、领域类型、公式、阈值、计时器、窗口尺寸、动作、互动、表情、装扮或经济目录、设置项及其测试发生变化时。

本文件是当前实现的配置索引，不替代源码。CFG 编号是长期引用标识：已有编号即使废弃也只能标为“已废弃”，不能改号或转给另一含义。其他参考文档应引用本表编号，避免形成互相漂移的数值副本。

## 当前已实现

### 默认存档与持久化

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-001 | 存档结构版本 | 2；读取器额外接受有效 schema 1 并迁移 | 安全整数；当前写入只允许 2 | `SaveData`、`validateSave()`、`validateLegacySave()`、`SaveStore` | 全部状态读写 | `game.test.ts`、`store.test.ts` | 高：改变后必须提供逐版迁移、备份和回退验证 |
| CFG-002 | 默认宠物名称 | 小橙子 | 字符串；设置入口去除首尾空白后为 1–12 个 JavaScript 字符单元 | `createDefaultSave()`、名称设置 IPC | 桌宠替代文本、面板、菜单 | `store.test.ts` | 中：影响新档和界面文案，不覆盖已有名称 |
| CFG-003 | 初始行为 | idle | `PetBehavior`：idle、walking、eating、playing、cleaning、sleeping、sad | `types.ts`、`createDefaultSave()` | 表情、自动散步、照顾动作 | `expression.test.ts` | 中：新增行为需同步类型、表情、动画和中断规则 |
| CFG-004 | 初始四项属性 | satiety=90；mood=90；energy=90；cleanliness=90 | 属性点；合法范围 0..当前属性上限 | `createDefaultSave()` | 状态页、衰减、效率、互动 | `game.test.ts`、`store.test.ts` | 高：改变新手节奏和首日体验 |
| CFG-005 | 最后更新时间 | 创建存档时的 `Date.now()` | Unix 毫秒；非负安全整数 | `createDefaultSave()`、`advanceOnline()`、`settleOffline()` | 在线推进、离线结算 | `game.test.ts` | 高：错误会重复结算、漏算或产生异常衰减 |
| CFG-006 | 初始成长状态 | level=1；experience=0；stage=sprout；totalOnlineMs=0；rewardRemainderMs=0 | 等级与经验为安全整数；时间字段为毫秒 | `createDefaultSave()` | 成长、奖励、状态页 | `growth.test.ts`、`game.test.ts` | 高：影响新档、升级和在线奖励连续性 |
| CFG-007 | 初始经济状态 | coins=30；ownedItems=[]；equippedItem=null；inventory={}；五个效果队列为空；activeExpedition=null；travelJournal=[]；pendingExpeditionReward=null | 金币、稳定 ID、背包、效果与探索复合状态 | `createDefaultEconomyState()` | 照顾、装扮、背包、服务、探索 | `economy.test.ts`、`store.test.ts` | 高：字段改变涉及存档兼容与经济平衡 |
| CFG-008 | 存档文件策略 | save.json；save.backup.json；save.tmp.json；save.schema1.backup.json | Electron userData 下的 UTF-8 JSON；迁移备份只写一次 | `SaveStore` | 存档加载、恢复、迁移 | `store.test.ts` | 高：影响数据安全、旧档恢复和回退 |
| CFG-009 | 保存时机与写入 | 加载结算后；每 60 秒；设置、照顾、交易、探索等关键操作；拖动完成；正常退出 | 先深校验并写临时文件，复读校验后备份和原子重命名 | `SaveStore.writeValidated()`、`main.ts` | 主进程 | `store.test.ts`；无完整定时器集成测试 | 高：遗漏会丢进度；高频写入需评估磁盘负担 |

### 成长、属性与衰减

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-010 | 最高等级 | 50 | 整数等级 1–50；50 级经验必须为 0 | `MAX_LEVEL`、`addExperience()` | 成长、校验、面板 | `growth.test.ts`、`game.test.ts` | 高：影响曲线、存档、称号、星级和属性上限 |
| CFG-011 | 经验需求公式 | 下一级：150 × (当前等级 + 1)；到达 L 级累计：75 × (L - 1) × (L + 2)；到 20 级 31,350；到 50 级 191,100 | 经验点；下一级公式用于 1–49 级 | `experienceForNextLevel()`、`cumulativeExperienceForLevel()` | 升级、面板、迁移 | `growth.test.ts`、`game.test.ts` | 高：改变完整成长时长及旧档比例 |
| CFG-012 | 成长阶段阈值 | sprout 1–4；lively 5–9；mature 10–19；radiant 20–50 | `GrowthStage` | `stageForLevel()` | 素材、主题、互动参数、面板 | `growth.test.ts`、`ui-regressions.test.ts` | 高：影响视觉、存档 stage 与进化叙事 |
| CFG-013 | 属性上限公式 | 1–20 级：100 + 2 × (L - 1)；21–50 级：138 + (L - 20)；1/20/50 级分别为 100/138/168 | 属性点 | `statCap()` | 校验、衰减、照顾、效率、表情、状态条 | `growth.test.ts`、`game.test.ts` | 高：同时改变容量、相对属性比例和照顾空间 |
| CFG-014 | 饱食衰减 | -2/小时；宠物睡眠时相同 | 属性点/小时 | `applyDecay()` | 在线推进、离线结算 | `game.test.ts` | 中：影响需求和效率 |
| CFG-015 | 心情衰减 | -1.5/小时；宠物睡眠时相同 | 属性点/小时 | `applyDecay()` | 在线推进、离线结算 | `game.test.ts` | 中：影响需求和效率 |
| CFG-016 | 精力变化 | 清醒 -3/小时；宠物睡眠 +12/小时 | 属性点/小时 | `applyDecay()` | 在线推进、离线结算、玩耍 | `game.test.ts` | 高：影响睡眠恢复与可玩频率 |
| CFG-017 | 清洁衰减 | -1/小时；宠物睡眠时相同 | 属性点/小时 | `applyDecay()` | 在线推进、离线结算 | `game.test.ts` | 中：影响需求和效率 |
| CFG-018 | 属性规范化 | 限制到 0..当前上限；结果四舍五入到两位小数 | 属性点 | `applyDecay()` | 全部时间推进 | `game.test.ts` | 中：舍入方式会造成长期累计差异 |
| CFG-019 | 称号、星级与主要里程碑 | 1–20 级逐级称号；20–24 为闪耀新星；25/30/35/40/45/50 分别 1–6 星；主要里程碑 5/10/20/25/30/35/40/45/50 | 称号与星级均由等级派生，不持久化 | `LEVEL_TITLES`、`radiantStarsForLevel()`、`describeGrowth()` | 面板、桌宠星辉、升级反馈 | `growth.test.ts`、`ui-regressions.test.ts` | 高：用户可见成长身份和长期目标 |

### 在线、离线与经济奖励

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-020 | 在线奖励效率 | 0.5 + 四项属性相对上限的平均值 × 0.7 | 倍率 0.5–1.2 | `rewardEfficiency()` | 在线金币、在线经验、状态页 | `game.test.ts` | 高：改变被动产出 |
| CFG-021 | 在线奖励周期 | 5 分钟 | 300,000 毫秒 | `REWARD_INTERVAL_MS` | 在线推进、面板倒计时 | `game.test.ts` | 高：影响余数和奖励节奏 |
| CFG-022 | 在线金币公式 | max(1, floor(完整单位数 × 2 × 效率)) | 安全整数金币；一次聚合推进有单位时至少 1 | `advanceOnline()` | `economy.coins` | `game.test.ts` | 高：影响购买和喂食经济 |
| CFG-023 | 在线经验公式 | max(1, floor(完整单位数 × 效率))；满级不累积 | 安全整数经验；一次聚合推进有单位时至少 1 | `advanceOnline()`、`addExperience()` | 成长 | `game.test.ts` | 高：影响升级时长 |
| CFG-024 | 在线奖励余数 | `rewardRemainderMs` 与在线 elapsed 相加后对五分钟取余 | 0..299,999 毫秒 | `advanceOnline()` | 连续在线与重启后的在线推进 | `game.test.ts` | 高：处理不当会漏发或重复发放 |
| CFG-025 | 离线属性衰减上限 | 8 小时 | 最多 28,800,000 毫秒；只限制属性变化 | `MAX_OFFLINE_MS`、`settleOffline()` | 加载、系统挂起恢复 | `game.test.ts`、`store.test.ts` | 高：影响长时间离线后的属性 |
| CFG-026 | 离线折扣 | 已废弃（1.2.0）：不再计算离线奖励，原 0.7 折扣不再应用 | 保留编号，禁止复用 | `settleOffline()` | 无 | `game.test.ts` | 高：重新启用将改变在线与离线价值关系 |
| CFG-027 | 离线金币公式 | 固定 0 | 离线不增加或扣除金币 | `settleOffline()` | 加载、系统挂起恢复 | `game.test.ts`、`store.test.ts` | 高：防止离线金币膨胀 |
| CFG-028 | 离线经验公式 | 固定 0 | 离线不增加经验 | `settleOffline()` | 加载、系统挂起恢复 | `game.test.ts`、`store.test.ts` | 高：成长只来自实际在线和有效照顾 |
| CFG-029 | 时钟倒退处理 | `now` 非有限或不大于 `lastUpdatedAt` 时不推进、不发奖、不改时间 | 时间边界规则 | `advanceOnline()`、`settleOffline()` | 在线与离线推进 | `game.test.ts` | 高：防止负衰减和异常奖励 |

### 照顾动作

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-030 | 喂食 | 饱食未满时花费 5 金币，实际恢复 min(25, 剩余空间)，经验 floor(3 × 实际恢复 / 25)，行为 eating；满属性不扣费、不发经验 | 金币、属性点、经验点 | `performAction()` | 互动页、表情、经济 | `game.test.ts` | 高：影响金币消耗、属性恢复和成长 |
| CFG-031 | 玩耍 | 心情未满且精力至少 8；实际恢复 min(20, 剩余空间)，精力 -8，经验 floor(8 × 实际恢复 / 20)，行为 playing；满心情不耗精力 | 属性点、经验点 | `performAction()` | 互动页、表情 | `game.test.ts` | 高：影响主动经验和精力循环 |
| CFG-032 | 清洁 | 清洁未满时实际恢复 min(30, 剩余空间)，经验 floor(4 × 实际恢复 / 30)，行为 cleaning；满属性不发经验 | 属性点、经验点 | `performAction()` | 互动页、表情 | `game.test.ts` | 中：影响需求恢复和防刷 |
| CFG-033 | 睡眠切换 | sleeping 与 idle 互切；无即时经验或金币 | 状态切换 | `performAction()` | 互动页、精力恢复 | `game.test.ts` | 高：影响自动散步和精力 |
| CFG-034 | 临时行为复位 | 2,600 毫秒后恢复 idle；sleeping 不复位 | 毫秒 | 主进程动作复位计时器 | 喂食、玩耍、清洁反馈 | 无直接计时测试 | 中：改变反馈持续时间和中断体验 |
| CFG-035 | 可调用照顾动作 | feed、play、clean、sleep | `PetAction` 白名单 | `types.ts`、主进程 IPC | preload、面板 | `game.test.ts` | 高：新增动作需贯穿 API、领域、界面、动画和测试 |
| CFG-036 | 环境互动奖励 | 鼠标、键盘、拖动、点击、追逐等运行时互动固定 0 金币、0 经验、0 属性变化 | 非经济视觉互动 | `InteractionController`、`PetView` | 桌宠窗口 | `interaction-controller.test.ts` | 中：若新增奖励必须重新评估防刷和经济曲线 |

### 窗口、计时与移动

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-040 | 桌宠窗口尺寸 | 220 × 220 | CSS 像素 | `PET_SIZE`、渲染样式 | BrowserWindow、边界、画布 | `ui-regressions.test.ts` | 高：同步影响窗口、CSS、默认位置与边界 |
| CFG-041 | 管理面板尺寸 | 390 × 620 | CSS 像素；不可调整大小 | `PANEL_WIDTH`、`PANEL_HEIGHT` | BrowserWindow、面板定位 | `ui-regressions.test.ts` | 中：影响布局和多显示器定位 |
| CFG-042 | 默认桌宠边距 | 工作区右侧 24、底部 12 | CSS 像素 | `defaultPetPosition()` | 首次位置、唤回 | 无直接测试 | 低：影响默认落点 |
| CFG-043 | 面板与桌宠间距 | 12 | CSS 像素 | 面板定位逻辑 | 面板左右定位 | 无直接测试 | 低：影响窗口视觉关系 |
| CFG-044 | 在线状态推进周期 | 60,000 | 毫秒；每分钟衰减、在线奖励检查、保存与广播 | `startTimers()` | 主进程 | 无定时器集成测试 | 高：影响存盘频率和前台数值刷新 |
| CFG-045 | 前台全屏轮询 | 每 5,000 毫秒；Windows 检测命令超时 2,500 毫秒；边界容差 2 像素 | 毫秒、像素 | `detectForegroundFullscreen()`、`startTimers()` | 自动散步、环境互动抑制 | `interaction-integration.test.ts` 部分覆盖 | 中：影响全屏兼容和系统开销 |
| CFG-046 | 自动散步调度间隔 | 8,000 + round(random × 8,000) | 毫秒；约 8–16 秒 | `startTimers()` | 自动散步 | 无直接计时测试 | 中：影响打扰频率 |
| CFG-047 | 自动散步最大水平步长 | gentle=40；normal=75；lively=110 | CSS 像素；随机正负方向 | 主进程散步调度 | 自动散步目标 | 无直接测试 | 中：与速度共同决定移动观感 |
| CFG-048 | 自动散步底部边距 | 工作区底部 8 | CSS 像素 | 主进程散步调度 | 自动散步目标 Y | 无直接测试 | 低：影响脚底贴边程度 |
| CFG-049 | 移动位置刷新周期 | 33 | 毫秒；约 30 FPS | 主进程移动计时器 | BrowserWindow 连续移动 | `motion.test.ts` 间接覆盖轨迹 | 中：影响流畅度和主进程负担 |
| CFG-050 | 移动速度 | gentle=55；normal=85；lively=120 | 像素/秒 | `motion.ts` | MotionPlan | `motion.test.ts` | 高：影响强度差异和移动时长 |
| CFG-051 | 单次移动时长限制 | 最短 500；最长 2,400 | 毫秒 | `motion.ts` | MotionPlan | `motion.test.ts` | 中：影响远近距离一致性 |
| CFG-052 | 移动插值 | ease-in-out sine；位置逐帧四舍五入 | 进度 0..1；整数像素 | `motion.ts` | BrowserWindow 移动 | `motion.test.ts` | 中：改变路径观感与落点 |
| CFG-053 | 步态参数 | normal 0.58 秒、手臂 ±12°、腿 ±9°、弹跳 -4px；gentle 0.78 秒、±7°、±5°、-2px；lively 0.42 秒、±17°、±13°、-6px | 秒、角度、像素 | `styles.css` | 角色分层步态 | 无逐值测试 | 中：需与移动速度和素材联调 |
| CFG-054 | 常驻与照顾反馈动画 | 呼吸 3 秒；眨眼 4.8 秒；气泡循环 8 秒；咀嚼 0.4 秒交替；睡眠嘴部 2.2 秒；Z 浮动 2 秒；闪光旋转 1 秒；闪耀光晕 2 秒 | CSS 动画周期 | `styles.css` | 桌宠视觉反馈 | `ui-regressions.test.ts` 部分覆盖 | 中：改变动作节奏和阶段辨识 |
| CFG-055 | 经济实际运行时推进周期 | 5,000 | 毫秒；推进效果 FIFO 和单个探索任务；进程退出或系统 suspend/sleep/hibernate 时暂停，OS lock-screen 不暂停；完成探索时立即保存，否则广播，常规保存仍由 CFG-044 等时机负责 | `advanceActualEconomyRuntime()`、`startTimers()` | 效果、探索、状态页 | `economy.test.ts`、`interaction-integration.test.ts` | 高：影响付费消耗时长和任务完成时机 |

### 表情与行为

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-060 | 行为表情映射 | walking→focused；eating→delighted；playing→excited；cleaning→refreshed；sleeping→asleep；sad→sad | `PetBehavior` 到 `PetExpression` | `expression.ts` | PetView、气泡、CSS | `expression.test.ts` | 高：动作反馈和替代文案需同步 |
| CFG-061 | 低需求表情阈值 | 最低属性比例小于或等于 20% | 比例 0.2 | `resolvePetExpression()` | PetView | `expression.test.ts` | 中：影响需求反馈频率 |
| CFG-062 | 低需求同值优先级 | energy、satiety、cleanliness、mood | 有序属性键 | `expression.ts` | 表情解析 | `expression.test.ts` | 中：同时低值时决定唯一表情 |
| CFG-063 | 待机表情权重 | neutral 40%；happy 25%；curious 15%；surprised 10%；proud 10% | 随机区间阈值 | `randomIdleExpression()` | 健康 idle 表情 | `expression.test.ts` | 低：影响角色性格观感 |
| CFG-064 | 待机表情重抽间隔 | 5,000 + round(random × 4,000) | 毫秒；约 5–9 秒 | `pet-view.tsx` | PetView | 无计时测试 | 低：影响待机变化频率 |
| CFG-065 | 表情决策优先级 | 行为映射 > 最低临界需求 > 加权待机 | 决策顺序 | `resolvePetExpression()` | PetView | `expression.test.ts` | 高：改变会覆盖动作或需求反馈 |

### 装扮目录、素材与长期消费

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-070 | 同时装备数量 | 1 | `equippedItem` 为单个稳定装扮 ID 或 null | `types.ts`、装备 IPC | 商店、PetView | `game.test.ts` | 高：扩展多槽位需要存档迁移和渲染改造 |
| CFG-071 | 叶子发卡 | ID leaf-clip；价格 20；1 级；图标 🌿；class wearable leaf-clip | `ShopItem` | `SHOP_ITEMS` | 商店、存档、PetView | `catalog.test.ts` | 高：稳定 ID 禁止改名或复用 |
| CFG-072 | 橙色蝴蝶结 | ID bow；价格 35；2 级；图标 🎀；class wearable bow | `ShopItem` | `SHOP_ITEMS` | 商店、存档、PetView | `catalog.test.ts` | 高：稳定 ID 禁止改名或复用 |
| CFG-073 | 圆框眼镜 | ID glasses；价格 55；4 级；图标 👓；class wearable glasses | `ShopItem` | `SHOP_ITEMS` | 商店、存档、PetView | `catalog.test.ts` | 高：稳定 ID 禁止改名或复用 |
| CFG-074 | 小礼帽 | ID top-hat；价格 80；6 级；图标 🎩；class wearable top-hat | `ShopItem` | `SHOP_ITEMS` | 商店、存档、PetView | `catalog.test.ts` | 高：稳定 ID 禁止改名或复用 |
| CFG-075 | 音乐耳机 | ID headphones；价格 110；8 级；图标 🎧；class wearable headphones | `ShopItem` | `SHOP_ITEMS` | 商店、存档、PetView | `catalog.test.ts` | 高：稳定 ID 禁止改名或复用 |
| CFG-076 | 温暖围巾 | ID scarf；价格 150；10 级；图标 🧣；class wearable scarf | `ShopItem` | `SHOP_ITEMS` | 商店、存档、PetView | `catalog.test.ts` | 高：稳定 ID 禁止改名或复用 |
| CFG-077 | 金色皇冠 | ID crown；价格 240；15 级；图标 👑；class wearable crown | `ShopItem` | `SHOP_ITEMS` | 商店、存档、PetView | `catalog.test.ts`、`game.test.ts` | 高：稳定 ID 禁止改名或复用 |
| CFG-078 | 星星光环 | ID halo；价格 360；20 级；图标 ✨；class wearable halo | `ShopItem` | `SHOP_ITEMS` | 商店、存档、PetView | `catalog.test.ts` | 高：稳定 ID 禁止改名或复用 |
| CFG-079 | 装扮视觉锚点 | 四阶段 × 八件共 32 组 x、y、width、rotation；当前宽度 36–109px、旋转 -24°–12°，完整逐项值以 `OUTFIT_LAYOUTS` 为权威 | 相对 165×168 角色画布的 CSS 像素 | `outfit-layout.ts` | PetView、商店预览 | `outfit-layout.test.ts` | 中：角色轮廓或装扮素材变化时须逐阶段复核 |
| CFG-080 | 阶段角色素材 | 4 阶段 × body、arm-left、arm-right、leg-left、leg-right；每层 512×512 RGBA PNG；另有阶段整图 fallback | 像素资源 | `pet-view.tsx`、`assets/pet` | PetView、步态 | `ui-regressions.test.ts` | 高：命名和坐标系是渲染契约 |
| CFG-081 | 背包目录与堆叠 | 8 种用品 + 5 种服务券，共 13 种；每种最多 99；单次购买 1–10 | 稳定 `InventoryItemId` 与安全整数数量 | `INVENTORY_ITEMS`、`INVENTORY_STACK_LIMIT`、`MAX_PURCHASE_QUANTITY` | 商店、背包、schema 校验 | `catalog.test.ts`、`economy.test.ts` | 高：价格、效果和 ID 影响经济与兼容；逐项数值以目录为权威 |
| CFG-082 | 定时效果队列 | celebration、keyboard、mouse、theme、aura 五槽；每槽 FIFO 最多 32 段，总剩余实际运行时最多 14 天 | 正整数毫秒；有效效果与来源 ID | `MAX_EFFECT_SEGMENTS_PER_SLOT`、`MAX_EFFECT_RUNTIME_PER_SLOT_MS` | 使用物品、探索奖励、PetView | `economy.test.ts`、`game.test.ts` | 高：影响可预付时长、schema 和渲染效果 |
| CFG-083 | 探索任务 | 4 种；同一时间最多一个活动任务或一个待领取奖励；开始扣费，只按应用实际运行时间推进，提前返回不退款 | 稳定探索/故事 ID；价格与时长以 `EXPEDITIONS` 为权威 | `EXPEDITIONS`、`advanceEconomyRuntime()` | 生活页、旅行册、效果奖励 | `catalog.test.ts`、`economy.test.ts`、`game.test.ts` | 高：持续消耗金币并涉及任务恢复与故事兼容 |

### 用户设置

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-090 | 自动散步 | 默认 true | 布尔值 | `createDefaultSave()`、`AppSettings` | 调度器、托盘、设置页 | `store.test.ts` | 中：影响默认打扰程度和移动 |
| CFG-091 | 始终置顶 | 默认 true | 布尔值 | `createDefaultSave()`、窗口设置 | BrowserWindow、托盘、设置页 | `interaction-integration.test.ts` 部分覆盖 | 中：影响桌面可见性 |
| CFG-092 | 开机启动 | 默认 false | 布尔值 | `createDefaultSave()`、登录项设置 | Electron 登录项、设置页 | 无 Windows 实机自动测试 | 高：涉及系统副作用 |
| CFG-093 | 动画强度 | 默认 normal；gentle、normal、lively | `AnimationIntensity` | `types.ts`、移动与样式 | 速度、步长、CSS、设置页 | `motion.test.ts` | 高：新增档位需同步领域、主进程、CSS 和 UI |
| CFG-094 | 桌宠位置 | 默认 null；运行后为有限 x、y | 主进程限制在匹配显示器工作区 | `AppSettings.petPosition`、移动逻辑 | BrowserWindow、拖动、唤回 | `interaction-integration.test.ts` | 高：影响多显示器、DPI 与存档 |
| CFG-095 | 通用设置入口白名单 | autoWalk、alwaysOnTop、launchAtLogin、animationIntensity、petName | `SettingKey`；布尔或字符串 | `types.ts`、设置 IPC | preload、设置页、托盘 | `interaction-integration.test.ts` 部分覆盖 | 高：其他设置使用专用校验 API |
| CFG-096 | 桌面锁定 | 默认 false；锁定后主体保持置顶并完全点击穿透，只能由独立解锁窗或托盘解锁 | 持久布尔值；锁定时禁止面板写操作和拖动 | `desktopLocked`、锁定 IPC | 主窗、解锁窗、托盘、面板 | `interaction-integration.test.ts`、`ui-regressions.test.ts` | 高：关系到误触防护、窗口安全和可恢复性 |
| CFG-097 | 鼠标环境互动 | 默认 true | 持久布尔值；关闭不影响基本拖动 | `mouseInteractionsEnabled` | 采样器、互动控制器、设置页 | `interaction-controller.test.ts` | 中：影响注视和自发鼠标互动 |
| CFG-098 | 键盘陪打 | 默认 false | 持久布尔值；启用必须有当前同意版本 | `keyboardInteractionEnabled`、键盘 worker | 设置页、互动控制器 | `interaction-integration.test.ts` | 高：涉及全局键盘事件最小化采集和明确同意 |
| CFG-099 | 键盘同意版本 | 默认 0；当前版本 1；启用时必须等于 1 | 0..1 安全整数 | `KEYBOARD_CONSENT_VERSION`、schema 校验 | 迁移、设置 IPC、键盘 worker | `game.test.ts`、`interaction-integration.test.ts` | 高：同意文案变化必须升版并重新确认 |

### 鼠标、键盘与锁定运行时

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-100 | 鼠标采样、点击与拖动阈值 | 采样 50ms；点击组结算 320ms；拖动阈值 7 DIP；飞行速度在 1.4px/ms 归一封顶、基础最大倾斜 11°，gentle/normal/lively 幅度系数 0.65/1/1.25 | 毫秒、DIP、像素/毫秒、角度、倍率 | `interaction.ts`、`drag-visual.ts` | 主进程采样、PetView | `interaction.test.ts`、`drag-visual.test.ts` | 中：影响点击、抚摸和拖动观感 |
| CFG-101 | 四阶段互动参数 | sprout 幅度0.75/时长1.12/shy；lively 1.15/0.86/bouncy；mature 0.95/1/steady；radiant 1.05/0.9/radiant | 幅度与时长倍率、性格标签 | `INTERACTION_STAGE_PROFILES` | 互动控制器、CSS | `interaction.test.ts`、`ui-regressions.test.ts` | 高：保证阶段动作差异显著 |
| CFG-102 | 互动优先级与时长 | 优先级 idle0、nearby30、rest/paw50、tug/chase/dizzy60、keyboard70、petting90、dodge92、landing95、dragging100；基础时长 nearby3500、petting1200、dodge900、landing650、rest3500、paw1350、tug2200、chase2400、dizzy1800ms | 高优先级可中断低优先级；时长再乘阶段倍率 | `INTERACTION_PRIORITY`、`INTERACTION_DURATION_MS` | 互动控制器 | `interaction.test.ts`、`interaction-controller.test.ts` | 高：决定动作竞争与反馈辨识度 |
| CFG-103 | 注视与鼠标轨迹识别 | 注视半径700，x/y分别按350/250归一；挑逗2秒、半径70–230、路径≥420、横向反转≥4；环绕2.5秒且≥1.25圈，≥2圈后眩晕；附近停留6秒、距离≤160、速度≤25 | CSS 像素、毫秒、圈数、像素/秒 | `gazeForCursor()`、`isTeasingCursor()`、`accumulatedCursorTurns()`、`isNearbyCursor()` | 注视、扒拉、追逐、眩晕、陪伴 | `interaction.test.ts`、`interaction-controller.test.ts` | 中：改变环境互动触发率 |
| CFG-104 | 键盘节奏识别 | worker 每250ms汇总；1.5秒内≥10次且至少4个非空桶触发；低于3次视为安静；连续陪打最多18秒，休息3500ms，结束冷却12秒；worker 2秒未 ready 则 unavailable | 只传计数与时间桶，不传按键内容 | `keyboard-worker.ts`、`keyboardRhythmIsBusy()`、`InteractionController`、主进程 worker | 键盘陪打 | `interaction.test.ts`、`interaction-controller.test.ts`、`interaction-integration.test.ts` | 高：涉及输入隐私、节奏和资源占用 |
| CFG-105 | 自发互动与鼠标拉扯限制 | 自发动作间隔≥12秒且每分钟≤4次；扒拉后鼠标距中心≤90持续300ms，再于900ms内移动≥120触发拉扯；弹簧系数0.22，单 tick 位移≤24；paw/tug/chase/nearby 冷却分别由控制器设为15/30/30/45秒 | 毫秒、像素、比例、次数 | `InteractionController` | 鼠标环境互动、窗口移动 | `interaction-controller.test.ts` | 高：限制打扰频率并防止窗口突跳 |
| CFG-106 | 独立解锁窗 | 40 × 40；主体锁定时显示，始终置顶；只能执行解锁 | CSS 像素；独立 preload/API | `UNLOCK_SIZE`、`createUnlockWindow()` | 锁定恢复 | `interaction-integration.test.ts`、`ui-regressions.test.ts` | 高：尺寸或入口错误可能让用户无法解锁 |
| CFG-107 | 统一启动快照与成长事件 | `state:bootstrap` 返回 `{ state, runtime, offlineSummary, growthProgress }`；`growthProgress` 可为 null，当前启动值为 null；后续 `growth:progress` 的 source 只允许 online 或 care | IPC 数据契约；成长事件含 fromLevel、toLevel、milestones | `StartupSnapshot`、`GrowthProgressEvent`、`setupIpc()` | preload、面板、桌宠窗口 | `interaction-integration.test.ts`、`ui-regressions.test.ts` | 高：防止初始化竞态、重复升级提示和离线误报 |

## 尚未实现

- 亲密度、成长历史、任务奖励、成就、重生、疾病、死亡、掉级、真实付费、联网奖励或第二货币。
- 多槽稳定装扮、云存档、多代历史备份、配置远程下发或自动修复无效 schema 2。
- 照顾动作冷却、每日次数、随机成功率或按日重置。
- 离线结算摘要弹窗和累计在线时间展示。
- 系统级“减少动态效果”以外的应用内完全禁用动画档位。

## 失败与边界

- schema 2 使用深校验；无法通过的当前档不会被裁剪、猜测或默认档覆盖。schema 1 仅在完整旧契约有效时迁移。
- level 与 stage 在 schema 2 中必须一致；迁移旧档时会重算，当前档不一致则拒绝加载或保存。
- 离线只处理最多八小时属性变化，固定 0 金币、0 经验，并保留在线余数和累计在线时间。
- 应用退出后的停机段，以及系统 suspend/sleep/hibernate 到 resume 的间隔，走零奖励 `settleOffline()`；实际运行时效果与探索在这些间隔不推进。
- OS lock-screen 本身不算离线：只暂停原生输入和自动散步；只要进程未 suspend，在线奖励、效果和探索仍按实际运行计时。
- 在线奖励的“至少 1”针对一次 `advanceOnline()` 聚合结果，不是逐个五分钟单位分别保底。
- 鼠标样本、键盘桶、动作、注视、冷却和运行时状态均不持久化；重启后重新开始。
- 目录价格与时长的逐项数值以 `src/shared/catalog.ts` 为唯一源码权威；本表只登记数量、堆叠、队列和运行规则。
- 本表记录 1.2.0 的实现事实；源码与本表不一致时，应先核对代码和测试，再在同一变更中更新本表。

## 相关测试

- `src/shared/growth.test.ts`：50 级曲线、阶段、称号、星级、里程碑和属性上限。
- `src/shared/game.test.ts`：深校验、衰减、在线余数、离线零奖励、照顾比例、防刷和迁移。
- `src/shared/catalog.test.ts`、`src/shared/economy.test.ts`：目录稳定性、背包、服务、效果 FIFO、探索和实际运行时。
- `src/shared/interaction.test.ts`、`src/main/interaction-controller.test.ts`、`src/main/interaction-integration.test.ts`：鼠标、键盘、拖动、锁定和系统恢复集成。
- `src/shared/expression.test.ts`、`src/main/motion.test.ts`：表情与移动。
- `src/main/store.test.ts`：默认档、深校验、备份恢复、schema 1 一次性备份、迁移与未来 schema 拒绝。
- `src/renderer/ui-regressions.test.ts`：四阶段素材、成长反馈、互动表现、经济界面和锁定入口。
- `src/main/release-config.test.ts`：发布配置与版本身份。
