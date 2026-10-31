// Pause menu: Settings / Inventory / Skills tabs. Works with mouse, touch,
// keyboard arrows and gamepad d-pad (focus navigation).

const $ = (id) => document.getElementById(id);

export class Menu {
  constructor(game) {
    this.game = game;
    this.root = $('menu');
    this.open = false;
    this.tab = 'settings';
    this.focusIndex = 0;

    for (const t of this.root.querySelectorAll('.tab')) t.addEventListener('click', () => this.showTab(t.dataset.tab));
    const sens = $('opt-sens'), inv = $('opt-invert');
    sens.addEventListener('input', () => game.setSetting('sensitivity', +sens.value));
    inv.addEventListener('change', () => game.setSetting('invertY', inv.checked));
    $('opt-day').addEventListener('change', () => game.setSetting('alwaysDay', $('opt-day').checked));
    $('opt-minimap').addEventListener('change', () => game.setSetting('minimap', $('opt-minimap').checked));
    $('opt-bob').addEventListener('change', () => game.setSetting('headBob', $('opt-bob').checked));
    $('opt-gfx').addEventListener('change', () => game.setSetting('gfx', $('opt-gfx').value));
    $('btn-resume').addEventListener('click', () => game.closeMenu());
    $('btn-fullscreen').addEventListener('click', () => game.toggleFullscreen());
    $('btn-admin').addEventListener('click', () => game.openAdmin());
    $('btn-reset').addEventListener('click', () => {
      if (this._confirmReset) { game.resetSave(); this._confirmReset = false; $('btn-reset').textContent = 'Reset save'; return; }
      this._confirmReset = true; $('btn-reset').textContent = 'Tap again to confirm';
      setTimeout(() => { this._confirmReset = false; $('btn-reset').textContent = 'Reset save'; }, 3000);
    });
    // keep touch events inside the menu from reaching the game
    this.root.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  }

  syncSettings(s) {
    $('opt-sens').value = s.sensitivity;
    $('sens-val').textContent = (+s.sensitivity).toFixed(1);
    $('opt-invert').checked = s.invertY;
    $('opt-day').checked = !!s.alwaysDay;
    $('opt-minimap').checked = s.minimap !== false;
    $('opt-bob').checked = s.headBob !== false;
    $('opt-gfx').value = s.gfx || 'med';
  }

  show(device) {
    this.open = true;
    this.root.classList.remove('hidden');
    this.showTab(this.tab);
    $('menu-hint').textContent = device === 'gamepad'
      ? 'D-pad: navigate · Left/Right: change · A: select · B/Start: resume'
      : device === 'kbm' ? 'Esc: resume · Arrows + Enter also work' : '';
    this.focusIndex = 0;
    this._applyFocus(device === 'gamepad' || device === 'kbm');
  }

  hide() {
    this.open = false;
    this.root.classList.add('hidden');
  }

  showTab(tab) {
    this.tab = tab;
    for (const t of this.root.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === tab);
    for (const s of this.root.querySelectorAll('section')) s.classList.toggle('active', s.dataset.page === tab);
  }

  _focusables() {
    return [...this.root.querySelectorAll('.focusable')].filter((e) => e.offsetParent !== null);
  }

  _applyFocus(visible) {
    const f = this._focusables();
    for (const e of f) e.classList.remove('focused');
    if (!visible || !f.length) return;
    this.focusIndex = (this.focusIndex + f.length) % f.length;
    f[this.focusIndex].classList.add('focused');
  }

  /** Called every frame while open with the input manager. */
  handleInput(input) {
    let moved = false;
    if (input.consume('nav_down')) { this.focusIndex++; moved = true; }
    if (input.consume('nav_up')) { this.focusIndex--; moved = true; }
    const f = this._focusables();
    const cur = f[(this.focusIndex % f.length + f.length) % f.length];
    const adjust = (dir) => {
      if (!cur) return;
      if (cur.type === 'range') {
        cur.value = Math.min(+cur.max, Math.max(+cur.min, +cur.value + dir * +cur.step));
        cur.dispatchEvent(new Event('input'));
      } else if (cur.classList.contains('tab')) {
        const tabs = [...this.root.querySelectorAll('.tab')];
        const i = tabs.indexOf(cur) + dir;
        if (tabs[i]) { this.focusIndex = f.indexOf(tabs[i]); tabs[i].click(); }
      }
      moved = true;
    };
    if (input.consume('nav_left')) adjust(-1);
    if (input.consume('nav_right')) adjust(1);
    if (input.consume('nav_ok') && cur) {
      if (cur.type === 'checkbox') { cur.checked = !cur.checked; cur.dispatchEvent(new Event('change')); }
      else if (cur.type !== 'range') cur.click();
      moved = true;
    }
    if (input.consume('nav_back')) { this.game.closeMenu(); return; }
    if (moved) this._applyFocus(true);
  }
}
