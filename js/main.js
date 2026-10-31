// Entry point + game loop. The Game object wires the modular systems
// together: renderer, input, player, areas, clock, state, UI.
import * as THREE from '../lib/three.module.min.js';
import { CONFIG } from './config.js';
import { events } from './engine/events.js';
import { Renderer } from './engine/renderer.js';
import { Input } from './input/input.js';
import { Player } from './player/player.js';
import { HUD } from './ui/hud.js';
import { Menu } from './ui/menu.js';
import { WorldClock } from './systems/clock.js';
import { GameState } from './systems/state.js';
import { loadSettings, saveSettings } from './systems/settings.js';
import { Town } from './world/town.js';
import { Dungeon } from './world/dungeon.js';
import { EnemyManager } from './entities/enemyManager.js';
import { CombatSystem } from './systems/combat.js';

// Registry of areas. New areas register a factory here.
const AREA_FACTORIES = {
  town: (g) => new Town(g),
  dungeon: (g) => new Dungeon(g),
};
export function registerArea(id, factory) { AREA_FACTORIES[id] = factory; }

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, this.renderer.aspect, CONFIG.camera.near, CONFIG.camera.far);
    this.renderer.onResize = (a) => { this.camera.aspect = a; this.camera.updateProjectionMatrix(); };
    this.overlayScene = new THREE.Scene(); // first-person view model (weapon)
    this.events = events;

    this.input = new Input(this.canvas);
    this.hud = new HUD();
    this.menu = new Menu(this);
    this.player = new Player(this.camera);
    this.overlayScene.add(this.camera);

    this.state = new GameState();
    this.hadSave = this.state.load();
    this.clock = new WorldClock(this.state.clockTime);
    this.settings = loadSettings();
    this.applySettings();

    this.areas = {};
    this.area = null;
    this.transitioning = false;
    this.portalCooldown = 0;
    this.paused = true;        // until the title screen is dismissed
    this.started = false;
    this.saveTimer = 0;
    this.enemies = new EnemyManager(this);
    this.combat = new CombatSystem(this);
    this.systems = [this.enemies, this.combat]; // pluggable: { update(dt, game) }

    this.input.onDeviceChange = (d) => this.hud.setDevice(d);
    this.hud.setDevice(this.input.device);

    this.travelTo('town', this.hadSave ? 'respawn' : 'start', true);
    this._setupTitle();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------ settings
  applySettings() {
    this.input.settings.sensitivity = this.settings.sensitivity;
    this.input.settings.invertY = this.settings.invertY;
    this.renderer.setPS1(this.settings.ps1);
    this.menu.syncSettings(this.settings);
  }

  setSetting(key, value) {
    this.settings[key] = value;
    saveSettings(this.settings);
    this.applySettings();
  }

  // ------------------------------------------------------------ title / menu
  _setupTitle() {
    const title = document.getElementById('title');
    const start = document.getElementById('title-start');
    const note = document.getElementById('title-note');
    const refresh = () => {
      start.textContent = this.input.device === 'touch' ? 'Tap to begin' : this.input.device === 'gamepad' ? 'Press A to begin' : 'Click to begin';
      note.textContent = this.hadSave ? 'Your ashes remember you.' : 'Headphones off. Lights low.';
    };
    refresh();
    this._titleRefresh = refresh;
    const go = (e) => {
      if (this.started) return;
      if (e && e.type === 'touchend') this.input._setDevice('touch');
      this.started = true;
      title.classList.add('hidden');
      this.paused = false;
      this.input.flush();
      if (this.input.device === 'touch') this.requestFullscreen();
      else this.input.requestLock();
      this.hud.banner(this.area.name, this.area.hostile ? '' : 'a refuge for the hollow');
    };
    title.addEventListener('click', go);
    title.addEventListener('touchend', (e) => { e.preventDefault(); go(e); });
    this._titleGo = go;
  }

  requestFullscreen() {
    const el = document.documentElement;
    try {
      const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
      if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* */ } }).catch(() => {});
    } catch (e) { /* not supported */ }
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else this.requestFullscreen();
  }

  openMenu() {
    if (this.menu.open || !this.started) return;
    this._menuToggleAt = performance.now();
    this.menu.show(this.input.device);
    this.input.enabled = false;
    this.input.resetTouch();
    this.input.releaseLock();
  }

  closeMenu() {
    if (!this.menu.open) return;
    this._menuToggleAt = performance.now();
    this.menu.hide();
    this.input.enabled = true;
    this.input.flush();
    this.input.requestLock();
  }

  resetSave() {
    GameState.wipe();
    this.state = new GameState();
    this.clock = new WorldClock(0);
    this.player.hp = this.player.maxHp;
    this.closeMenu();
    this.travelTo('town', 'start', true);
    this.hud.feed('The ashes scatter. You begin anew.');
  }

  // ------------------------------------------------------------ areas
  spawnEnemies(area) { this.enemies.spawn(area); }
  clearEnemies(area) { this.enemies.clear(area); }

  getArea(id) {
    if (!this.areas[id]) {
      const a = AREA_FACTORIES[id](this);
      a.build();
      this.areas[id] = a;
    }
    return this.areas[id];
  }

  /** Move the player to another area (with fade unless `instant`). */
  travelTo(id, spawnName, instant = false) {
    if (!AREA_FACTORIES[id]) { this.hud.feed('The way is sealed.'); return; }
    const doSwap = () => {
      const prev = this.area;
      if (prev) prev.onExit();
      this.area = this.getArea(id);
      const sp = this.area.spawns[spawnName] || this.area.spawns.start || Object.values(this.area.spawns)[0];
      this.player.place(sp.pos.x, sp.pos.y, sp.pos.z, sp.yaw);
      this.area.onEnter(prev);
      const wl = this.area.weaponLighting();
      this.combat.weapon.setLighting(wl[0], wl[1]);
      this.portalCooldown = 1.0;
      events.emit('areaChanged', { id, prev: prev && prev.id });
    };
    if (instant) { doSwap(); return; }
    this.transitioning = true;
    this.hud.fade(true);
    setTimeout(() => {
      doSwap();
      this.hud.fade(false);
      this.transitioning = false;
      this.hud.banner(this.area.name, this.area.hostile ? 'the dead do not rest here' : `${this.clock.phase === 'day' ? 'grey day' : 'deep night'} in the hollow`);
    }, 480);
  }

  onPortal(portal) {
    events.emit('portalUsed', { from: this.area.id, to: portal.target });
    const leavingHostile = this.area.hostile;
    const target = this.getArea(portal.target);
    if (target.hostile && !leavingHostile) {
      // entering the dungeon: a fresh RUN begins, SAVED is what you walked in with
      this.state.startRun();
      this.state.save();
    } else if (leavingHostile && !target.hostile) {
      // made it out alive: the run becomes permanent
      const s = this.state.commitRun();
      this.state.save();
      if (s && (s.currency || s.items)) this.hud.feed(`Kept ${s.currency} ashes${s.items ? ' and ' + s.items + ' relic(s)' : ''}.`, '#d8c080');
    }
    this.travelTo(portal.target, portal.spawn || 'portal');
  }

  // ------------------------------------------------------------ loop
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt <= 0) return;
    try {
      this.update(dt);
      this.renderer.render(this.area.scene, this.camera, this.overlayScene);
    } catch (e) {
      document.getElementById('error').textContent = 'Error: ' + e.message;
      throw e;
    }
  }

  update(dt) {
    const input = this.input;
    input.update(dt);

    if (!this.started) {
      if (input.device === 'gamepad' && (input.consume('nav_ok') || input.consume('hit'))) this._titleGo();
      if (this._titleRefresh) this._titleRefresh();
      input.flush();
      this.area.update(dt, this.player);
      this.player.update(dt, { move: { x: 0, y: 0 }, look: { x: dt * 0.05, y: 0 } }, this.area.collision);
      return;
    }

    // menu toggle (debounced: Esc can arrive as both keydown + lock loss)
    if (input.consume('menu') && performance.now() - (this._menuToggleAt || 0) > 250) {
      if (this.menu.open) this.closeMenu(); else this.openMenu();
    }
    if (this.menu.open) {
      this.menu.handleInput(input);
      input.flush();
      this.hud.update(dt, this.camera);
      return; // paused
    }

    const area = this.area;
    this.player.update(dt, input, area.collision);
    for (const s of this.systems) s.update(dt, this);
    area.update(dt, this.player);

    // portals
    if (this.portalCooldown > 0) this.portalCooldown -= dt;
    const np = area.nearestPortal(this.player);
    this.hud.prompt(np && np.dist < 4.5 && !this.transitioning ? np.portal.label : '');
    if (!this.transitioning && this.portalCooldown <= 0 && !this.player.dead) {
      const p = area.checkPortals(this.player);
      if (p) this.onPortal(p);
    }

    // world clock only runs in hostile areas
    this.clock.update(dt, area.hostile && !this.transitioning && !this.player.dead);
    this.state.clockTime = this.clock.time;
    if (area.hostile) {
      this.saveTimer += dt;
      if (this.saveTimer > 10) { this.saveTimer = 0; this.state.save(); }
    }

    this.hud.setHp(this.player.hp, this.player.maxHp);
    this.hud.setClock(this.clock, area.hostile);
    const st = this.state;
    this.hud.setRunInfo(st.inRun
      ? `Run: ${st.run.currency} ashes${st.run.items.length ? ' · ' + st.run.items.reduce((a, i) => a + i.qty, 0) + ' relics' : ''}  ·  Kept: ${st.saved.currency}`
      : `Ashes: ${st.saved.currency}  ·  Lv ${st.progression.level}`);
    this.hud.update(dt, this.camera);
    input.flush();
  }
}

window.addEventListener('error', (e) => {
  const el = document.getElementById('error');
  if (el) el.textContent = 'Error: ' + (e.message || e);
});

window.game = new Game();
