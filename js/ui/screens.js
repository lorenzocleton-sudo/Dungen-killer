// Full-screen panels: INVENTORY (own button), SHOP (Ashen Market) and
// TRAINER (Hall of Paths, the only place skills can be learned).
// All rendered as HTML; mouse/touch click, gamepad/arrow keys via SpatialNav.
import { ITEMS, SLOTS, SLOT_NAMES, SHOP_STOCK, sellPrice, statLine, RARITY } from '../systems/items.js';
import { SKILLS, SKILL_MAP, BRANCHES, rankOf, learnBlocker, isOpen, xpForLevel, TREE_W, TREE_H } from '../systems/skills.js';
import { RANKS } from '../systems/renown.js';
import { NOTES, NOTE_MAP, ITEM_LORE, RANK_EPITHET } from '../../data/lore.js';
import { statRows } from '../systems/stats.js';
import { SpatialNav } from './nav.js';
import { dangerFor, recommendedLevel } from '../systems/progression.js';
import { STORY_LEVELS } from '../entities/enemyTypes.js';
import { BIOMES, bandFor } from '../world/biomes.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TITLES = { inventory: 'Inventory', shop: 'The Ashen Market', trainer: 'Hall of Paths', levels: 'The Waystone \u2014 choose your depth', pit: 'The Proving Pit' };
const TABS = {
  inventory: [['items', 'Items'], ['status', 'Renown'], ['tree', 'Skill Tree'], ['journal', 'Lore Journal']],
  shop: [['buy', 'Buy'], ['sell', 'Sell']],
  trainer: [['tree', 'Skill Tree']],
  levels: [['levels', 'Levels']],
  pit: [['pit', 'Tiers']],
};

export class Screens {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('panel');
    this.nav = new SpatialNav(this.root);
    this.open = false;
    this.mode = null;
    this.tab = null;
    this.sel = null;       // selected item uid / stock id / skill id
    this.msg = '';
    this.root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      this.act(el.dataset.act, el.dataset);
    });
    this.root.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  }

  show(mode, tab) {
    this.mode = mode;
    this.tab = tab || TABS[mode][0][0];
    this.sel = null;
    this.msg = '';
    this.open = true;
    this.root.classList.remove('hidden');
    this.render();
    if (this.game.input.device !== 'touch') this.nav.ensure();
  }

  hide() {
    this.open = false;
    this.root.classList.add('hidden');
    this.nav.clear();
  }

  // ------------------------------------------------------------ actions
  act(a, d) {
    const st = this.game.state;
    switch (a) {
      case 'close': this.game.closeScreen(); return;
      case 'tab': this.tab = d.tab; this.sel = null; this.msg = ''; break;
      case 'sel': this.sel = +d.uid; this.msg = ''; break;
      case 'slot': { const uid = st.equipped[d.slot]; this.sel = uid ?? null; if (!uid) this.msg = `Nothing equipped in ${SLOT_NAMES[d.slot]}.`; break; }
      case 'equip': st.equip(+d.uid); this.msg = 'Equipped.'; break;
      case 'unequip': if (!st.unequip(d.slot)) this.msg = 'You need a weapon in hand.'; else this.msg = 'Removed.'; break;
      case 'use': this.game.combat.drinkFlask(); break;
      case 'stock': this.sel = d.id; this.msg = ''; break;
      case 'buy': {
        const def = ITEMS[d.id];
        if (!st.spend(this.price(d.id))) { this.msg = 'Not enough ashes.'; break; }
        st.addItem(d.id, 1); st.save();
        this.msg = `Bought ${def.name}.`;
        break;
      }
      case 'sell': {
        const f = st.find(+d.uid);
        if (!f) break;
        if (Object.values(st.equipped).includes(f.item.uid)) { this.msg = 'Unequip it first.'; break; }
        const price = sellPrice(f.item.id);
        st.removeItem(f.item.uid, 1);
        st.addCurrency(price); st.save();
        this.msg = `Sold for ${price} ashes.`;
        if (!st.find(+d.uid)) this.sel = null;
        break;
      }
      case 'sellall': {
        let total = 0;
        for (const it of [...st.saved.items]) {
          const def = ITEMS[it.id];
          if (def.kind !== 'material' && def.kind !== 'relic') continue;
          total += sellPrice(it.id) * it.qty;
          st.removeItem(it.uid, it.qty);
        }
        st.addCurrency(total); st.save();
        this.msg = total ? `Sold all loot for ${total} ashes.` : 'No loot to sell.';
        this.sel = null;
        break;
      }
      case 'node': this.sel = d.id; this.msg = ''; break;
      case 'enter': { const L = +d.level; this.game.closeScreen(); this.game.enterDungeonLevel(L, false, d.cq === '1'); return; }
      case 'pittier': { const T = +d.tier; this.game.closeScreen(); this.game.enterPit(T); return; }
      case 'zoom': this.zoom = Math.max(0.45, Math.min(1.6, (this.zoom || 0.7) * (d.z === 'in' ? 1.2 : 1 / 1.2))); break;
      case 'learn': {
        const why = st.learn(d.id, this.game.renown.rankIndex);
        this.msg = why || `Learned ${SKILL_MAP[d.id].name}.`;
        if (!why) st.save();
        break;
      }
    }
    const focusKey = this.nav.current && (this.nav.current.dataset.key);
    this.render();
    if (focusKey) {
      const el = this.root.querySelector(`[data-key="${focusKey}"]`);
      if (el) this.nav.focus(el, false);
    }
    if (this.game.input.device !== 'touch') this.nav.ensure();
  }

  handleInput(input) {
    if (input.consume('cancel') || input.consume('nav_back')) {
      this.game.closeScreen();
      return;
    }
    if (input.consume('inventory') || input.consume('menu')) { this.game.closeScreen(); return; }
    const tabs = TABS[this.mode];
    const ti = tabs.findIndex((t) => t[0] === this.tab);
    if (input.consume('tab_next') && tabs.length > 1) this.act('tab', { tab: tabs[(ti + 1) % tabs.length][0] });
    if (input.consume('tab_prev') && tabs.length > 1) this.act('tab', { tab: tabs[(ti + tabs.length - 1) % tabs.length][0] });
    this.nav.handle(input);
  }

  // ------------------------------------------------------------ rendering
  render() {
    const tv = this.root.querySelector('#tree-view');
    const prevScroll = tv && this._treeTab === this.tab + this.mode ? [tv.scrollLeft, tv.scrollTop] : null;
    this._treeTab = this.tab + this.mode;
    this._render();
    this.afterRender(prevScroll);
  }

  _render() {
    const g = this.game, st = g.state, p = st.progression;
    const tabs = TABS[this.mode].map(([id, label]) =>
      `<button class="tab focusable ${id === this.tab ? 'active' : ''}" data-act="tab" data-tab="${id}" data-key="tab-${id}">${label}</button>`).join('');
    const xpPct = Math.round((p.xp / xpForLevel(p.level)) * 100);
    const head = `
      <div class="pn-head">
        <div class="pn-title">${TITLES[this.mode]}</div>
        <div class="pn-money"><b>${st.saved.currency}</b> ashes${st.inRun ? ` <span class="run">+${st.run.currency} unsecured</span>` : ''}</div>
        <div class="pn-level">Lv ${p.level} <span class="xpbar"><span style="width:${xpPct}%"></span></span> ${p.skillPoints} skill pt${p.skillPoints === 1 ? '' : 's'}</div>
        <button class="pn-close focusable" data-act="close" data-key="close">✕</button>
      </div>
      <div class="pn-tabs">${tabs}</div>`;
    let body = '';
    if (this.tab === 'items') body = this.renderItems();
    else if (this.tab === 'tree') body = this.renderTree(this.mode === 'trainer');
    else if (this.tab === 'status') body = this.renderStatus();
    else if (this.tab === 'journal') body = this.renderJournal();
    else if (this.tab === 'levels') body = this.renderLevels();
    else if (this.tab === 'pit') body = this.renderPit();
    else if (this.tab === 'buy') body = this.renderBuy();
    else if (this.tab === 'sell') body = this.renderSell();
    this.root.innerHTML = `<div class="pn-box mode-${this.mode}">${head}<div class="pn-body">${body}</div>
      <div class="pn-msg">${esc(this.msg)}</div>
      <div class="pn-hint">${this.hint()}</div></div>`;
    this.nav.current = null;
  }

  hint() {
    const d = this.game.input.device;
    if (d === 'gamepad') return 'D-pad move · A select · RB/LT switch tab · B close';
    if (d === 'kbm') return 'Click or arrows + Enter · I / Esc close';
    return 'Tap to select · ✕ to close';
  }

  itemCell(it, opts = {}) {
    const def = ITEMS[it.id];
    const eq = Object.values(this.game.state.equipped).includes(it.uid);
    return `<button class="cell focusable ${this.sel === it.uid ? 'sel' : ''} ${it.run ? 'runitem' : ''} ${eq ? 'eq' : ''}" style="${def.rarity ? `box-shadow: inset 0 0 0 2px ${RARITY[def.rarity].color}` : ''}"
      data-act="${opts.act || 'sel'}" data-uid="${it.uid}" data-key="i${it.uid}" title="${esc(def.name)}">
      <span class="glyph" style="color:${def.icon[1]}">${def.icon[0]}</span>
      ${it.qty > 1 ? `<span class="qty">${it.qty}</span>` : ''}${eq ? '<span class="eqm">E</span>' : ''}</button>`;
  }

  renderItems() {
    const st = this.game.state;
    const eq = st.equippedDefs();
    const slots = SLOTS.map((s) => {
      const e = eq[s];
      return `<button class="slot focusable ${e && this.sel === e.uid ? 'sel' : ''}" data-act="slot" data-slot="${s}" data-key="slot-${s}">
        <span class="slot-name">${SLOT_NAMES[s]}</span>
        <span class="slot-item">${e ? `<span style="color:${e.icon[1]}">${e.icon[0]}</span> ${esc(e.name)}${e.run ? ' <span class="run">*</span>' : ''}` : '<i>empty</i>'}</span></button>`;
    }).join('');
    const stats = statRows(this.game.player.stats).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    const items = st.allItems();
    const grid = items.length ? items.map((it) => this.itemCell(it)).join('') : '<div class="empty">Your pack is empty.</div>';
    return `<div class="inv-layout">
      <div class="inv-left"><div class="slots">${slots}</div><div class="stats">${stats}</div></div>
      <div class="inv-right"><div class="grid">${grid}</div>
        <div class="legend"><span class="runbox"></span> warm loot \u2014 unbound until carried through a portal alive</div>
        ${this.itemDetail()}</div>
    </div>`;
  }

  itemDetail(shop) {
    const st = this.game.state;
    if (this.sel == null) return '<div class="detail muted">Select an item.</div>';
    const f = st.find(this.sel);
    if (!f) return '<div class="detail muted">Select an item.</div>';
    const def = ITEMS[f.item.id];
    const eqSlot = Object.entries(st.equipped).find(([, u]) => u === f.item.uid)?.[0];
    const btns = [];
    if (shop) {
      btns.push(`<button class="focusable" data-act="sell" data-uid="${f.item.uid}" data-key="sell-${f.item.uid}">Sell for ${sellPrice(f.item.id)}</button>`);
    } else {
      if (def.kind === 'gear' && !eqSlot) btns.push(`<button class="focusable" data-act="equip" data-uid="${f.item.uid}" data-key="equip">Equip</button>`);
      if (eqSlot && eqSlot !== 'weapon') btns.push(`<button class="focusable" data-act="unequip" data-slot="${eqSlot}" data-key="unequip">Unequip</button>`);
      if (def.kind === 'consumable') btns.push(`<button class="focusable" data-act="use" data-key="use">Drink</button>`);
    }
    return `<div class="detail">
      <div class="d-name" style="${def.rarity ? `color:${RARITY[def.rarity].color}` : ''}"><span style="color:${def.icon[1]}">${def.icon[0]}</span> ${esc(def.name)} ${f.item.qty > 1 ? '×' + f.item.qty : ''}
        ${f.run ? '<span class="run">(unsecured)</span>' : ''}${eqSlot ? ' <span class="eqtag">equipped</span>' : ''}</div>
      <div class="d-kind">${def.rarity ? `<span style="color:${RARITY[def.rarity].color}">${RARITY[def.rarity].name}</span> · ` : ''}${def.kind === 'gear' ? SLOT_NAMES[def.slot] : def.kind[0].toUpperCase() + def.kind.slice(1)} · worth ${sellPrice(f.item.id)} ashes</div>
      ${def.stats && Object.keys(def.stats).length ? `<div class="d-stats">${statLine(def.stats)}</div>` : ''}
      <div class="d-desc">${esc(def.desc || '')}</div>
      ${ITEM_LORE[f.item.id] ? `<div class="d-lore">${esc(ITEM_LORE[f.item.id])}</div>` : ''}
      <div class="d-btns">${btns.join('')}</div></div>`;
  }

  renderBuy() {
    const st = this.game.state;
    const rk = this.game.renown.rankIndex;
    const disc = this.game.renown.discount;
    const stock = SHOP_STOCK.filter((id) => (ITEMS[id].minRank || 0) <= rk);
    const locked = SHOP_STOCK.filter((id) => (ITEMS[id].minRank || 0) > rk);
    const rows = stock.map((id) => {
      const def = ITEMS[id];
      const owned = st.count(id);
      const afford = st.saved.currency >= this.price(id);
      return `<button class="row-item focusable ${this.sel === id ? 'sel' : ''} ${afford ? '' : 'poor'}" data-act="stock" data-id="${id}" data-key="s-${id}">
        <span class="glyph" style="color:${def.icon[1]}">${def.icon[0]}</span>
        <span class="ri-name">${esc(def.name)}${owned ? ` <small>(own ${owned})</small>` : ''}<small>${def.stats ? statLine(def.stats) : esc(def.desc)}</small></span>
        <span class="ri-price">${this.price(id)}</span></button>`;
    }).join('') + (locked.length ? `<div class="locked-stock">${locked.length} finer wares are kept behind the counter for those of greater renown (next: ${RANKS[Math.min(...locked.map((id) => ITEMS[id].minRank))].title}).</div>` : '')
      + (disc ? `<div class="locked-stock">Your renown earns a ${disc}% discount.</div>` : '');
    let detail = '<div class="detail muted">The merchant watches you in silence. Choose something.</div>';
    if (this.sel && ITEMS[this.sel]) {
      const def = ITEMS[this.sel];
      detail = `<div class="detail"><div class="d-name"><span style="color:${def.icon[1]}">${def.icon[0]}</span> ${esc(def.name)}</div>
        <div class="d-kind">${def.kind === 'gear' ? SLOT_NAMES[def.slot] : def.kind[0].toUpperCase() + def.kind.slice(1)}</div>
        ${def.stats ? `<div class="d-stats">${statLine(def.stats)}</div>` : ''}
        <div class="d-desc">${esc(def.desc || '')}</div>
        <div class="d-btns"><button class="focusable" data-act="buy" data-id="${this.sel}" data-key="buy">Buy for ${this.price(this.sel)} ashes</button></div></div>`;
    }
    return `<div class="shop-layout"><div class="rows">${rows}</div>${detail}</div>`;
  }

  renderSell() {
    const st = this.game.state;
    const items = st.saved.items.map((i) => ({ ...i, run: false }));
    const grid = items.length ? items.map((it) => this.itemCell(it)).join('') : '<div class="empty">Nothing to sell.</div>';
    return `<div class="shop-layout"><div>
      <div class="grid">${grid}</div>
      <button class="focusable sellall" data-act="sellall" data-key="sellall">Sell all loot (materials & relics)</button></div>
      ${this.itemDetail(true)}</div>`;
  }

  price(id) { return Math.max(1, Math.round(ITEMS[id].value * (1 - this.game.renown.discount / 100))); }

  renderStatus() {
    const r = this.game.renown.info();
    const parts = r.parts.map(([k, v, note]) => `<div><span>${k} <small>${note}</small></span><b>+${v}</b></div>`).join('');
    const ladder = RANKS.map((rk, i) => `<div class="ladder-step ${i <= r.index ? 'got' : ''} ${i === r.index ? 'cur' : ''}"><b>${rk.title}</b><span>${rk.min}</span></div>`).join('');
    const perks = [
      `Shop discount: ${this.game.renown.discount}%`,
      `Keystone skills: ${r.index >= 4 ? 'all' : r.index >= 3 ? 'tier II' : r.index >= 2 ? 'tier I' : 'locked (needs Slayer)'}`,
      `Castle: ${r.index >= 5 ? 'the King\'s private errands' : r.index >= 4 ? 'throne room + audience with the King' : r.index >= 3 ? 'great hall' : r.index >= 1 ? 'courtyard' : 'gates closed (needs Wanderer)'}`,
    ];
    return `<div class="status-layout">
      <div class="status-main">
        <div class="rank-title">${r.rank.title}</div>
        <div class="small">In Emberwick they call you "${RANK_EPITHET[r.index]}".</div>
        <div class="rank-score">${r.score} renown${r.next ? ` · ${r.next.min - r.score} to ${r.next.title}` : ' · highest rank'}</div>
        <div class="rank-bar"><span style="width:${Math.round(r.progress * 100)}%"></span></div>
        <div class="stats rank-parts">${parts}</div>
        <div class="small">Renown never falls, even in death. Gear does not count — only deeds.</div>
      </div>
      <div class="status-side"><div class="ladder">${ladder}</div><ul class="perks">${perks.map((p) => `<li>${p}</li>`).join('')}</ul></div>
    </div>`;
  }

  renderLevels() {
    const g = this.game, w = g.state.world, conq = w.conquered || {};
    const plv = g.state.progression.level;
    const row = (L, label) => {
      const dz = dangerFor(L, g), rec = recommendedLevel(L);
      const story = STORY_LEVELS[L];
      const band = BIOMES[bandFor(L)];
      const crown = conq[L] ? '<span class="crown" title="Conquered">\u265B</span>' : '';
      return `<div class="lv-row"><span class="lv-dot" style="color:${dz.color}" title="${dz.label}">${dz.icon}</span>
        <span class="lv-name">${crown}${label || 'Level ' + L} <small>${esc(bandFor(L) === 'crypt' ? 'The Catacombs' : band.title)}${story ? ' \u00B7 ' + esc(g.enemyName(story)) : ''}</small></span>
        <span class="lv-rec">rec. Lv ${rec}${plv < rec - 8 ? ' \u2620' : ''}</span>
        <button class="focusable" data-act="enter" data-level="${L}" data-cq="0" data-key="lv${L}">Enter</button>
        <button class="focusable cq" data-act="enter" data-level="${L}" data-cq="1" data-key="cq${L}" title="+150% HP/damage, more elites, traps, no shrines; kill everything">Conquest</button></div>`;
    };
    const rows = g.startableLevels().map((L) => row(L)).join('');
    const abyss = (w.abyssBest || 0) > 30 || conq[30] ? row(31, 'The Abyss (depth 31)') : '';
    return `<div class="levels">
      <div class="small">Difficulty never changes per level: early levels grow easy to farm, deep ones outscale you until you level and gear up.
        Your power: Lv ${plv}${g.state.ascension && g.state.ascension.level ? ' \u00B7 Ascension ' + g.state.ascension.level : ''}. Deepest: ${w.deepest || 0}${w.abyssBest ? ' \u00B7 Abyss best ' + w.abyssBest : ''}.
        Conquer a level (kill every enemy in Conquest) to start at the next one.</div>
      <div class="lv-legend"><span style="color:#70c060">\u25CF safe</span> <span style="color:#e0c050">\u25CF fair</span> <span style="color:#e05040">\u25CF dangerous</span> <span>\u2620 deadly</span> \u00B7 \u265B conquered</div>
      ${rows}${abyss}</div>`;
  }

  renderPit() {
    const g = this.game, w = g.state.world, best = w.pitBest || {};
    const max = Math.max(1, w.deepest || 1);
    const tiers = [];
    for (let t = 1; t <= max; t++) tiers.push(t);
    const rows = tiers.reverse().map((t) => {
      const dz = dangerFor(t, g);
      return `<div class="lv-row"><span class="lv-dot" style="color:${dz.color}">${dz.icon}</span>
        <span class="lv-name">Tier ${t} <small>enemies of level ${t}+ \u00B7 loot item level ${t}+</small></span>
        <span class="lv-rec">best wave: ${best[t] || '-'}</span>
        <button class="focusable" data-act="pittier" data-tier="${t}" data-key="pt${t}">Fight</button></div>`;
    }).join('');
    return `<div class="levels"><div class="small">Waves grow harder; every 5th is elite, every 10th brings a guardian. Between waves you may leave and keep the loot. Death loses it. Tiers unlock with your deepest main-dungeon level.</div>${rows}</div>`;
  }

  renderJournal() {
    const found = this.game.journal.found;
    if (!found.length) return '<div class="empty">No notes yet. Search bookshelves, chests and the remains of those who went before.</div>';
    const items = found.map((id) => NOTE_MAP[id]).filter(Boolean).map((n) => `<div class="note"><div class="note-title">${esc(n.title)}</div><div class="note-text">\u201C${esc(n.text)}\u201D</div></div>`).join('');
    return `<div class="journal"><div class="small">${found.length} of ${NOTES.length} fragments found</div>${items}</div>`;
  }

  renderTree(canLearn) {
    const st = this.game.state, prog = st.progression;
    const ren = this.game.renown;
    if (!this.zoom) this.zoom = Math.min(1, Math.max(0.5, (Math.min(window.innerWidth * 0.62, 900)) / 1000));
    const z = this.zoom, W = 1000, H = 1600;
    const lines = [];
    for (const n of SKILLS) for (const r of n.requires) {
      const a = SKILL_MAP[r];
      const lit = rankOf(prog, r) > 0 && rankOf(prog, n.id) > 0;
      const open = rankOf(prog, r) > 0;
      lines.push(`<line x1="${a.x * 10}" y1="${a.y * 10}" x2="${n.x * 10}" y2="${n.y * 10}" class="${lit ? 'lit' : open ? 'open' : ''}" style="${lit ? `stroke:${BRANCHES[n.branch].color}` : ''}"/>`);
    }
    const nodes = SKILLS.map((n) => {
      const r = rankOf(prog, n.id);
      const state = r >= n.max ? 'max' : r > 0 ? 'part' : isOpen(prog, n) ? 'avail' : 'locked';
      const pips = n.max > 1 ? `<span class="pips">${'◆'.repeat(r)}${'◇'.repeat(n.max - r)}</span>` : '';
      const lock = n.rank && ren.rankIndex < n.rank ? '<span class="klock">♕</span>' : '';
      return `<button class="node focusable ${state} ${n.keystone ? 'cap' : ''} ${n.branch === 'hybrid' ? 'hyb' : ''} ${this.sel === n.id ? 'sel' : ''}" style="left:${n.x * 10}px;top:${n.y * 10}px;--c:${BRANCHES[n.branch].color}"
        data-act="node" data-id="${n.id}" data-key="n-${n.id}">${lock}<span class="nn">${esc(n.name)}</span>${pips}</button>`;
    }).join('');
    const labels = [['iron', 180], ['ash', 500], ['shadow', 820]].map(([b, x]) =>
      `<div class="branch-label" style="left:${x}px;top:20px;color:${BRANCHES[b].color}">${BRANCHES[b].name}</div>`).join('')
      + `<div class="branch-label" style="left:500px;top:1555px;color:${BRANCHES.hybrid.color}">◆ crossroads nodes join two paths ◆</div>`;
    let detail = `<div class="detail muted">${canLearn ? 'The old master waits. Choose a path.' : 'Skills can only be learned at the Hall of Paths, in town.'}</div>`;
    if (this.sel && SKILL_MAP[this.sel]) {
      const n = SKILL_MAP[this.sel];
      const r = rankOf(prog, n.id);
      const why = learnBlocker(prog, n, st.saved.currency, ren.rankIndex, (i) => RANKS[i].title);
      let btn = '';
      if (canLearn) {
        btn = why ? `<div class="blocker">${esc(why)}</div>`
          : `<button class="focusable" data-act="learn" data-id="${n.id}" data-key="learn">Learn (${n.points} pt${n.points > 1 ? 's' : ''}${n.fee ? `, ${n.fee} ashes` : ''})</button>`;
      } else if (r < n.max) btn = '<div class="blocker">Visit the Hall of Paths in town to learn this.</div>';
      detail = `<div class="detail"><div class="d-name" style="color:${BRANCHES[n.branch].color}">${esc(n.name)} ${n.max > 1 ? `<small>rank ${r}/${n.max}</small>` : r ? '<small>learned</small>' : ''}</div>
        <div class="d-kind">${BRANCHES[n.branch].name}${n.keystone ? ` · keystone (renown: ${RANKS[n.rank].title})` : ''} · cost ${n.points} pt${n.points > 1 ? 's' : ''}${n.fee ? ` + ${n.fee} ashes` : ''}</div>
        <div class="d-desc">${esc(n.desc)}</div><div class="d-btns">${btn}</div></div>`;
    }
    return `<div class="tree-layout">
      <div class="tree-view" id="tree-view">
        <div class="tree-zoom"><button class="focusable" data-act="zoom" data-z="out" data-key="zout">−</button><button class="focusable" data-act="zoom" data-z="in" data-key="zin">+</button></div>
        <div class="tree-sizer" style="width:${W * z}px;height:${H * z}px">
          <div class="tree" style="width:${W}px;height:${H}px;transform:scale(${z})">
            <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${lines.join('')}</svg>${labels}${nodes}</div></div></div>
      ${detail}</div>`;
  }

  /** Keep the tree scrolled to the root on first open, preserve scroll after. */
  afterRender(prevScroll) {
    const v = this.root.querySelector('#tree-view');
    if (!v) return;
    if (prevScroll) { v.scrollLeft = prevScroll[0]; v.scrollTop = prevScroll[1]; }
    else { v.scrollTop = v.scrollHeight; v.scrollLeft = (v.scrollWidth - v.clientWidth) / 2; }
    // pinch / ctrl+wheel zoom
    v.onwheel = (e) => { if (!e.ctrlKey) return; e.preventDefault(); this.act('zoom', { z: e.deltaY < 0 ? 'in' : 'out' }); };
    let pinch = null;
    v.ontouchstart = (e) => { if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); };
    v.ontouchmove = (e) => {
      if (e.touches.length !== 2 || !pinch) return;
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (Math.abs(d - pinch) > 40) { this.act('zoom', { z: d > pinch ? 'in' : 'out' }); pinch = d; }
    };
  }
}
