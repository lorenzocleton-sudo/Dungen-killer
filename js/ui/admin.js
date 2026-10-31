// Hidden admin / debug menu.
// Open: F1 (keyboard), tap the HUD status line 5x (touch), hold LB+RB and press
// Start (gamepad). Everything here is a cheat or a test tool.
import * as THREE from '../../lib/three.module.min.js';
import { ENEMY_TYPES } from '../entities/enemyTypes.js';
import { ITEMS } from '../systems/items.js';
import { SKILLS } from '../systems/skills.js';
import { GameState } from '../systems/state.js';
import { SpatialNav } from './nav.js';

export const DEBUG_DEFAULTS = {
  god: false, noclip: false, infAshes: false, infStamina: false, speedMul: 1,
  showFps: false, showColliders: false, forcePhase: null,
};

export class AdminMenu {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.root = document.createElement('div');
    this.root.id = 'admin';
    this.root.className = 'hidden';
    document.body.appendChild(this.root);
    this.nav = new SpatialNav(this.root);
    this.root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-cmd]');
      if (el) this.run(el.dataset.cmd, el);
    });
    this.root.addEventListener('change', (e) => {
      const el = e.target.closest('[data-cmd]');
      if (el && (el.tagName === 'SELECT' || el.type === 'range' || el.type === 'checkbox')) this.run(el.dataset.cmd, el);
    });
    this.root.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    // FPS overlay
    this.fpsEl = document.createElement('div');
    this.fpsEl.id = 'fps';
    document.body.appendChild(this.fpsEl);
    this._frames = 0; this._fpsT = 0;
    this.colliderMesh = null; this._colT = 0;
    // touch: tap the status line 5x
    const hot = document.getElementById('hp-wrap');
    let taps = [];
    hot.addEventListener('touchstart', (e) => {
      const now = performance.now();
      taps = taps.filter((t) => now - t < 2500); taps.push(now);
      if (taps.length >= 5) { taps = []; e.preventDefault(); game.openAdmin(); }
    }, { passive: false });
    hot.addEventListener('click', () => {
      const now = performance.now();
      taps = taps.filter((t) => now - t < 2500); taps.push(now);
      if (taps.length >= 5) { taps = []; game.openAdmin(); }
    });
  }

  get d() { return this.game.debug; }

  show() { this.open = true; this.root.classList.remove('hidden'); this.render(); if (this.game.input.device !== 'touch') this.nav.ensure(); }
  hide() { this.open = false; this.root.classList.add('hidden'); this.nav.clear(); }

  toast(msg) { this.game.hud.feed('[admin] ' + msg, '#80c0ff'); const m = this.root.querySelector('.adm-msg'); if (m) m.textContent = msg; }

  render() {
    const g = this.game, d = this.d, st = g.state, p = st.progression;
    const tog = (k, label) => `<label class="adm-row"><input type="checkbox" class="focusable" data-cmd="toggle:${k}" ${d[k] ? 'checked' : ''}> ${label}</label>`;
    const enemyOpts = Object.entries(ENEMY_TYPES).map(([k, v]) => `<option value="${k}">${v.boss ? '☠ ' : ''}${v.name}</option>`).join('');
    const itemOpts = Object.entries(ITEMS).sort((a, b) => (a[1].rarity || '').localeCompare(b[1].rarity || '') || a[1].name.localeCompare(b[1].name))
      .map(([k, v]) => `<option value="${k}">${v.rarity ? '[' + v.rarity + '] ' : ''}${v.name}</option>`).join('');
    const biomes = (g.biomeIds || ['crypt']).map((b) => `<option value="${b}">${b}</option>`).join('');
    const pity = st.pity || { sinceRare: 0, sinceLegendary: 0 };
    const ren = g.renown ? g.renown.info() : { score: 0, rank: { title: '?' } };
    const tp = ['town', 'castle', 'dungeon:1', 'dungeon:2', 'dungeon:3', 'dungeon:4', 'dungeon:5', 'arena:1', 'arena:2', 'arena:3', 'arena:4', 'arena:5']
      .map((t) => `<button class="focusable" data-cmd="tp:${t}">${t.replace(':', ' ')}</button>`).join('');
    this.root.innerHTML = `<div class="adm-box">
      <div class="adm-head"><b>ADMIN / DEBUG</b><span class="adm-msg"></span><button class="focusable" data-cmd="close">✕</button></div>
      <div class="adm-cols">
      <section><h4>Cheats</h4>
        ${tog('god', 'God mode')}${tog('noclip', 'Noclip / fly (look to steer, jump=Space)')}
        ${tog('infAshes', 'Infinite ashes')}${tog('infStamina', 'Infinite stamina')}
        <label class="adm-row">Speed x<span>${d.speedMul.toFixed(1)}</span><input type="range" class="focusable" min="0.5" max="5" step="0.5" value="${d.speedMul}" data-cmd="speed"></label>
        ${tog('showFps', 'Show FPS')}${tog('showColliders', 'Show colliders')}
        <div class="adm-btns"><button class="focusable" data-cmd="heal">Full heal</button><button class="focusable" data-cmd="ashes">+1000 ashes</button><button class="focusable" data-cmd="killall">Kill all enemies</button></div>
      </section>
      <section><h4>Progress</h4>
        <div class="small">Lv ${p.level} · XP ${p.xp} · ${p.skillPoints} pts · Renown ${ren.score} (${ren.rank.title})</div>
        <div class="adm-btns"><button class="focusable" data-cmd="xp:100">+100 XP</button><button class="focusable" data-cmd="xp:1000">+1000 XP</button></div>
        <div class="adm-btns"><input type="number" id="adm-level" value="${p.level}" min="1" max="99"><button class="focusable" data-cmd="setlevel">Set level</button></div>
        <div class="adm-btns"><button class="focusable" data-cmd="unlockall">Unlock all skills</button><button class="focusable" data-cmd="resetskills">Reset skills</button></div>
        <div class="adm-btns"><input type="number" id="adm-renown" value="${ren.score}" min="0"><button class="focusable" data-cmd="setrenown">Set renown</button></div>
      </section>
      <section><h4>Spawn</h4>
        <div class="adm-btns"><select id="adm-enemy">${enemyOpts}</select><button class="focusable" data-cmd="spawnenemy">Spawn</button></div>
        <div class="adm-btns"><select id="adm-item">${itemOpts}</select><button class="focusable" data-cmd="spawnitem">Give</button></div>
        <div class="adm-btns"><select id="adm-rarity"><option value="">(none)</option><option>normal</option><option>special</option><option>rare</option><option>legendary</option></select><button class="focusable" data-cmd="forcechest">Force next chest</button></div>
        <div class="small">Pity: ${pity.sinceRare} runs since Rare, ${pity.sinceLegendary} since Legendary${g.rewards && g.rewards.forceNext ? ` · next forced: ${g.rewards.forceNext}` : ''}</div>
        <div class="adm-btns"><button class="focusable" data-cmd="resetpity">Reset pity</button><button class="focusable" data-cmd="pityrare">Rare pity due</button><button class="focusable" data-cmd="pitylegend">Legendary pity due</button></div>
      </section>
      <section><h4>World</h4>
        <div class="adm-btns adm-wrap">${tp}</div>
        <div class="adm-btns"><select id="adm-biome">${biomes}</select><button class="focusable" data-cmd="tpdepths">Random dungeon</button></div>
        <div class="adm-btns"><button class="focusable" data-cmd="phase:day">Force day</button><button class="focusable" data-cmd="phase:night">Force night</button><button class="focusable" data-cmd="phase:">Use clock</button><button class="focusable" data-cmd="clock">+5 min clock</button></div>
        <div class="adm-btns"><button class="focusable" data-cmd="revealmap">Reveal full minimap</button></div>
        <div class="adm-btns"><button class="focusable danger" data-cmd="resetsave">Reset save</button></div>
      </section>
      </div></div>`;
  }

  run(cmd, el) {
    const g = this.game, d = this.d, st = g.state;
    const [c, arg] = cmd.split(':');
    const fwd = () => g.player.pos.clone().addScaledVector(g.player.forward, 4);
    switch (c) {
      case 'close': g.closeAdmin(); return;
      case 'toggle': d[arg] = el.checked; this.toast(`${arg} ${el.checked ? 'on' : 'off'}`); break;
      case 'speed': d.speedMul = +el.value; break;
      case 'heal': g.player.hp = g.player.maxHp; g.player.stamina = g.player.maxStamina; break;
      case 'ashes': st.addCurrency(1000); this.toast('+1000 ashes'); break;
      case 'killall': for (const e of g.enemies.list) if (!e.dead) { e.hp = 0; e.die(); } this.toast('All enemies killed'); break;
      case 'xp': g.giveXp(+arg); this.toast(`+${arg} XP`); break;
      case 'setlevel': {
        const lv = Math.max(1, +document.getElementById('adm-level').value | 0);
        const p = st.progression;
        p.skillPoints = Math.max(0, p.skillPoints + (lv - p.level)); p.level = lv; p.xp = 0;
        this.toast('Level ' + lv); break;
      }
      case 'unlockall': for (const s of SKILLS) st.progression.skills[s.id] = s.max; g.renown && g.renown.noteSkills(); g.combat.refreshStats(); this.toast('All skills unlocked'); break;
      case 'resetskills': st.progression.skills = { root: 1 }; st.progression.skillPoints = st.progression.level; g.combat.refreshStats(); this.toast('Skills reset (points refunded)'); break;
      case 'setrenown': g.renown && g.renown.setScore(+document.getElementById('adm-renown').value || 0); this.toast('Renown set'); break;
      case 'spawnenemy': g.enemies.spawnAt(document.getElementById('adm-enemy').value, fwd(), g.area); this.toast('Spawned'); break;
      case 'spawnitem': { const id = document.getElementById('adm-item').value; st.addItem(id, 1); this.toast('Gave ' + ITEMS[id].name); break; }
      case 'forcechest': if (g.rewards) g.rewards.forceNext = document.getElementById('adm-rarity').value || null; this.toast('Next chest: ' + (g.rewards?.forceNext || 'normal roll')); break;
      case 'resetpity': st.pity = { sinceRare: 0, sinceLegendary: 0 }; this.toast('Pity reset'); break;
      case 'pityrare': st.pity = { sinceRare: 50, sinceLegendary: st.pity?.sinceLegendary || 0 }; this.toast('Next chest: guaranteed Rare (pity)'); break;
      case 'pitylegend': st.pity = { sinceRare: st.pity?.sinceRare || 0, sinceLegendary: 300 }; this.toast('Next chest: guaranteed Legendary (pity)'); break;
      case 'tp': {
        const [, dest, lvl] = cmd.split(':');
        g.closeAdmin();
        if (dest === 'town' || dest === 'castle') g.travelTo(dest, 'start');
        else g.enterDungeonLevel(+lvl, dest === 'arena');
        return;
      }
      case 'tpdepths': g.closeAdmin(); g.nextBiome = document.getElementById('adm-biome').value; if (!g.state.inRun) g.state.startRun(); g.travelTo('depths', 'portal'); return;
      case 'phase': d.forcePhase = arg || null; this.toast('Town phase: ' + (arg || 'clock')); break;
      case 'clock': g.clock.time += 300; this.toast('Clock +5 min'); break;
      case 'revealmap': g.minimap && g.minimap.revealAll(); this.toast('Map revealed'); break;
      case 'resetsave': GameState.wipe(); location.reload(); return;
    }
    st.save();
    if (!['speed'].includes(c)) this.render();
  }

  handleInput(input) {
    if (input.consume('cancel') || input.consume('admin') || input.consume('menu')) { this.game.closeAdmin(); return; }
    this.nav.handle(input);
  }

  /** Per-frame debug effects (also runs while the menu is closed). */
  update(dt) {
    const g = this.game, d = this.d;
    if (d.infAshes && g.state.saved.currency < 50000) g.state.saved.currency = 99999;
    if (d.infStamina) g.player.stamina = g.player.maxStamina;
    g.player.speedMul = d.speedMul;
    g.player.god = d.god;
    g.player.noclip = d.noclip;
    // FPS
    this._frames++; this._fpsT += dt;
    if (this._fpsT >= 0.5) {
      this.fps = Math.round(this._frames / this._fpsT); this._frames = 0; this._fpsT = 0;
      const info = g.renderer.frameStats || { calls: 0, triangles: 0 };
      info.triangles = info.tris ?? info.triangles;
      this.fpsEl.textContent = d.showFps ? `${this.fps} fps · ${info.calls} calls · ${(info.triangles / 1000).toFixed(1)}k tris · ${g.area.id}` : '';
    }
    this.fpsEl.style.display = d.showFps ? 'block' : 'none';
    // collider wireframes near the player
    this._colT -= dt;
    if (d.showColliders && this._colT <= 0) { this._colT = 1; this.buildColliders(); }
    if (!d.showColliders && this.colliderMesh) { this.colliderMesh.parent && this.colliderMesh.parent.remove(this.colliderMesh); this.colliderMesh = null; }
  }

  buildColliders() {
    const g = this.game, p = g.player.pos;
    if (this.colliderMesh) { this.colliderMesh.parent && this.colliderMesh.parent.remove(this.colliderMesh); this.colliderMesh.geometry.dispose(); }
    const boxes = g.area.collision.query(p.x - 25, p.z - 25, p.x + 25, p.z + 25, []);
    const pos = [];
    for (const b of boxes) {
      if (b.disabled) continue;
      const v = [[b.minX, b.minY, b.minZ], [b.maxX, b.minY, b.minZ], [b.maxX, b.minY, b.maxZ], [b.minX, b.minY, b.maxZ],
        [b.minX, b.maxY, b.minZ], [b.maxX, b.maxY, b.minZ], [b.maxX, b.maxY, b.maxZ], [b.minX, b.maxY, b.maxZ]];
      for (const [a, c] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) pos.push(...v[a], ...v[c]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.colliderMesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x40ff80, fog: false, depthTest: false, transparent: true, opacity: 0.6 }));
    this.colliderMesh.renderOrder = 99;
    g.area.scene.add(this.colliderMesh);
  }
}
