// Derived player stats = base + equipped gear + learned skills.
// Recomputed whenever equipment or skills change.
import { ITEMS } from './items.js';
import { SKILLS, rankOf } from './skills.js';
import { CONFIG } from '../config.js';

export const BASE_STATS = {
  maxHp: CONFIG.player.maxHp,
  defense: 0,          // % damage reduction (capped)
  damagePct: 0,
  attackSpeedPct: 0,
  critChance: 12,
  critDmgPct: 75,      // crit = +75% damage
  speedPct: 0,
  sprintPct: 0,
  reach: 0,
  arcPct: 0,
  regen: 0,
  lifesteal: 0,
  executePct: 0,
  burnDps: 0,
  burnPct: 0,
  emberBurst: 0,
  flaskPct: 0,
  killHeal: 0,
  ashPct: 0,
  dropPct: 0,
  pyre: 0,
  deathDance: 0,
  maxStamina: 100,
  staminaRegenPct: 0,
  rollCostPct: 0,     // % cheaper rolls
  rollIframes: 0,     // extra seconds of invulnerability
  rollDistPct: 0,
  attackCostPct: 0,   // % cheaper attacks
};

export function computeStats(state) {
  const s = { ...BASE_STATS };
  for (const [, uid] of Object.entries(state.equipped)) {
    const f = state.find(uid);
    const def = f && ITEMS[f.item.id];
    if (!def || !def.stats) continue;
    for (const [k, v] of Object.entries(def.stats)) s[k] = (s[k] || 0) + v;
  }
  for (const node of SKILLS) {
    const r = rankOf(state.progression, node.id);
    if (!r) continue;
    for (const [k, v] of Object.entries(node.effects)) s[k] = (s[k] || 0) + v * r;
  }
  s.defense = Math.min(70, s.defense);
  s.attackSpeedPct = Math.max(-50, s.attackSpeedPct);
  return s;
}

/** Short summary rows for the inventory screen. */
export function statRows(s) {
  return [
    ['Max HP', s.maxHp],
    ['Damage', `+${s.damagePct}%`],
    ['Attack speed', `${s.attackSpeedPct >= 0 ? '+' : ''}${s.attackSpeedPct}%`],
    ['Critical', `${s.critChance}% (x${(1 + s.critDmgPct / 100).toFixed(2)})`],
    ['Defense', `${s.defense}%`],
    ['Move speed', `${s.speedPct >= 0 ? '+' : ''}${s.speedPct}%`],
    ['Stamina', `${s.maxStamina} (+${s.staminaRegenPct}% regen)`],
    ...(s.burnDps ? [['Burn', `${Math.round(s.burnDps * (1 + s.burnPct / 100))}/s`]] : []),
    ...(s.regen ? [['Regen', `${s.regen}/s`]] : []),
    ...(s.lifesteal ? [['Lifesteal', `${s.lifesteal}%`]] : []),
  ];
}
