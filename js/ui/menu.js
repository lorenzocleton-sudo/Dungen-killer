// Pause menu: Settings / Inventory / Skills tabs. Works with mouse, touch,
// keyboard arrows and gamepad d-pad (focus navigation).
import { SKILL_TREE, xpForLevel } from '../systems/skills.js';

const $ = (id) => document.getElementById(id);

export class Menu {
  constructor(game) {
    this.game = game;
    this.root = $('menu');
    this.open = false;
    this.tab = 'settings';
    this.focusIndex = 0;

    for (const t of this.root.querySelectorAll('.tab')) t.addEventListener('click', () => this.showTab(t.dataset.tab));
    const sens = $('opt-sens'), inv = $('opt-invert'), ps1 = $('opt-ps1');
    sens.addEventListener('input', () => game.setSetting('sensitivity', +sens.value));
    inv.addEventListener('change', () => game.setSetting('invertY', inv.checked));
    ps1.addEventListener('change', () => game.setSetting('ps1', ps1.checked));
    $('btn-resume').addEventListener('click', () => game.closeMenu());
    $('btn-fullscreen').addEventListener('click', () => game.toggleFullscreen());
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
    $('opt-ps1').checked = s.ps1;
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
    if (tab === 'inventory') this.renderInventory();
    if (tab === 'skills') this.renderSkills();
  }

  renderInventory() {
    const st = this.game.state;
    const list = (inv) => inv.items.length
      ? '<ul>' + inv.items.map((i) => `<li>${i.name}${i.qty > 1 ? ' ×' + i.qty : ''}</li>`).join('') + '</ul>'
      : '<div class="empty">Nothing.</div>';
    const gear = (inv) => Object.keys(inv.gear).length
      ? Object.entries(inv.gear).map(([k, v]) => `${k}: ${v.name}`).join(', ') : '<span class="empty">none</span>';
    this.root.querySelector('[data-page=inventory]').innerHTML = `<div class="inv">
      <h4>Kept (saved)</h4>
      <div class="small">Ashes: ${st.saved.currency} · Gear: ${gear(st.saved)}</div>${list(st.saved)}
      <h4>This run ${st.inRun ? '' : '(not in the dungeon)'}</h4>
      <div class="small">Ashes: ${st.run.currency} · Gear: ${gear(st.run)}</div>${list(st.run)}
      <div class="small">Die and the run is lost. Walk back through the portal to keep it.</div>
    </div>`;
  }

  renderSkills() {
    const p = this.game.state.progression;
    this.root.querySelector('[data-page=skills]').innerHTML = `<div class="skills">
      <div class="small">Level ${p.level} · XP ${p.xp}/${xpForLevel(p.level)} · Unspent points: ${p.skillPoints}</div>
      <div class="branches">${SKILL_TREE.branches.map((b) => `
        <div class="branch"><h4>${b.name}</h4><div class="small">${b.desc}</div>
          ${b.nodes.map((n) => `<div class="node">${n.name}<br>${n.desc}</div>`).join('')}
        </div>`).join('')}</div>
      <div class="small" style="margin-top:8px">The paths are sealed for now. Your choices here will shape what you become.</div>
    </div>`;
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
