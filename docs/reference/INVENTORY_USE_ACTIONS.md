# 用品与服务专属动作规格

> 文档级别：`LIVING`（随实现持续维护）  
> 修改权限：用品或服务目录、使用动作、道具素材、运行时优先级或验收规则变化时同步更新；长期专属动作底线以 `PRODUCT_GUARDRAILS.md` 为准。  
> 适用版本：1.2.6 预览及后续版本。  
> 最后核对：2026-08-23。  
> 权威来源：`docs/governance/PRODUCT_GUARDRAILS.md`、`src/shared/catalog.ts`、`src/shared/types.ts`、`src/main/interaction-controller.ts`、`src/main/main.ts`、`src/renderer/pet-view.tsx`、`src/renderer/styles.css`、`assets/props/inventory/` 与相关测试。  
> 更新触发：新增、删除或调整用品和服务；改变动作阶段、持续时间、表情、道具、优先级、打断方式、减少动态效果或素材路径。

本文件是用品与服务使用动作的详细权威规格。目录中的数值效果与持续效果仍以 `src/shared/catalog.ts` 和[配置与变量总账](CONFIGURATION_REGISTRY.md)为准；本文件负责“成功使用时小橙子实际做什么”。

## 1. 强制设计原则

- 每个 `InventoryItemId` 必须拥有一个 `useVisual`，明确持续时间、表情和本地透明道具素材。
- 成功动作必须由角色参与：表情变化与身体或四肢动作至少同时出现，不能把道具静止放在角色旁边充当动作。
- 道具位于角色朝向坐标系内，随左右镜像；角色身体、双臂和道具的运动节拍必须互相对应。
- 使用瞬间动作与长期效果分离。主题、光环、键盘或鼠标强化可以继续存在，但不能替代使用当下的动作。
- 使用动作只在库存、属性预检和持续效果队列均成功提交后触发。失败不播放、不扣库存，也不改变属性。
- 新增用品或服务必须同时更新本文件、目录配置、正式素材、动作样式和自动化测试，否则不得视为完成。

## 2. 运行时与打断规则

- 主进程在成功使用后启动临时 `inventory-use` 互动，并携带当前 `InventoryItemId`；该状态不写入 schema 2 存档。
- 动作开始时停止自动散步，并优先于待机、鼠标环境互动、键盘陪打、轻拍、躲闪和落地动作。
- 用户拖动保持最高优先级，可以立即安全打断使用动作；结束拖动后进入正常落地动作，不恢复被打断的仪式。
- 同一动作期间再次成功使用另一物品时，立即切换到最新物品的新动作和完整时长。
- 应用退出、窗口销毁或进程结束时动作直接结束，不在下次启动时重播；长期主题、光环和强化效果仍按持久化队列恢复。
- `prefers-reduced-motion` 下保留表情、持物姿态和最终视觉结果，停止循环跳跃、旋转和粒子漂移。

## 3. 用品动作

| 稳定 ID | 名称 | 时长 | 表情 | 动作节拍 | 正式道具 |
| --- | --- | ---: | --- | --- | --- |
| `item-citrus-cookie` | 橘香饼干 | 8 秒 | `delighted` | 双臂下探拿起饼干 → 双手送到嘴边 → 身体轻压模拟咬食与咀嚼 → 放下并满足回弹 | `assets/props/inventory/citrus-cookie.png` |
| `item-honey-soda` | 蜂蜜汽水 | 8 秒 | `refreshed` | 双手抱杯 → 杯子抬高并向嘴边倾斜 → 身体轻仰完成吞咽 → 放杯、擦嘴并精神一振 | `assets/props/inventory/honey-soda.png` |
| `item-ribbon-ball` | 缎带毛球 | 12 秒 | `excited` | 目光和身体先向一侧追踪 → 左右手交替拍打移动毛球 → 短暂跃起扑球 → 把毛球收回怀中 | `assets/props/inventory/ribbon-ball.png` |
| `item-bubble-bath` | 泡泡浴券 | 12 秒 | `refreshed` | 双手交替搓洗脸颊与身体 → 泡泡绕身体上浮 → 身体左右甩水 → 亮晶晶定格 | `assets/props/inventory/bubble-bath.png` |
| `item-mini-keyboard` | 迷你键盘券 | 10 秒 | `focused` | 键盘从下方拉入 → 身体坐稳前倾 → 双臂交替快速敲击 → 停手并得意展示 | `assets/props/mini-keyboard.png` |
| `item-mouse-feather` | 鼠标逗趣羽 | 10 秒 | `excited` | 羽毛从一侧进入 → 身体左右追踪、双臂交替挥爪 → 跳起抓住 → 抱回身前 | `assets/props/inventory/mouse-feather.png` |
| `item-sunset-theme` | 落日桌面主题券 | 8 秒 | `happy` | 暖阳从上方出现 → 一手遮眼仰望 → 双臂舒展并轻转 → 暖阳下沉、角色回正 | `assets/props/inventory/sunset-orb.png` |
| `item-stage-sparkle` | 阶段星辉券 | 8 秒 | `surprised` | 低头看向双手 → 双臂抖落星尘 → 身体旋转并抬臂 → 按当前成长阶段姿态定格 | `assets/props/inventory/stage-sparkles.png` |

## 4. 服务动作

服务使用时长沿用既有仪式时长。长服务按表内节拍循环，但每个循环都必须包含开始、互动和收尾姿态，不能退化为单一上下浮动。

| 稳定 ID | 名称 | 时长 | 表情 | 动作节拍 | 正式道具 |
| --- | --- | ---: | --- | --- | --- |
| `service-cozy-grooming` | 舒适护理券 | 20 秒 | `refreshed` | 坐稳 → 双臂配合刷具左右梳理叶片和身体 → 蓬松抖动 → 对镜检查并满意收尾 | `assets/props/inventory/grooming-kit.png` |
| `service-desktop-picnic` | 桌边野餐券 | 45 秒 | `delighted` | 展开野餐垫 → 身体坐低 → 左右手交替取食 → 小口品尝、满足摇摆并整理餐垫 | `assets/props/inventory/picnic-set.png` |
| `service-sparkle-party` | 闪耀派对券 | 60 秒 | `excited` | 派对礼炮入场 → 左右踏步与交替拍手 → 跳起撒彩纸 → 回到中心继续下一轮舞步 | `assets/props/inventory/party-popper.png` |
| `service-royal-celebration` | 皇家庆典券 | 90 秒 | `proud` | 皇冠号角落位 → 身体正式鞠躬 → 挺身并抬臂 → 皇家挥手两拍、骄傲定格 | `assets/props/inventory/royal-fanfare.png` |
| `service-grand-festival` | 橙光盛典券 | 120 秒 | `proud` | 号角与烟花开场 → 双臂展开巡游 → 连续庆典跳步 → 烟花扩散、张臂完成终场 | `assets/props/inventory/grand-fireworks.png` |

## 5. 持续效果与旧存档

- 迷你键盘、鼠标逗趣羽、主题和光环继续进入 `keyboard`、`mouse`、`theme`、`aura` 队列，并按应用实际运行时间推进。
- 1.2.6 起，用品和服务的使用仪式由临时 `inventory-use` 状态立即播放，不再为新使用行为加入 `celebration` 队列。
- 旧 schema 2 存档中已存在的消费庆典效果 ID 保持有效，仍能继续显示并自然耗尽；不删除、不改名，也不需要提升 schema。
- 探索返程庆典仍使用持久化 `celebration` 队列，因为返程可能在用户未注视桌宠时完成。

## 6. 素材和渲染要求

- 正式道具必须是随安装包提供的本地 RGBA PNG，具有真实透明背景、完整边缘、无文字、无水印和无平台字体依赖。
- 道具保持柔和、圆润的 3D 卡通质感，以橙色、奶油色和暖金色为主，与角色、装扮和现有迷你键盘一致。
- 道具层进入 `pet-facing` 内部，随左右朝向镜像；CSS 同时编排 `pet-rig`、左右手和道具，必要时使用受限粒子层补充反馈。
- 全部动作必须在 220×220 透明桌宠窗口内保持主体和主要道具可见，不得扩展窗口、截断关键物件或阻挡拖动输入。

## 7. 验收要求

- 自动化测试必须证明全部 `INVENTORY_ITEM_IDS` 都有唯一 `useVisual`，并锁定时长、表情和素材路径。
- 控制器测试覆盖成功触发、失败不触发、连续使用切换、环境互动不能覆盖、拖动打断、超时恢复和非法时长拒绝。
- 渲染测试覆盖 13 个专属选择器、身体/四肢参与、减少动态效果和 13 张正式道具素材。
- 素材检查至少验证尺寸、RGBA 类型、透明角像素和可见边界；人工检查四成长阶段、左右朝向和三档动画强度。
- 生产构建必须包含 `assets/props/inventory/`；正式发布前还要在 Windows 安装版中逐项使用并观察动作。
