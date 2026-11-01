// ALLIES: Tavern companions, Menagerie pets and summons (skeletons, spectral
// knights, wolves). Allies follow you (clearance pathfinding, teleport to keep
// up with jumps/dashes), fight what you fight, and can be targeted by
// enemies. Companions are DOWNED at 0 HP: stand next to them for 3 s to
// revive, or after 30 s they limp back to town. Orders: follow / hold /
// attack target / stay back.
import * as THREE from '../../lib/three.module.min.js';
import { ENEMY_TYPES } from './enemyTypes.js';
import { NavGrid } from '../engine/nav.js';
import { events } from '../engine/events.js';
import { defOf } from '../systems/items.js';
import { generateItem } from '../systems/itemgen.js';
import { spriteMaterial } from '../engine/materials.js';

// role: tank, caster, thief, archer, healer, berserker, witch
export const COMPANIONS = {
  bram: { name: 'Bram', title: 'Oathguard tank', model: 'knight', scale: 0.85, hp: 220, dmg: 14, range: 2.2, speed: 6, cost: 600, role: 'tank', weapon: 'sword',
    lines: { hire: 'An oath is an oath. Lead, and I’ll hold the line.', kill: 'Down.', low: 'Still standing!', downed: 'Not... yet...', revive: 'My thanks. Again.', idle: 'The Oathguard buried a king once. I was there. I think.' },
    tree: [['Shield Wall', 'Taunts nearby enemies onto himself.', { taunt: 1 }], ['Bulwark', '+40% HP.', { hpPct: 40 }], ['Last Oath', 'Revives himself once per run.', { selfRevive: 1 }]],
    quest: { text: 'Fight beside Bram until a story guardian falls.', reward: 'aegis_vael' } },
  ilse: { name: 'Sister Ilse', title: 'Cinder Choir firecaller', model: 'hag', scale: 1, hp: 120, dmg: 18, range: 13, ranged: { color: 0xff7020, speed: 14, burn: 5 }, speed: 5.5, cost: 700, role: 'caster',
    lines: { hire: 'The Choir is ash. I am what is left of the song.', kill: 'Burn.', low: 'The fire... is in me too...', downed: 'Sing... for me...', revive: 'Warm again.', idle: 'Merrow taught me the first note. I hope I never learn the last.' },
    tree: [['Kindle', 'Her bolts set fires.', { burnPct: 50 }], ['Fire Nova', 'Bursts into flame when enemies close in.', { nova: 1 }], ['Pyre Song', '+40% damage.', { dmgPct: 40 }]],
    quest: { text: 'Fight beside Ilse until a story guardian falls.', reward: 'choirs_end' } },
  nix: { name: 'Nix', title: 'Veiled thief', model: 'shade_assassin', scale: 0.9, hp: 110, dmg: 16, range: 1.9, speed: 7.5, cost: 650, role: 'thief',
    lines: { hire: 'You pay, I stab. You don’t pay, I still stab. Ha.', kill: 'Mine!', low: 'Ow. Ow ow.', downed: 'Don’t... take my boots...', revive: 'Knew you liked me.', idle: 'The Veiled stole an hour once. I stole a spoon. We all start somewhere.' },
    tree: [['Pickpocket', '+15% item find for you.', { lootFind: 15 }], ['Backstab', 'Crits deal double.', { critPct: 25 }], ['Vanish', 'Turns unseen when hurt.', { vanish: 1 }]],
    quest: { text: 'Fight beside Nix until a story guardian falls.', reward: 'widows_fang' } },
  hedda: { name: 'Hedda', title: 'Rimewatch archer', model: 'archer', scale: 1, hp: 120, dmg: 15, range: 16, ranged: { color: 0xa0d8ff, speed: 26, arrow: true, chill: 30 }, speed: 6, cost: 650, role: 'archer',
    lines: { hire: 'The north froze. I didn’t.', kill: 'Clean shot.', low: 'Getting cold...', downed: 'Leave me... the snow will...', revive: 'Not today, winter.', idle: 'My company is still at the wall. Standing. Waiting for orders I never brought.' },
    tree: [['Frost Arrows', 'Arrows chill harder.', { chill: 30 }], ['Volley', 'Sometimes shoots three arrows.', { volley: 1 }], ['Eagle Eye', '+40% damage.', { dmgPct: 40 }]],
    quest: { text: 'Fight beside Hedda until a story guardian falls.', reward: 'heartstring' } },
  oswin: { name: 'Father Oswin', title: 'Hearth-Keeper healer', model: 'hollow', scale: 1, hp: 140, dmg: 8, range: 12, ranged: { color: 0xffe0a0, speed: 16 }, speed: 5.5, cost: 800, role: 'healer',
    lines: { hire: 'I keep the Hearth. Let me keep you too.', kill: 'Rest now.', low: 'Pray for me, child.', downed: 'The fire... will hold...', revive: 'Bless you.', idle: 'The hour holds. For now. Do not ask me what it costs.' },
    tree: [['Mending', 'Heals you more often.', { healRate: 40 }], ['Sanctuary', 'His heals also cleanse.', { cleanse: 1 }], ['Benediction', 'Heals are 60% stronger.', { healPct: 60 }]],
    quest: { text: 'Fight beside Oswin until a story guardian falls.', reward: 'hearth_ember' } },
  korr: { name: 'Korr', title: 'berserker', model: 'brute', scale: 0.65, hp: 200, dmg: 22, range: 2.4, speed: 6, cost: 750, role: 'berserker', bleed: 5,
    lines: { hire: 'Point. I break.', kill: 'MORE!', low: 'HA! It only hurts!', downed: 'Korr... rests... briefly...', revive: 'AGAIN!', idle: 'Before the ash I had a farm. Goats. Korr misses goats.' },
    tree: [['Rend', 'Hits bleed harder.', { bleedPct: 60 }], ['Blood Rage', '+50% damage below half HP.', { rage: 1 }], ['Unstoppable', '+40% HP.', { hpPct: 40 }]],
    quest: { text: 'Fight beside Korr until a story guardian falls.', reward: 'sunderer' } },
  mirelle: { name: 'Mirelle', title: 'bone-witch', model: 'hag', scale: 0.95, hp: 115, dmg: 12, range: 12, ranged: { color: 0x90d050, speed: 12, poison: 4 }, speed: 5.5, cost: 750, role: 'witch',
    lines: { hire: 'The dead like me. You might, in time.', kill: 'Another for the choir.', low: 'My bones ache. Literally.', downed: 'Raise... me...', revive: 'Oh, you DO care.', idle: 'Every bone remembers being someone. I just ask them nicely.' },
    tree: [['Grave Call', 'Raises a skeleton every 15 s.', { raise: 1 }], ['Bone Ward', '+40% HP.', { hpPct: 40 }], ['Choir of Bones', 'Raises two at a time.', { raise2: 1 }]],
    quest: { text: 'Fight beside Mirelle until a story guardian falls.', reward: 'grave_lantern' } },
  silent: { name: 'The Silent One', title: '???', model: 'wraith', scale: 1, hp: 180, dmg: 24, range: 2.2, speed: 7, cost: 2000, role: 'silent', late: true,
    lines: { hire: '...', kill: '...', low: '...', downed: '...', revive: '...', idle: '(It points at the Hearth, then at the castle. Then at you.)' },
    tree: [['Unseen', 'Enemies rarely target it.', { stealth: 1 }], ['Hollow Blade', '+60% damage.', { dmgPct: 60 }], ['Remembered', 'It whispers a name you almost know.', { lore: 1 }]],
    quest: { text: 'Fight beside the Silent One until the Hollow King falls.', reward: 'hollow_crown' } },
};

export const PETS = {
  wolf_pup: { name: 'Ash-Wolf Pup', model: 'wolf', scale: 0.6, hp: 80, dmg: 9, range: 1.6, speed: 7.5, cost: 300 },
  ember_sprite: { name: 'Ember Sprite', model: 'imp', scale: 0.6, hp: 50, dmg: 7, range: 10, ranged: { color: 0xff8030, speed: 14, burn: 3 }, speed: 7, cost: 400 },
  grave_hound: { name: 'Grave Hound', model: 'panther', scale: 0.7, hp: 110, dmg: 12, range: 1.8, speed: 8, cost: 650 },
  owl: { name: 'Menagerie Owl', model: 'gargoyle', scale: 0.4, hp: 60, dmg: 6, range: 9, ranged: { color: 0xe0c070, speed: 16 }, speed: 7, cost: 500, fly: 1.8, loot: 10 },
};

const SUMMONS = {
  skeleton: { name: 'Risen Skeleton', model: 'hollow', scale: 1, hp: 60, dmg: 10, range: 2, speed: 5 },
  spectral_knight: { name: 'Spectral Knight', model: 'knight', scale: 0.85, hp: 160, dmg: 18, range: 2.3, speed: 6, ghost: true },
  wolf: { name: 'Summoned Wolf', model: 'wolf', scale: 1, hp: 90, dmg: 12, range: 1.8, speed: 8 },
  spirit_hound: { name: 'Spirit Hound', model: 'panther', scale: 0.8, hp: 120, dmg: 12, range: 1.8, speed: 8, ghost: true },
};

class Ally {
  constructor(mgr, kind, id, def, opts = {}) {
    const g = mgr.game, area = g.area;
    this.mgr = mgr; this.kind = kind; this.id = id; this.def = def; this.area = area;
    this.level = opts.level || 1;
    const st = g.player.stats || {};
    const hpMul = (1 + (this.level - 1) * 0.15) * (1 + (st.allyHpPct || 0) / 100) * (opts.hpMul || 1);
    this.maxHp = this.hp = Math.round(def.hp * hpMul * (1 + (opts.perks?.hpPct || 0) / 100));
    this.dmgBase = def.dmg * (1 + (this.level - 1) * 0.15) * (opts.dmgMul || 1);
    this.perks = opts.perks || {};
    this.life = opts.life || 0;
    const T = ENEMY_TYPES[def.model];
    this.model = T.build();
    this.group = this.model.root;
    this.group.scale.multiplyScalar(def.scale || 1);
    if (def.ghost) this.group.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; o.material.emissive.setRGB(0.15, 0.2, 0.35); } });
    const tag = new THREE.Sprite(spriteMaterial('glow', kind === 'companion' ? 0x80c0ff : kind === 'pet' ? 0xa0e080 : 0xc0c0ff)); tag.scale.set(0.5, 0.5, 1); tag.position.y = 2.3 / (def.scale || 1); this.group.add(tag);
    this.pos = (opts.pos || g.player.pos).clone();
    this.pos.x += (Math.random() - 0.5) * 2; this.pos.z += (Math.random() - 0.5) * 2;
    this.yaw = g.player.yaw + Math.PI; this.vel = new THREE.Vector3(); this.cd = 1; this.anim = Math.random() * 5;
    this.radius = Math.min(0.6, T.radius * (def.scale || 1)); this.height = 1.8 * (def.scale || 1);
    this.forward = new THREE.Vector3(); this.grounded = true; this.slowT = 0;
    this.group.position.copy(this.pos);
    area.scene.add(this.group);
  }

  get eyeY() { return this.pos.y + this.height * 0.85; }
  get dead() { return this.downed || this.gone; }

  damage(amount, sourcePos, src) {
    if (this.dead || this.mgr.godMode) return 0;
    this.hp -= amount;
    this.flash = 0.15;
    if (this.kind === 'companion' && this.hp < this.maxHp * 0.3 && !this._saidLow) { this._saidLow = true; this.mgr.say(this, 'low'); }
    if (this.hp <= 0) {
      this.hp = 0;
      if (this.kind === 'companion') {
        if (this.perks.selfRevive && !this._selfRevived) { this._selfRevived = true; this.hp = this.maxHp * 0.5; this.mgr.say(this, 'revive'); return amount; }
        this.downed = true; this.downT = 0; this.reviveT = 0; this.mgr.say(this, 'downed');
        this.group.rotation.x = -1.4;
      } else this.remove();
    }
    return amount;
  }
  addDot(dps, dur) { this.damage(Math.round(dps * dur * 0.3)); }

  remove() { this.gone = true; this.area.scene.remove(this.group); }

  /** Nearest enemy to attack (respecting orders). */
  pickTarget(enemies, player) {
    const o = this.mgr.order;
    if (o === 'attack' && this.mgr.focus && !this.mgr.focus.dead) return this.mgr.focus;
    let best = null, bd = o === 'hold' ? this.def.range + 1 : 14;
    for (const e of enemies) {
      if (e.dead || e.disguised || e.def.flee && this.kind !== 'pet') continue;
      const d = e.pos.distanceTo(this.pos);
      const fromPlayer = e.pos.distanceTo(player.pos);
      if (fromPlayer > 18) continue;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  navStep(dt, tx, tz, ty) {
    const nav = this.area.getNav && this.area.getNav();
    if (!nav) return { x: tx, z: tz };
    const need = NavGrid.need(this.radius);
    const mk = nav.idx(this.pos.x, this.pos.z), tk = nav.idx(tx, tz);
    if (nav.walkable(mk) && nav.walkable(tk) && nav.lineClear(mk, tk, need)) return { x: tx, z: tz };
    this.repathT = (this.repathT || 0) - dt;
    if (!this.path || this.repathT <= 0) { this.repathT = 0.8 + Math.random() * 0.4; this.path = nav.findPath(this.pos.x, this.pos.z, this.pos.y, tx, tz, ty, 8000, need) || null; this.pi = 0; }
    if (!this.path) return null;
    while (this.pi < this.path.length - 1 && Math.hypot(this.path[this.pi].x - this.pos.x, this.path[this.pi].z - this.pos.z) < 0.7) this.pi++;
    return this.path[this.pi];
  }

  update(dt, g) {
    const p = g.player;
    this.anim += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.life) { this.life -= dt; if (this.life <= 0) { this.area.dust.burst(this.pos.x, this.pos.y + 0.6, this.pos.z, 20, 2, 0.8, [0.5, 0.5, 0.6], 0.1, -2, 1); this.remove(); return; } }
    if (this.downed) {
      // stand next to them to revive
      this.downT += dt;
      const near = p.pos.distanceTo(this.pos) < 2.6 && !p.dead;
      this.reviveT = near ? this.reviveT + dt : Math.max(0, this.reviveT - dt);
      g.hud.prompt(near ? `Reviving ${this.def.name}... ${Math.min(100, Math.round(this.reviveT / 3 * 100))}%` : '');
      if (this.reviveT >= 3) { this.downed = false; this.hp = this.maxHp * 0.5; this.group.rotation.x = 0; this._saidLow = false; this.mgr.say(this, 'revive'); g.hud.prompt(''); }
      else if (this.downT > 30) { g.hud.feed(`${this.def.name} limps back to Emberwick.`, '#a0b0c0'); this.remove(); }
      return;
    }
    if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + dt * this.maxHp * 0.01);
    const st = p.stats || {};
    const dmgMul = (1 + (st.petDmgPct || 0) / 100) * (1 + (this.perks.dmgPct || 0) / 100) * (this.perks.rage && this.hp < this.maxHp / 2 ? 1.5 : 1);
    const target = this.pickTarget(g.enemies.list, p);
    const dp = p.pos.distanceTo(this.pos);
    // keep up: teleport when left far behind (jumps, dashes, ledges)
    if (dp > 20 || Math.abs(p.pos.y - this.pos.y) > 4 && dp > 6) {
      this.pos.copy(p.pos).addScaledVector(p.forward, -1.5); this.pos.x += (Math.random() - 0.5); this.path = null;
      this.area.glow.burst(this.pos.x, this.pos.y + 1, this.pos.z, 14, 2, 0.5, [0.6, 0.8, 1], 0.05, 0, 1);
    }
    let goal = null, speed = 0;
    this.cd -= dt;
    const o = this.mgr.order;
    if (o === 'hold' && !this.holdPos) this.holdPos = this.pos.clone();
    if (o !== 'hold') this.holdPos = null;
    if (this.def.role === 'healer' || this.kind === 'companion' && this.id === 'oswin') {
      this.healT = (this.healT || 0) - dt * (1 + (this.perks.healRate || 0) / 100);
      if (this.healT <= 0 && p.hp < p.maxHp * 0.75 && dp < 14 && !p.dead) {
        this.healT = 6; p.heal(p.maxHp * 0.12 * (1 + (this.perks.healPct || 0) / 100)); if (this.perks.cleanse) p.dot = null;
        this.area.glow.burst(p.pos.x, p.pos.y + 1, p.pos.z, 18, 1.5, 1, [1, 0.9, 0.5], 0.05, 1, 1);
      }
    }
    if (this.perks.raise) { this.raiseT = (this.raiseT || 15) - dt; if (this.raiseT <= 0 && target) { this.raiseT = 15; for (let i = 0; i < (this.perks.raise2 ? 2 : 1); i++) this.mgr.summon('skeleton', this.pos, { life: 20 }); } }
    if (target && !p.dead) {
      const d = target.pos.distanceTo(this.pos) - target.radius;
      this.yaw = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
      const rng = this.def.range;
      const stayBack = o === 'stay' && this.def.ranged;
      if (d > rng * 0.9 && o !== 'hold') { goal = target.pos; speed = this.def.speed; }
      if (d <= rng && this.cd <= 0) {
        this.cd = this.def.ranged ? 1.4 : 1.0;
        this.swingT = 0.3;
        const dmg = Math.round(this.dmgBase * dmgMul * (0.85 + Math.random() * 0.3) * (this.perks.critPct && Math.random() < 0.25 ? 2 : 1));
        if (this.def.ranged) this.mgr.shoot(this, target, dmg);
        else {
          target.takeHit(dmg, this.pos, 0.6);
          g.hud.damageNumber(target.headPos(new THREE.Vector3()), dmg, 'ally');
          if (this.def.bleed) target.dot('bleed', this.def.bleed * (1 + (this.perks.bleedPct || 0) / 100), 4);
          if (target.dead && this.kind === 'companion' && Math.random() < 0.3) this.mgr.say(this, 'kill');
        }
        if (this.perks.taunt && target.state) target._tgtAlly = this;
      }
      if (stayBack && d < 6) { goal = this.pos.clone().addScaledVector(new THREE.Vector3(this.pos.x - target.pos.x, 0, this.pos.z - target.pos.z).normalize(), 3); speed = this.def.speed; }
    } else if (o === 'hold' && this.holdPos) { if (this.holdPos.distanceTo(this.pos) > 1) { goal = this.holdPos; speed = this.def.speed * 0.8; } }
    else if (dp > (o === 'stay' ? 6 : 3)) {
      const side = this.kind === 'pet' ? 1.6 : -1.6;
      goal = p.pos.clone().addScaledVector(p.forward, -1.8); goal.x += Math.cos(p.yaw) * side; goal.z -= Math.sin(p.yaw) * side;
      speed = Math.min(this.def.speed * (dp > 8 ? 1.6 : 1), 12);
    }
    if (goal && speed) {
      const wp = this.navStep(dt, goal.x, goal.z, goal.y ?? this.pos.y);
      if (wp) {
        const yaw = Math.atan2(wp.x - this.pos.x, wp.z - this.pos.z);
        if (!target || speed) this.yaw = target && !goal ? this.yaw : yaw;
        const q = { x: this.pos.x + Math.sin(yaw) * speed * dt, z: this.pos.z + Math.cos(yaw) * speed * dt };
        g.area.collision.resolve(q, this.radius, this.pos.y, 1.6, 0.45);
        this.pos.x = q.x; this.pos.z = q.z;
      }
    }
    const gh = g.area.collision.groundHeight(this.pos.x, this.pos.z, 0.2, this.pos.y + 0.5, 0.9);
    if (gh > -Infinity) this.pos.y += (gh - this.pos.y) * Math.min(1, dt * 12);
    this.group.position.copy(this.pos);
    if (this.def.fly) this.group.position.y += this.def.fly + Math.sin(this.anim * 3) * 0.15;
    this.group.rotation.y = this.yaw;
    this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    // simple walk / attack animation on whatever rig the model has
    const m = this.model, walk = speed > 0.5 ? 1 : 0, ph = this.anim * 9;
    if (m.legL) { m.legL.rotation.x = Math.sin(ph) * 0.6 * walk; m.legR.rotation.x = -Math.sin(ph) * 0.6 * walk; }
    if (m.armR) m.armR.rotation.x = this.swingT > 0 ? -2.2 + (0.3 - this.swingT) * 10 : -Math.sin(ph) * 0.4 * walk;
    if (this.swingT > 0) this.swingT -= dt;
    if (m.legs) m.legs.forEach((l, i) => { l.rotation.y = l.userData.baseY + Math.sin(ph * 1.5 + i) * 0.25 * walk; });
  }
}

export class AllyManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.order = 'follow';
    this.focus = null;
    this.shots = [];
    events.on('areaChanged', () => this.onArea());
    events.on('enemyKilled', ({ enemy }) => {
      const c = this.companion;
      if (!c || c.dead) return;
      const rec = this.game.state.companions.hired[c.id];
      if (!rec) return;
      rec.xp = (rec.xp || 0) + Math.round(enemy.def.xp * 0.5);
      while (rec.xp >= 100 * (rec.level || 1)) { rec.xp -= 100 * (rec.level || 1); rec.level = (rec.level || 1) + 1; this.game.hud.feed(`${c.def.name} reached level ${rec.level}`, '#80c0ff'); }
      // personal quest: a story guardian falls with them at your side
      if (enemy.def.boss && (rec.loyalty || 0) >= 8 && !rec.questDone && (c.id !== 'silent' || enemy.type === 'hollow_king')) {
        rec.questDone = true;
        const q = COMPANIONS[c.id].quest;
        this.game.loot.spawnGen(generateItem({ ilvl: enemy.level || 5, unique: q.reward, rarity: 'legendary' }), enemy.pos, 7);
        this.game.hud.banner(`${c.def.name}'s quest`, 'a gift of loyalty');
      }
    });
    events.on('runCommitted', () => { const c = this.game.state.companions; const r = c.active && c.hired[c.active]; if (r) r.loyalty = (r.loyalty || 0) + 1; });
  }

  get companion() { return this.list.find((a) => a.kind === 'companion' && !a.gone); }

  say(a, what) {
    const L = a.def.lines && a.def.lines[what];
    if (L) this.game.hud.speak(`${a.def.name}: "${L}"`, 3.5);
  }

  /** Companion stats from level + gear (weapon / armour / ring from your items). */
  companionOpts(id) {
    const rec = this.game.state.companions.hired[id] || {};
    const perks = {};
    COMPANIONS[id].tree.forEach(([, , eff], i) => { if ((rec.level || 1) >= [3, 6, 10][i]) Object.assign(perks, eff); });
    let dmgMul = 1, hpMul = 1;
    for (const [slot, uid] of Object.entries(rec.gear || {})) {
      const f = this.game.state.find(uid); const d = f && defOf(f.item);
      if (!d) continue;
      if (slot === 'weapon' && d.dmg) dmgMul += ((d.dmg[0] + d.dmg[1]) / 2) / 30;
      if (d.stats) { hpMul += (d.stats.maxHp || 0) / 200; dmgMul += (d.stats.damagePct || 0) / 100; }
    }
    return { level: rec.level || 1, perks, dmgMul, hpMul };
  }

  onArea() {
    for (const a of this.list) a.remove();
    this.list = [];
    for (const s of this.shots) s.area.scene.remove(s.m);
    this.shots = [];
    const g = this.game, area = g.area;
    if (!area || !area.hostile) return;
    const c = g.state.companions;
    if (c.active && COMPANIONS[c.active] && c.hired[c.active]) this.list.push(new Ally(this, 'companion', c.active, COMPANIONS[c.active], this.companionOpts(c.active)));
    if (c.pet && PETS[c.pet]) this.list.push(new Ally(this, 'pet', c.pet, PETS[c.pet], { level: Math.max(1, Math.floor(g.state.progression.level / 2)) }));
    const st = g.player.stats || {};
    for (let i = 0; i < (st.spectralKnights || 0); i++) this.summon('spectral_knight', g.player.pos, { level: g.state.progression.level, life: 0 });
    if (st.packCall) this.summon('spirit_hound', g.player.pos, { level: g.state.progression.level });
  }

  summon(type, pos, o = {}) {
    if (!SUMMONS[type]) return null;
    if (this.list.filter((a) => a.kind === 'summon' && !a.gone).length >= 8) return null;
    const a = new Ally(this, 'summon', type, SUMMONS[type], { level: o.level || this.game.state.progression.level, life: o.life ?? 25, pos, dmgMul: o.dmgMul || 1 });
    this.list.push(a);
    this.game.area.dust.burst(a.pos.x, a.pos.y + 0.3, a.pos.z, 16, 2, 0.6, [0.4, 0.4, 0.5], 0.1, -2, 1);
    return a;
  }

  shoot(a, target, dmg) {
    const area = this.game.area, r = a.def.ranged;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: r.color }));
    m.position.set(a.pos.x, a.pos.y + 1.3, a.pos.z);
    area.scene.add(m);
    this.shots.push({ m, area, target, dmg, speed: r.speed, r, life: 3 });
  }

  cycleOrder() {
    const L = ['follow', 'hold', 'attack', 'stay'];
    this.order = L[(L.indexOf(this.order) + 1) % L.length];
    const names = { follow: 'Follow me', hold: 'Hold position', attack: 'Attack my target', stay: 'Stay back' };
    this.game.hud.feed(`Order: ${names[this.order]}`, '#80c0ff');
    if (this.order === 'attack' && !this.focus) {
      // the enemy you're looking at
      const p = this.game.player; let best = null, bd = 0.25;
      for (const e of this.game.enemies.list) { if (e.dead) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; let d = Math.atan2(dx, dz) - Math.atan2(p.forward.x, p.forward.z); d = Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); if (d < bd) { bd = d; best = e; } }
      this.focus = best;
    }
  }

  update(dt) {
    const g = this.game;
    if (g.input.consume('order')) { if (this.list.length) this.cycleOrder(); else g.hud.feed('No companion with you.', '#a08060'); }
    for (const a of this.list) if (!a.gone) a.update(dt, g);
    this.list = this.list.filter((a) => !a.gone);
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      const t = s.target;
      if (!t || t.dead || s.life <= 0) { s.area.scene.remove(s.m); this.shots.splice(i, 1); continue; }
      const to = t.headPos(new THREE.Vector3()).sub(s.m.position);
      const d = to.length();
      if (d < 0.5) {
        t.takeHit(s.dmg, s.m.position, 0.3);
        if (s.r.burn) t.ignite(s.r.burn, 3);
        if (s.r.chill) t.chill(s.r.chill, 2);
        if (s.r.poison) t.dot('poison', s.r.poison, 4);
        g.hud.damageNumber(t.headPos(new THREE.Vector3()), s.dmg, 'ally');
        s.area.scene.remove(s.m); this.shots.splice(i, 1); continue;
      }
      s.m.position.addScaledVector(to.normalize(), Math.min(d, s.speed * dt));
    }
  }

  /** Who an enemy goes after: allies close to it sometimes draw its attention. */
  targetFor(e, player) {
    if (e.def.boss || !this.list.length) return player;
    if (e._tgtAlly && !e._tgtAlly.dead && e._tgtAlly.pos.distanceTo(e.pos) < 8) return e._tgtAlly;
    let best = null, bd = Math.min(5, player.pos.distanceTo(e.pos) * 0.7);
    for (const a of this.list) { if (a.dead || a.perks.stealth) continue; const d = a.pos.distanceTo(e.pos); if (d < bd) { bd = d; best = a; } }
    return best || player;
  }
}
