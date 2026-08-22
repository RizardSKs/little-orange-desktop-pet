# 界面、窗口、设置与 IPC

| 控制项 | 内容 |
| --- | --- |
| 文档级别 | `LIVING` |
| 修改权限 | 窗口、设置、菜单、IPC 或公开 API 变化时同步更新 |
| 适用版本 | 1.2.3 |
| 最后核对 | 2026-08-23 |
| 权威源码 | `src/main/main.ts`、`src/preload/preload.ts`、`src/preload/unlock.ts`、`src/shared/types.ts`、`src/shared/economy-types.ts`、`src/renderer/App.tsx`、`src/renderer/pet-view.tsx`、`src/renderer/panel-view.tsx` |
| 更新触发 | 增删窗口、设置键、IPC 通道、公开方法、事件、sender 验证、参数验证或系统副作用 |

具体数值统一登记在[CONFIGURATION_REGISTRY.md](CONFIGURATION_REGISTRY.md)；受保护的 IPC 与权限原则见[架构安全准则](../governance/ARCHITECTURE_SECURITY.md)。

## 当前已实现

### 窗口、菜单与单实例

| 窗口 | 当前实现 |
| --- | --- |
| 桌宠窗口 | 透明、无边框、固定大小、不显示任务栏；默认置顶，位置限制在最近显示器工作区。关闭只隐藏，非退出。 |
| 管理面板 | 固定大小的普通窗口，包含状态、互动、生活与设置页；生活页包含装扮、用品、服务、探索和背包。关闭只隐藏。 |
| 解锁窗口 | 只在桌面锁定时使用的透明、无边框、不获取焦点、置顶小窗口。它位于桌宠右上角且限制在工作区，使用独立 preload，只能请求解锁。 |

托盘在未锁定时提供唤回、打开面板、自动散步、始终置顶、桌面锁定和退出；锁定时会禁用会改变桌宠状态或位置的菜单项，单击托盘显示桌宠与解锁按钮。Windows 应用菜单包含文件、宠物、查看和帮助，宠物菜单也可锁定/解锁。

应用使用单实例锁。第二次启动时，未锁定则显示桌宠并打开面板；已锁定则显示桌宠与解锁按钮，不打开面板。

### 桌面锁定

`desktopLocked` 是 schema 2 中的持久设置。进入锁定时主进程按以下顺序处理：

1. 先创建或取得独立解锁窗口；同步创建失败则不进入锁定。
2. 取消自动移动、用户拖动和会改变窗口位置的光标拖拽，保存当前位置。
3. 隐藏管理面板，强制桌宠置顶，禁用桌宠焦点并调用 `setIgnoreMouseEvents(true)` 使主体完全点击穿透。
4. 定位并显示解锁按钮，然后保存并广播新状态。

桌面锁定不等于 Windows 会话锁屏。桌面锁定期间桌宠位置固定，但鼠标注视、纯视觉的环境反应和已授权的键盘陪打可继续。Windows 锁屏则会停止鼠标采样和键盘工作进程，解锁后再恢复。

用户可通过独立解锁按钮、托盘菜单或应用菜单解锁。解锁会恢复鼠标事件和焦点能力，并按用户原有的 `alwaysOnTop` 设置恢复置顶级别。应用重启时会恢复持久锁定；如果无法安全建立解锁窗口，启动路径会取消锁定并恢复主体输入。

### 设置

| 设置 | 类型 | 默认值 | 主进程副作用 |
| --- | --- | --- | --- |
| `autoWalk` | `boolean` | `true` | 关闭时取消当前移动；开启后允许周期散步 |
| `alwaysOnTop` | `boolean` | `true` | 未锁定时调用桌宠窗口 `setAlwaysOnTop`；桌面锁定会临时强制置顶 |
| `launchAtLogin` | `boolean` | `false` | 调用 `app.setLoginItemSettings` |
| `animationIntensity` | `gentle | normal | lively` | `normal` | 影响移动速度、自动步长和步态 |
| `petPosition` | `{x,y} | null` | `null` | 决定桌宠恢复位置；不是 `setSetting` 可直接写入的键 |
| `desktopLocked` | `boolean` | `false` | 开启主体穿透、强制置顶、位置固定和独立解锁窗口 |
| `mouseInteractionsEnabled` | `boolean` | `true` | 决定是否采样全局光标并运行注视/环境互动 |
| `keyboardInteractionEnabled` | `boolean` | `false` | 在同意版本有效且系统可用时启动隔离键盘工作进程 |
| `keyboardConsentVersion` | 整数 | `0` | 记录用户已确认的键盘节奏隐私说明版本；不通过通用 `setSetting` 修改 |
| `petName` | 伪设置键 | `小橙子` | 实际写入 `pet.name`；去除首尾空白后须为 1–12 个字符 |

从 schema 1 迁移时，新增锁定/鼠标/键盘设置分别使用上表默认值，不会在转换时自动启用全局键盘监听。

### `OrangePetApi` 与事件

| 公开方法 | IPC 通道 | 当前作用 |
| --- | --- | --- |
| `loadBootstrap()` | `state:bootstrap` | 原子读取启动状态、临时互动、离线摘要和启动成长事件 |
| `loadState()` | `state:load` | 读取当前 `SaveData` 快照 |
| `loadRuntimeState()` | `interaction:runtime-load` | 读取当前不持久的 `PetRuntimeState` |
| `performAction(action)` | `pet:action` | 执行喂食、玩耍、清洁或睡眠切换，返回 `{state,message}` |
| `purchaseInventoryItem(id, quantity)` | `economy:item-purchase` | 购买用品或服务券，返回带 `ok/code/message/state` 的业务结果 |
| `useInventoryItem(id)` | `economy:item-use` | 原子预检属性、消耗背包数量并入队限时效果 |
| `startExpedition(id)` | `expedition:start` | 扣除金币并开始按实际运行时间推进的探索 |
| `returnExpeditionEarly()` | `expedition:return` | 提前结束当前探索，不发放返程奖励 |
| `acknowledgeExpeditionReward()` | `expedition:ack` | 确认旅行故事并清除待确认返程状态 |
| `setSetting(key, value)` | `settings:set` | 更新通用白名单设置或宠物名称 |
| `setDesktopLocked(locked)` | `desktop-lock:set` | 由未锁定的管理面板发起桌面锁定；锁定后的解锁使用独立通道 |
| `setMouseInteractions(enabled)` | `mouse-interaction:set` | 开关全局光标注视与环境互动 |
| `setKeyboardInteraction(enabled, consentVersion?)` | `keyboard-interaction:set` | 开关键盘节奏互动；首次开启必须附当前同意版本 |
| `recordPetTap()` | `pet:tap` | 交由主进程在点击窗口内结算单/双/多击 |
| `beginPetDrag()` | `pet:drag-start` | 请求主进程进入拖动，返回是否接受 |
| `setPetPosition(position)` | `pet:set-position` | 仅在主进程已确认 `dragging` 时限制并更新位置 |
| `endPetDrag()` | `pet:drag-end` | 结束拖动、保存位置并进入落地动画 |
| `togglePanel()` | `panel:toggle` | 在桌宠/面板窗口之间显示或隐藏管理面板；锁定时只会保持隐藏 |
| `showContextMenu()` | `pet:context-menu` | 由桌宠窗口请求右键菜单 |
| `buyItem(id)` | `shop:buy` | 购买旧装扮目录中的可穿戴项 |
| `equipItem(id | null)` | `shop:equip` | 装备已拥有装扮或卸下 |
| `quitApp()` | `app:quit` | 进入幂等退出入口；停止调度器/监听器/原生 worker、结算保存一次，再关闭窗口和应用 |

`onStateChanged`、`onMotionChanged`、`onRuntimeChanged` 和 `onGrowthProgress` 分别订阅 `state:changed`、`motion:changed`、`interaction:runtime-changed` 和 `growth:progress`；每个方法都返回取消订阅函数。`GrowthProgressEvent.source` 仅为 `online | care`，分别表示在线周期奖励或有效照料导致的升级。

`window.orangePetUnlock` 只在解锁 preload 中暴露一个 `unlock()` 方法，对应 `desktop-lock:unlock`。它不能读取存档、修改设置、购买项目或退出应用。

### IPC 来源白名单

| 来源 | 允许的有状态副作用通道 |
| --- | --- |
| 管理面板 | `pet:action`、`settings:set`、`desktop-lock:set`、`mouse-interaction:set`、`keyboard-interaction:set`、全部用品/探索通道、`shop:buy`、`shop:equip`；这些请求还会在 `desktopLocked=true` 时被拒绝 |
| 桌宠窗口 | `pet:context-menu`、`pet:tap`、`pet:drag-start`、`pet:set-position`、`pet:drag-end` |
| 桌宠或面板 | `panel:toggle` |
| 独立解锁窗口 | `desktop-lock:unlock` |

`state:bootstrap`、`state:load`、`interaction:runtime-load` 和 `app:quit` 当前没有在 handler 内再校验 sender，但只由普通 preload 暴露；独立解锁 preload 不暴露这些能力。如新增窗口复用普通 preload，必须重新评估这些读通道和退出通道的 sender 边界。

### 参数验证

- 照料动作仅允许 `feed`、`play`、`clean`、`sleep`。
- 通用设置仅允许 `autoWalk`、`alwaysOnTop`、`launchAtLogin`、`animationIntensity`和伪键 `petName`；布尔/字符串类型、动画强度与名称长度分别校验。
- 桌面锁定、鼠标和键盘开关必须是布尔值；首次启用键盘还必须提交当前同意版本。
- 拖动坐标必须是有限数，且只能在主进程状态为 `dragging` 时修改；最终位置按显示器工作区限制。
- 用品和探索 ID 使用稳定 ID 集合守卫；购买数量必须是受限正整数。使用物品先计算属性结果，只有属性预检和库存/效果领域函数均成功才原子提交；服务类在属性已满时仍可消耗并提供仪式/视觉效果。
- 旧装扮购买必须在目录中找到；装备值必须为 `null` 或已拥有且仍在目录中的 ID。

## 待批准规划

以下仍未实现：

- IPC 响应的通用运行时 schema 校验和统一错误对象。
- 可调整大小、主题、快捷键配置或窗口布局持久化。
- 面向离线更新包的应用内导入界面。
- 自动更新、联网检查或下载；这些仍超出当前产品边界。

## 失败与边界

- `OrangePetApi.setPetPosition` 声明为 `Promise<void>`，主进程当前实际返回限制后的坐标；渲染层不使用返回值，新代码也不应依赖这个未声明差异。
- 解锁 HTML 通过本地 data URL 异步加载。同步窗口创建失败会阻止锁定；异步页面加载失败当前没有专用 UI 错误提示，但托盘/应用菜单解锁路径仍存在。
- 键盘原生组件启动超时、报错或退出时，`keyboardStatus` 变为 `unavailable`，不会中断桌宠、存档或其他互动。
- 所有退出入口共用 `requestQuit()`；`before-quit` 在窗口销毁前停止周期、递归和短时定时器，已关闭窗口的引用由 `closed` 事件清空。
- `launchAtLogin`、真实 BrowserWindow 点击穿透、多显示器解锁定位与打包后原生键盘组件仍依赖 Windows/Electron 实装冒烟测试。

## 相关测试

- `src/main/interaction-integration.test.ts`：锁定穿透与置顶恢复、手势/解锁 sender 校验、键盘聚合载荷、最小解锁 preload、挂起处理、退出清理顺序与经济 IPC 暴露。
- `src/main/runtime-scheduler.test.ts`：统一调度器的幂等停止、周期/递归定时器停机和显式取消。
- `src/renderer/ui-regressions.test.ts`：透明背景、桌宠分层、交互类和主界面静态契约。
- `src/main/release-config.test.ts`：发布身份、原生模块解包与更新配置。

当前没有逐通道 Electron 端到端、菜单操作、设置系统副作用或窗口生命周期自动化测试。
