# 配置与变量总账

> 文档级别：LIVING（随实现持续维护）  
> 修改权限：子代理可在对应代码或测试已经变更并完成核对时修改；不得仅为设想改写“当前值”，不得重排、复用或删除既有 CFG 编号。  
> 适用版本：1.1.0  
> 最后核对：2026-08-15  
> 权威源码：src/shared/types.ts、src/shared/game.ts、src/shared/catalog.ts、src/shared/expression.ts、src/main/main.ts、src/main/motion.ts、src/renderer/App.tsx、src/renderer/styles.css  
> 更新触发：默认存档、领域类型、公式、阈值、计时器、窗口尺寸、动作、表情、装扮目录、设置项或其测试发生变化时。

本文件是当前实现的配置索引，不替代源码。CFG 编号是长期引用标识：已有编号即使废弃也只能标为“已废弃”，不能改号或转给另一含义。其他参考文档应引用本表编号，避免复制出第二套权威数值。

## 当前已实现

### 默认存档与持久化

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-001 | 存档结构版本 | 1 | 整数；当前校验只接受 1 | src/shared/types.ts:51-57；src/shared/game.ts:23,147-153 | SaveStore、全部状态读写 | src/main/store.test.ts:19-38 | 高：改变后必须提供旧存档迁移，不能静默重置 |
| CFG-002 | 默认宠物名称 | 小橙子 | 字符串；设置入口去除首尾空白后为 1–12 个 JavaScript 字符单元 | src/shared/game.ts:24-26；src/main/main.ts:248-251 | 桌宠替代文本、面板、右键菜单 | src/main/store.test.ts:20-24 | 中：影响新存档和界面文案，不应覆盖已有名称 |
| CFG-003 | 初始行为 | idle | PetBehavior 枚举：idle、walking、eating、playing、cleaning、sleeping、sad | src/shared/types.ts:1；src/shared/game.ts:25 | 表情解析、自动散步、动作复位 | src/shared/expression.test.ts:12-23 | 中：新增行为需同步类型、表情、动画和中断规则 |
| CFG-004 | 初始四项属性 | satiety=90；mood=90；energy=90；cleanliness=90 | 数值点数；运行时目标范围为 0..属性上限 | src/shared/game.ts:26 | 状态页、衰减、效率、互动 | src/shared/game.test.ts:29-44 | 高：改变新手节奏、初期收益和首日体验 |
| CFG-005 | 最后更新时间 | 创建存档时的 Date.now() | Unix 时间戳，毫秒；应为有限数 | src/shared/game.ts:21,25；src/shared/types.ts:24 | 在线推进、离线结算 | src/shared/game.test.ts:46-54 | 高：错误会重复结算、漏发或造成属性异常 |
| CFG-006 | 初始成长状态 | level=1；experience=0；stage=sprout；totalOnlineMs=0；rewardRemainderMs=0 | 等级为整数；经验为点；两个时间字段为毫秒 | src/shared/game.ts:28 | 成长、奖励、阶段素材、状态页 | src/shared/game.test.ts:4-26,36-44 | 高：影响新存档、升级和挂机连续性 |
| CFG-007 | 初始经济状态 | coins=30；ownedItems=[]；equippedItem=null | 金币为数值；物品为稳定 ID 数组；装备为 ID 或 null | src/shared/game.ts:29；src/shared/types.ts:35-39 | 喂食、商店、桌宠装扮 | src/shared/game.test.ts:57-75 | 高：改变初始购买能力；字段改变涉及存档兼容 |
| CFG-008 | 存档文件策略 | save.json；save.backup.json；save.tmp.json | 位于 Electron userData；UTF-8 JSON | src/main/store.ts:6-30 | SaveStore | src/main/store.test.ts:19-38 | 高：影响数据安全、备份恢复和更新兼容 |
| CFG-009 | 自动保存时机 | 加载结算后；每 60 秒；关键操作；自动移动完成；正常退出 | 毫秒计时与事件触发 | src/main/store.ts:17-22；src/main/main.ts:116-120,208-245,340-344,378 | 主进程 | 无完整时机测试 | 高：遗漏会丢失进度；新增高频写入需评估磁盘负担 |

### 成长、属性与衰减

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-010 | 最高等级 | 20 | 整数等级，1–20 | src/shared/game.ts:4；src/shared/game.ts:56-68 | 经验、阶段、状态页 | src/shared/game.test.ts:15-25 | 高：影响存档校验、经验显示、阶段与装扮解锁 |
| CFG-011 | 下一级经验公式 | 100 + (当前等级 - 1) × 50 | 经验点；当前等级 1–19 | src/shared/game.ts:16 | addExperience、状态页 | src/shared/game.test.ts:4-13 | 高：改变完整成长时长，需平衡奖励来源 |
| CFG-012 | 成长阶段阈值 | sprout 1–4；lively 5–9；mature 10–19；radiant 20 | GrowthStage 枚举 | src/shared/game.ts:9-14；src/shared/types.ts:3 | 升级、素材路径、面板阶段名 | src/shared/game.test.ts:4-13；src/renderer/ui-regressions.test.ts:21-29 | 高：影响阶段素材、存档 stage 与解锁叙事 |
| CFG-013 | 属性上限公式 | 100 + 2 × (限制在 1–20 后的等级 - 1) | 属性点；1 级 100，20 级 138 | src/shared/game.ts:17 | 衰减、互动、效率、状态条、需求表情 | src/shared/game.test.ts:4-13 | 高：同时改变养成容量、需求比例和收益效率 |
| CFG-014 | 饱食衰减 | -2/小时；睡眠时相同 | 属性点/小时 | src/shared/game.ts:38-46 | 在线推进、离线结算 | src/shared/game.test.ts:29-34 | 中：影响低需求表情与收益 |
| CFG-015 | 心情衰减 | -1.5/小时；睡眠时相同 | 属性点/小时 | src/shared/game.ts:38-46 | 在线推进、离线结算 | src/shared/game.test.ts:29-34 | 中：影响低需求表情与收益 |
| CFG-016 | 精力变化 | 清醒 -3/小时；睡眠 +12/小时 | 属性点/小时 | src/shared/game.ts:38-46 | 在线推进、离线结算、玩耍门槛 | src/shared/game.test.ts:29-34 | 高：影响睡眠收益与可玩频率 |
| CFG-017 | 清洁衰减 | -1/小时；睡眠时相同 | 属性点/小时 | src/shared/game.ts:38-46 | 在线推进、离线结算 | src/shared/game.test.ts:29-34 | 中：影响低需求表情与收益 |
| CFG-018 | 属性规范化 | 限制到 0..当前上限；结果四舍五入到两位小数 | 属性点 | src/shared/game.ts:18-19,38-46 | 所有时间推进 | src/shared/game.test.ts:29-34 | 中：改变舍入会造成长期累计差异 |

### 在线、离线与经济奖励

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-020 | 奖励效率公式 | 0.5 + 四项属性相对上限的平均值 × 0.7 | 倍率；正常状态下 0.5–1.2 | src/shared/game.ts:49-54 | 在线金币、在线经验、离线奖励、状态页 | 由 src/shared/game.test.ts:36-54 间接覆盖 | 高：同时改变全部被动产出 |
| CFG-021 | 奖励周期 | 5 分钟 | 300000 毫秒 | src/shared/game.ts:5 | 在线推进、离线结算、状态页倒计时 | src/shared/game.test.ts:36-44 | 高：影响存档余数和全部挂机节奏 |
| CFG-022 | 在线金币公式 | max(1, floor(结算单位数 × 2 × 效率)) | 整数金币；一次推进有结算单位时至少 1 | src/shared/game.ts:71-85 | economy.coins | src/shared/game.test.ts:36-44 | 高：影响购买与喂食经济 |
| CFG-023 | 在线经验公式 | max(1, floor(结算单位数 × 效率)) | 整数经验；一次推进有结算单位时至少 1；满级不累计 | src/shared/game.ts:71-85 | addExperience | src/shared/game.test.ts:36-44 | 高：影响升级时长 |
| CFG-024 | 在线奖励余数 | rewardRemainderMs 累加并对 5 分钟取余 | 毫秒；目标范围 0..299999 | src/shared/game.ts:76-80 | 连续在线和重启后的在线推进 | src/shared/game.test.ts:36-44 | 高：处理不当会漏发或重复发放 |
| CFG-025 | 离线累计上限 | 8 小时 | 28800000 毫秒 | src/shared/game.ts:6,89-103 | SaveStore.load | src/shared/game.test.ts:46-54 | 高：影响回流奖励和属性衰减时长 |
| CFG-026 | 离线折扣 | 在线基础结果的 70% | 倍率 0.7 | src/shared/game.ts:97-103 | 离线金币、离线经验 | src/shared/game.test.ts:46-54 | 高：影响在线与离线价值关系 |
| CFG-027 | 离线金币公式 | floor(完整离线周期数 × 2 × 结算后效率 × 0.7) | 整数金币；允许为 0 | src/shared/game.ts:93-103 | economy.coins | src/shared/game.test.ts:46-54 | 高：改变回流经济 |
| CFG-028 | 离线经验公式 | 未满级时 floor(完整离线周期数 × 结算后效率 × 0.7)，满级为 0 | 整数经验；允许为 0 | src/shared/game.ts:93-103 | addExperience | src/shared/game.test.ts:46-54 | 高：改变回流升级速度 |
| CFG-029 | 时钟倒退处理 | now 不大于 lastUpdatedAt 时不推进、不发奖 | 时间边界规则 | src/shared/game.ts:71-73,89-92 | 在线与离线推进 | src/shared/game.test.ts:46-54 | 高：防止负衰减和异常奖励 |

### 互动动作

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-030 | 喂食 | 花费 5 金币；饱食 +25；经验 +3；行为 eating | 整数金币、属性点、经验点 | src/shared/game.ts:106-116 | 互动页、表情、经济 | src/shared/game.test.ts:57-66 | 高：影响金币消耗和成长 |
| CFG-031 | 玩耍 | 需要精力至少 8；心情 +20；精力 -8；经验 +8；行为 playing | 属性点、经验点 | src/shared/game.ts:117-124 | 互动页、表情 | src/shared/game.test.ts:57-66 | 高：影响最强主动经验来源 |
| CFG-032 | 清洁 | 清洁 +30；经验 +4；行为 cleaning | 属性点、经验点 | src/shared/game.ts:125-130 | 互动页、表情 | 无直接断言 | 中：影响需求恢复和成长 |
| CFG-033 | 睡眠切换 | sleeping 与 idle 互切；无即时经验或金币 | 状态切换 | src/shared/game.ts:131-132 | 互动页、菜单、精力恢复 | src/shared/game.test.ts:29-34 间接覆盖睡眠恢复 | 高：影响自动散步、动作复位和精力 |
| CFG-034 | 临时行为复位 | 2600 毫秒后恢复 idle；sleeping 不复位 | 毫秒 | src/main/main.ts:266-274 | 喂食、玩耍、清洁动画/表情 | 无直接测试 | 中：改变反馈持续时间和动作中断体验 |
| CFG-035 | 可调用动作白名单 | feed、play、clean、sleep | PetAction 枚举 | src/shared/types.ts:2；src/main/main.ts:15,277-286 | preload IPC、主进程 | 领域动作由 src/shared/game.test.ts:57-66 部分覆盖 | 高：新增动作需贯穿 API、领域、界面、动画和测试 |

### 窗口、计时与移动

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-040 | 桌宠窗口尺寸 | 220 × 220 | CSS 像素 | src/main/main.ts:12,63-70；src/renderer/styles.css:10 | BrowserWindow、屏幕边界、渲染画布 | src/renderer/ui-regressions.test.ts:7-19 部分覆盖渲染结构 | 高：同步影响窗口、CSS、默认位置与边界 |
| CFG-041 | 管理面板尺寸 | 390 × 620 | CSS 像素；不可调整大小 | src/main/main.ts:13-14,79-84 | BrowserWindow、面板定位 | 无直接测试 | 中：影响布局与多显示器定位 |
| CFG-042 | 默认桌宠边距 | 工作区右侧 24、底部 12 | CSS 像素 | src/main/main.ts:49-52 | 首次位置、唤回 | 无直接测试 | 低：影响默认落点 |
| CFG-043 | 面板与桌宠间距 | 12 | CSS 像素 | src/main/main.ts:92-100 | 面板左右定位 | 无直接测试 | 低：影响窗口视觉关系 |
| CFG-044 | 在线状态推进周期 | 60000 | 毫秒；1 分钟 | src/main/main.ts:340-344 | 衰减、奖励、保存与广播 | 无定时集成测试 | 高：影响存盘频率和前台数值刷新 |
| CFG-045 | 前台全屏轮询 | 每 5000 毫秒；Windows 检测命令超时 2500 毫秒；边界容差 2 像素 | 毫秒、像素 | src/main/main.ts:329-348 | 自动散步抑制 | 无直接测试 | 中：影响全屏应用兼容与系统开销 |
| CFG-046 | 自动散步调度间隔 | 8000 + round(random × 8000) | 毫秒；约 8–16 秒 | src/main/main.ts:349-361 | 自动散步 | 无直接测试 | 中：影响打扰频率和活跃感 |
| CFG-047 | 自动散步最大水平步长 | gentle=40；normal=75；lively=110 | CSS 像素，随机取正负方向 | src/main/main.ts:354-358 | 自动散步目标 | 无直接测试 | 中：与速度、窗口尺寸共同决定移动观感 |
| CFG-048 | 自动散步底部边距 | 工作区底部 8 | CSS 像素 | src/main/main.ts:358 | 自动散步目标 Y | 无直接测试 | 低：影响脚底贴边程度 |
| CFG-049 | 移动位置刷新周期 | 33 | 毫秒；约 30 FPS | src/main/main.ts:229-236 | BrowserWindow 连续移动 | 无直接测试 | 中：影响流畅度和主进程负担 |
| CFG-050 | 移动速度 | gentle=55；normal=85；lively=120 | 像素/秒 | src/main/motion.ts:3,12-15 | MotionPlan | src/main/motion.test.ts:4-11 | 高：影响强度差异和移动时长 |
| CFG-051 | 单次移动时长限制 | 最短 500；最长 2400 | 毫秒 | src/main/motion.ts:12-15 | MotionPlan | src/main/motion.test.ts:4-11 | 中：影响远近距离的一致性 |
| CFG-052 | 移动插值 | ease-in-out sine；位置逐帧四舍五入 | 进度限制 0..1；输出整数像素 | src/main/motion.ts:18-29 | BrowserWindow 移动 | src/main/motion.test.ts:13-21 | 中：改变路径观感与落点 |
| CFG-053 | 步态参数 | normal 0.58 秒、手臂 ±12°、腿 ±9°、弹跳 -4px；gentle 0.78 秒、±7°、±5°、-2px；lively 0.42 秒、±17°、±13°、-6px | 秒、角度、像素 | src/renderer/styles.css:13,23-27,57 | 角色分层步态 | 无逐值测试 | 中：需与移动速度和分层素材联调 |
| CFG-054 | 常驻与反馈动画时长 | 呼吸 3 秒；眨眼 4.8 秒；气泡循环 8 秒；咀嚼 0.4 秒交替；睡眠嘴部 2.2 秒；Z 浮动 2 秒；闪光旋转 1 秒；闪耀光晕 2 秒 | CSS 动画周期 | src/renderer/styles.css:11,17,35,48,50,55,58-64 | 桌宠视觉反馈 | 无逐值测试 | 中：改变动作节奏；当前不受动画强度统一控制 |

### 表情与行为

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-060 | 行为表情映射 | walking→focused；eating→delighted；playing→excited；cleaning→refreshed；sleeping→asleep；sad→sad | PetBehavior 到 PetExpression | src/shared/expression.ts:6-13 | PetView、气泡、CSS 表情 | src/shared/expression.test.ts:12-23 | 高：动作反馈和无障碍文案需同步 |
| CFG-061 | 低需求表情阈值 | 最低属性比例小于或等于 20% | 比例 0.2 | src/shared/expression.ts:33-48 | PetView | src/shared/expression.test.ts:25-37 | 中：影响需求反馈出现频率 |
| CFG-062 | 低需求同值优先级 | energy、satiety、cleanliness、mood | 有序属性键列表 | src/shared/expression.ts:15-22 | 表情解析 | src/shared/expression.test.ts:25-37 | 中：同时低值时决定唯一表情 |
| CFG-063 | 待机表情权重 | neutral 40%；happy 25%；curious 15%；surprised 10%；proud 10% | 随机区间阈值 | src/shared/expression.ts:4,24-31 | 健康 idle 表情 | src/shared/expression.test.ts:5-10 | 低：影响角色性格观感 |
| CFG-064 | 待机表情重抽间隔 | 5000 + round(random × 4000) | 毫秒；约 5–9 秒 | src/renderer/App.tsx:44-52 | PetView | 无计时测试 | 低：影响待机变化频率 |
| CFG-065 | 表情决策优先级 | 行为映射 > 最低临界需求 > 加权待机 | 决策顺序 | src/shared/expression.ts:33-48 | PetView | src/shared/expression.test.ts:12-37 | 高：改变会覆盖动作或需求反馈 |

### 装扮目录与素材

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-070 | 同时装备数量 | 1 | equippedItem 为单个 ID 或 null | src/shared/types.ts:35-39；src/main/main.ts:320-324 | 商店、PetView | 无装备集成测试 | 高：扩展多槽位需要存档迁移和渲染改造 |
| CFG-071 | 叶子发卡 | ID leaf-clip；价格 20；1 级；图标 🌿；class wearable leaf-clip | ShopItem | src/shared/catalog.ts:4 | 商店、存档、PetView | src/shared/game.test.ts:68-75 | 高：ID 已持久化，禁止改名或复用 |
| CFG-072 | 橙色蝴蝶结 | ID bow；价格 35；2 级；图标 🎀；class wearable bow | ShopItem | src/shared/catalog.ts:5 | 商店、存档、PetView | 无逐项测试 | 高：ID 已持久化，禁止改名或复用 |
| CFG-073 | 圆框眼镜 | ID glasses；价格 55；4 级；图标 👓；class wearable glasses | ShopItem | src/shared/catalog.ts:6 | 商店、存档、PetView | 无逐项测试 | 高：ID 已持久化，禁止改名或复用 |
| CFG-074 | 小礼帽 | ID top-hat；价格 80；6 级；图标 🎩；class wearable top-hat | ShopItem | src/shared/catalog.ts:7 | 商店、存档、PetView | 无逐项测试 | 高：ID 已持久化，禁止改名或复用 |
| CFG-075 | 音乐耳机 | ID headphones；价格 110；8 级；图标 🎧；class wearable headphones | ShopItem | src/shared/catalog.ts:8 | 商店、存档、PetView | 无逐项测试 | 高：ID 已持久化，禁止改名或复用 |
| CFG-076 | 温暖围巾 | ID scarf；价格 150；10 级；图标 🧣；class wearable scarf | ShopItem | src/shared/catalog.ts:9 | 商店、存档、PetView | 无逐项测试 | 高：ID 已持久化，禁止改名或复用 |
| CFG-077 | 金色皇冠 | ID crown；价格 240；15 级；图标 👑；class wearable crown | ShopItem | src/shared/catalog.ts:10 | 商店、存档、PetView | src/shared/game.test.ts:68-75 部分覆盖等级锁 | 高：ID 已持久化，禁止改名或复用 |
| CFG-078 | 星星光环 | ID halo；价格 360；20 级；图标 ✨；class wearable halo | ShopItem | src/shared/catalog.ts:11 | 商店、存档、PetView | 无逐项测试 | 高：ID 已持久化，禁止改名或复用 |
| CFG-079 | 装扮视觉锚点 | leaf-clip top19 left50 size27；bow top30 right24 size37；glasses top72 left46 size47；top-hat top0 left61 size37；headphones top53 left33 size61；scarf top119 left54 size48；crown top4 left64 size37；halo top1 left58 size37 | CSS 像素；相对 165×168 pet-character | src/renderer/styles.css:13,56 | PetView | 无视觉坐标测试 | 中：角色轮廓或阶段素材变化时必须逐阶段复核 |
| CFG-080 | 阶段角色素材 | 4 阶段 × body、arm-left、arm-right、leg-left、leg-right；每层 512×512 RGBA PNG；另有阶段整图 fallback | 像素资源 | src/renderer/App.tsx:39-41,80-87；assets/pet | PetView、步态 | src/renderer/ui-regressions.test.ts:15-29 | 高：命名和坐标系是渲染契约 |

### 用户设置

| 编号 | 变量或规则 | 当前值 | 类型、单位与范围 | 权威源码 | 使用方 | 相关测试 | 变更影响 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CFG-090 | 自动散步 | 默认 true | 布尔值 | src/shared/game.ts:30；src/shared/types.ts:43-49 | 调度器、托盘、设置页 | 无直接测试 | 中：影响默认打扰程度和移动 |
| CFG-091 | 始终置顶 | 默认 true | 布尔值 | src/shared/game.ts:30；src/main/main.ts:63-72,248-260 | BrowserWindow、托盘、设置页 | 无直接测试 | 中：影响桌面可见性 |
| CFG-092 | 开机启动 | 默认 false | 布尔值 | src/shared/game.ts:30；src/main/main.ts:248-260 | Electron 登录项、设置页 | 无直接测试 | 高：涉及系统副作用，应做 Windows 实机验证 |
| CFG-093 | 动画强度 | 默认 normal；可选 gentle、normal、lively | AnimationIntensity 枚举 | src/shared/types.ts:4,43-49；src/shared/game.ts:30；src/main/main.ts:16,252-254 | 速度、步长、CSS 步态、设置页 | src/main/motion.test.ts:4-11 | 高：新增档位需同时更新领域类型、主进程、CSS 和 UI |
| CFG-094 | 桌宠位置 | 默认 null；运行后为 x、y | 有限数坐标；主进程限制在最近显示器工作区 | src/shared/types.ts:41,43-49；src/shared/game.ts:30；src/main/main.ts:49-60,184-189,305-312 | BrowserWindow、拖动、唤回 | 无主进程集成测试 | 高：影响多显示器、DPI 与存档 |
| CFG-095 | 可公开修改的设置键 | autoWalk、alwaysOnTop、launchAtLogin、animationIntensity、petName | SettingKey 白名单；布尔或字符串 | src/shared/types.ts:65；src/main/main.ts:248-263,287-292 | preload API、设置页、托盘 | 无 IPC 集成测试 | 高：新增设置需完成类型、校验、副作用、默认值与迁移 |

## 待批准规划

以下均未实现，只有用户明确批准后才能进入代码与“当前值”：

- 将硬编码数值集中为类型安全的领域配置模块，并保留 CFG 编号到源码常量的映射。
- 为配置增加显式版本、合法范围校验和变更记录。
- 为装扮增加资源化图像、分阶段锚点、多槽位、类别或稀有度。
- 为动作增加冷却、时长、中断策略、队列、亲密度、任务或道具。
- 将全部动画周期纳入动画强度或无动画/减少动态效果设置。
- 在界面展示离线结算摘要和累计在线时长。

## 失败与边界

- 当前存档校验较浅，只校验 schema、主要对象、名称、时间、等级和 ownedItems 数组；没有完整校验属性、金币、阶段、余数、装备 ID 或设置值。见 src/shared/game.ts:147-153。
- level 与 stage 在加载时不做一致性修复；stage 只在 addExperience 升级过程中更新。
- 拖动通过 pet:set-position 只更新内存，松手没有单独保存调用；通常依赖每分钟保存或正常退出。
- 离线结算不把离线时长与 rewardRemainderMs 合并，且效率取整段衰减后的最终属性。
- 应用运行中经历系统挂起后，resume 使用 advanceOnline 而不是带 8 小时上限的 settleOffline，因此该段时间按在线规则处理。
- online 的“至少 1”针对一次 advanceOnline 的聚合结果，不是逐个五分钟单位分别保底。
- 货币、经验和大部分状态字段没有运行时上下界完整校验；修改前不能假定坏存档会被安全拒绝。
- 本表记录的是 1.1.0 事实。源码与本表不一致时，应先核对代码和测试，再在同一变更中更新本表，不得凭文档猜测实现。

## 相关测试

- src/shared/game.test.ts：成长曲线、阶段、属性上限、衰减、在线余数、离线上限、时钟倒退、喂食、玩耍和购买。
- src/shared/expression.test.ts：待机权重、行为优先级、需求阈值和同值优先级。
- src/main/motion.test.ts：速度档位、时长上下限、方向、缓动与落点。
- src/main/store.test.ts：默认存档、主存档损坏后的备份恢复。
- src/renderer/ui-regressions.test.ts：透明窗口约束、角色五层资源、四阶段 512×512 RGBA 素材。
- 当前缺少主进程 IPC、定时器、自动散步、多显示器、拖动即时保存、逐件装扮、装备持久化和设置系统副作用的集成测试。
