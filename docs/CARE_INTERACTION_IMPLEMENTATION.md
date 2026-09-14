# 四项基础互动实施与验证

> 文档级别：`LIVING`
> 修改权限：随本次功能、素材和验证更新。
> 适用版本：1.2.7 后续开发；尚未正式发布。
> 最后核对日期：2026-09-14。
> 权威来源：用户“开始执行功能开发”“继续执行”；`src/main/care-controller.ts`、`interaction-controller.ts`、`main.ts`；`src/shared/care.ts`、`game.ts`、`types.ts`；`src/renderer/rig/care-actions.ts`、`live-pet.tsx`；对应测试和本地验证输出。
> 更新触发：命令、分镜、素材、接口、实测结果或交付状态变化。

## 当前交付范围

四项基础照顾已经接入正式主进程、preload、面板和角色渲染。喂食、玩耍、清洁为有限动作；睡觉包含入睡、持续睡眠和叫醒。每种短片有三个变体，控制器分别轮换，四阶段共用可靠接触基础并提供不同姿态或反应。未重制旧十三项用品，未更改金币、属性恢复、经验公式、存档 schema 或应用身份。

| 操作 | 已实现表现 |
| --- | --- |
| 喂食 | 注意与闻香、左手端碗、右手拿面包靠嘴、两次进食节拍、咀嚼、擦嘴和满足反应；变化包含吹凉时的专注和最后点头 |
| 玩耍 | 蓄力、抛接毛球、随球转动重心、接回抱稳和短暂庆祝；变化包含反向接球、接偏后重新抱稳 |
| 清洁 | 手持毛巾擦脸与身体、眯眼配合、轻抖与检查；变化包含先后部位调整、停下检查毛巾后继续 |
| 入睡 | 困倦、揉眼、抱枕靠身、坐低侧靠和闭眼；变化包含换侧揉眼、调整抱枕 |
| 持续睡眠 | 低幅呼吸、稀疏抱枕调整；继承入睡变体，抚摸或拖动后恢复，不反复播放入睡 |
| 叫醒 | 睁眼、放下抱枕、伸展和恢复清醒；变化包含揉眼、先伸展一侧 |

时长、优先级、缓存上限与节拍周期统一见 [配置登记表](reference/CONFIGURATION_REGISTRY.md)。变体不改变领域收益；减少动态效果取消弹跳、摇摆、飞散，保留用途姿态与表情。素材异常时身体动作降级不重试消费；角色关键层失败仍沿既有整图 fallback。

## 命令与生命周期

`CareController` 同步完成有效性判断、候选领域状态、保存及内存提交，之后才启动运行时表现。保存失败不修改当前成功状态；提交后显示失败保留已完成照顾，并在消息中说明。动画回调、图片解码、窗口重绘均不能调用领域结算。

面板每次明确操作生成请求 ID；主进程按来源隔离最近请求结果。缓存命中不重播、不再次结算，返回最新状态；超过有界缓存或跨进程重启不承诺历史命令去重。当前没有自动网络重试或消费队列。

同一短动作有效期间重复操作返回 busy；不同有效动作可替换并各自结算。`feed → play → feed` 是三次明确有效操作，旧 feed 不继续占位。拖动期间拒绝消费；失败照顾不清除旧表演。菜单捕获 asleep/awake 目标，避免过期切换反转；面板、桌宠右键菜单、应用菜单、托盘均进入统一处理。

睡眠状态以存档领域行为为准。入睡表演取消、拖动和抚摸不唤醒；显式叫醒或成功照顾才离开睡眠。结束与中断清理临时照顾行为，旧截止时间不能结束新序列；应用启动清理非睡眠临时行为，不重播。系统挂起清理短片，恢复不补播，原有离线收益语义保持。成长与装扮在安全区间整体提交；入睡到循环不叠加旧抱枕退出快照。

## 验证证据

| 层次 | 实际结果与边界 |
| --- | --- |
| Vitest | 全量 24 个文件、137 项通过，包含新增事务及分镜测试和四项控制器生命周期测试 |
| 类型与构建 | `npx.cmd tsc --noEmit`、`npm.cmd run build` 通过；生产构建包含新动作 |
| 真实素材 | 147 张本地 PNG 测量；新增碗、面包、毛巾、抱枕的接触像素通过；初始碗边透明握点已修正 |
| alpha 边界 | 基础动作 430,560 帧扫描无越界，涵盖四阶段、双朝向、强度、减少动态、三变体及既有永久／旅行附件 |
| 正式组件 | 隔离 Electron 96 张四阶段关键帧通过；六类 LivePet 加载通过；喂食中成长等待安全边界后整套提交 |
| 离线预览 | 六类动作的早／中段画面可区分，文件模式运行且无存档 API；使用生产求帧函数，不是安装包录屏 |
| 真实应用链路 | 已构建主进程＋preload＋生产界面在独立临时存档运行，15 项检查通过：消费、重试、busy、照顾替换、用品切换、持续睡眠、拖动后恢复、应用菜单叫醒、短片结束和模拟挂起恢复 |
| 短时观测 | 真实测试桌宠采样 180 个睡眠帧间隔，中位约 5.6 ms、P95 约 5.7 ms；这是本机高刷新率短时观测。进程工作集保存于 JSON，不构成长期稳定性或性能提升结论；首个 CPU 快照为零不用于 CPU 基准结论 |

证据目录：`tmp/rig-evidence/care/`、`tmp/rig-evidence/care-app/`、`tmp/rig-evidence/bounds.json`、`asset-measurements.json`、`contact-pixels.json`。这些输出由脚本重建，不进入源码提交或发行包。

真实应用测试曾在主动隐藏桌宠后无法继续绘帧；已区分为测试窗口可见性问题，并改用真实显示的独立桌宠完成检查，测试后退出。未修改用户正式存档。软件渲染未解决沙箱子进程失败；随后获得本机隔离验证执行权限，才取得上述实际结果。

**尚未验证**：真实 Windows 各档系统 DPI／跨屏、人工托盘与右键操作、真实硬件挂起／锁屏／全屏、长时间运行与原版同条件性能对照，以及正式 Setup／Update 安装升级。模拟 powerMonitor 事件不等于真实系统睡眠。当前仅开发构建和功能验证，不宣称正式发布、安装兼容验收或用户美术验收完成。

## 复现与观看

首先运行自动检查及构建：

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run build
node_modules/.bin/electron.cmd scripts/measure_rig_assets.cjs
node scripts/verify_rig_bounds.cjs --care-only
node scripts/export_care_preview.mjs
```

打开 `tmp/rig-evidence/care/小橙子四项互动预览.html`，可切换动作、四阶段、三变体、朝向、装扮和减少动态，并拖动时间轴。此文件包含本地图片与实际分镜逻辑，可单独复制查看，不联网。

正式 React 验证需要保持第一条命令的本地服务运行，在另一个终端执行第二条：

```powershell
npm.cmd exec vite -- --host 127.0.0.1
node_modules/.bin/electron.cmd scripts/verify_care_animations.cjs
```

独立存档真实应用检查会临时显示一个测试桌宠，完成后退出，不使用真实存档：

```powershell
node_modules/.bin/electron.cmd scripts/verify_care_app.cjs
```

## 本地素材来源与提示词

四张新增素材均使用内置 imagegen；未调用外部付费 API、未增加运行时网络请求。生成 PNG 原样复制并保留透明 alpha，逻辑画布统一由渲染矩阵映射；没有通过 Python 重画或修改生成素材。

| 文件 | 提示词与参考 |
| --- | --- |
| `assets/props/rig/care/pillow.png` | 单个奶油白／杏色柔软抱枕，圆角、缝边、小橙叶刺绣、哑光 3D 卡通、轻微俯视、对称轮廓、透明 RGBA，无角色／手／文字／地面阴影，适合作为双手握持道具 |
| `assets/props/rig/care/washcloth.png` | “A small soft folded turquoise washcloth for a cute orange desktop pet. Square-ish plump folded cloth, rounded edges, visible terry fabric texture, front view slight top visible. One washcloth only.” 加统一生产约束：哑光 3D 卡通、柔和暖光、透明 RGBA、居中留边，无手／角色／文字／地面阴影 |
| `assets/props/rig/care/bowl.png` | “A small cream ceramic snack bowl containing three soft golden bread bites, cute orange leaf emblem on bowl front. Bowl viewed front with slight top visible, no spoon, no separate objects. One bowl only.” 加上述统一生产约束 |
| `assets/props/rig/care/bread.png` | 参考已生成碗图，提取一致风格的单个金黄色柔软小面包；无碗／其他物体／手，正面、圆角方形、居中、透明 RGBA；顶部中央作为嘴部接触点 |

新图没有替换任何已发布角色或物品素材。完整生成结果与摘要可由本地测量脚本核验；生成历史不是外部图库许可声明。

## 变更文件地图

- 领域与接口：`src/shared/care.ts`、`game.ts`、`types.ts`、`interaction.ts`；`src/preload/preload.ts`。
- 主进程：`src/main/care-controller.ts`、`care-controller.test.ts`、`interaction-controller.ts`、`interaction-controller.test.ts`、`main.ts`。
- 界面与动画：`src/renderer/panel-view.tsx`；`rig/actions.ts`、`care-actions.ts`、`care-actions.test.ts`、`live-pet.tsx`、`interruptions.ts`、`rig-preview.tsx`。
- 素材：上述四张 `assets/props/rig/care/*.png`。
- 验证与预览：`scripts/measure_rig_assets.cjs`、`verify_rig_bounds.cjs`、`verify_care_animations.cjs`、`verify_care_app.cjs`、`care_preview_entry.ts`、`export_care_preview.mjs`。
- 文档：本文件、开发计划、文档地图、当前状态、照顾／行为／IPC／素材／角色／配置／测试参考及 `CHANGELOG.md`。
