// Active skills for the 4-slot skill bar (keys 1-4, D-pad, touch buttons).
// Each: { name, icon, color, cost (mana), cd (seconds), cast(combat, game) }.
// Damage scales with your weapon and "% skill damage".
import * as THREE from '../../lib/three.module.min.js';

const fwdPoint = (p, d) => p.pos.clone().addScaledVector(p.forward, d);

export const ACTIVES = {
  war_stomp: { name: 'War Stomp', icon: '✷', color: '#c0c8d0', cost: 20, cd: 8, cast(c, g) { c.nova(g.player.pos, 4.5, Math.round(30 * c.dmgScale() * c.skillMul()), [0.8, 0.8, 0.85], 2.5, true); for (const e of g.enemies.list) if (!e.dead && !e.brain && e.pos.distanceTo(g.player.pos) < 4.5) { e.state = 'stagger'; e.timer = 1.2; } g.player.shake = 0.6; } },
  iron_wall: { name: 'Iron Wall', icon: '⛨', color: '#b0b8c8', cost: 25, cd: 16, cast(c, g) { g.player.absorb = Math.round(g.player.maxHp * 0.35); c.buff('defense', 20, 6); g.hud.feed('Iron Wall', '#c0c8d0'); } },
  blood_rite: { name: 'Blood Rite', icon: '♥', color: '#e04040', cost: 0, cd: 14, cast(c, g) { const p = g.player; p.hp = Math.max(1, p.hp - p.maxHp * 0.15); c.buff('damagePct', 40, 8); g.area.glow.burst(p.pos.x, p.pos.y + 1, p.pos.z, 30, 2, 0.8, [0.9, 0.1, 0.1], 0.06, 0, 1); } },
  crimson_leech: { name: 'Crimson Leech', icon: '☘', color: '#c03040', cost: 25, cd: 10, cast(c, g) { let tot = 0; for (const e of g.enemies.list) if (!e.dead && e.pos.distanceTo(g.player.pos) < 6) tot += c.hitEnemy(e, { base: 18 * c.dmgScale(), skill: true, noProc: true }); g.player.heal(tot * 0.4); } },
  raise_dead: { name: 'Raise the Dead', icon: '☠', color: '#d0c8b0', cost: 35, cd: 22, cast(c, g) { if (g.allies) for (let i = 0; i < 2; i++) g.allies.summon('skeleton', fwdPoint(g.player, 2), { life: 25, dmgMul: c.skillMul() }); } },
  curse: { name: 'Curse of Frailty', icon: '☣', color: '#9080a0', cost: 20, cd: 12, cast(c, g) { for (const e of g.enemies.list) if (!e.dead && e.pos.distanceTo(g.player.pos) < 9) { e.cursedT = 8; e.chill(30, 8); g.area.dust.burst(e.pos.x, e.pos.y + 1, e.pos.z, 10, 1, 0.8, [0.4, 0.2, 0.5], 0.08, 0, 1); } } },
  shadow_step: { name: 'Shadow Step', icon: '⇢', color: '#8a9a7a', cost: 15, cd: 7, cast(c, g) { const p = g.player; const to = fwdPoint(p, 6); const q = { x: to.x, z: to.z }; g.area.collision.resolve(q, 0.4, p.pos.y, 1.7, 0.45); g.area.glow.burst(p.pos.x, p.pos.y + 1, p.pos.z, 20, 2, 0.5, [0.3, 0.3, 0.3], 0.08, 0, 1); p.pos.x = q.x; p.pos.z = q.z; c.nextCrit = true; p.invuln = Math.max(p.invuln, 0.3); } },
  fan_of_knives: { name: 'Fan of Knives', icon: '†', color: '#c0c0c8', cost: 20, cd: 6, cast(c, g) { for (let i = 0; i < 10; i++) c.fireShot({ speed: 24, knife: true, spread: (i / 10) * Math.PI * 2, skill: true }, Math.round(12 * c.dmgScale() * c.skillMul())); } },
  volley: { name: 'Volley', icon: '⇟', color: '#a07848', cost: 25, cd: 10, cast(c, g) { const at = fwdPoint(g.player, 8); let n = 0; const iv = setInterval(() => { if (++n > 6) return clearInterval(iv); c.nova(at, 3.2, Math.round(14 * c.dmgScale() * c.skillMul()), [0.7, 0.6, 0.4], 0.5); }, 180); } },
  bear_trap: { name: 'Bear Trap', icon: '⌂', color: '#806040', cost: 15, cd: 9, cast(c, g) { const at = fwdPoint(g.player, 2); g.projectiles.zone(g.area, at.x, g.player.pos.y, at.z, { r: 1.6, dur: 15, color: 0x806040, hurtsEnemies: true, enemyDps: 20 * c.dmgScale(), kind: 'bleed' }); const iv = setInterval(() => { for (const e of g.enemies.list) if (!e.dead && e.pos.distanceTo(at) < 1.8) e.chill(90, 1); }, 300); setTimeout(() => clearInterval(iv), 15000); } },
  chain_lightning: { name: 'Chain Lightning', icon: 'ϟ', color: '#e0e080', cost: 25, cd: 5, cast(c, g) { const p = g.player; let best = null, bd = 14; for (const e of g.enemies.list) { if (e.dead) continue; const d = e.pos.distanceTo(p.pos); if (d < bd) { bd = d; best = e; } } if (best) { c.hitEnemy(best, { base: 30 * c.dmgScale(), skill: true, noProc: true }); c.chain(best, Math.round(24 * c.dmgScale() * c.skillMul()), 5, [0.9, 0.9, 0.5]); } } },
  thunder_dash: { name: 'Thunder Dash', icon: '⚡', color: '#f0e070', cost: 20, cd: 12, cast(c, g) { const p = g.player; p.dashCharges = p.maxDashes; c.nova(p.pos, 3.5, Math.round(22 * c.dmgScale() * c.skillMul()), [0.9, 0.9, 0.4], 1); } },
  frost_nova: { name: 'Frost Nova', icon: '❄', color: '#a0d8ff', cost: 25, cd: 10, cast(c, g) { c.nova(g.player.pos, 5, Math.round(18 * c.dmgScale() * c.skillMul()), [0.6, 0.85, 1], 0.3); for (const e of g.enemies.list) if (!e.dead && e.pos.distanceTo(g.player.pos) < 5.5) { e.chill(100, 2.5); if (!e.brain) { e.state = 'stagger'; e.timer = 2.5; } } } },
  ice_lance: { name: 'Ice Lance', icon: '➴', color: '#80c0ff', cost: 15, cd: 3, cast(c) { c.fireShot({ speed: 30, size: 0.2, color: 0x90d0ff, pierce: 4, chill: 50, skill: true }, Math.round(36 * c.dmgScale() * c.skillMul())); } },
  fireball: { name: 'Fireball', icon: '☄', color: '#ff7030', cost: 20, cd: 3, cast(c) { c.fireShot({ speed: 18, size: 0.3, color: 0xff6020, aoe: 3, burn: 8, skill: true }, Math.round(34 * c.dmgScale() * c.skillMul())); } },
  flame_nova: { name: 'Flame Nova', icon: '♨', color: '#ff9040', cost: 30, cd: 9, cast(c, g) { c.nova(g.player.pos, 5, Math.round(26 * c.dmgScale() * c.skillMul()), [1, 0.5, 0.15], 1.2, false, 8); } },
  holy_light: { name: 'Holy Light', icon: '☀', color: '#f0e0a0', cost: 35, cd: 18, cast(c, g) { const p = g.player; p.heal(p.maxHp * 0.35); p.dot = null; for (const a of g.allies ? g.allies.list : []) if (!a.dead) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.35); g.area.glow.burst(p.pos.x, p.pos.y + 1, p.pos.z, 40, 2, 1.2, [1, 0.95, 0.6], 0.06, 1.5, 1); } },
  aegis: { name: 'Aegis', icon: '◈', color: '#f0d890', cost: 30, cd: 20, cast(c, g) { g.player.absorb = Math.round(g.player.maxHp * 0.5); c.buff('regen', 4, 8); g.hud.feed('Aegis', '#f0d890'); } },
  call_wolf: { name: 'Call of the Wolf', icon: '❁', color: '#90b070', cost: 30, cd: 25, cast(c, g) { if (g.allies) g.allies.summon('wolf', fwdPoint(g.player, 2), { life: 30, dmgMul: c.skillMul() }); } },
  roar: { name: 'Primal Roar', icon: '❂', color: '#70a050', cost: 20, cd: 15, cast(c, g) { c.buff('damagePct', 15, 8); c.buff('petDmgPct', 50, 8); for (const e of g.enemies.list) if (!e.dead && !e.brain && e.pos.distanceTo(g.player.pos) < 6) { e.state = 'stagger'; e.timer = 1; } g.player.shake = 0.4; } },
};

/** Cooldown/mana handling for the skill bar. Attached to CombatSystem. */
export function installActives(combat, game) {
  combat.skillCd = {};
  combat.skillMul = () => 1 + ((combat.stats.skillDmgPct || 0) / 100);
  combat.castSlot = (i) => {
    const id = game.state.skillbar[i];
    const A = id && ACTIVES[id];
    if (!A) { game.hud.feed(`Skill slot ${i + 1} is empty — assign skills in the Skill Tree.`, '#a08060'); return; }
    const p = game.player;
    if (p.dead || game.transitioning) return;
    if ((combat.skillCd[id] || 0) > 0) return;
    if (!game.area.hostile && !['iron_wall', 'aegis', 'holy_light'].includes(id)) { game.hud.feed('Not here.', '#a08060'); return; }
    if (!p.useMana(A.cost)) { game.hud.feed('Not enough mana.', '#6070d0'); return; }
    combat.skillCd[id] = A.cd * (1 - (combat.stats.cdrPct || 0) / 100);
    A.cast(combat, game);
  };
  combat.updateActives = (dt) => {
    for (const k of Object.keys(combat.skillCd)) if (combat.skillCd[k] > 0) combat.skillCd[k] -= dt;
    for (let i = 0; i < 4; i++) if (game.input.consume('skill' + (i + 1))) combat.castSlot(i);
    for (const e of game.enemies.list) if (e.cursedT > 0) e.cursedT -= dt;
    game.hud.setSkills(game.state.skillbar.map((id) => {
      const A = id && ACTIVES[id];
      if (!A) return null;
      const cdMax = A.cd * (1 - (combat.stats.cdrPct || 0) / 100);
      return { icon: A.icon, color: A.color, name: `${A.name} (${A.cost} mana, ${A.cd}s)`, cd: Math.max(0, (combat.skillCd[id] || 0) / cdMax), mana: game.player.mana >= A.cost };
    }));
  };
  void THREE;
}
