// Lore Journal: every note the Wanderer finds is saved once (SAVED state -
// lore, like skill, is memory, and the Hearth keeps memory).
import { NOTES, NOTE_MAP } from '../../data/lore.js';
import { events } from '../engine/events.js';

export class Journal {
  constructor(game) { this.game = game; }

  get found() {
    const w = this.game.state.world;
    if (!Array.isArray(w.journal)) w.journal = [];
    return w.journal;
  }

  has(id) { return this.found.includes(id); }

  /** Record + show a note. */
  add(id) {
    const n = NOTE_MAP[id];
    if (!n) return null;
    const isNew = !this.has(id);
    if (isNew) {
      this.found.push(id);
      this.game.hud.feed(`Lore found: ${n.title}  (${this.found.length}/${NOTES.length})`, '#c8b0e0');
      events.emit('loreFound', { id });
      this.game.state.save();
    }
    this.game.hud.speak(`${n.title}: "${n.text}"`, 8);
    return n;
  }

  /** An unread note for a place tag (falls back to 'any', then to an old one). */
  pickFor(...tags) {
    for (const t of tags) {
      const unread = NOTES.filter((n) => n.where === t && !this.has(n.id));
      if (unread.length) return unread[Math.floor(Math.random() * unread.length)];
    }
    const unreadAny = NOTES.filter((n) => n.where === 'any' && !this.has(n.id));
    if (unreadAny.length) return unreadAny[0];
    const old = NOTES.filter((n) => tags.includes(n.where));
    return old.length ? old[Math.floor(Math.random() * old.length)] : null;
  }

  readFor(...tags) { const n = this.pickFor(...tags); return n ? this.add(n.id) : null; }
}
