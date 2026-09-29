# 四项动作样板实施与验收

> 文档级别：`LIVING`  
> 修改权限：随当前样板实现、验证与用户观感反馈同步维护。  
> 适用版本：1.2.7；本文件保留样板开发阶段的过程证据。  
> 最后核对日期：2026-09-14。  
> 权威来源：用户“启动开发”“继续执行”；`src/renderer/rig/`；本次实际执行的测试和本地证据。  
> 更新触发：样板分镜、接触点、时序、资源策略、验证范围或用户验收结果变化。

## 当前交付

已接入汽水、毛球、护理、键盘四项技术样板。基线为开发前提交 `cb1b99e` 的源码；底层角色附件改进已存在于该基线，不能算作本轮新增。沿用现有全部 PNG，没有重画角色或调整经济、库存、存档、稳定 ID、窗口和阶段显示尺寸。

| 样板 | 当前表现 | 素材判断与剩余观感问题 |
| --- | --- | --- |
| 蜂蜜汽水 | 注意道具、双手握杯、吸管贴嘴、轻微间歇饮用、放下并收手 | 现有素材可完成技术接触；当前杯身有明显倾角，是否自然需用户看动态确认 |
| 缎带毛球 | 场景中小范围往返、伸手截停、停顿、再释放 | 可复用；缎带与球体仍是一张 PNG，未做独立软体飘动 |
| 舒适护理 | 单手握刷柄、正面单一区域刷理、停下查看、继续、收回 | 可复用独立刷具；不扩展到背面梳理或镜子组合 |
| 迷你键盘 | 键盘固定、手落键面、左右交替、分段停顿、收手 | 可复用；当前是键面接触与手部动作，不含独立键帽下压图 |

证据状态为“技术样板已实现，用户动态观感待确认”。既有素材暂不需要强制补图；这不等于四项已经获得美术验收，也不应据此把剩余动作统一判为可直接复用。

## 时序与生命周期

- `actions.ts` 只将四项 `inventory-use` 路由到 `sample-actions.ts`；其余库存动作与环境键盘仍沿用原配方。
- `LivePet` 传入已有主进程时长。开场、使用与收尾按已经过去的时间直接求值；错过阶段不补播、不推迟结束。参数唯一登记见 [配置总账](reference/CONFIGURATION_REGISTRY.md)。
- 吸管、杯身、刷柄、毛球截停与键面用实际图内坐标定位；刚性道具不继承身体压缩，位置和角度分别计算。
- 中断继续使用已有快照退场与新序列逻辑，不等待旧动作“成功收尾”。阶段／旅行变化仍在资源就绪且接触释放后整套提交。
- 本次实测发现首次加载可能错过新动作开场的安全区间。已允许初始无接触整图在首次资源就绪时原子提交；已建立的握持姿态不因此放开换装条件。
- 道具未加载时沿用已有不空握降级；本次未新增加载超时机制，不能宣称已覆盖永久不返回的加载请求。

## 查看样板

本地证据目录为 `tmp/rig-evidence/motion-samples/`，不进入 Git 或安装包：

- `小橙子动作样板对比.html`：双击离线打开，四项可切换、暂停、重播和拖动时间轴；开发前后同一时刻并排显示。当前为活泼阶段、朝右、原尺寸，使用生产动作函数采样绘制，非真实安装版录屏。
- `四阶段样板.png`：正式 React 绘制组件的四阶段接触关键帧拼图。
- `renderer-results.json`：逐关键帧及首次加载、成长切换结果。
- `live-performance.json`：短时 LivePet 性能观测及环境说明。
- `evaluation-metrics.json`：纯求帧函数耗时，不能当作渲染 FPS。

项目开发预览可检查全阶段、左右朝向、装扮、旅行装及减少动态效果：

```powershell
npx.cmd vite --host 127.0.0.1
```

打开 `http://127.0.0.1:5173/?view=rig-preview&action=item-honey-soda&time=0`，点击播放。`fixture=live` 是自动运行的真实组件回归入口，减少动态跟随系统偏好；默认预览提供确定性时间轴。

## 实际验证与限制

| 检查 | 本次结果 |
| --- | --- |
| 全量测试 | 22 个测试文件、123 项通过 |
| 类型与构建 | `npx.cmd tsc --noEmit`、`npm.cmd run build` 通过 |
| 当前素材测量 | 143 张 PNG 记录尺寸、SHA-256 与真实 alpha 凸包；8 个样板接触点均达到既有可见阈值 |
| 完整几何扫描 | 334,992 帧，无越界；覆盖四阶段、双朝向、三档强度、减少动态、全部永久与旅行附件，四项使用完整时长而非单周期 |
| 正式组件截图 | 四样板 × 四阶段 × 双朝向 × 四时刻；图片解码、唯一绘制与结束清理通过 |
| 真实组件接入 | 动作中途首次加载与握持后的成长提交独立验证；结果文件记录最终状态 |
| 短时性能基线 | 开发前／当前各运行待机、四样板和最长服务共 12 个案例；本次观测帧间隔中位数约 16.7 ms，P95 为 16.7–16.8 ms，样板图层数未增加 |

性能环境为 Windows、Electron 43.1.1、宿主缩放 125%、Vite 开发构建、固定帧率离屏窗口。每例只是短时观测，先旧后新、共享进程和缓存。工作集随案例加载增加，不能解释为已证明泄漏，也不能据此宣称长期稳定；CPU 与内存原值保存在 JSON。隐藏窗口早期采样曾受节流与初始降级影响，未被当作有效对照结果。

样板开发时尚未进行正式打包。用户随后明确授权上传当前版本，v1.2.7 已完成安装、升级与正式发布，详见 [发布快照](releases/v1.2.7.md)。仍待补充的是用户逐项动态反馈、安装版长期运行与全长庆典观察、真实 Windows 多档 DPI／跨屏拖动、渲染故障下的完整人工操作。现有自动检查不等于剩余动作可直接批量推广。

## 复现检查

在仓库根目录执行。基线目录只放历史源码，不检出或覆盖当前工作区：

```powershell
New-Item -ItemType Directory -Force tmp/motion-baseline | Out-Null
git archive --format=tar --output=tmp/motion-baseline.tar cb1b99e src
tar -xf tmp/motion-baseline.tar -C tmp/motion-baseline
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run build
```

测量与离线导出：

```powershell
Start-Process -FilePath (Resolve-Path 'node_modules/electron/dist/electron.exe') -ArgumentList 'scripts/measure_rig_assets.cjs' -WindowStyle Hidden -Wait
node scripts/verify_rig_bounds.cjs
node scripts/export_motion_samples.cjs
```

启动前述本地 Vite 后执行实际组件验证与短时对照；Electron 使用各自独立的临时资料目录：

```powershell
Start-Process -FilePath (Resolve-Path 'node_modules/electron/dist/electron.exe') -ArgumentList 'scripts/verify_motion_samples.cjs' -WindowStyle Hidden -Wait
Start-Process -FilePath (Resolve-Path 'node_modules/electron/dist/electron.exe') -ArgumentList 'scripts/verify_rig_live.cjs' -WindowStyle Hidden -Wait
Start-Process -FilePath (Resolve-Path 'node_modules/electron/dist/electron.exe') -ArgumentList 'scripts/benchmark_motion_samples.cjs' -WindowStyle Hidden -Wait
```

## 本次文件范围

| 文件 | 作用 |
| --- | --- |
| `src/renderer/rig/sample-actions.ts`、`sample-actions.test.ts` | 四项有限动作与回归 |
| `src/renderer/rig/actions.ts`、`actions.test.ts` | 路由、输入类型、原动作兼容检查 |
| `src/renderer/rig/live-pet.tsx`、`pet-frame.ts` | 总时长、首次提交与阶段表情 |
| `src/renderer/rig/rig-preview.tsx` | 完整播放、时间轴、重播与选择 |
| `scripts/measure_rig_assets.cjs`、`verify_rig_bounds.cjs` | 真实像素接触与完整边界测量 |
| `scripts/export_motion_samples.cjs`、`verify_motion_samples.cjs`、`benchmark_motion_samples.cjs` | 可交付样片、真实组件验证与短时对照 |
| `docs/MOTION_SAMPLE_IMPLEMENTATION.md`、`MOTION_AND_PROP_ENRICHMENT_PLAN.md`、`MOTION_AND_PROP_REVIEW_CONCLUSION.md`、`README.md` | 实施、计划、历史状态补充与导航 |
| `docs/reference/CONFIGURATION_REGISTRY.md`、`INVENTORY_USE_ACTIONS.md`、`PET_RIG_AND_ATTACHMENTS.md`、`TESTING_AND_ACCEPTANCE.md` | 参数、当前行为、架构与测试证据 |
| `docs/status/CURRENT_IMPLEMENTATION.md`、`CHANGELOG.md` | 当前开发状态与追加未发布记录 |

本表省略的同目录前缀按所在行首个完整路径理解。受保护治理文件、PNG、目录数值与存档文件均未修改。

## 下一步判断

首先确认汽水倾杯观感、毛球截停节奏、护理停顿和键盘手部可读性。若用户接受，按计划推进饼干及其余动作；若有视觉问题，先修正对应样板再推广。两轮文字评审已经收敛，新的决定依据应是可播放样板和实测，而不是继续堆叠分镜建议。
