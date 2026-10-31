// Player ownership state, split in two:
//   SAVED - everything owned before entering the portal (+ skill progression)
//   RUN   - everything gained during the current dungeon visit
// Dying wipes RUN. Leaving through a portal alive merges RUN into SAVED.
// SAVED, progression and the world clock persist in localStorage.
import { CONFIG } from '../config.js';
import { events } from '../engine/events.js';
import { newProgression } from './skills.js';

export function emptyInventory() {
  return {
    currency: 0,   // "ashes" - placeholder currency
    items: [],     // { id, name, kind, qty }
    gear: {},      // slot -> item (weapon, armor, ...); empty for now
  };
}

function mergeInto(dst, src) {
  dst.currency += src.currency;
  for (const it of src.items) {
    const ex = dst.items.find((d) => d.id === it.id && it.stackable !== false);
    if (ex) ex.qty += it.qty; else dst.items.push({ ...it });
  }
  for (const [slot, item] of Object.entries(src.gear)) dst.gear[slot] = item;
}

export class GameState {
  constructor() {
    this.saved = emptyInventory();
    this.run = emptyInventory();
    this.progression = newProgression();
    this.clockTime = 0;
    this.inRun = false;
    this.stats = { deaths: 0, kills: 0, runs: 0 };
  }

  /** Entering the dungeon: start an empty RUN. */
  startRun() {
    this.run = emptyInventory();
    this.inRun = true;
    this.stats.runs++;
    events.emit('runStarted', {});
  }

  /** Survived: everything from this run becomes permanent. */
  commitRun() {
    if (!this.inRun) return null;
    const summary = { currency: this.run.currency, items: this.run.items.length };
    mergeInto(this.saved, this.run);
    this.run = emptyInventory();
    this.inRun = false;
    events.emit('runCommitted', summary);
    return summary;
  }

  /** Died: RUN items and gear are lost; SAVED and progression stay. */
  loseRun() {
    const lost = { currency: this.run.currency, items: this.run.items.length };
    this.run = emptyInventory();
    this.inRun = false;
    this.stats.deaths++;
    events.emit('runLost', lost);
    return lost;
  }

  addGear(slot, item) { (this.inRun ? this.run : this.saved).gear[slot] = item; }
  addCurrency(n) { (this.inRun ? this.run : this.saved).currency += n; }
  addItem(item) {
    const inv = this.inRun ? this.run : this.saved;
    const ex = inv.items.find((d) => d.id === item.id);
    if (ex) ex.qty += item.qty || 1; else inv.items.push({ qty: 1, ...item });
  }

  // -------------------------------------------------------- persistence
  serialize() {
    return JSON.stringify({
      version: 1,
      saved: this.saved,
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
      if (!d || d.version !== 1) return false;
      this.saved = Object.assign(emptyInventory(), d.saved);
      this.progression = Object.assign(newProgression(), d.progression);
      this.clockTime = +d.clock || 0;
      this.stats = Object.assign(this.stats, d.stats);
      return true;
    } catch (e) { return false; }
  }

  static wipe() {
    try { localStorage.removeItem(CONFIG.saveKey); } catch (e) { /* ignore */ }
  }
}
