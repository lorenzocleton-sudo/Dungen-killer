// Player ownership state, split in two:
//   SAVED - everything owned before entering the portal (+ skill progression)
//   RUN   - everything gained during the current dungeon visit
// Dying wipes RUN (and unequips anything that came from it). Leaving through
// a portal alive merges RUN into SAVED. SAVED, equipment, progression and the
// world clock persist in localStorage.
import { CONFIG } from '../config.js';
import { events } from '../engine/events.js';
import { newProgression, SKILL_MAP, learnBlocker, rankOf } from './skills.js';
import { ITEMS } from './items.js';
import { newRenown } from './renown.js';

export function emptyInventory() {
  return { currency: 0, items: [] }; // items: { uid, id, qty }
}

const stackable = (id) => ITEMS[id] && ITEMS[id].kind !== 'gear';

export class GameState {
  constructor() {
    this.saved = emptyInventory();
    this.run = emptyInventory();
    this.equipped = {};           // slot -> uid
    this.progression = newProgression();
    this.clockTime = 0;
    this.inRun = false;
    this.nextUid = 1;
    this.stats = { deaths: 0, kills: 0, runs: 0 };
    this.renown = newRenown();
    this.pity = { sinceRare: 0, sinceLegendary: 0 };
    this.world = { deepest: 0, bosses: {}, homeChests: {}, kingGift: false, lore: {} };
    // starting kit
    const sword = this.addItem('rusted_sword');
    this.equipped.weapon = sword.uid;
    this.addItem('ashen_flask', 2);
  }

  // -------------------------------------------------------- items
  _inv() { return this.inRun ? this.run : this.saved; }

  addItem(id, qty = 1) {
    if (!ITEMS[id]) return null;
    const inv = this._inv();
    if (stackable(id)) {
      const ex = inv.items.find((i) => i.id === id);
      if (ex) { ex.qty += qty; return ex; }
    }
    const it = { uid: this.nextUid++, id, qty };
    inv.items.push(it);
    events.emit('inventoryChanged', {});
    return it;
  }

  /** Locate an item instance. Returns { item, inv, run } or null. */
  find(uid) {
    for (const [inv, run] of [[this.saved, false], [this.run, true]]) {
      const item = inv.items.find((i) => i.uid === uid);
      if (item) return { item, inv, run };
    }
    return null;
  }

  removeItem(uid, qty = 1) {
    const f = this.find(uid);
    if (!f) return false;
    f.item.qty -= qty;
    if (f.item.qty <= 0) {
      f.inv.items.splice(f.inv.items.indexOf(f.item), 1);
      for (const [slot, u] of Object.entries(this.equipped)) if (u === uid) delete this.equipped[slot];
    }
    events.emit('inventoryChanged', {});
    return true;
  }

  /** All items, with a `run` flag for things not yet secured. */
  allItems() {
    return [...this.saved.items.map((i) => ({ ...i, run: false })), ...this.run.items.map((i) => ({ ...i, run: true }))];
  }

  count(id) {
    return this.allItems().filter((i) => i.id === id).reduce((a, i) => a + i.qty, 0);
  }

  /** Use one of a consumable (RUN copies first - they'd be lost anyway). */
  consume(id) {
    const it = this.run.items.find((i) => i.id === id) || this.saved.items.find((i) => i.id === id);
    if (!it) return false;
    this.removeItem(it.uid, 1);
    return true;
  }

  get currency() { return this.saved.currency + this.run.currency; }
  addCurrency(n) {
    this._inv().currency += n;
    if (n > 0) events.emit('ashesEarned', { amount: n });
    events.emit('inventoryChanged', {});
  }
  spend(n) {
    if (this.saved.currency < n) return false;
    this.saved.currency -= n;
    events.emit('inventoryChanged', {});
    return true;
  }

  // -------------------------------------------------------- equipment
  equip(uid) {
    const f = this.find(uid);
    if (!f) return false;
    const def = ITEMS[f.item.id];
    if (!def || def.kind !== 'gear') return false;
    this.equipped[def.slot] = uid;
    events.emit('equipmentChanged', {});
    return true;
  }

  unequip(slot) {
    if (slot === 'weapon') return false; // always hold something
    delete this.equipped[slot];
    events.emit('equipmentChanged', {});
    return true;
  }

  equippedDefs() {
    const out = {};
    for (const [slot, uid] of Object.entries(this.equipped)) {
      const f = this.find(uid);
      if (f) out[slot] = { ...ITEMS[f.item.id], id: f.item.id, uid, run: f.run };
    }
    return out;
  }

  // -------------------------------------------------------- skills (trainer only)
  learn(id, renownRank = 0) {
    const node = SKILL_MAP[id];
    const why = learnBlocker(this.progression, node, this.saved.currency, renownRank);
    if (why) return why;
    this.progression.skillPoints -= node.points;
    this.saved.currency -= node.fee;
    this.progression.skills[id] = rankOf(this.progression, id) + 1;
    events.emit('equipmentChanged', {});
    events.emit('skillLearned', { id });
    return null;
  }

  // -------------------------------------------------------- runs
  startRun() {
    this.run = emptyInventory();
    this.inRun = true;
    this.stats.runs++;
    events.emit('runStarted', {});
  }

  commitRun() {
    if (!this.inRun) return null;
    const summary = { currency: this.run.currency, items: this.run.items.reduce((a, i) => a + i.qty, 0) };
    this.saved.currency += this.run.currency;
    for (const it of this.run.items) {
      const ex = stackable(it.id) && this.saved.items.find((i) => i.id === it.id);
      if (ex) {
        ex.qty += it.qty;
        for (const [slot, u] of Object.entries(this.equipped)) if (u === it.uid) this.equipped[slot] = ex.uid;
      } else this.saved.items.push(it);
    }
    this.run = emptyInventory();
    this.inRun = false;
    events.emit('runCommitted', summary);
    return summary;
  }

  loseRun() {
    const lost = { currency: this.run.currency, items: this.run.items.reduce((a, i) => a + i.qty, 0) };
    for (const it of this.run.items) {
      for (const [slot, u] of Object.entries(this.equipped)) if (u === it.uid) delete this.equipped[slot];
    }
    if (!this.equipped.weapon) {
      // fall back to the best weapon still owned, or a fresh rusted sword
      const w = this.saved.items.find((i) => ITEMS[i.id]?.slot === 'weapon') || this.addItemSaved('rusted_sword');
      this.equipped.weapon = w.uid;
    }
    this.run = emptyInventory();
    this.inRun = false;
    this.stats.deaths++;
    events.emit('runLost', lost);
    events.emit('equipmentChanged', {});
    return lost;
  }

  addItemSaved(id) {
    const was = this.inRun; this.inRun = false;
    const it = this.addItem(id); this.inRun = was;
    return it;
  }

  // -------------------------------------------------------- persistence
  serialize() {
    return JSON.stringify({
      version: 3,
      saved: this.saved,
      renown: this.renown,
      pity: this.pity,
      world: this.world,
      equipped: this.equipped,
      nextUid: this.nextUid,
      progression: this.progression,
      clock: this.clockTime,
      stats: this.stats,
      savedAt: Date.now(),
    });
  }

  save() {
    try { localStorage.setItem(CONFIG.saveKey, this.serialize()); return true; } catch (e) { return false; }
  }

  load() {
    try {
      const raw = localStorage.getItem(CONFIG.saveKey);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d) return false;
      if (d.version === 1) return this._loadV1(d);
      if (d.version !== 2 && d.version !== 3) return false;
      // v2 -> v3: renown, pity counters and world progress default to fresh
      if (d.version === 3) {
        this.renown = Object.assign(newRenown(), d.renown);
        this.pity = Object.assign({ sinceRare: 0, sinceLegendary: 0 }, d.pity);
        this.world = Object.assign(this.world, d.world);
      }
      this.saved = { currency: d.saved.currency || 0, items: (d.saved.items || []).filter((i) => ITEMS[i.id]) };
      this.equipped = d.equipped || {};
      this.nextUid = d.nextUid || 1000;
      this.progression = Object.assign(newProgression(), d.progression);
      // drop skills that no longer exist, refunding their points
      for (const id of Object.keys(this.progression.skills)) if (!SKILL_MAP[id]) { this.progression.skillPoints += this.progression.skills[id]; delete this.progression.skills[id]; }
      this.clockTime = +d.clock || 0;
      this.stats = Object.assign(this.stats, d.stats);
      if (!this.find(this.equipped.weapon)) this.equipped.weapon = this.addItemSaved('rusted_sword').uid;
      return true;
    } catch (e) { return false; }
  }

  _loadV1(d) {
    // demo v1 saves: plain item lists + gear map + "unlocked" skills
    this.saved = { currency: d.saved?.currency || 0, items: [] };
    this.clockTime = +d.clock || 0;
    this.stats = Object.assign(this.stats, d.stats);
    const lvl = d.progression?.level || 1;
    this.progression = { ...newProgression(), level: lvl, xp: d.progression?.xp || 0, skillPoints: lvl };
    this.equipped = {};
    this.equipped.weapon = this.addItemSaved('rusted_sword').uid;
    this.addItemSaved('ashen_flask'); this.addItemSaved('ashen_flask');
    for (const it of d.saved?.items || []) if (ITEMS[it.id]) for (let i = 0; i < (it.qty || 1); i++) this.addItemSaved(it.id);
    const rename = { hollow_helm: 'dented_helm' };
    for (const g of Object.values(d.saved?.gear || {})) { const id = rename[g.id] || g.id; if (ITEMS[id]) this.addItemSaved(id); }
    return true;
  }

  static wipe() {
    try { localStorage.removeItem(CONFIG.saveKey); } catch (e) { /* ignore */ }
  }
}
