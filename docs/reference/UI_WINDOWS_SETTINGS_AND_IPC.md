# 界面、窗口、设置与 IPC

| 控制项 | 内容 |
| --- | --- |
| 文档级别 | `LIVING` |
| 修改权限 | 窗口、设置、菜单、IPC 或公开 API 变化时同步更新 |
| 适用版本 | 1.1.0 |
| 最后核对 | 2026-08-15 |
| 权威源码 | `src/main/main.ts`、`src/preload/preload.ts`、`src/shared/types.ts`、`src/renderer/App.tsx` |
| 更新触发 | 增删窗口、设置键、IPC 通道、公开方法、事件、验证或系统副作用 |

具体数值统一登记在[变量登记表](CONFIGURATION_REGISTRY.md)；受保护的 IPC 与权限原则见[架构安全准则](../governance/ARCHITECTURE_SECURITY.md)。

## 当前已实现

### 窗口与菜单

- 桌宠窗口是透明、无边框、固定大小、默认置顶且不显示在任务栏的窗口；位置会限制在最近显示器工作区内。
- 管理面板是固定大小的独立窗口，包含状态、互动、装扮和设置四页；关闭操作只隐藏窗口。
- 托盘提供唤回、打开面板、自动散步、始终置顶和退出。
- Windows 应用菜单包含文件、宠物、查看和帮助。
- 应用使用单实例锁；第二次启动会显示桌宠并打开面板。

### 设置

| 设置 | 类型 | 默认值 | 主进程副作用 |
| --- | --- | --- | --- |
| `autoWalk` | `boolean` | `true` | 关闭时取消当前移动；开启后允许周期散步 |
| `alwaysOnTop` | `boolean` | `true` | 调用桌宠窗口 `setAlwaysOnTop` |
| `launchAtLogin` | `boolean` | `false` | 调用 `app.setLoginItemSettings` |
| `animationIntensity` | `gentle \| normal \| lively` | `normal` | 影响移动速度、步频、摆幅和弹跳 |
| `petPosition` | `{x,y} \| null` | `null` | 决定桌宠恢复位置；不是 `setSetting` 可直接修改的键 |
| `petName` | 伪设置键 | `小橙子` | 实际写入 `pet.name`；去除首尾空白后须为 1–12 个字符 |

### `OrangePetApi`

| 公开方法 | IPC 通道 | 当前作用 |
| --- | --- | --- |
| `loadState()` | `state:load` | 读取当前 `SaveData` 快照 |
| `performAction(action)` | `pet:action` | 执行喂食、玩耍、清洁或睡眠切换 |
| `setSetting(key, value)` | `settings:set` | 更新允许的设置或宠物名称 |
| `togglePanel()` | `panel:toggle` | 显示或隐藏管理面板 |
| `showContextMenu()` | `pet:context-menu` | 打开桌宠右键菜单 |
| `setPetPosition(position)` | `pet:set-position` | 校验、限制并更新桌宠位置 |
| `buyItem(itemId)` | `shop:buy` | 购买目录中的装扮并返回业务结果 |
| `equipItem(itemId \| null)` | `shop:equip` | 装备已拥有装扮或卸下 |
| `quitApp()` | `app:quit` | 标记正常退出并关闭应用 |
| `onStateChanged(callback)` | `state:changed` | 订阅持久状态广播，返回取消订阅函数 |
| `onMotionChanged(callback)` | `motion:changed` | 订阅临时步态方向与移动状态，返回取消订阅函数 |

`showContextMenu` 是当前公开 API 的一部分，旧版总技术文档曾遗漏，后续接口清单不得再次省略。

### 主进程输入校验

- 动作仅允许 `feed`、`play`、`clean`、`sleep`。
- 动画强度仅允许 `gentle`、`normal`、`lively`。
- 布尔设置拒绝字符串；宠物名称拒绝空白和超过 12 字符的值。
- 坐标必须是有限数值，随后还会按显示器工作区限制。
- 商品 ID 长度不得超过 40；购买必须能在目录中找到。
- 装备值必须为 `null` 或已拥有且仍存在于目录中的 ID。

## 待批准规划

以下均未实现：

- IPC 响应的运行时 schema 校验或统一错误对象。
- 可调整大小、主题、快捷键配置或窗口布局持久化。
- 面向离线更新包的应用内导入界面。
- 自动更新、联网检查或下载；这些还违反当前受保护产品准则，除非用户先明确授权修改准则。

## 失败与边界情况

- `OrangePetApi.setPetPosition` 的类型声明为 `Promise<void>`，当前主进程处理器实际返回限制后的坐标；渲染层未使用该返回值。这是接口实现差距，不应在新代码中继续依赖未声明返回值。
- 设置页面捕获并展示设置错误；其他多数 IPC 调用没有统一错误展示。
- 拖动过程中只更新内存位置，指针松开没有专门的立即保存 IPC；通常依赖周期保存或正常退出落盘。
- 面板获得焦点会取消移动；面板仅可见但未聚焦时，散步条件只检查 `isFocused()`。
- `launchAtLogin` 依赖 Windows/Electron 环境，当前没有集成测试验证系统实际注册结果。

## 相关测试

- `src/renderer/ui-regressions.test.ts`：透明背景、角色图层与中文应用菜单静态检查。
- `src/main/release-config.test.ts`：发布身份与更新配置。
- 当前没有逐通道 IPC、菜单操作、设置副作用或窗口生命周期集成测试。

