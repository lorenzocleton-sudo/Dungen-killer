// Player ownership state, split in two:
//   SAVED - everything owned before entering the portal (+ skill progression)
//   RUN   - everything gained during the current dungeon visit
// Dying wipes RUN (and unequips anything that came from it). Leaving through
// a portal alive merges RUN into SAVED. SAVED, equipment, progression, the
// stash and world progress persist in localStorage.
//
// SAVE VERSIONING: every save carries `version`. load() runs the migration
// chain v1 -> v2 -> v3 -> v4 -> ... so old saves keep working. Add a new
// migrate step (and bump SAVE_VERSION) whenever the format changes.
import { CONFIG } from '../config.js';
import { events } from '../engine/events.js';
import { newProgression, SKILL_MAP } from './skills.js';
import { ITEMS, defOf, touchItem } from './items.js';
import { newRenown } from './renown.js';

export const SAVE_VERSION = 4;
const STACK_KINDS = new Set(['consumable', 'material', 'gem', 'key', 'relic', 'cosmetic']);

export function emptyInventory() {
  return { currency: 0, items: [] }; // items: { uid, id, qty, g? }
}

const stackable = (id) => id !== 'gen' && ITEMS[id] && STACK_KINDS.has(ITEMS[id].kind);
const valid = (it) => it && (it.id === 'gen' ? !!(it.g && it.g.b) : !!ITEMS[it.id]);

export function newWorld() {
  return {
    deepest: 0, bosses: {}, homeChests: {}, kingGift: false, lore: {}, journal: [],
    conquered: {}, pitBest: {}, abyssBest: 0,
    restoration: 0, restoreParts: {}, killRestore: 0,
    cosmetics: { dye: null, cloak: null, portal: null }, festival: false,
  };
}

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
    this.pity = { sinceRare: 0, sinceLegendary: 0, sinceMythic: 0 };
    this.world = newWorld();
    this.stash = { tabs: [[], [], [], []], names: ['Stash I', 'Stash II', 'Stash III', 'Stash IV'] };
    this.ascension = { level: 0, points: 0, spent: {} };
    this.companions = { hired: {}, active: null, pet: null, pets: {} };
    this.skillbar = [null, null, null, null];
    this.quick = 'bomb';
    this.buyback = [];
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
      if (ex) { ex.qty += qty; events.emit('inventoryChanged', {}); return ex; }
    }
    const it = { uid: this.nextUid++, id, qty };
    inv.items.push(it);
    events.emit('inventoryChanged', {});
    return it;
  }

  /** Add a generated item (see itemgen.generateItem). */
  addGen(g, toSaved = false) {
    const inv = toSaved ? this.saved : this._inv();
    const it = { uid: this.nextUid++, id: 'gen', qty: 1, g };
    inv.items.push(it);
    events.emit('inventoryChanged', {});
    return it;
  }

  /** Locate an item instance. Returns { item, inv, run } or null. */
  find(uid) {
    if (uid == null) return null;
    for (const [inv, run] of [[this.saved, false], [this.run, true]]) {
      const item = inv.items.find((i) => i.uid === uid);
      if (item) return { item, inv, run };
    }
    return null;
  }

  def(uid) { const f = this.find(uid); return f ? defOf(f.item) : null; }

  isEquipped(uid) { return Object.values(this.equipped).includes(uid) || this.companionHas(uid); }

  companionHas(uid) {
    for (const c of Object.values(this.companions.hired || {})) for (const u of Object.values(c.gear || {})) if (u === uid) return true;
    return false;
  }

  removeItem(uid, qty = 1) {
    const f = this.find(uid);
    if (!f) return false;
    f.item.qty -= qty;
    if (f.item.qty <= 0) {
      f.inv.items.splice(f.inv.items.indexOf(f.item), 1);
      for (const [slot, u] of Object.entries(this.equipped)) if (u === uid) delete this.equipped[slot];
      for (const c of Object.values(this.companions.hired || {})) for (const [s, u] of Object.entries(c.gear || {})) if (u === uid) delete c.gear[s];
    }
    events.emit('inventoryChanged', {});
    return true;
  }

  /** All items, with a `run` flag for things not yet secured. */
  allItems() {
    return [...this.saved.items.map((i) => ({ ...i, run: false })), ...this.run.items.map((i) => ({ ...i, run: true }))];
  }

  count(id) {
    let n = 0;
    for (const i of this.saved.items) if (i.id === id) n += i.qty;
    for (const i of this.run.items) if (i.id === id) n += i.qty;
    return n;
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

  toggleLock(uid) {
    const f = this.find(uid);
    if (!f || f.item.id !== 'gen') return false;
    f.item.g.lk = f.item.g.lk ? 0 : 1;
    touchItem(f.item);
    events.emit('inventoryChanged', {});
    return true;
  }

  // -------------------------------------------------------- equipment
  equip(uid) {
    const f = this.find(uid);
    if (!f) return false;
    const def = defOf(f.item);
    if (!def || def.kind !== 'gear') return false;
    let slot = def.slot;
    if (slot === 'ring') slot = !this.equipped.ring1 || this.equipped.ring1 === uid ? 'ring1' : !this.equipped.ring2 ? 'ring2' : 'ring1';
    // one item can't sit in two slots
    for (const [s, u] of Object.entries(this.equipped)) if (u === uid) delete this.equipped[s];
    this.equipped[slot] = uid;
    if (f.item.g) { delete f.item.g.new; touchItem(f.item); }
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
      const d = f && defOf(f.item);
      if (d) out[slot] = { ...d, id: f.item.id, uid, run: f.run, item: f.item };
    }
    return out;
  }

  // -------------------------------------------------------- stash (town only, SAVED items)
  toStash(uid, tab = 0) {
    const f = this.find(uid);
    if (!f || f.run || this.isEquipped(uid)) return false;
    const t = this.stash.tabs[tab];
    if (!t || t.length >= 48) return false;
    f.inv.items.splice(f.inv.items.indexOf(f.item), 1);
    if (stackable(f.item.id)) { const ex = t.find((i) => i.id === f.item.id); if (ex) { ex.qty += f.item.qty; events.emit('inventoryChanged', {}); return true; } }
    t.push(f.item);
    events.emit('inventoryChanged', {});
    return true;
  }

  fromStash(uid, tab = 0) {
    const t = this.stash.tabs[tab];
    const i = t ? t.findIndex((x) => x.uid === uid) : -1;
    if (i < 0) return false;
    const [it] = t.splice(i, 1);
    if (stackable(it.id)) { const ex = this.saved.items.find((x) => x.id === it.id); if (ex) { ex.qty += it.qty; events.emit('inventoryChanged', {}); return true; } }
    this.saved.items.push(it);
    events.emit('inventoryChanged', {});
    return true;
  }

  // -------------------------------------------------------- skills (trainer only)
  learn(id, renownRank = 0, learnBlocker, rankOf) {
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
      // companions lose the RUN gear they were given
      for (const c of Object.values(this.companions.hired || {})) for (const [s, u] of Object.entries(c.gear || {})) if (u === it.uid) delete c.gear[s];
    }
    if (!this.equipped.weapon) {
      // fall back to the best weapon still owned, or a fresh rusted sword
      const w = this.saved.items.find((i) => defOf(i)?.slot === 'weapon') || this.addItemSaved('rusted_sword');
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
      version: SAVE_VERSION,
      saved: this.saved,
      renown: this.renown,
      pity: this.pity,
      world: this.world,
      equipped: this.equipped,
      nextUid: this.nextUid,
      progression: this.progression,
      clock: this.clockTime,
      stats: this.stats,
      stash: this.stash,
      ascension: this.ascension,
      companions: this.companions,
      skillbar: this.skillbar,
      quick: this.quick,
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
      let d = JSON.parse(raw);
      if (!d) return false;
      if (d.version === 1) { this._loadV1(d); d = JSON.parse(this.serialize()); d.version = 3; }
      if (!(d.version >= 2 && d.version <= SAVE_VERSION)) return false;
      d = migrate(d);
      this.renown = Object.assign(newRenown(), d.renown);
      this.pity = Object.assign({ sinceRare: 0, sinceLegendary: 0, sinceMythic: 0 }, d.pity);
      this.world = Object.assign(newWorld(), d.world);
      this.saved = { currency: d.saved.currency || 0, items: (d.saved.items || []).filter(valid) };
      this.equipped = d.equipped || {};
      this.nextUid = d.nextUid || 1000;
      this.progression = Object.assign(newProgression(), d.progression);
      this.stash = d.stash || this.stash;
      for (const t of this.stash.tabs) for (let i = t.length - 1; i >= 0; i--) if (!valid(t[i])) t.splice(i, 1);
      this.ascension = Object.assign({ level: 0, points: 0, spent: {} }, d.ascension);
      this.companions = Object.assign({ hired: {}, active: null, pet: null, pets: {} }, d.companions);
      this.skillbar = Array.isArray(d.skillbar) ? d.skillbar.slice(0, 4).concat([null, null, null, null]).slice(0, 4) : [null, null, null, null];
      this.quick = d.quick || 'bomb';
      // drop skills that no longer exist, refunding their points
      for (const id of Object.keys(this.progression.skills)) if (!SKILL_MAP[id]) { this.progression.skillPoints += this.progression.skills[id]; delete this.progression.skills[id]; }
      this.clockTime = +d.clock || 0;
      this.stats = Object.assign(this.stats, d.stats);
      for (const [slot, uid] of Object.entries(this.equipped)) if (!this.find(uid)) delete this.equipped[slot];
      if (!this.find(this.equipped.weapon)) this.equipped.weapon = this.addItemSaved('rusted_sword').uid;
      return true;
    } catch (e) { console.warn('save load failed', e); return false; }
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

/** Save migration chain. Each step takes a save object of version N and returns version N+1. */
const MIGRATIONS = {
  // v2 -> v3: renown, pity and world progress start fresh
  2: (d) => ({ ...d, version: 3, renown: d.renown || newRenown(), pity: d.pity || { sinceRare: 0, sinceLegendary: 0 }, world: d.world || newWorld() }),
  // v3 -> v4: 12 equipment slots (ring -> ring1), mythic pity, stash, ascension,
  //           companions, skill bar, world restoration + conquest records
  3: (d) => {
    const eq = { ...(d.equipped || {}) };
    if (eq.ring !== undefined) { eq.ring1 = eq.ring; delete eq.ring; }
    return {
      ...d, version: 4, equipped: eq,
      pity: { sinceRare: 0, sinceLegendary: 0, sinceMythic: 0, ...(d.pity || {}) },
      world: { ...newWorld(), ...(d.world || {}) },
      stash: d.stash || { tabs: [[], [], [], []], names: ['Stash I', 'Stash II', 'Stash III', 'Stash IV'] },
      ascension: d.ascension || { level: 0, points: 0, spent: {} },
      companions: d.companions || { hired: {}, active: null, pet: null, pets: {} },
      skillbar: d.skillbar || [null, null, null, null],
    };
  },
};

export function migrate(d) {
  while (d.version < SAVE_VERSION && MIGRATIONS[d.version]) d = MIGRATIONS[d.version](d);
  return d;
}
