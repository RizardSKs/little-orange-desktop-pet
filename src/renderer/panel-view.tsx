import { useMemo, useState } from 'react';
import {
  EXPEDITIONS,
  findExpedition,
  findInventoryItem,
  findTravelStory,
  INVENTORY_ITEMS,
  SERVICE_VOUCHERS,
  SHOP_ITEMS,
  SUPPLY_ITEMS,
  TRAVEL_STORIES,
  type InventoryCatalogItem,
} from '../shared/catalog';
import { EFFECT_SLOTS, type EffectSlot } from '../shared/economy-types';
import { describeGrowth, MAX_LEVEL, rewardEfficiency, statCap } from '../shared/game';
import type { PetAction, PetRuntimeState, PetStats, SaveData, SettingKey } from '../shared/types';
import type { GrowthCelebrationState } from './App';
import { outfitAssetPath } from './outfit-layout';

const STAGE_NAMES = { sprout: '幼芽', lively: '活力', mature: '成熟', radiant: '闪耀' } as const;
const EFFECT_SLOT_NAMES: Record<EffectSlot, string> = {
  celebration: '庆典', keyboard: '键盘', mouse: '鼠标', theme: '主题', aura: '光环',
};
type TopTab = 'status' | 'actions' | 'life' | 'settings';
type LifeSection = 'outfits' | 'supplies' | 'services' | 'explore' | 'backpack';

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(1, Math.ceil(milliseconds / 1_000));
  if (totalSeconds < 60) return `${totalSeconds} 秒`;
  const totalMinutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} 分钟`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`;
};

export function PanelView({ state, setState, runtime, notice, flash, growthCelebration }: {
  state: SaveData;
  setState: (state: SaveData) => void;
  runtime: PetRuntimeState;
  notice: string;
  flash: (message: string) => void;
  growthCelebration: GrowthCelebrationState | null;
}) {
  const [tab, setTab] = useState<TopTab>('status');
  const [lifeSection, setLifeSection] = useState<LifeSection>('outfits');
  const cap = statCap(state.growth.level);
  const descriptor = describeGrowth(state.growth.level);
  const efficiency = Math.round(rewardEfficiency(state) * 100);
  const openExplore = () => {
    setLifeSection('explore');
    setTab('life');
  };

  return (
    <main className={`panel-shell panel-stage-${state.growth.stage}`}>
      <header className="hero-card">
        <div className="hero-pet-preview">
          <img className="hero-pet" src={`${location.protocol === 'file:' ? '../assets/pet' : '/assets/pet'}/${state.growth.stage}.png`} alt="" />
        </div>
        <div className="hero-copy">
          <p>{STAGE_NAMES[state.growth.stage]}阶段 · {descriptor.title}</p>
          <h1>{state.pet.name}</h1>
          <div className="level-row"><span>Lv.{state.growth.level}</span><span className="star-row">{descriptor.radiantStars ? '★'.repeat(descriptor.radiantStars) : state.growth.level >= 20 ? '新星' : ''}</span><span>🪙 {state.economy.coins}</span></div>
        </div>
      </header>

      <nav className="tabs">
        {([['status', '状态'], ['actions', '互动'], ['life', '生活'], ['settings', '设置']] as const).map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </nav>

      <section className="panel-content">
        {tab === 'status' && <StatusTab state={state} cap={cap} efficiency={efficiency} onOpenExplore={openExplore} />}
        {tab === 'actions' && <ActionsTab state={state} setState={setState} flash={flash} />}
        {tab === 'life' && <LifeTab state={state} setState={setState} flash={flash} section={lifeSection} setSection={setLifeSection} />}
        {tab === 'settings' && <SettingsTab state={state} runtime={runtime} setState={setState} flash={flash} />}
      </section>
      {growthCelebration && <div className={`panel-growth-celebration ${growthCelebration.kind}`}><strong>{growthCelebration.title}</strong><span>{growthCelebration.detail}</span></div>}
      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}

function StatusBar({ label, icon, value, cap, color }: { label: string; icon: string; value: number; cap: number; color: string }) {
  const percent = Math.max(0, Math.min(100, Math.round(value / cap * 100)));
  return <div className="stat-row"><div className="stat-label"><span>{icon} {label}</span><strong>{Math.round(value)}/{cap}</strong></div><div className="bar"><i style={{ width: `${percent}%`, background: color }} /></div></div>;
}

function StatusTab({ state, cap, efficiency, onOpenExplore }: { state: SaveData; cap: number; efficiency: number; onOpenExplore: () => void }) {
  const descriptor = describeGrowth(state.growth.level);
  const stats: [keyof PetStats, string, string, string][] = [
    ['satiety', '饱食度', '🍊', '#ff9b32'], ['mood', '心情', '💛', '#ffca3a'], ['energy', '精力', '⚡', '#61c0bf'], ['cleanliness', '清洁度', '✨', '#7a9cff'],
  ];
  const effectStatuses = EFFECT_SLOTS.flatMap((slot) => {
    const queue = state.economy.effectQueues[slot];
    const effect = queue[0];
    if (!effect) return [];
    return [{
      slot,
      effect,
      queuedSegments: queue.length - 1,
      totalRuntimeMs: queue.reduce((total, queued) => total + queued.remainingRuntimeMs, 0),
    }];
  });
  const expedition = state.economy.activeExpedition ? findExpedition(state.economy.activeExpedition.expeditionId) : null;
  const pendingStory = state.economy.pendingExpeditionReward
    ? findTravelStory(state.economy.pendingExpeditionReward.storyId)
    : null;
  const nextXp = descriptor.nextLevelExperience;
  const xpPercent = nextXp ? Math.max(0, Math.min(100, state.growth.experience / nextXp * 100)) : 100;
  return <div className="stack">
    <div className="card"><div className="card-heading"><h2>当前状态</h2><span className={`stage-pill ${state.growth.stage}`}>{STAGE_NAMES[state.growth.stage]}</span></div>{stats.map(([key, label, icon, color]) => <StatusBar key={key} label={label} icon={icon} value={state.pet.stats[key]} cap={cap} color={color} />)}</div>
    <div className="card growth-card">
      <div><small>Lv.{state.growth.level} · {descriptor.title}</small><strong>{state.growth.level >= MAX_LEVEL ? '成长圆满' : `${state.growth.experience} / ${nextXp}`}</strong></div>
      <div className="bar xp"><i style={{ width: `${xpPercent}%` }} /></div>
      <p>{descriptor.nextMilestoneLevel ? `下一里程碑：Lv.${descriptor.nextMilestoneLevel} ${descriptor.nextMilestoneLabel}` : '六星圆满，继续享受陪伴时光。'}</p>
    </div>
    <div className="info-grid"><div className="info-tile"><span>在线陪伴效率</span><strong>{efficiency}%</strong></div><div className="info-tile"><span>距离下次在线奖励</span><strong>{Math.max(1, Math.ceil((300_000 - state.growth.rewardRemainderMs) / 60_000))} 分钟</strong></div></div>
    {expedition && <div className="card travel-status"><div><b>{expedition.icon} {expedition.name}进行中</b><span>剩余 {formatDuration(state.economy.activeExpedition!.remainingRuntimeMs)}</span></div><small>探索只消耗应用实际运行时间；关闭或系统挂起时暂停。</small></div>}
    {state.economy.pendingExpeditionReward && <div className="card pending-return-status"><div><b>📮 返程故事待确认</b><span>{pendingStory?.title ?? '小橙子带回了一篇旅行故事'}</span></div><button onClick={onOpenExplore}>前往探索查看</button></div>}
    {effectStatuses.length > 0 && <div className="card"><h2>限时体验队列</h2><div className="effect-list">{effectStatuses.map(({ slot, effect, queuedSegments, totalRuntimeMs }) => <article className="effect-queue-row" key={slot}><span className="effect-current"><b>{EFFECT_SLOT_NAMES[slot]} · {findInventoryItem(effect.sourceId)?.name ?? findExpedition(effect.sourceId)?.name ?? effect.effectId}</b><small>当前剩余 {formatDuration(effect.remainingRuntimeMs)}</small></span><span className="effect-queue-meta"><small>排队 {queuedSegments} 段</small><strong>总剩余 {formatDuration(totalRuntimeMs)}</strong></span></article>)}</div></div>}
    <p className="tip">金币和经验只在应用实际运行及有效照顾时获得；关闭应用或 Windows 睡眠、休眠期间没有奖励。</p>
  </div>;
}

function ActionsTab({ state, setState, flash }: { state: SaveData; setState: (state: SaveData) => void; flash: (message: string) => void }) {
  const cap = statCap(state.growth.level);
  const action = async (kind: PetAction) => {
    try {
      const result = await window.orangePet.performAction(kind);
      setState(result.state);
      flash(result.message);
    } catch (error) { flash(error instanceof Error ? error.message : '互动失败'); }
  };
  const actions: { id: PetAction; icon: string; title: string; desc: string; disabled?: boolean }[] = [
    { id: 'feed', icon: '🥣', title: '喂食', desc: '饱食最多 +25 · 5 金币 · 按实际恢复发经验', disabled: state.economy.coins < 5 || state.pet.stats.satiety >= cap },
    { id: 'play', icon: '🧶', title: '玩耍', desc: '心情最多 +20 · 精力 -8 · 按实际恢复发经验', disabled: state.pet.stats.energy < 8 || state.pet.stats.mood >= cap },
    { id: 'clean', icon: '🫧', title: '清洁', desc: '清洁最多 +30 · 按实际恢复发经验', disabled: state.pet.stats.cleanliness >= cap },
    { id: 'sleep', icon: state.pet.behavior === 'sleeping' ? '🌞' : '🌙', title: state.pet.behavior === 'sleeping' ? '叫醒' : '睡觉', desc: state.pet.behavior === 'sleeping' ? '恢复清醒状态' : '应用运行时每小时恢复 12 点精力' },
  ];
  return <div className="stack"><div className="action-grid">{actions.map((item) => <button key={item.id} className="action-card" disabled={item.disabled} onClick={() => void action(item.id)}><span>{item.icon}</span><strong>{item.title}</strong><small>{item.desc}</small></button>)}</div><div className="card cozy-note"><b>有效照顾才会成长</b><p>属性已满时不会扣除金币、精力或发放经验。鼠标、键盘和旅行互动只带来表现，不会变成刷取途径。</p></div></div>;
}

function LifeTab({ state, setState, flash, section, setSection }: {
  state: SaveData;
  setState: (state: SaveData) => void;
  flash: (message: string) => void;
  section: LifeSection;
  setSection: (section: LifeSection) => void;
}) {
  return <div className="stack life-tab">
    <div className="segmented life-sections">{([['outfits', '装扮'], ['supplies', '用品'], ['services', '服务'], ['explore', '探索'], ['backpack', '背包']] as const).map(([id, label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}>{label}</button>)}</div>
    {section === 'outfits' && <OutfitShop state={state} setState={setState} flash={flash} />}
    {section === 'supplies' && <InventoryShop items={SUPPLY_ITEMS} state={state} setState={setState} flash={flash} />}
    {section === 'services' && <InventoryShop items={SERVICE_VOUCHERS} state={state} setState={setState} flash={flash} />}
    {section === 'explore' && <ExploreView state={state} setState={setState} flash={flash} />}
    {section === 'backpack' && <BackpackView state={state} setState={setState} flash={flash} />}
  </div>;
}

function OutfitShop({ state, setState, flash }: { state: SaveData; setState: (state: SaveData) => void; flash: (message: string) => void }) {
  const handleItem = async (itemId: string) => {
    const owned = state.economy.ownedItems.includes(itemId);
    if (!owned) {
      const result = await window.orangePet.buyItem(itemId); setState(result.state); flash(result.message);
    } else {
      const next = await window.orangePet.equipItem(state.economy.equippedItem === itemId ? null : itemId); setState(next); flash(next.economy.equippedItem ? '装扮完成！' : '已卸下装扮。');
    }
  };
  return <div className="shop-grid">{SHOP_ITEMS.map((item) => {
    const owned = state.economy.ownedItems.includes(item.id); const equipped = state.economy.equippedItem === item.id; const locked = state.growth.level < item.unlockLevel;
    return <button className={`shop-card ${equipped ? 'equipped' : ''}`} key={item.id} disabled={locked} onClick={() => void handleItem(item.id)}><img className="shop-icon-image" src={outfitAssetPath(item.assetFile)} alt="" /><strong>{item.name}</strong><small>{locked ? `Lv.${item.unlockLevel} 解锁` : equipped ? '使用中 · 点击卸下' : owned ? '已拥有 · 点击装备' : `🪙 ${item.price}`}</small></button>;
  })}</div>;
}

function InventoryShop({ items, state, setState, flash }: { items: readonly InventoryCatalogItem[]; state: SaveData; setState: (state: SaveData) => void; flash: (message: string) => void }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const purchase = async (item: InventoryCatalogItem) => {
    const quantity = quantities[item.id] ?? 1;
    if (item.kind === 'service' && !window.confirm(`购买 ${quantity} 张「${item.name}」服务券？\n将花费 ${item.price * quantity} 金币，购买后存入背包，不会自动使用。`)) return;
    try {
      const result = await window.orangePet.purchaseInventoryItem(item.id, quantity);
      setState(result.state); flash(result.message);
    } catch (error) { flash(error instanceof Error ? error.message : '购买失败'); }
  };
  return <div className="catalog-list">{items.map((item) => <article className="catalog-card" key={item.id}>
    <span className="catalog-icon">{item.icon}</span><div className="catalog-copy"><strong>{item.name}</strong><p>{item.description}</p><small>背包已有 {state.economy.inventory[item.id] ?? 0}/99</small></div>
    <div className="catalog-buy"><label>数量<input type="number" min={1} max={10} value={quantities[item.id] ?? 1} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Math.max(1, Math.min(10, Number(event.target.value) || 1)) }))} /></label><button disabled={state.economy.coins < item.price * (quantities[item.id] ?? 1)} onClick={() => void purchase(item)}>🪙 {item.price * (quantities[item.id] ?? 1)}</button></div>
  </article>)}</div>;
}

function BackpackView({ state, setState, flash }: { state: SaveData; setState: (state: SaveData) => void; flash: (message: string) => void }) {
  const carried = INVENTORY_ITEMS.filter((item) => (state.economy.inventory[item.id] ?? 0) > 0);
  const use = async (item: InventoryCatalogItem) => {
    if (item.kind === 'service' && !window.confirm(`使用「${item.name}」？\n将消耗 1 张服务券。即使属性已满，仪式和限时视觉效果仍会生效。`)) return;
    try {
      const result = await window.orangePet.useInventoryItem(item.id);
      setState(result.state); flash(result.message);
    } catch (error) { flash(error instanceof Error ? error.message : '使用失败'); }
  };
  if (!carried.length) return <div className="card empty-state"><span>🎒</span><b>背包还是空的</b><p>购买的用品和服务券会永久保存在这里，退出或更新都不会消失。</p></div>;
  return <div className="catalog-list">{carried.map((item) => <article className="catalog-card backpack-card" key={item.id}><span className="catalog-icon">{item.icon}</span><div className="catalog-copy"><strong>{item.name}</strong><p>{item.description}</p><small>持有 {state.economy.inventory[item.id]}</small></div><button className="primary-small" onClick={() => void use(item)}>使用 1 件</button></article>)}</div>;
}

function ExploreView({ state, setState, flash }: { state: SaveData; setState: (state: SaveData) => void; flash: (message: string) => void }) {
  const active = state.economy.activeExpedition && findExpedition(state.economy.activeExpedition.expeditionId);
  const pending = state.economy.pendingExpeditionReward;
  const pendingStory = pending ? findTravelStory(pending.storyId) : null;
  const start = async (id: string) => {
    const item = findExpedition(id);
    if (!item || !window.confirm(`派小橙子进行「${item.name}」？\n花费 ${item.price} 金币，预计 ${formatDuration(item.durationRuntimeMs)}实际运行时间。关闭或系统挂起时暂停。`)) return;
    const result = await window.orangePet.startExpedition(id); setState(result.state); flash(result.message);
  };
  const returnEarly = async () => {
    if (!window.confirm('确定提前回家吗？\n金币不退还，也不会获得故事或主题效果。')) return;
    const result = await window.orangePet.returnExpeditionEarly(); setState(result.state); flash(result.message);
  };
  const acknowledge = async () => {
    const result = await window.orangePet.acknowledgeExpeditionReward(); setState(result.state); flash(result.message);
  };
  const collected = useMemo(() => new Set(state.economy.travelJournal), [state.economy.travelJournal]);
  return <div className="stack">
    {pending && pendingStory && <div className="card story-return"><span>📮</span><h2>{pendingStory.title}</h2><p>{pendingStory.text}</p><button onClick={() => void acknowledge()}>收进旅行册</button></div>}
    {active && <div className="card active-expedition"><span>{active.icon}</span><div><h2>{active.name}</h2><p>剩余 {formatDuration(state.economy.activeExpedition!.remainingRuntimeMs)}</p><small>旅行装已经穿好，桌面互动仍然可用。</small></div><button className="danger-small" onClick={() => void returnEarly()}>提前回家</button></div>}
    {!active && !pending && <div className="catalog-list">{EXPEDITIONS.map((item) => <article className="catalog-card" key={item.id}><span className="catalog-icon">{item.icon}</span><div className="catalog-copy"><strong>{item.name}</strong><p>{item.description}</p><small>{formatDuration(item.durationRuntimeMs)} · 4 个故事</small></div><button className="primary-small" disabled={state.economy.coins < item.price} onClick={() => void start(item.id)}>🪙 {item.price}</button></article>)}</div>}
    <div className="card journal"><div className="card-heading"><h2>旅行册</h2><span>{collected.size}/16</span></div><div className="journal-grid">{TRAVEL_STORIES.map((story) => <span className={collected.has(story.id) ? 'collected' : ''} title={collected.has(story.id) ? story.text : '尚未发现'} key={story.id}>{collected.has(story.id) ? story.title : '未发现'}</span>)}</div></div>
  </div>;
}

function SettingsTab({ state, runtime, setState, flash }: { state: SaveData; runtime: PetRuntimeState; setState: (state: SaveData) => void; flash: (message: string) => void }) {
  const [name, setName] = useState(state.pet.name);
  const update = async (key: SettingKey, value: boolean | string) => { try { setState(await window.orangePet.setSetting(key, value)); flash('设置已保存。'); } catch (error) { flash(error instanceof Error ? error.message : '设置失败'); } };
  const updateLock = async (locked: boolean) => { try { setState(await window.orangePet.setDesktopLocked(locked)); if (!locked) flash('已解除桌面锁定。'); } catch (error) { flash(error instanceof Error ? error.message : '锁定失败'); } };
  const updateMouse = async (enabled: boolean) => { setState(await window.orangePet.setMouseInteractions(enabled)); flash(enabled ? '鼠标互动已开启。' : '鼠标环境互动已关闭。'); };
  const updateKeyboard = async (enabled: boolean) => {
    if (enabled && !window.confirm('开启键盘陪打？\n\n小橙子只在本机统计按键次数和时间桶，用于判断敲击节奏。不会读取、传递或保存按键内容、字符、密码、输入法内容或活动窗口。该功能默认关闭，可随时停用。')) return;
    try { setState(await window.orangePet.setKeyboardInteraction(enabled, enabled ? 1 : undefined)); flash(enabled ? '键盘陪打已开启。' : '键盘陪打已关闭。'); }
    catch (error) { flash(error instanceof Error ? error.message : '键盘互动设置失败'); }
  };
  return <div className="stack">
    <div className="card"><label className="field-label">角色名称</label><div className="name-field"><input maxLength={12} value={name} onChange={(event) => setName(event.target.value)} /><button onClick={() => void update('petName', name)}>保存</button></div></div>
    <div className="card settings-list">
      <Toggle label="自动散步" desc="在当前屏幕底部随机蹦跳" checked={state.settings.autoWalk} onChange={(value) => void update('autoWalk', value)} />
      <Toggle label="始终置顶" desc="让小橙子保持在其他窗口上方" checked={state.settings.alwaysOnTop} onChange={(value) => void update('alwaysOnTop', value)} />
      <Toggle label="开机启动" desc="登录 Windows 后自动出现" checked={state.settings.launchAtLogin} onChange={(value) => void update('launchAtLogin', value)} />
    </div>
    <div className="card settings-list">
      <Toggle label="鼠标环境互动" desc="注视、陪伴、扒拉和追逐；基本拖拽不受影响" checked={state.settings.mouseInteractionsEnabled} onChange={(value) => void updateMouse(value)} />
      <Toggle label="键盘陪打" desc={`默认关闭 · 组件状态：${{ disabled: '未启用', starting: '启动中', ready: '已就绪', unavailable: '组件不可用' }[runtime.keyboardStatus]}`} checked={state.settings.keyboardInteractionEnabled} onChange={(value) => void updateKeyboard(value)} />
    </div>
    <div className="card"><label className="field-label">动画强度</label><div className="segmented">{([['gentle', '轻柔'], ['normal', '标准'], ['lively', '活泼']] as const).map(([id, label]) => <button key={id} className={state.settings.animationIntensity === id ? 'active' : ''} onClick={() => void update('animationIntensity', id)}>{label}</button>)}</div></div>
    <div className="card lock-card"><div><strong>桌面锁定</strong><p>锁定后宠物主体置顶并完全点击穿透，只能通过独立解锁按钮或托盘恢复。</p></div><button onClick={() => void updateLock(true)}>🔒 锁定在桌面</button></div>
    <button className="quit-button" onClick={() => window.orangePet.quitApp()}>完全退出小橙子</button>
  </div>;
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle-row"><span><strong>{label}</strong><small>{desc}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}
