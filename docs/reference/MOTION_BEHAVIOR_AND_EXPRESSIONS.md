# 移动、行为、动画与表情规格

> 文档级别：LIVING（随实现持续维护）  
> 修改权限：子代理仅可在行为类型、移动调度、动画、表达式解析、交互手势、视觉素材或测试已经变更并核对后更新；新增动作方向或角色性格规则必须先取得用户批准。  
> 适用版本：1.1.0  
> 最后核对：2026-08-15  
> 权威源码：src/shared/types.ts:1-11、src/shared/expression.ts、src/main/motion.ts、src/main/main.ts:184-245,266-275,329-361、src/renderer/App.tsx:7-12,33-103、src/renderer/styles.css:9-64  
> 更新触发：PetBehavior、PetExpression、动作持续时间、自动散步条件、速度/步长/缓动、动画强度、拖动与点击手势、图层结构、表情文案、CSS 动画或相关测试变化时。

精确参数统一登记在 [CONFIGURATION_REGISTRY.md](CONFIGURATION_REGISTRY.md)，主要见 CFG-034、CFG-035、CFG-040 至 CFG-065、CFG-079、CFG-080、CFG-090、CFG-093、CFG-094。

## 当前已实现

### 行为模型

PetBehavior 当前包含：

- idle：默认待机，也是自动散步的前置状态。
- walking：主进程连续移动期间的临时行为。
- eating、playing、cleaning：互动成功后的临时行为。
- sleeping：由用户显式切换的持续行为。
- sad：类型和表情映射已存在，但当前没有规则主动设置。

行为只有一个字符串字段，不是带开始时间、剩余时间、优先级或参数的动作对象。主进程使用一个 actionResetTimer 按 CFG-034 将非睡眠互动复位为 idle。

### 自动散步状态流

自动散步调度器按 CFG-046 重复检查。只有同时满足以下条件才开始一次移动：

- petWindow 存在。
- autoWalk 为 true，见 CFG-090。
- 当前 behavior 严格等于 idle。
- 未检测到前台全屏窗口。
- 管理面板当前没有焦点。

目标点以当前桌宠所在显示器的工作区为准：

- X 在当前位置左右随机 CFG-047 的最大步长范围内，再由 clampPosition 限制到工作区。
- Y 固定到工作区底部，边距见 CFG-048。
- 移动速度、时长和缓动分别见 CFG-050 至 CFG-052。
- 主进程按 CFG-049 更新 BrowserWindow 位置。

开始移动时：

1. 取消已有移动。
2. 保存需要恢复的旧 behavior。
3. 根据目标 X 判断 left 或 right。
4. 把 behavior 设为 walking。
5. 广播 PetMotionState 的 moving=true 和 direction。

完成时写入 petPosition，恢复旧 behavior，广播 moving=false，并保存状态。取消时使用 motionToken 使旧 tick 失效；如当前仍为 walking，恢复动作前行为。

自动移动会在管理面板获得焦点、用户互动、拖动位置、关闭 autoWalk 或检测到全屏窗口时取消。sleeping 等非 idle 行为自然阻止下一次散步。

### 拖动、单击与右键

PetView 的左键手势：

- pointer down 记录屏幕起点和窗口起点。
- 横纵位移绝对值之和大于 5 像素后判定为拖动。
- 拖动期间每次 pointer move 都调用 pet:set-position；主进程取消自动移动、限制工作区并移动窗口。
- 未发生拖动的 pointer up 视为单击，切换管理面板。

右键阻止浏览器默认菜单，并请求主进程显示桌宠菜单。右键菜单可打开面板、睡觉/叫醒、切换自动散步、隐藏或退出。

### 角色分层与朝向

当前阶段使用 CFG-080 的五张同坐标系图层。pet-facing 包含 pet-rig，因此向左时整个身体、四肢和 DOM 五官通过 scaleX(-1) 翻转。装扮位于 pet-facing 外部，不跟随翻转，详见装扮规格。

正常待机时 pet-rig 持续呼吸；moving=true 时切换为上下弹跳，并让左右手脚交替摆动。动画强度的步态参数见 CFG-053，移动速度和随机步长分别见 CFG-050、CFG-047。

### 动作动画

动作视觉当前主要由 behavior 对应表情和 CSS 局部动画构成：

- walking：专注表情、身体弹跳、四肢交替。
- eating：满足表情和嘴部咀嚼。
- playing：兴奋表情和嘴部咀嚼样式。
- cleaning：清爽表情、表情星标和额外闪光。
- sleeping：闭眼、睡眠嘴部动作和 Z 标记。
- radiant 阶段：独立光晕。

具体周期见 CFG-054。当前没有逐动作身体关键帧、玩具资源、粒子系统、声音、动作时间线或动画完成事件。

### 表情决策

PetExpression 当前包含 14 种：neutral、happy、curious、surprised、proud、focused、delighted、excited、refreshed、asleep、sad、sleepy、hungry、uncomfortable。

解析顺序见 CFG-065：

1. 如果当前 behavior 有专属表情，直接返回 CFG-060 的映射。
2. 否则比较四项属性相对当前上限的比例；达到 CFG-061 阈值时返回最低需求对应表情，同值顺序见 CFG-062。
3. 没有临界需求时，根据 CFG-063 的权重选择待机表情。

PetView 按 CFG-064 周期重抽 idleRoll。每个表情有一条固定中文气泡文案和对应 CSS 眼睛、眉毛、嘴巴或标记。行为/需求表情的气泡持续可见；健康待机气泡按 CFG-054 中的气泡循环间歇显示。

## 待批准规划

以下均未实现：

- 参数化动作状态机：动作开始时间、持续时间、优先级、可中断性、冷却和结束原因。
- 抚摸、跳跃、挥手、跌倒、玩具互动、节日动作或多段组合动作。
- 逐动作骨骼/分层关键帧、粒子、音效和动画完成事件。
- 垂直自由移动、路径规划、障碍物避让、窗口边缘行为或多显示器巡游策略。
- 动作或性格随等级、阶段、装扮、时间段和亲密度变化。
- 为全部动画统一提供“减少动态效果”或完全关闭动画。
- 为装扮建立跟随朝向、阶段和动作的锚点系统。

新增行为时必须同时定义：触发条件、状态字段、互斥/中断、持续时间、结束状态、表情、身体动画、气泡、保存语义、IPC 白名单和测试。

## 失败与边界

- sad 行为没有触发路径；低 mood 直接产生 sad 表情，但 behavior 仍通常是 idle。
- animationIntensity 只统一影响移动速度、自动步长和步态参数；呼吸、眨眼、表情、咀嚼、睡眠、闪光与光晕周期保持不变。
- 动作持续时间由主进程固定定时器决定，与 CSS 动画周期没有完成事件同步。
- playing 与 eating 共用相似的嘴部动画，没有独立的玩具或肢体动作；cleaning 也没有清洁身体动作。
- 自动散步会把 Y 目标拉到屏幕底部；用户把桌宠拖到较高位置后，下一次散步不是保持同一高度。
- Windows 全屏检测依赖外部 PowerShell 和前台窗口矩形；执行失败时按“非全屏”处理。
- pet:set-position 在每个 pointer move 调用，没有节流；主进程每次都会取消移动并设置窗口位置。
- 拖动结束没有显式保存，位置依赖下一次每分钟保存、后续关键操作或正常退出。
- 拖动阈值使用 abs(dx)+abs(dy)>5，不是欧氏距离；pointer cancel 也走与 pointer up 相同的结束逻辑。
- PetMotionState 不持久化，渲染器初始假定 moving=false、direction=right；它只接收后续广播。
- 装扮不在翻转节点内，角色向左时不会镜像；固定锚点也不区分成长阶段。
- 表情阈值依赖合法的属性和等级。浅层存档校验无法阻止 NaN、负属性或错误 stage 进入渲染。
- healthy idle 的表情随机性只在前端，无法复现，也不会保存。
- motion、自动散步和拖动没有 Electron 集成测试；纯函数测试无法覆盖真实窗口中断和多显示器边界。

## 相关测试

- src/main/motion.test.ts:4-11：验证左右方向、强度速度差异和移动时长上下限。
- src/main/motion.test.ts:13-21：验证 sine 缓动边界、单调插值和精确落点。
- src/shared/expression.test.ts:5-10：验证待机表情权重边界和随机值限制。
- src/shared/expression.test.ts:12-23：验证行为表情优先于需求和待机。
- src/shared/expression.test.ts:25-37：验证最低需求、20% 边界和固定同值优先级。
- src/renderer/ui-regressions.test.ts:15-29：验证五层渲染结构与四阶段 RGBA 素材契约。
- 当前缺少真实 BrowserWindow 移动、自动散步门槛、取消/恢复行为、拖动阈值、即时保存、全屏检测、动作定时器、CSS 动画截图、朝向与装扮联动测试。
