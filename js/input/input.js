// Unified input: keyboard+mouse (pointer lock), touch (virtual joystick +
// swipe look + HIT button) and Gamepad API. All sources feed the same
// per-frame values, and the most recently used one becomes `device`
// (used by the HUD to show matching hints / touch controls).
import { CONFIG } from '../config.js';

const DEAD = 0.18;

function deadzone(x, y) {
  const m = Math.hypot(x, y);
  if (m < DEAD) return [0, 0];
  const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
  return [x * k, y * k];
}

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.settings = { sensitivity: 1, invertY: false };
    this.enabled = true;          // gameplay input (false while menus are open)
    this.keys = new Set();
    this.actions = new Set();     // one-shot actions consumed by the game
    this.mouseDX = 0; this.mouseDY = 0;
    this.touchLookDX = 0; this.touchLookDY = 0;
    this.joy = null;              // { id, ox, oy, x, y }
    this.lookTouch = null;        // { id, x, y }
    this.padPrev = [];
    this.padIndex = -1;
    this.onDeviceChange = null;
    this.pointerLocked = false;
    this.sprint = false;
    this.sprintToggle = false;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.device = ('ontouchstart' in window && coarse) ? 'touch' : 'kbm';

    this._bindKeyboard();
    this._bindMouse();
    this._bindTouch();
    window.addEventListener('gamepadconnected', (e) => { this.padIndex = e.gamepad.index; this._setDevice('gamepad'); });
    window.addEventListener('gamepaddisconnected', () => { this.padIndex = -1; });
  }

  _setDevice(d) {
    if (this.device === d) return;
    this.device = d;
    if (this.onDeviceChange) this.onDeviceChange(d);
  }

  /** One-shot action check (hit, menu, interact, nav_up, ...). */
  consume(action) {
    if (this.actions.has(action)) { this.actions.delete(action); return true; }
    return false;
  }
  trigger(action) { this.actions.add(action); }

  // ------------------------------------------------------------ keyboard
  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this._setDevice('kbm');
      this.keys.add(e.code);
      switch (e.code) {
        case 'KeyF': case 'KeyJ': this.trigger('hit'); break;
        case 'Space': this.trigger('roll'); break;
        case 'Escape': case 'KeyP': this.trigger('menu'); e.preventDefault(); break;
        case 'F1': this.trigger('admin'); e.preventDefault(); break;
        case 'KeyM': this.trigger('map'); break;
        case 'KeyI': case 'Tab': case 'KeyB': this.trigger('inventory'); e.preventDefault(); break;
        case 'KeyE': this.trigger('interact'); break;
        case 'KeyR': this.trigger('flask'); break;
        case 'KeyW': case 'KeyZ': {
          // double-tap W = sprint until W is released
          const now = performance.now();
          if (now - (this._lastW || 0) < 320) this.wSprint = true;
          this._lastW = now;
          break;
        }
        case 'ArrowUp': this.trigger('nav_up'); break;
        case 'ArrowDown': this.trigger('nav_down'); break;
        case 'ArrowLeft': this.trigger('nav_left'); break;
        case 'ArrowRight': this.trigger('nav_right'); break;
        case 'Enter': this.trigger('nav_ok'); break;
      }
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyW' || e.code === 'KeyZ') this.wSprint = false;
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  // ------------------------------------------------------------ mouse
  _bindMouse() {
    const c = this.canvas;
    document.addEventListener('pointerlockchange', () => {
      const was = this.pointerLocked;
      this.pointerLocked = document.pointerLockElement === c;
      if (was && !this.pointerLocked && this.enabled) this.trigger('menu'); // Esc released the lock
    });
    c.addEventListener('mousedown', (e) => {
      if (this._touchRecent()) return;
      this._setDevice('kbm');
      if (!this.pointerLocked) { this.requestLock(); return; }
      if (e.button === 0) this.trigger('hit');
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this._setDevice('kbm');
    });
  }

  requestLock() {
    if (this.device === 'touch' || !this.canvas.requestPointerLock) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignored: not allowed without gesture */ }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _touchRecent() { return performance.now() - (this._lastTouch || -1e9) < 800; }

  // ------------------------------------------------------------ touch
  _bindTouch() {
    const layer = document.getElementById('touch-layer');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    this.joyEls = { base, knob };
    const R = () => Math.min(70, window.innerHeight * 0.12);

    const start = (e) => {
      this._lastTouch = performance.now();
      this._setDevice('touch');
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && !this.joy) {
          this.joy = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0 };
          this._drawJoy();
        } else if (!this.lookTouch) {
          this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
    };
    const move = (e) => {
      this._lastTouch = performance.now();
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) {
          let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy;
          const r = R(), m = Math.hypot(dx, dy);
          if (m > r) { // drag the base along so the stick never "runs out"
            this.joy.ox += (dx / m) * (m - r); this.joy.oy += (dy / m) * (m - r);
            dx = t.clientX - this.joy.ox; dy = t.clientY - this.joy.oy;
          }
          this.joy.x = dx / r; this.joy.y = dy / r;
          this._drawJoy();
        } else if (this.lookTouch && t.identifier === this.lookTouch.id) {
          this.touchLookDX += t.clientX - this.lookTouch.x;
          this.touchLookDY += t.clientY - this.lookTouch.y;
          this.lookTouch.x = t.clientX; this.lookTouch.y = t.clientY;
        }
      }
    };
    const end = (e) => {
      this._lastTouch = performance.now();
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) { this.joy = null; this._drawJoy(); }
        if (this.lookTouch && t.identifier === this.lookTouch.id) this.lookTouch = null;
      }
    };
    layer.addEventListener('touchstart', start, { passive: false });
    layer.addEventListener('touchmove', move, { passive: false });
    layer.addEventListener('touchend', end);
    layer.addEventListener('touchcancel', end);

    const bindBtn = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        this._lastTouch = performance.now();
        this._setDevice('touch');
        el.classList.add('pressed');
        this.trigger(action);
      }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); el.classList.remove('pressed'); });
      el.addEventListener('mousedown', (e) => { e.stopPropagation(); this.trigger(action); });
    };
    bindBtn('btn-hit', 'hit');
    bindBtn('btn-menu', 'menu');
    bindBtn('btn-bag', 'inventory');
    bindBtn('btn-use', 'interact');
    bindBtn('btn-flask', 'flask');
    bindBtn('btn-run', 'sprint_toggle');
    bindBtn('btn-roll', 'roll');
  }

  _drawJoy() {
    const { base, knob } = this.joyEls;
    if (!this.joy) { base.style.display = knob.style.display = 'none'; return; }
    const r = Math.min(70, window.innerHeight * 0.12);
    base.style.display = knob.style.display = 'block';
    base.style.left = this.joy.ox + 'px'; base.style.top = this.joy.oy + 'px';
    base.style.width = base.style.height = r * 2 + 'px';
    const m = Math.min(1, Math.hypot(this.joy.x, this.joy.y)) / (Math.hypot(this.joy.x, this.joy.y) || 1);
    knob.style.left = this.joy.ox + this.joy.x * m * r + 'px';
    knob.style.top = this.joy.oy + this.joy.y * m * r + 'px';
  }

  resetTouch() {
    this.joy = null; this.lookTouch = null; this._drawJoy();
  }

  // ------------------------------------------------------------ gamepad
  _pollGamepad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = pads && this.padIndex >= 0 ? pads[this.padIndex] : null;
    if (!pad && pads) for (const p of pads) if (p && p.connected) { pad = p; this.padIndex = p.index; break; }
    if (!pad) return { mx: 0, my: 0, lx: 0, ly: 0 };
    const b = (i) => !!(pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5));
    const edge = (i) => b(i) && !this.padPrev[i];
    const [mx, my] = deadzone(pad.axes[0] || 0, pad.axes[1] || 0);
    let [lx, ly] = deadzone(pad.axes[2] || 0, pad.axes[3] || 0);
    let any = Math.abs(mx) + Math.abs(my) + Math.abs(lx) + Math.abs(ly) > 0;
    if (edge(0) || edge(2) || edge(5) || edge(7)) this.trigger('hit');
    if (edge(9)) this.trigger(b(4) && b(5) ? 'admin' : 'menu');   // LB+RB+Start = admin
    if (edge(8)) this.trigger('inventory');
    if (edge(3)) this.trigger('interact');
    if (edge(4)) this.trigger('flask');
    if (edge(10)) this.trigger('sprint_toggle');   // L3 click toggles sprint
    if (edge(6)) this.trigger('tab_prev');
    if (edge(5) || edge(7)) this.trigger('tab_next');
    if (edge(1)) { this.trigger('nav_back'); this.trigger('cancel'); this.trigger('roll'); }
    if (edge(0)) this.trigger('nav_ok');
    if (edge(12)) this.trigger('nav_up');
    if (edge(13)) this.trigger('nav_down');
    if (edge(14)) this.trigger('nav_left');
    if (edge(15)) this.trigger('nav_right');
    // stick-as-dpad for menus
    const sy = pad.axes[1] || 0, sx = pad.axes[0] || 0;
    const st = Math.abs(sy) > 0.6 ? (sy > 0 ? 'd' : 'u') : Math.abs(sx) > 0.6 ? (sx > 0 ? 'r' : 'l') : '';
    if (st && st !== this._stickPrev) this.trigger({ u: 'nav_up', d: 'nav_down', l: 'nav_left', r: 'nav_right' }[st]);
    this._stickPrev = st;
    for (let i = 0; i < pad.buttons.length; i++) { if (b(i) && !this.padPrev[i]) any = true; this.padPrev[i] = b(i); }
    if (any) this._setDevice('gamepad');
    // response curve on look for fine aiming
    const lm = Math.hypot(lx, ly);
    if (lm > 0) { const k = Math.pow(lm, 1.6) / lm; lx *= k; ly *= k; }
    return { mx, my, lx, ly };
  }

  update(dt) {
    const gp = this._pollGamepad(dt);
    const sens = this.settings.sensitivity;
    const inv = this.settings.invertY ? -1 : 1;

    let mx = 0, my = 0;
    if (this.keys.has('KeyW') || this.keys.has('KeyZ')) my += 1;
    if (this.keys.has('KeyS')) my -= 1;
    if (this.keys.has('KeyD')) mx += 1;
    if (this.keys.has('KeyA') || this.keys.has('KeyQ')) mx -= 1;
    if (this.joy) { mx += this.joy.x; my -= this.joy.y; }
    mx += gp.mx; my -= gp.my;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    this.move.x = mx; this.move.y = my;

    const tScale = 6.0 / Math.max(400, window.innerWidth);
    this.look.x = (this.mouseDX * CONFIG.look.mouse + this.touchLookDX * tScale + gp.lx * CONFIG.look.gamepad * dt) * sens;
    this.look.y = (this.mouseDY * CONFIG.look.mouse + this.touchLookDY * tScale + gp.ly * CONFIG.look.gamepad * dt) * sens * inv;
    this.mouseDX = this.mouseDY = this.touchLookDX = this.touchLookDY = 0;

    // sprint: Shift held, double-tap W, or the gamepad/touch toggle
    if (this.actions.has('sprint_toggle')) { this.actions.delete('sprint_toggle'); this.sprintToggle = !this.sprintToggle; }
    this.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || !!this.wSprint || !!this.sprintToggle;
    const runBtn = document.getElementById('btn-run');
    if (runBtn) runBtn.classList.toggle('on', !!this.sprintToggle);

    if (!this.enabled) { this.move.x = this.move.y = 0; this.look.x = this.look.y = 0; }
  }

  /** Clear queued gameplay actions (e.g. when closing a menu). */
  flush() {
    this.actions.clear();
  }
}
