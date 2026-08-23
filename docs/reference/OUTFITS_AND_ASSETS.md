# 装扮与角色素材规格

> 文档级别：`LIVING`（随实现持续维护）  
> 修改权限：装扮目录、购买/装备逻辑、渲染锚点、角色素材或测试变化时同步更新；既有物品 ID、存档兼容规则和美术方向不得擅自改变。  
> 适用版本：1.2.6 预览  
> 最后核对：2026-08-23  
> 权威源码：`src/shared/catalog.ts`、`src/renderer/outfit-layout.ts`、`src/renderer/pet-view.tsx`、`scripts/prepare_v1_2_3_outfit_assets.py`、`assets/outfits/`、`assets/props/`  
> 更新触发：稳定 ID、装扮所有权、旅行外观、限时视觉、阶段素材、素材处理流程或相关测试变化。

精确目录价格、解锁等级和视觉参数统一登记在[配置与变量总账](CONFIGURATION_REGISTRY.md)。本文件说明稳定资产契约和渲染关系。

## 永久装扮

`ownedItems` 继续保存永久所有权，`equippedItem` 保存一个已装备 ID 或 `null`。以下八个已发布 ID 保持不变：

| 稳定 ID | 装扮 |
| --- | --- |
| `leaf-clip` | 叶子发卡 |
| `bow` | 橙色蝴蝶结 |
| `glasses` | 圆框眼镜 |
| `top-hat` | 小礼帽 |
| `headphones` | 音乐耳机 |
| `scarf` | 温暖围巾 |
| `crown` | 金色皇冠 |
| `halo` | 星星光环 |

购买仍按目录存在、未拥有、等级解锁和金币足够的顺序校验；成功购买不会自动装备。装备新物品会替换旧物品，卸下使用 `null`。schema 1 到 schema 2 的迁移会原样保留上述所有权和当前装备。

八件永久装扮均使用 `assets/outfits/<stable-id>.png` 下的 512×512 RGBA 本地素材。`OUTFIT_LAYOUTS` 为四个成长阶段定义共 32 组位置、宽度和旋转；装扮位于 `pet-facing` 内的角色运动节点中，因此会跟随呼吸、步态、开心飞行拖拽和左右镜像。商店预览读取同一素材，不再依赖平台 emoji 字体。

## v1.2.2 阶段角色素材

四个阶段共交付 80 张本地透明 PNG，每阶段固定 20 张：

```text
assets/pet/<stage>.png                 # 整图加载降级
assets/pet/<stage>/body.png            # 身体
assets/pet/<stage>/arm-left.png        # 左臂
assets/pet/<stage>/arm-right.png       # 右臂
assets/pet/<stage>/leg-left.png        # 左腿
assets/pet/<stage>/leg-right.png       # 右腿
assets/pet/<stage>/expressions/<expression>.png # 14 种图片表情
```

| 阶段目录 | 等级范围 | 视觉职责 |
| --- | --- | --- |
| `sprout` | 1–4 | 最小轮廓和幼芽气质 |
| `lively` | 5–9 | 更舒展的叶片和活力轮廓 |
| `mature` | 10–19 | 更完整、稳定的成熟轮廓 |
| `radiant` | 20–50 | 柔和晨曦与星尘质感、五叶中央分枝，并由等级星数继续强化 |

全部整图、身体、手脚和表情层均为 512×512 RGBA，共用同一透明坐标系。渲染时按左右腿、左右手、身体、图片表情的顺序叠放；任一层加载失败后，整套角色切换到带中性表情的 `<stage>.png`，避免残缺角色。14 种表情与 `PetExpression` 稳定值一一对应。`radiant` 默认只保留低强度哑光星尘，不再使用身体外发光或金属油亮滤镜；用品、服务和庆典主动触发的光环仍按各自效果显示。

## 旅行装、用品与限时效果

- 探索期间根据委托显示 `travel-satchel`、`travel-raincoat`、`travel-star-cape` 或 `travel-grand-backpack` 旅行标识。
- 旅行装只在视觉上暂时覆盖普通装扮，不修改 `equippedItem`；正常返程或提前返程后，原永久装扮自动恢复。
- 键盘、鼠标、主题和光环由持久化效果队列驱动。1.2.6 起，新使用的用品和服务由临时 `inventory-use` 立即播放专属动作；旧存档消费庆典和探索返程庆典仍可从 `celebration` 队列继续显示，队列推进由主进程按实际运行时间完成。
- 探索正常完成时，返程庆典和对应主题奖励原子入队；提前返程不入队，且原永久装扮仍会恢复。
- 1.2.4 的键盘陪打和光标抓握分别使用 `assets/props/mini-keyboard.png` 与 `assets/props/cursor-grab.png`。1.2.6 预览在 `assets/props/inventory/` 增加十二张用品/服务透明 PNG，迷你键盘动作复用现有键盘；十三种正式使用动作均不依赖系统 emoji。逐项映射见[用品与服务专属动作规格](INVENTORY_USE_ACTIONS.md)。

## 素材处理流程

`scripts/prepare_v1_2_3_outfit_assets.py` 将批准的透明装扮图裁去极低 alpha 外扩光效、等比缩放并居中写入 512×512 RGBA 画布。正式源码包含已经核验的八张输出图，运行时不依赖 Python 或图片生成服务。

`scripts/prepare_v1_2_2_character_assets.py` 是 v1.2.2 的离线维护脚本，不是运行时依赖，也不会由 `npm.cmd run build` 自动执行。脚本负责：

- 将批准的四阶段透明 master 输入规范化到 512×512 RGBA 画布和统一落脚线。
- 使用各阶段固定区域提取双臂和双腿，并从周围橙色果皮拟合连续表面，形成无五官身体层。
- 确定性生成四阶段各 14 张图片表情，检查尺寸、可见 alpha 和四角透明。
- 仅在显式传入 `--preview-dir` 时生成阶段与表情对比图，预览不进入安装包。

脚本依赖 Python、Pillow 与 NumPy；正式源码提交包含已经核验的 80 张运行时素材，不依赖用户电脑现场生成。

## 失败与边界

- 分层或当前表情加载失败会降级为带中性表情的整图，因此降级状态无法显示独立手脚步态或动态表情，外围效果仍可工作。
- `layerFailed` 在成长阶段改变时重置；同阶段内的临时加载失败不会自动重试分层模式。
- 旅行装和探索返程的遗留临时标识仍可能使用 emoji；用品和服务的正式使用动作、键盘与光标抓握均使用本地 PNG，不受平台字体影响。
- 自动测试验证装扮稳定 ID、文件名、512×512 RGBA 和 32 组边界，不替代透明边缘、DPI、左右镜像和动作遮挡的人工截图检查。

## 相关测试

- `src/renderer/ui-regressions.test.ts`：验证五层与图片表情加载、整图 fallback，以及全部 80 张 PNG 的尺寸与 RGBA 类型。
- `src/renderer/outfit-layout.test.ts`：验证八件本地装扮、透明 PNG 契约和四阶段 32 组布局边界。
- `src/shared/catalog.test.ts`：锁定八件永久装扮 ID，以及用品、服务、探索、故事和效果目录。
- `src/renderer/ui-regressions.test.ts`：验证十二张新增用品/服务道具与复用键盘均为本地 RGBA PNG，并锁定十三种动作选择器。
- `src/shared/game.test.ts`、`src/main/store.test.ts`：验证永久装扮购买规则和 schema 1 到 schema 2 的所有权/装备保留。
- `scripts/prepare_v1_2_2_character_assets.py`：执行时验证全部 80 张阶段运行素材的透明画布契约。
