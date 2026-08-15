import { useEffect, useRef, useState } from 'react';
import { SHOP_ITEMS } from '../shared/catalog';
import { resolvePetExpression } from '../shared/expression';
import { experienceForNextLevel, rewardEfficiency, statCap } from '../shared/game';
import type { PetAction, PetExpression, PetMotionState, PetStats, SaveData, SettingKey } from '../shared/types';

const STAGE_NAMES = { sprout: '幼芽', lively: '活力', mature: '成熟', radiant: '闪耀' } as const;
const EXPRESSION_TEXT: Record<PetExpression, string> = {
  neutral: '今天也要元气满满！', happy: '心情真不错～', curious: '那边是什么？', surprised: '哇！', proud: '我超棒的！',
  focused: '一步、两步～', delighted: '好好吃！', excited: '一起玩吧！', refreshed: '亮晶晶～', asleep: '呼…呼…',
  sad: '想要抱抱…', sleepy: '有一点困啦…', hungry: '肚子咕咕叫…', uncomfortable: '想洗香香…',
};

function usePetState() {
  const [state, setState] = useState<SaveData | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    void window.orangePet.loadState().then(setState);
    return window.orangePet.onStateChanged(setState);
  }, []);
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 2200); };
  return { state, setState, notice, flash };
}

export function App() {
  const view = new URLSearchParams(location.search).get('view') ?? 'panel';
  document.body.dataset.view = view;
  const pet = usePetState();
  if (!pet.state) return <div className={`loading ${view}`}>{view === 'panel' ? '正在叫醒小橙子…' : ''}</div>;
  return view === 'pet' ? <PetView state={pet.state} /> : <PanelView {...pet} />;
}

function PetView({ state }: { state: SaveData }) {
  const drag = useRef<{ startX: number; startY: number; windowX: number; windowY: number; moved: boolean } | null>(null);
  const [idleRoll, setIdleRoll] = useState(() => Math.random());
  const [motion, setMotion] = useState<PetMotionState>({ moving: false, direction: 'right' });
  const [layerFailed, setLayerFailed] = useState(false);
  const expression = resolvePetExpression(state, idleRoll);
  const assetRoot = location.protocol === 'file:' ? '../assets/pet' : '/assets/pet';
  const stageRoot = `${assetRoot}/${state.growth.stage}`;
  const fallbackSprite = `${assetRoot}/${state.growth.stage}.png`;
  const equipped = SHOP_ITEMS.find((item) => item.id === state.economy.equippedItem);

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => { setIdleRoll(Math.random()); schedule(); }, 5_000 + Math.round(Math.random() * 4_000));
    };
    schedule();
    const unsubscribe = window.orangePet.onMotionChanged(setMotion);
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, []);

  useEffect(() => setLayerFailed(false), [state.growth.stage]);

  const pointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.screenX, startY: event.screenY, windowX: event.screenX - event.clientX, windowY: event.screenY - event.clientY, moved: false };
  };
  const pointerMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = event.screenX - drag.current.startX;
    const dy = event.screenY - drag.current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.current.moved = true;
    if (drag.current.moved) void window.orangePet.setPetPosition({ x: drag.current.windowX + dx, y: drag.current.windowY + dy });
  };
  const pointerUp = () => {
    const moved = drag.current?.moved;
    drag.current = null;
    if (!moved) void window.orangePet.togglePanel();
  };

  return (
    <main className={`pet-screen intensity-${state.settings.animationIntensity}`}>
      <div className={`speech expression-${expression}`}>{EXPRESSION_TEXT[expression]}</div>
      <div className={`pet-character stage-${state.growth.stage} expression-${expression} ${motion.moving ? 'is-moving' : ''}`} onContextMenu={(event) => { event.preventDefault(); void window.orangePet.showContextMenu(); }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
        <div className="stage-glow" />
        <div className={`pet-facing direction-${motion.direction}`}>
          <div className="pet-rig">
            {layerFailed ? <img className="pet-texture fallback-texture" src={fallbackSprite} draggable={false} alt={state.pet.name} /> : <>
              <img className="pet-layer limb leg leg-left" src={`${stageRoot}/leg-left.png`} draggable={false} alt="" onError={() => setLayerFailed(true)} />
              <img className="pet-layer limb leg leg-right" src={`${stageRoot}/leg-right.png`} draggable={false} alt="" onError={() => setLayerFailed(true)} />
              <img className="pet-layer limb arm arm-left" src={`${stageRoot}/arm-left.png`} draggable={false} alt="" onError={() => setLayerFailed(true)} />
              <img className="pet-layer limb arm arm-right" src={`${stageRoot}/arm-right.png`} draggable={false} alt="" onError={() => setLayerFailed(true)} />
              <img className="pet-layer pet-body" src={`${stageRoot}/body.png`} draggable={false} alt={state.pet.name} onError={() => setLayerFailed(true)} />
            </>}
            <div className="orange-fallback" />
            <div className="face">
              <span className="brow left-brow" /><span className="brow right-brow" />
              <span className="eye left-eye"><i className="pupil" /></span><span className="eye right-eye"><i className="pupil" /></span>
              <span className="cheek left-cheek" /><span className="cheek right-cheek" />
              <span className="mouth" /><span className="expression-mark" />
            </div>
          </div>
        </div>
        {equipped && <span className={equipped.className}>{equipped.icon}</span>}
        {expression === 'asleep' && <span className="zzz">Z<small>z</small></span>}
        {expression === 'refreshed' && <span className="sparkles">✦</span>}
      </div>
    </main>
  );
}

type PanelProps = ReturnType<typeof usePetState> & { state: SaveData };

function PanelView({ state, setState, notice, flash }: PanelProps) {
  const [tab, setTab] = useState<'status' | 'actions' | 'shop' | 'settings'>('status');
  const cap = statCap(state.growth.level);
  const nextXp = state.growth.level >= 20 ? 0 : experienceForNextLevel(state.growth.level);
  const efficiency = Math.round(rewardEfficiency(state) * 100);

  const action = async (kind: PetAction) => {
    const before = state;
    const next = await window.orangePet.performAction(kind);
    setState(next);
    if (kind === 'feed' && before.economy.coins < 5) flash('金币不足，挂机一会儿再来吧。');
    else flash({ feed: '小橙子吃得好满足！', play: '一起玩真开心！', clean: '洗得亮晶晶！', sleep: next.pet.behavior === 'sleeping' ? '晚安，小橙子。' : '睡醒啦！' }[kind]);
  };

  return (
    <main className="panel-shell">
      <header className="hero-card">
        <div className={`mini-orange stage-${state.growth.stage}`}><span>●</span><span>●</span><b>⌣</b></div>
        <div className="hero-copy"><p>{STAGE_NAMES[state.growth.stage]}阶段</p><h1>{state.pet.name}</h1><div className="level-row"><span>Lv.{state.growth.level}</span><span>🪙 {state.economy.coins}</span></div></div>
      </header>

      <nav className="tabs">
        {([['status', '状态'], ['actions', '互动'], ['shop', '装扮'], ['settings', '设置']] as const).map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </nav>

      <section className="panel-content">
        {tab === 'status' && <StatusTab state={state} cap={cap} nextXp={nextXp} efficiency={efficiency} />}
        {tab === 'actions' && <ActionsTab state={state} onAction={action} />}
        {tab === 'shop' && <ShopTab state={state} setState={setState} flash={flash} />}
        {tab === 'settings' && <SettingsTab state={state} setState={setState} flash={flash} />}
      </section>
      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}

function StatusBar({ label, icon, value, cap, color }: { label: string; icon: string; value: number; cap: number; color: string }) {
  const percent = Math.round(value / cap * 100);
  return <div className="stat-row"><div className="stat-label"><span>{icon} {label}</span><strong>{Math.round(value)}/{cap}</strong></div><div className="bar"><i style={{ width: `${percent}%`, background: color }} /></div></div>;
}

function StatusTab({ state, cap, nextXp, efficiency }: { state: SaveData; cap: number; nextXp: number; efficiency: number }) {
  const stats: [keyof PetStats, string, string, string][] = [
    ['satiety', '饱食度', '🍊', '#ff9b32'], ['mood', '心情', '💛', '#ffca3a'], ['energy', '精力', '⚡', '#61c0bf'], ['cleanliness', '清洁度', '✨', '#7a9cff'],
  ];
  return <div className="stack">
    <div className="card"><h2>今日状态</h2>{stats.map(([key, label, icon, color]) => <StatusBar key={key} label={label} icon={icon} value={state.pet.stats[key]} cap={cap} color={color} />)}</div>
    <div className="card growth-card"><div><small>成长经验</small><strong>{state.growth.level >= 20 ? '已满级' : `${state.growth.experience} / ${nextXp}`}</strong></div><div className="bar xp"><i style={{ width: state.growth.level >= 20 ? '100%' : `${state.growth.experience / nextXp * 100}%` }} /></div></div>
    <div className="info-grid"><div className="info-tile"><span>挂机效率</span><strong>{efficiency}%</strong></div><div className="info-tile"><span>下次结算</span><strong>{Math.max(1, Math.ceil((300000 - state.growth.rewardRemainderMs) / 60000))} 分钟</strong></div></div>
    <p className="tip">属性越好，挂机获得的金币越多。离线收益最多累计 8 小时。</p>
  </div>;
}

function ActionsTab({ state, onAction }: { state: SaveData; onAction: (action: PetAction) => void }) {
  const actions: { id: PetAction; icon: string; title: string; desc: string; disabled?: boolean }[] = [
    { id: 'feed', icon: '🥣', title: '喂食', desc: '饱食 +25 · 经验 +3 · 5 金币', disabled: state.economy.coins < 5 },
    { id: 'play', icon: '🧶', title: '玩耍', desc: '心情 +20 · 精力 -8 · 经验 +8', disabled: state.pet.stats.energy < 8 },
    { id: 'clean', icon: '🫧', title: '清洁', desc: '清洁 +30 · 经验 +4' },
    { id: 'sleep', icon: state.pet.behavior === 'sleeping' ? '🌞' : '🌙', title: state.pet.behavior === 'sleeping' ? '叫醒' : '睡觉', desc: state.pet.behavior === 'sleeping' ? '恢复清醒状态' : '每小时恢复 12 点精力' },
  ];
  return <div className="stack"><div className="action-grid">{actions.map((item) => <button key={item.id} className="action-card" disabled={item.disabled} onClick={() => onAction(item.id)}><span>{item.icon}</span><strong>{item.title}</strong><small>{item.desc}</small></button>)}</div><div className="card cozy-note"><b>温和养成</b><p>小橙子不会生病或离开。即使暂时没空照顾，回来陪陪它就会重新开心起来。</p></div></div>;
}

function ShopTab({ state, setState, flash }: { state: SaveData; setState: (s: SaveData) => void; flash: (m: string) => void }) {
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
    return <button className={`shop-card ${equipped ? 'equipped' : ''}`} key={item.id} disabled={locked} onClick={() => handleItem(item.id)}><span className="shop-icon">{item.icon}</span><strong>{item.name}</strong><small>{locked ? `Lv.${item.unlockLevel} 解锁` : equipped ? '使用中 · 点击卸下' : owned ? '已拥有 · 点击装备' : `🪙 ${item.price}`}</small></button>;
  })}</div>;
}

function SettingsTab({ state, setState, flash }: { state: SaveData; setState: (s: SaveData) => void; flash: (m: string) => void }) {
  const [name, setName] = useState(state.pet.name);
  const update = async (key: SettingKey, value: boolean | string) => { try { setState(await window.orangePet.setSetting(key, value)); flash('设置已保存。'); } catch (error) { flash(error instanceof Error ? error.message : '设置失败'); } };
  return <div className="stack">
    <div className="card"><label className="field-label">角色名称</label><div className="name-field"><input maxLength={12} value={name} onChange={(e) => setName(e.target.value)} /><button onClick={() => update('petName', name)}>保存</button></div></div>
    <div className="card settings-list">
      <Toggle label="自动散步" desc="在当前屏幕底部随机蹦跳" checked={state.settings.autoWalk} onChange={(v) => update('autoWalk', v)} />
      <Toggle label="始终置顶" desc="让小橙子保持在其他窗口上方" checked={state.settings.alwaysOnTop} onChange={(v) => update('alwaysOnTop', v)} />
      <Toggle label="开机启动" desc="登录 Windows 后自动出现" checked={state.settings.launchAtLogin} onChange={(v) => update('launchAtLogin', v)} />
    </div>
    <div className="card"><label className="field-label">动画强度</label><div className="segmented">{([['gentle','轻柔'],['normal','标准'],['lively','活泼']] as const).map(([id,label]) => <button key={id} className={state.settings.animationIntensity === id ? 'active' : ''} onClick={() => update('animationIntensity', id)}>{label}</button>)}</div></div>
    <button className="quit-button" onClick={() => window.orangePet.quitApp()}>完全退出小橙子</button>
  </div>;
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="toggle-row"><span><strong>{label}</strong><small>{desc}</small></span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i /></label>;
}
