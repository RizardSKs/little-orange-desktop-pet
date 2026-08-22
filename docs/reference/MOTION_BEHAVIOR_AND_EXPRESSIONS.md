# 移动、行为、动画与表情规格

> 文档级别：LIVING（随实现持续维护）  
> 修改权限：子代理仅可在行为类型、移动调度、动画、表达式解析、交互手势、视觉素材或测试已经变更并核对后更新；新增动作方向或角色性格规则必须先取得用户批准。  
> 适用版本：1.2.3  
> 最后核对：2026-08-23  
> 权威源码：`src/shared/types.ts`、`src/shared/interaction.ts`、`src/shared/expression.ts`、`src/main/interaction-controller.ts`、`src/main/motion.ts`、`src/main/main.ts`、`src/renderer/pet-view.tsx`、`src/renderer/styles.css`  
> 更新触发：`PetBehavior`、`PetInteractionKind`、互动优先级、触发阈值、自动散步条件、速度/缓动、动画强度、拖动/点击手势、四阶段变体、表情文案或相关测试变化时。

精确参数统一登记在 [CONFIGURATION_REGISTRY.md](CONFIGURATION_REGISTRY.md)；实现常量和纯判定规则位于 `src/shared/interaction.ts`，不应在其他文档复制第二份数值权威。

## 当前已实现

### 持久行为与临时互动是两层状态

`PetBehavior` 是进入 `SaveData` 的领域行为：

- `idle`：默认待机，也是自动散步的前置状态。
- `walking`：主进程连续移动期间的临时领域行为。
- `eating`、`playing`、`cleaning`：照料成功后的短时行为。
- `sleeping`：用户显式切换的持续行为。
- `sad`：类型与表情映射存在，当前没有规则主动写入。

`PetRuntimeState` 由主进程的 `InteractionController` 所有，不持久化，包含：

- `motion`：窗口是否正在自动移动及朝向。
- `interaction`：当前互动种类、序列号、开始时间、持续时间和朝向。
- `gaze`：归一化的鼠标注视偏移。
- `keyboardStatus`：键盘节奏组件的 `disabled | starting | ready | unavailable` 状态。

`PetInteractionKind` 已包含 `idle`、`nearby`、`petting`、`dodge`、`dragging`、`landing`、`keyboard-typing`、`keyboard-rest`、`cursor-paw`、`cursor-tug`、`cursor-chase`和 `cursor-dizzy`。每次状态变更都增加 `sequenceId`，便于渲染层重启同类动画。

### 互动优先级与中断

当前顺序从高到低为：用户拖动、落地、多次点击闪躲、单击抚摸、键盘陪打、鼠标扩展互动、附近陪伴、待机。新状态只能中断更低优先级状态；拖动、落地和显式照料使用主进程的强制收束路径。

喂食、玩耍、清洁或睡眠开始时，主进程清除待结算点击和低优先级环境互动。睡眠、照料动画或前台全屏应用存在时，注视、鼠标环境互动和键盘陪打均回到待机，不会在条件解除后继续一段过期动画。

### 自动散步

自动散步只在以下条件同时满足时启动：

- 桌宠窗口存在，`autoWalk` 已开启，`behavior` 严格等于 `idle`。
- 未进入桌面锁定，Windows 会话未锁屏，系统未挂起。
- 未检测到前台全屏窗口，管理面板没有焦点。

目标 X 在当前位置左右的强度对应范围内随机生成，Y 对齐所在显示器工作区底部，最后经 `clampPosition` 限制。主进程使用 `MotionPlan` 管理方向、时长和 sine 缓动；`motionToken` 使被取消的旧 tick 失效。

开始移动会保存需恢复的旧行为、设置 `walking` 并广播临时步态；完成后写入 `petPosition`、恢复旧行为并保存。面板获得焦点、照料、拖动、关闭自动散步、桌面锁定或进入前台全屏都会取消当前移动。

### 鼠标注视与环境互动

主进程通过 Electron `screen.getCursorScreenPoint()` 定期采样全局光标。仅当鼠标互动开启、桌宠可见、非睡眠/照料/前台全屏且系统会话可用时才读取光标；关闭开关后不会继续采样。

- 注视：`gazeForCursor` 把光标相对桌宠中心的位置归一化；超出跟踪范围时回中。
- 附近陪伴：光标在桌宠附近低速停留后进入 `nearby`。
- 挑逗与扒拉：在规定环形范围内足够长距离地往返挑逗后进入 `cursor-paw`。
- 被拖走：扒拉后的短时窗内，光标先靠近再快速拉开，可进入 `cursor-tug`。窗口按限速弹簧步进跟随光标，结束时立即保存位置。
- 环绕与眩晕：光标绕行达到规则阈值后进入 `cursor-chase`，继续多圈则在追逐结束后接 `cursor-dizzy`。

自发互动有最小间隔、每分钟上限和分类冷却，防止持续特效干扰。桌面锁定时仍可更新注视和纯视觉的被动反应，但 `cursor-tug`、自动散步和用户拖动都不能改变窗口位置。

### 点击、拖动与右键

`PetView` 的左键手势使用欧氏距离阈值区分点击和拖动：

1. `pointerdown` 记录指针、屏幕起点和窗口起点，并捕获该指针。
2. 越过 `DRAG_THRESHOLD_DIP` 后只请求一次 `pet:drag-start`。
3. 只有主进程确认未锁定并进入 `dragging` 后，渲染层才能继续发送 `pet:set-position`。
4. 释放或取消已开始的拖动时发送 `pet:drag-end`，主进程保存位置并进入 `landing`。

拖动视觉由渲染层根据相邻指针样本计算限幅速度和方向，不扩展 IPC 或存档。`dragging` 时使用 `excited` 图片表情，身体朝移动方向倾斜并轻微拉伸，双臂展开、双腿后摆；动画强度控制幅度。释放后使用 `happy` 表情和三段软弹落地。减少动态效果模式保留静态飞行姿态，但取消持续摆动。

未进入拖动的点击由主进程在 `TAP_SETTLE_MS` 窗口后统一结算：单击是 `petting`，双击打开管理面板，三击及以上是 `dodge`。桌面锁定时桌宠主体点击穿透，上述手势不可达。

右键仅由桌宠窗口请求 `pet:context-menu`；主进程验证 sender 且桌面未锁定后才显示菜单。

### 键盘陪打的视觉行为

键盘互动默认关闭，只有当用户已明确同意且隔离键盘组件处于 `ready` 时才会参与状态机。`keyboardRhythmIsBusy` 只根据按键次数和时间桶判断节奏，达到忙碌条件后进入 `keyboard-typing`；持续上限到期后进入 `keyboard-rest`，静默足够长时则提前回待机。

渲染层在 `keyboard-typing` 显示小键盘并让双手交替敲击。幼芽阶段较慢、活力阶段较快；其他阶段使用各自性格节奏。键盘内容隔离和隐私边界详见 [ARCHITECTURE_AND_DATA_FLOW.md](ARCHITECTURE_AND_DATA_FLOW.md)。

### 四阶段差异

`INTERACTION_STAGE_PROFILES` 为四个阶段定义独立的振幅、时长系数和性格：幼芽偏害羞且收敛，活力阶段快而弹跳，成熟阶段稳定，闪耀阶段更利落并附带星光。

- 主进程按阶段系数调整交互持续时间。
- CSS 通过 `--interaction-amplitude`、`--personality-duration`、阶段体型和粒子差异放大阶段辨识度。
- 各阶段使用五张同坐标系身体/四肢分层、14 张图片表情，并保留带中性表情的整图 fallback。`pet-facing` 包含身体、四肢和 PNG 五官，向左时整体镜像。

### 表情决策

`PetExpression` 当前包含 14 种：`neutral`、`happy`、`curious`、`surprised`、`proud`、`focused`、`delighted`、`excited`、`refreshed`、`asleep`、`sad`、`sleepy`、`hungry`和 `uncomfortable`。

解析顺序仍是：持久行为专属表情 > 当前属性上限下的最低需求 > 健康待机加权表情。临时互动通过 `interaction-*` CSS 类控制身体动画，不会写回 `PetBehavior`或覆盖领域需求表情。

解析结果直接选择 `assets/pet/<stage>/expressions/<expression>.png`。图片表情不改变领域优先级；任一分层或表情文件加载失败时统一降级到该阶段中性整图。

升级、阶段进化与闪耀星级反馈由 `growth:progress` 事件驱动。该事件只有 `online` 和 `care` 两种来源；渲染层根据跨越的最高里程碑显示桌宠与面板庆祝动画。

## 待批准规划

以下仍未实现：

- 音效、语音、震动或动画完成事件。
- 障碍物避让、跨显示器巡游、边缘栖息和垂直路径规划。
- 按亲密度、时段或具体装扮改变互动规则。
- 统一的“减少动态效果”运行时开关；当前只有 CSS `prefers-reduced-motion` 降级。
- 为装扮建立跟随朝向、阶段和动作的完整锚点系统。

新增互动时仍必须同时定义触发条件、优先级、中断规则、持续时间、冷却、结束状态、保存语义、IPC 来源和测试。

## 失败与边界

- Windows 前台全屏检测依赖隐藏 PowerShell 进程和前台窗口矩形；执行失败时按“非全屏”处理。
- 鼠标识别是定时采样和启发式规则，不保证每次人类手势都被命中；频率上限可避免误判持续触发。
- 光标拖拽和用户指针拖拽都会改变窗口位置，但两者由主进程不同状态管理，不会同时获得移动权。
- `PetRuntimeState` 不持久化；应用重启后从待机、居中注视和未启动键盘组件重建。
- 键盘原生组件不可用时只停用键盘陪打，其他行为、存档和鼠标互动仍可继续。
- 开心飞行参数来自渲染层最近一次指针样本；极短或缺失样本会回到安全限幅姿态，不参与经济、领域状态或存档。
- 健康待机表情的随机值只存在渲染层，不可复现且不保存。

## 相关测试

- `src/shared/interaction.test.ts`：注视归一化、优先级、挑逗、环绕、附近停留、键盘聚合节奏和四阶段轮廓。
- `src/main/interaction-controller.test.ts`：单/双/多击、拖动锁定门、落地保存、键盘故障降级、锁定注视和全屏收束。
- `src/main/interaction-integration.test.ts`：点击穿透、置顶恢复、IPC sender 校验、键盘工作进程聚合载荷与解锁 preload 边界。
- `src/main/motion.test.ts`：移动方向、强度速度差异、时长边界和缓动精确落点。
- `src/shared/expression.test.ts`：行为表情优先级、需求阈值和待机权重。
- `src/renderer/ui-regressions.test.ts`：分层结构、14 种图片表情、交互 CSS 类、四阶段视觉契约和透明窗口回归。
- `src/renderer/drag-visual.test.ts`：拖动方向、速度限幅、动画强度和静止姿态。

当前仍缺少真实 BrowserWindow 下的多显示器拖动、鼠标手势时序、视觉截图以及原生键盘钩子端到端测试。
