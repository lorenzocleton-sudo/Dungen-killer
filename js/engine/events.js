// Tiny pub/sub bus so systems (loot, story, audio, ...) can hook in later
// without the core loop knowing about them.
export class EventBus {
  constructor() { this.handlers = new Map(); }
  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type).delete(fn);
  }
  emit(type, payload) {
    const h = this.handlers.get(type);
    if (h) for (const fn of [...h]) fn(payload);
  }
}

export const events = new EventBus();
