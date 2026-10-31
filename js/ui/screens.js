// Full-screen panels: INVENTORY (own button), SHOP (Ashen Market) and
// TRAINER (Hall of Paths, the only place skills can be learned).
// All rendered as HTML; mouse/touch click, gamepad/arrow keys via SpatialNav.
import { ITEMS, SLOTS, SLOT_NAMES, SHOP_STOCK, sellPrice, statLine } from '../systems/items.js';
import { SKILLS, SKILL_MAP, BRANCHES, rankOf, learnBlocker, isOpen, xpForLevel } from '../systems/skills.js';
import { statRows } from '../systems/stats.js';
import { SpatialNav } from './nav.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TITLES = { inventory: 'Inventory', shop: 'The Ashen Market', trainer: 'Hall of Paths' };
const TABS = {
  inventory: [['items', 'Items'], ['tree', 'Skill Tree']],
  shop: [['buy', 'Buy'], ['sell', 'Sell']],
  trainer: [['tree', 'Skill Tree']],
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
        if (!st.spend(def.value)) { this.msg = 'Not enough ashes.'; break; }
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
      case 'learn': {
        const why = st.learn(d.id);
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
    return `<button class="cell focusable ${this.sel === it.uid ? 'sel' : ''} ${it.run ? 'runitem' : ''} ${eq ? 'eq' : ''}"
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
        <div class="legend"><span class="runbox"></span> found this run — lost if you die</div>
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
      <div class="d-name"><span style="color:${def.icon[1]}">${def.icon[0]}</span> ${esc(def.name)} ${f.item.qty > 1 ? '×' + f.item.qty : ''}
        ${f.run ? '<span class="run">(unsecured)</span>' : ''}${eqSlot ? ' <span class="eqtag">equipped</span>' : ''}</div>
      <div class="d-kind">${def.kind === 'gear' ? SLOT_NAMES[def.slot] : def.kind} · worth ${sellPrice(f.item.id)} ashes</div>
      ${def.stats && Object.keys(def.stats).length ? `<div class="d-stats">${statLine(def.stats)}</div>` : ''}
      <div class="d-desc">${esc(def.desc || '')}</div>
      <div class="d-btns">${btns.join('')}</div></div>`;
  }

  renderBuy() {
    const st = this.game.state;
    const rows = SHOP_STOCK.map((id) => {
      const def = ITEMS[id];
      const owned = st.count(id);
      const afford = st.saved.currency >= def.value;
      return `<button class="row-item focusable ${this.sel === id ? 'sel' : ''} ${afford ? '' : 'poor'}" data-act="stock" data-id="${id}" data-key="s-${id}">
        <span class="glyph" style="color:${def.icon[1]}">${def.icon[0]}</span>
        <span class="ri-name">${esc(def.name)}${owned ? ` <small>(own ${owned})</small>` : ''}<small>${def.stats ? statLine(def.stats) : esc(def.desc)}</small></span>
        <span class="ri-price">${def.value}</span></button>`;
    }).join('');
    let detail = '<div class="detail muted">The merchant watches you in silence. Choose something.</div>';
    if (this.sel && ITEMS[this.sel]) {
      const def = ITEMS[this.sel];
      detail = `<div class="detail"><div class="d-name"><span style="color:${def.icon[1]}">${def.icon[0]}</span> ${esc(def.name)}</div>
        <div class="d-kind">${def.kind === 'gear' ? SLOT_NAMES[def.slot] : def.kind[0].toUpperCase() + def.kind.slice(1)}</div>
        ${def.stats ? `<div class="d-stats">${statLine(def.stats)}</div>` : ''}
        <div class="d-desc">${esc(def.desc || '')}</div>
        <div class="d-btns"><button class="focusable" data-act="buy" data-id="${this.sel}" data-key="buy">Buy for ${def.value} ashes</button></div></div>`;
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

  renderTree(canLearn) {
    const st = this.game.state, prog = st.progression;
    const lines = [];
    for (const n of SKILLS) for (const r of n.requires) {
      const a = SKILL_MAP[r];
      const lit = rankOf(prog, r) > 0 && rankOf(prog, n.id) > 0;
      const open = rankOf(prog, r) > 0;
      lines.push(`<line x1="${a.x}" y1="${a.y}" x2="${n.x}" y2="${n.y}" class="${lit ? 'lit' : open ? 'open' : ''}" style="${lit ? `stroke:${BRANCHES[n.branch].color}` : ''}"/>`);
    }
    const nodes = SKILLS.map((n) => {
      const r = rankOf(prog, n.id);
      const state = r >= n.max ? 'max' : r > 0 ? 'part' : isOpen(prog, n) ? 'avail' : 'locked';
      const pips = n.max > 1 ? `<span class="pips">${'◆'.repeat(r)}${'◇'.repeat(n.max - r)}</span>` : '';
      return `<button class="node focusable ${state} ${n.capstone ? 'cap' : ''} ${this.sel === n.id ? 'sel' : ''}" style="left:${n.x}%;top:${n.y}%;--c:${BRANCHES[n.branch].color}"
        data-act="node" data-id="${n.id}" data-key="n-${n.id}"><span class="nn">${esc(n.name)}</span>${pips}</button>`;
    }).join('');
    const labels = ['iron', 'ash', 'shadow'].map((b, i) =>
      `<div class="branch-label" style="left:${[20, 50, 80][i]}%;color:${BRANCHES[b].color}">${BRANCHES[b].name}</div>`).join('');
    let detail = `<div class="detail muted">${canLearn ? 'The old master waits. Choose a path.' : 'Skills can only be learned at the Hall of Paths, in town.'}</div>`;
    if (this.sel && SKILL_MAP[this.sel]) {
      const n = SKILL_MAP[this.sel];
      const r = rankOf(prog, n.id);
      const why = learnBlocker(prog, n, st.saved.currency);
      let btn = '';
      if (canLearn) {
        btn = why ? `<div class="blocker">${esc(why)}</div>`
          : `<button class="focusable" data-act="learn" data-id="${n.id}" data-key="learn">Learn (${n.points} pt${n.points > 1 ? 's' : ''}${n.fee ? `, ${n.fee} ashes` : ''})</button>`;
      } else if (r < n.max) btn = '<div class="blocker">Visit the Hall of Paths in town to learn this.</div>';
      detail = `<div class="detail"><div class="d-name" style="color:${BRANCHES[n.branch].color}">${esc(n.name)} ${n.max > 1 ? `<small>rank ${r}/${n.max}</small>` : r ? '<small>learned</small>' : ''}</div>
        <div class="d-kind">${BRANCHES[n.branch].name}${n.capstone ? ' · capstone' : ''} · cost ${n.points} pt${n.points > 1 ? 's' : ''}${n.fee ? ` + ${n.fee} ashes` : ''}</div>
        <div class="d-desc">${esc(n.desc)}</div><div class="d-btns">${btn}</div></div>`;
    }
    return `<div class="tree-layout"><div class="tree">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines.join('')}</svg>${labels}${nodes}</div>${detail}</div>`;
  }
}
