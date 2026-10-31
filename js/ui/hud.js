// HUD: HP bar, dungeon clock, area banner, prompts, loot feed, device hints
// and floating damage numbers.
import * as THREE from '../../lib/three.module.min.js';
import { fmtTime } from '../systems/clock.js';

const $ = (id) => document.getElementById(id);

const HINTS = {
  kbm: 'WASD move · Space jump · Shift dash · Click hit · Right-click block · 1-4 skills · E use · R flask · G item · I inventory · M map · L levels · Esc menu',
  touch: 'Left thumb: move · Swipe right: look · HIT strike · JUMP · DASH · BLOCK · skills beside HIT · \u25C8 inventory',
  gamepad: 'L-stick move · R-stick look · A jump · X/RT hit · B dash · LT block · D-pad skills · Y use · LB flask · RB item · Back inventory',
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

  setClock(clock, inDungeon, shownPhase) {
    const phase = shownPhase || clock.phase;
    const icon = phase === 'day' ? '☀' : '☾';
    this.el.phase.textContent = inDungeon
      ? `Town: ${phase.toUpperCase()} ${icon}`
      : `${phase === 'day' ? 'Day' : 'Night'} ${icon}`;
    this.el.time.textContent = inDungeon
      ? `Dungeon ${fmtTime(clock.time)}  ·  flips in ${fmtTime(clock.untilFlip)}`
      : `Time stands still  ·  ${fmtTime(clock.time)}`;
  }

  setStamina(v, max, exhausted) {
    const el = this._st || (this._st = document.getElementById('st-fill'));
    el.style.width = Math.max(0, v / max) * 100 + '%';
    el.parentElement.style.width = `min(${(max / 100) * 26}vw, ${max * 2}px)`;
    el.classList.toggle('tired', !!exhausted);
  }

  setMana(v, max) {
    const el = this._mp || (this._mp = document.getElementById('mp-fill'));
    const w = Math.max(0, v / max) * 100;
    if (Math.abs(w - (this._mpw || -1)) > 0.5) { el.style.width = w + '%'; this._mpw = w; }
  }

  setDash(n, max, cdK) {
    const key = n + '/' + max;
    if (key === this._dk) return;
    this._dk = key;
    const el = document.getElementById('dash-pips');
    el.innerHTML = Array.from({ length: Math.min(max, 6) }, (_, i) => `<i class="${i < n ? '' : 'empty'}"></i>`).join('');
  }

  /** Skill bar: slots [{icon, color, cd (0..1), ready, mana}] */
  setSkills(slots) {
    for (let i = 0; i < 4; i++) {
      const el = this._sk ? this._sk[i] : null;
      if (!this._sk) this._sk = [1, 2, 3, 4].map((k) => document.getElementById('btn-sk' + k));
      const s = slots[i], b = this._sk[i];
      const key = s ? `${s.icon}|${Math.round(s.cd * 20)}|${s.mana}` : '-';
      if (b._key === key) continue;
      b._key = key;
      b.classList.toggle('empty', !s);
      b.classList.toggle('nomana', !!(s && !s.mana));
      b.querySelector('.sk-ic').textContent = s ? s.icon : '';
      b.querySelector('.sk-ic').style.color = s ? s.color : '';
      b.querySelector('.sk-cd').style.height = s ? Math.round(s.cd * 100) + '%' : '0';
      b.title = s ? s.name : '';
      void el;
    }
  }

  flashStamina() {
    const el = document.getElementById('st-bar');
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  /** NPC speech line, bottom centre. */
  speak(text, secs = 4.5) {
    const el = document.getElementById('speech');
    el.textContent = text; el.classList.add('show');
    clearTimeout(this._sp); this._sp = setTimeout(() => el.classList.remove('show'), secs * 1000);
  }

  /** Boss / mini-boss health bar (top centre). */
  setBoss(e) {
    const el = this._boss || (this._boss = document.getElementById('boss-bar'));
    if (!e) { if (this._bossOn) { el.classList.remove('show'); this._bossOn = false; } return; }
    if (!this._bossOn) { el.classList.add('show'); this._bossOn = true; }
    el.querySelector('.bb-name').textContent = e.name + (e.brain && e.brain.phase === 2 ? '  \u2022 enraged' : '');
    el.querySelector('.bb-fill').style.width = Math.max(0, e.hp / e.maxHp) * 100 + '%';
  }

  setSprint(on) { document.getElementById('sprint-ind').classList.toggle('show', on); }

  /** Context prompt; on touch the USE button doubles as the action. */
  interactPrompt(text, device) {
    const btn = document.getElementById('btn-use');
    btn.classList.toggle('show', !!text);
    if (text) btn.textContent = text.replace(/^\[[^\]]*\]\s*/, '');
    const key = device === 'gamepad' ? '[Y] ' : device === 'kbm' ? '[E] ' : '';
    this.prompt(text ? key + text : '');
  }

  /** Proving Pit status line (+ "Leave now" button during breaks). */
  pit(text, leave, onLeave) {
    const el = document.getElementById('pit-hud');
    if (!text) { el.classList.remove('show'); this._pitKey = null; return; }
    el.classList.add('show');
    const key = text + (leave ? '|L' : '');
    if (key === this._pitKey) return;
    this._pitKey = key;
    el.innerHTML = `<div>${text}</div>` + (leave && this._pitWave !== false ? `<button id="pit-leave">Leave now (keep loot) <small>[E]</small></button>` : '');
    const b = document.getElementById('pit-leave');
    if (b) { const go = (e) => { e.preventDefault(); e.stopPropagation(); onLeave && onLeave(); }; b.addEventListener('click', go); b.addEventListener('touchstart', go, { passive: false }); }
  }

  /** Conquest kill counter. */
  conquest(c) {
    const el = document.getElementById('conquest-ctr');
    if (!c) { el.classList.remove('show'); return; }
    el.classList.add('show');
    const t = c.done ? '\u265B CONQUERED' : `CONQUEST \u2014 ${c.killed} / ${c.total} slain`;
    if (el.textContent !== t) el.textContent = t;
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

  fade(on, tip) {
    this.el.fade.classList.toggle('on', on);
    if (tip !== undefined) this.el.fade.textContent = tip || '';
  }

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
