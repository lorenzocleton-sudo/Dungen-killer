// HUD: HP bar, dungeon clock, area banner, prompts, loot feed, device hints
// and floating damage numbers.
import * as THREE from '../../lib/three.module.min.js';
import { fmtTime } from '../systems/clock.js';

const $ = (id) => document.getElementById(id);

const HINTS = {
  kbm: 'WASD move  ·  Mouse look  ·  Click / Space hit  ·  Esc menu',
  touch: 'Left thumb: move  ·  Swipe right side: look  ·  HIT to strike',
  gamepad: 'L-stick move  ·  R-stick look  ·  A / RT hit  ·  Start menu',
};

export class HUD {
  constructor() {
    this.el = {
      hpFill: $('hp-fill'), hpLag: $('hp-lag'), run: $('run-info'),
      phase: $('clock-phase'), time: $('clock-time'),
      banner: $('banner'), bTitle: $('banner-title'), bSub: $('banner-sub'),
      prompt: $('prompt'), feed: $('feed'), hints: $('hints'), dmg: $('dmg-layer'),
      death: $('death'), deathSub: document.querySelector('#death .death-sub'),
      fade: $('fade'),
    };
    this.numbers = [];
    this._v = new THREE.Vector3();
    this.hintTimer = 0;
    this._lastHp = -1;
  }

  setDevice(device) {
    document.body.classList.toggle('touch', device === 'touch');
    document.body.classList.toggle('gamepad', device === 'gamepad');
    this.el.hints.textContent = HINTS[device] || '';
    this.el.hints.style.opacity = 1;
    this.hintTimer = 12;
  }

  setHp(hp, max) {
    if (hp === this._lastHp) return;
    const pct = Math.max(0, hp / max) * 100 + '%';
    this.el.hpFill.style.width = pct;
    this.el.hpLag.style.width = pct;
    this._lastHp = hp;
  }

  setClock(clock, inDungeon) {
    const phase = clock.phase;
    const icon = phase === 'day' ? '☀' : '☾';
    this.el.phase.textContent = inDungeon
      ? `Town: ${phase.toUpperCase()} ${icon}`
      : `${phase === 'day' ? 'Day' : 'Night'} ${icon}`;
    this.el.time.textContent = inDungeon
      ? `Dungeon ${fmtTime(clock.time)}  ·  flips in ${fmtTime(clock.untilFlip)}`
      : `Time stands still  ·  ${fmtTime(clock.time)}`;
  }

  setRunInfo(text) { if (this.el.run.textContent !== text) this.el.run.textContent = text; }

  banner(title, sub = '') {
    this.el.bTitle.textContent = title;
    this.el.bSub.textContent = sub;
    this.el.banner.classList.add('show');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => this.el.banner.classList.remove('show'), 2800);
  }

  prompt(text) {
    if (text) { this.el.prompt.textContent = text; this.el.prompt.classList.add('show'); }
    else this.el.prompt.classList.remove('show');
  }

  feed(text, color) {
    const d = document.createElement('div');
    d.textContent = text;
    if (color) d.style.color = color;
    this.el.feed.appendChild(d);
    setTimeout(() => { d.style.opacity = 0; }, 3000);
    setTimeout(() => d.remove(), 4200);
    while (this.el.feed.children.length > 6) this.el.feed.firstChild.remove();
  }

  showDeath(show, sub = '') {
    this.el.death.classList.toggle('show', show);
    this.el.deathSub.textContent = sub;
  }

  fade(on) { this.el.fade.classList.toggle('on', on); }

  /** Floating damage number anchored to a world position. */
  damageNumber(pos, amount, kind = '') {
    const d = document.createElement('div');
    d.className = 'dmg ' + kind;
    d.textContent = Math.round(amount);
    this.el.dmg.appendChild(d);
    this.numbers.push({ el: d, pos: pos.clone(), t: 0, dx: (Math.random() - 0.5) * 0.6 });
  }

  update(dt, camera) {
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.el.hints.style.opacity = 0.35;
    }
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.t += dt;
      if (n.t > 1.1) { n.el.remove(); this.numbers.splice(i, 1); continue; }
      this._v.copy(n.pos); this._v.y += n.t * 0.9; this._v.x += n.dx * n.t;
      this._v.project(camera);
      if (this._v.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = '';
      n.el.style.left = ((this._v.x + 1) / 2) * w + 'px';
      n.el.style.top = ((1 - this._v.y) / 2) * h + 'px';
      n.el.style.opacity = Math.min(1, (1.1 - n.t) * 3);
    }
  }
}
