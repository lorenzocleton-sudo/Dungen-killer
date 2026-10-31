// World clock. Advances ONLY while the player is in a hostile area (the
// dungeon). Every CONFIG.clock.phaseLength seconds of accumulated dungeon
// time flips the town between DAY and NIGHT.
import { CONFIG } from '../config.js';
import { events } from '../engine/events.js';

export class WorldClock {
  constructor(time = 0) {
    this.time = time;
    this.period = CONFIG.clock.phaseLength;
  }

  update(dt, running) {
    if (!running) return;
    const before = this.phase;
    this.time += dt;
    if (this.phase !== before) events.emit('phaseChanged', { phase: this.phase, time: this.time });
  }

  /** Phase for any accumulated time (0-5 min = day, 5-10 = night, ...). */
  static phaseAt(t, period = CONFIG.clock.phaseLength) {
    return Math.floor(t / period) % 2 === 0 ? 'day' : 'night';
  }

  get phase() { return WorldClock.phaseAt(this.time, this.period); }
  get untilFlip() { return this.period - (this.time % this.period); }
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
