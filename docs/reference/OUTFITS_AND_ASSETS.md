# 装扮与角色素材规格

> 文档级别：LIVING（随实现持续维护）  
> 修改权限：子代理仅可在装扮目录、购买/装备逻辑、渲染锚点、角色素材或测试已变更并核对后更新；既有物品 ID、存档兼容规则和美术方向不得擅自改变。  
> 适用版本：1.1.0  
> 最后核对：2026-08-15  
> 权威源码：src/shared/types.ts:35-39,67-74、src/shared/catalog.ts:3-14、src/shared/game.ts:135-145、src/main/main.ts:313-325、src/renderer/App.tsx:33-54,74-100,170-182、src/renderer/styles.css:13-32,56、scripts/prepare_assets.py、assets/pet  
> 更新触发：物品 ID、名称、价格、解锁等级、所有权、装备槽、渲染方式、CSS 锚点、阶段角色素材、素材生成流程或相关测试变化时。

精确目录值和视觉坐标统一登记在 [CONFIGURATION_REGISTRY.md](CONFIGURATION_REGISTRY.md)，见 CFG-070 至 CFG-080。

## 当前已实现

### 装扮数据模型

ShopItem 包含：

- id：购买、所有权、装备和存档使用的稳定字符串标识。
- name：商店展示名称和购买成功提示的一部分。
- icon：当前直接渲染的 emoji 字符。
- price：金币价格。
- unlockLevel：可购买和可点击的最低等级。
- className：用于定位装扮的 CSS 类名。

EconomyState 使用 ownedItems 字符串数组保存永久所有权，使用 equippedItem 保存一个物品 ID 或 null。因此当前是单装备模型，见 CFG-070。

八件装扮的权威条目为：

| CFG 编号 | 稳定 ID | 当前用途 |
| --- | --- | --- |
| CFG-071 | leaf-clip | 叶子发卡 |
| CFG-072 | bow | 橙色蝴蝶结 |
| CFG-073 | glasses | 圆框眼镜 |
| CFG-074 | top-hat | 小礼帽 |
| CFG-075 | headphones | 音乐耳机 |
| CFG-076 | scarf | 温暖围巾 |
| CFG-077 | crown | 金色皇冠 |
| CFG-078 | halo | 星星光环 |

价格、等级、图标和 className 只以配置总账与 src/shared/catalog.ts 为准。已有 ID 已经进入用户存档，不能通过改名来“整理命名”，也不能赋给新物品。

### 购买流程

buyItem 是共享领域纯函数，按以下顺序检查：

1. catalog 中必须存在该 ID。
2. ownedItems 不能已经包含该 ID。
3. 当前 level 必须达到 unlockLevel。
4. coins 必须不少于 price。
5. 成功后扣除金币并把 ID 追加到 ownedItems。

购买不会自动装备。失败返回原状态的深拷贝、ok=false 和中文原因；成功返回 ok=true 和购买提示。主进程无论购买成功或失败都会保存并广播返回状态。

渲染层在未解锁时禁用商店按钮；等级已到但金币不足时允许点击，由领域层返回失败。当前没有确认对话框、退款、出售、赠送、重复物品或数量堆叠。

### 装备流程

装备由主进程 shop:equip 处理：

- itemId 为 null 时卸下当前装扮。
- 非 null ID 必须存在于 catalog，且必须出现在 ownedItems。
- 验证通过后直接覆盖 equippedItem，保存并广播。
- 商店中点击已拥有物品会在“装备该物品”和“卸下当前同一物品”之间切换。

没有身体部位槽位、冲突矩阵或套装规则；装备新物品会替换旧物品。

### 装扮渲染

PetView 在 catalog 中按 equippedItem 查找条目，找到后渲染一个使用 icon 和 className 的 span。所有装扮共用一套基于 pet-character 的绝对像素锚点，见 CFG-079。

装扮节点位于 pet-facing 节点外侧，因此角色朝左翻转时，身体与五官翻转，装扮本身不会随之镜像。四个成长阶段也共用相同锚点，没有逐阶段偏移。

当前装扮是系统 emoji 字形，不是项目内 PNG/SVG 美术资源。实际颜色、轮廓和占位可能随 Windows 字体与 Electron/Chromium 环境改变。

### 角色阶段素材

角色阶段和五层资源契约见 CFG-012、CFG-080：

- 运行时优先加载当前阶段目录中的左右腿、左右手和身体五层。
- 五层共享 512×512 坐标系，在 165×165 的 pet-rig 中重叠。
- 任一层加载失败时，PetView 将整套角色切换为对应阶段整图 fallback。
- 五官由 DOM/CSS 单独绘制，不烘焙进表情素材。
- radiant 阶段额外显示 stage-glow。

scripts/prepare_assets.py 是当前离线素材处理辅助脚本：

- 将身体层规范化到 512×512 RGBA 透明画布。
- 依据固定多边形区域从每阶段整图提取左右手脚。
- 验证尺寸、可见 alpha 和四角透明。
- 去除部分品红边缘，并从 sprout 整图生成应用图标。

该脚本不是运行时依赖，也不会在 npm build 中自动执行。

## 待批准规划

以下均未实现：

- 把 emoji 装扮替换为项目内透明 PNG、SVG 或分层资源。
- 为每个阶段、方向或动作定义独立锚点、缩放、旋转和遮挡层级。
- 增加头部、脸部、颈部等多槽位并支持同时装备。
- 增加类别、稀有度、套装、颜色变体、预览、收藏进度、出售或退款。
- 让装扮随朝向镜像，或为不应镜像的文字/徽章提供例外。
- 提供 catalog schema 版本、废弃物品迁移或缺失物品占位。
- 将素材检查和截图回归自动纳入构建流水线。

新增装扮前必须先确定稳定 ID、兼容策略、价格与解锁平衡、所有阶段锚点、失败降级方式和测试，不应只向 catalog 追加一行。

## 失败与边界

- validateSave 只确认 ownedItems 是数组，不验证数组元素类型、重复 ID、catalog 存在性或 equippedItem 是否已拥有。
- 如果 catalog 删除或改名，旧存档会留下孤儿 ownedItems；PetView 找不到 equippedItem 时只是不显示，不会迁移或提示。
- 当前所有装扮依赖平台 emoji，无法保证跨 Windows 版本视觉一致。
- 单套 CSS 坐标未按 sprout、lively、mature、radiant 分别验证；阶段轮廓变化可能造成漂浮、穿模或遮脸。
- 装扮不在 pet-facing 内，向左移动时不会跟随角色镜像。
- 商店卡片只按等级禁用；金币不足由点击后返回提示。
- 购买成功不自动装备，当前也没有“试穿”状态。
- layerFailed 只在 stage 改变时重置；同阶段中资源暂时加载失败后不会自动重试分层模式。
- fallback 是整张阶段角色图，无法参与左右手脚步态；降级后仍可叠加 DOM 五官和装扮。
- prepare_assets.py 依赖 Pillow，但 package.json 不声明 Python/Pillow 环境；它是维护脚本而非可重复 npm 构建步骤。
- UI 回归测试只检查 512×512 和 PNG RGBA 色彩类型；四角透明等更严格检查目前主要存在于手动运行的 Python 脚本。

## 相关测试

- src/shared/game.test.ts:68-75：验证高等级物品被拒、叶子发卡可购买、重复购买被拒。
- src/renderer/ui-regressions.test.ts:15-19：验证五层文件名和整图 fallback 仍在渲染代码中。
- src/renderer/ui-regressions.test.ts:21-29：验证四阶段五层素材均为 512×512 RGBA PNG。
- scripts/prepare_assets.py:35-42：脚本运行时检查尺寸、可见 alpha 和透明四角，但它不是 Vitest。
- 当前缺少八件目录逐项快照、价格/解锁全量测试、金币不足、装备/卸下、未知 ID、孤儿存档、多阶段锚点、朝向镜像和视觉截图回归。
