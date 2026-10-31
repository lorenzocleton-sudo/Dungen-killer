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
import { MainDungeon, RandomDungeon } from './world/dungeon.js';
import { Castle } from './world/castle.js';
import { BIOME_IDS } from './world/biomes.js';
import { Projectiles } from './entities/projectiles.js';
import { Rewards } from './systems/rewards.js';
import { Minimap } from './ui/minimap.js';
import { Screens } from './ui/screens.js';
import { AdminMenu, DEBUG_DEFAULTS } from './ui/admin.js';
import { addXp } from './systems/skills.js';
import { Renown } from './systems/renown.js';
import { ENEMY_TYPES } from './entities/enemyTypes.js';
import { EnemyManager } from './entities/enemyManager.js';
import { CombatSystem } from './systems/combat.js';
import { LootSystem } from './systems/loot.js';

// Registry of areas. New areas register a factory here.
const AREA_FACTORIES = {
  town: (g) => new Town(g),
  dungeon: (g) => new MainDungeon(g),
  depths: (g) => new RandomDungeon(g),
  castle: (g) => new Castle(g),
};
export function registerArea(id, factory) { AREA_FACTORIES[id] = factory; }
const HOSTILE_AREAS = { dungeon: true, depths: true };

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
    this.screens = new Screens(this);
    this.debug = { ...DEBUG_DEFAULTS };
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
    this.loot = new LootSystem(this);
    this.projectiles = new Projectiles(this);
    this.rewards = new Rewards(this);
    this.minimap = new Minimap(this);
    this.biomeIds = BIOME_IDS;
    this.dungeonLevel = 1;
    this.systems = [this.enemies, this.combat, this.loot, this.projectiles]; // pluggable: { update(dt, game) }
    this.admin = new AdminMenu(this);
    this.renown = new Renown(this);
    this.renown.noteSkills();
    this.renown.lastRank = this.renown.rankIndex;
    this.deathTimer = 0;
    events.on('playerDied', () => this.onPlayerDeath());
    events.on('areaChanged', () => this.projectiles.clear());
    events.on('enemyKilled', ({ enemy }) => {
      if (!enemy.def.boss) return;
      this.state.world.bosses[enemy.type] = (this.state.world.bosses[enemy.type] || 0) + 1;
      this.loot.roll('boss', enemy.pos, 4);
      // bosses always drop a Special, sometimes a Rare
      this.loot.spawn(this.rewards.randomItem(Math.random() < 0.3 ? 'rare' : 'special'), enemy.pos, 5);
      if (this.area.onBossDefeated) this.area.onBossDefeated(enemy);
      this.state.save();
    });
    events.on('playerFellOut', () => { if (!this.player.dead) { this.player.invuln = 0; this.player.damage(99999); } });

    this.combat.refreshStats();
    this.player.hp = this.player.maxHp;
    events.on('inventoryChanged', () => { if (this.screens.open) this.screens.render(); });

    this.input.onDeviceChange = (d) => this.hud.setDevice(d);
    this.hud.setDevice(this.input.device);

    this.travelTo('town', this.hadSave ? 'respawn' : 'start', true);
    this._setupTitle();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Phase shown in town: clock-driven unless "always day" (or debug) overrides it. */
  townPhase() {
    if (this.debug && this.debug.forcePhase) return this.debug.forcePhase;
    return this.settings.alwaysDay ? 'day' : this.clock.phase;
  }

  // ------------------------------------------------------------ settings
  applySettings() {
    this.input.settings.sensitivity = this.settings.sensitivity;
    this.input.settings.invertY = this.settings.invertY;
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

  /** Inventory / shop / trainer panels (pause the game while open). */
  openScreen(mode, tab) {
    if (!this.started || this.player.dead) return;
    if (this.menu.open) this.closeMenu();
    this.screens.show(mode, tab);
    this.input.enabled = false;
    this.input.resetTouch();
    this.input.releaseLock();
    this.hud.interactPrompt('');
  }

  closeScreen() {
    if (!this.screens.open) return;
    this._menuToggleAt = performance.now();
    this.screens.hide();
    this.input.enabled = true;
    this.input.flush();
    this.input.requestLock();
    this.state.save();
  }

  toggleMap() {
    if (!this.started || this.player.dead) return;
    const on = !this.minimap.open;
    if (on && (this.menu.open || this.screens.open || this.admin.open)) return;
    this.minimap.showBig(on);
    this.input.enabled = !on;
    if (on) { this.input.resetTouch(); this.input.releaseLock(); } else { this.input.flush(); this.input.requestLock(); }
  }

  openAdmin() {
    if (!this.started) return;
    if (this.menu.open) this.closeMenu();
    if (this.screens.open) this.closeScreen();
    this.admin.show();
    this.input.enabled = false;
    this.input.resetTouch();
    this.input.releaseLock();
  }

  closeAdmin() {
    if (!this.admin.open) return;
    this.admin.hide();
    this.input.enabled = true;
    this.input.flush();
    this.input.requestLock();
  }

  enemyName(type) { return ENEMY_TYPES[type] ? ENEMY_TYPES[type].name : type; }

  /** XP with level-up feedback (used by kills and the admin menu). */
  giveXp(n) {
    const lv = addXp(this.state.progression, n);
    if (lv) this.hud.feed(`Level ${this.state.progression.level}! Skill point gained - visit the Hall of Paths`, '#e0b060');
    return lv;
  }

  /** Main dungeon level N (step 6 replaces this with the levelled dungeon). */
  enterDungeonLevel(level, toArena = false) {
    if (!this.state.inRun) this.state.startRun();
    this.dungeonLevel = level;
    this.pendingArena = toArena;
    this.travelTo('dungeon', 'portal');
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
    this.renown.lastRank = 0;
    this.combat.refreshStats();
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
      if (prev && prev.transient) { prev.dispose(); delete this.areas[prev.id]; }
      this.area = this.getArea(id);
      const sp = this.area.spawns[spawnName] || this.area.spawns.start || Object.values(this.area.spawns)[0];
      this.player.place(sp.pos.x, sp.pos.y, sp.pos.z, sp.yaw);
      this.area.onEnter(prev);
      if (this.area instanceof MainDungeon) {
        this.renown.reachLevel(this.area.level);
        this.state.world.deepest = Math.max(this.state.world.deepest || 0, this.area.level);
      }
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
    const targetHostile = !!HOSTILE_AREAS[portal.target];
    if (portal.descend) this.dungeonLevel++;
    else if (portal.target === 'dungeon' && !leavingHostile) this.dungeonLevel = 1;
    if (targetHostile && !leavingHostile) {
      // entering a dungeon: a fresh RUN begins, SAVED is what you walked in with
      this.state.startRun();
      this.state.save();
    } else if (leavingHostile && !targetHostile) {
      // made it out alive: the run becomes permanent
      const s = this.state.commitRun();
      this.state.save();
      if (s && (s.currency || s.items)) this.hud.feed(`Kept ${s.currency} ashes${s.items ? ' and ' + s.items + ' item(s)' : ''}.`, '#d8c080');
    }
    this.travelTo(portal.target, portal.spawn || 'portal');
  }

  // ------------------------------------------------------------ death
  /** Death rule: RUN is wiped, SAVED + progression survive, wake in town. */
  onPlayerDeath() {
    const run = this.state.run;
    const nItems = run.items.reduce((a, i) => a + i.qty, 0);
    const parts = [];
    if (run.currency) parts.push(`${run.currency} ashes`);
    if (nItems) parts.push(`${nItems} item${nItems > 1 ? 's' : ''}`);
    this.state.loseRun();
    this.state.save();
    this.hud.showDeath(true, parts.length ? `Lost: ${parts.join(', ')}` : 'You carried nothing worth losing.');
    this.hud.prompt('');
    this.deathTimer = 4.2;
    this.respawning = false;
  }

  respawn() {
    this.respawning = true;
    this.hud.fade(true);
    setTimeout(() => {
      this.hud.showDeath(false);
      this.player.dead = false;
      this.player.hp = this.player.maxHp;
      this.player.invuln = 1;
      this.travelTo('town', 'respawn', true);
      this.hud.fade(false);
      this.hud.banner(this.area.name, 'you wake beside the old well');
      this.respawning = false;
    }, 600);
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

    if (this.admin.open) {
      this.admin.handleInput(input);
      this.admin.update(dt);
      input.flush();
      return; // paused
    }
    if (input.consume('admin')) { this.openAdmin(); input.flush(); return; }
    if (this.minimap.open) {
      if (input.consume('map') || input.consume('cancel') || input.consume('menu')) this.toggleMap();
      this.minimap.update(dt);
      input.flush();
      return; // paused while the full map is open
    }
    if (input.consume('map')) { this.toggleMap(); input.flush(); return; }
    this.admin.update(dt);
    if (this.screens.open) {
      this.screens.handleInput(input);
      input.flush();
      this.hud.update(dt, this.camera);
      return; // paused
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
    if (input.consume('inventory') && !this.player.dead && !this.transitioning) {
      this.openScreen('inventory');
      input.flush();
      return;
    }

    const area = this.area;
    if (this.player.dead && !this.respawning) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.respawn();
    }
    this.player.update(dt, input, area.collision);
    for (const s of this.systems) s.update(dt, this);
    area.update(dt, this.player);

    // interactables (shop, trainer, chests) take priority over portal labels
    let near = null, nd = Infinity;
    for (const it of area.interactables) {
      if (!it.enabled) continue;
      const d = Math.hypot(it.pos.x - this.player.pos.x, it.pos.z - this.player.pos.z);
      if (d < it.radius && d < nd && Math.abs(it.pos.y - this.player.pos.y) < 2) { near = it; nd = d; }
    }
    if (near && !this.player.dead && !this.transitioning) {
      this.hud.interactPrompt(near.label, input.device);
      if (input.consume('interact')) near.onUse();
    } else {
      this.hud.interactPrompt('');
      // portals
      const np = area.nearestPortal(this.player);
      this.hud.prompt(np && np.dist < 4.5 && !this.transitioning ? (np.portal.locked ? np.portal.lockedLabel : np.portal.label) : '');
    }
    if (this.portalCooldown > 0) this.portalCooldown -= dt;
    this.hud.setSprint(this.player.sprinting);
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
    let boss = null;
    for (const e of this.enemies.list) if (e.showsBar && (!boss || e.def.boss)) boss = e;
    this.hud.setBoss(boss);
    this.minimap.update(dt);
    this.hud.setStamina(this.player.stamina, this.player.maxStamina, this.player.exhausted);
    this.hud.setClock(this.clock, area.hostile, this.townPhase());
    const st = this.state;
    const runItems = st.run.items.reduce((a, i) => a + i.qty, 0);
    const flasks = st.count('ashen_flask');
    this.hud.setRunInfo((st.inRun
      ? `Run: ${st.run.currency} ashes${runItems ? ' · ' + runItems + ' item' + (runItems > 1 ? 's' : '') : ''}  ·  Kept: ${st.saved.currency}`
      : `Ashes: ${st.saved.currency}  ·  Lv ${st.progression.level}${st.progression.skillPoints ? ' (' + st.progression.skillPoints + ' pt)' : ''}`) + `  ·  Flasks: ${flasks}`);
    this.hud.update(dt, this.camera);
    input.flush();
  }
}

window.addEventListener('error', (e) => {
  const el = document.getElementById('error');
  if (el) el.textContent = 'Error: ' + (e.message || e);
});

window.game = new Game();
