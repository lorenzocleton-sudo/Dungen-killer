// Derived player stats = base + level + equipped gear (affixes, gems, sets,
// uniques, curses) + learned skills + Ascension + temporary buffs.
// Recomputed whenever equipment or skills change.
import { defOf } from './items.js';
import { SKILLS, rankOf } from './skills.js';
import { SETS } from './itemgen.js';
import { CONFIG } from '../config.js';

export const BASE_STATS = {
  maxHp: CONFIG.player.maxHp, defense: 0, damagePct: 0, attackSpeedPct: 0, critChance: 10, critDmgPct: 75,
  speedPct: 0, reach: 0, arcPct: 0, regen: 0, lifesteal: 0, executePct: 0, burnDps: 0, burnPct: 0, emberBurst: 0,
  flaskPct: 0, killHeal: 0, ashPct: 0, dropPct: 0, pyre: 0, deathDance: 0, maxStamina: 100, staminaRegenPct: 0,
  rollCostPct: 0, rollIframes: 0, rollDistPct: 0, attackCostPct: 0, maxMana: 100, manaRegen: 0, blockPct: 0,
  resFire: 0, resFrost: 0, resPoison: 0, resAll: 0, cdrPct: 0, skillDmgPct: 0, healPct: 0, maxHpPct: 0,
};

/** Set pieces worn: { setId: count }. */
export function setCounts(state) {
  const n = {};
  for (const uid of Object.values(state.equipped)) {
    const f = state.find(uid); const d = f && defOf(f.item);
    if (d && d.set) n[d.set] = (n[d.set] || 0) + 1;
  }
  return n;
}

export function computeStats(state, extra) {
  const s = { ...BASE_STATS };
  const add = (k, v) => { s[k] = (s[k] || 0) + v; };
  s.maxHp += (state.progression.level - 1) * 5;      // levels make you sturdier
  let weapon = null;
  for (const [slot, uid] of Object.entries(state.equipped)) {
    const f = state.find(uid);
    const def = f && defOf(f.item);
    if (!def || !def.stats) continue;
    if (slot === 'weapon') weapon = def;
    for (const [k, v] of Object.entries(def.stats)) add(k, v);
  }
  for (const [id, c] of Object.entries(setCounts(state))) {
    const S = SETS[id]; if (!S) continue;
    for (const t of [2, 4, 6]) if (c >= t) for (const [k, v] of Object.entries(S.bonus[t])) add(k, v);
  }
  for (const node of SKILLS) {
    const r = rankOf(state.progression, node.id);
    if (!r || !node.effects) continue;
    for (const [k, v] of Object.entries(node.effects)) add(k, v * r);
  }
  const asc = state.ascension || {};
  for (const [k, v] of Object.entries(asc.spent || {})) {
    const per = { damagePct: 3, maxHpPct: 3, critChance: 1, speedPct: 1, ashPct: 5, cdrPct: 1 }[k] || 0;
    add(k, v * per);
  }
  if (extra) for (const [k, v] of Object.entries(extra)) add(k, v);
  s.maxHp = Math.round(s.maxHp * (1 + s.maxHpPct / 100));
  s.resFire = Math.min(90, s.resFire + s.resAll); s.resFrost = Math.min(90, s.resFrost + s.resAll); s.resPoison = Math.min(90, s.resPoison + s.resAll);
  if (s.resFire >= 100) s.resFire = 100;
  s.defense = Math.min(75, s.defense);
  s.critChance = Math.min(85, s.critChance);
  s.attackSpeedPct = Math.max(-50, s.attackSpeedPct);
  s.cdrPct = Math.min(50, s.cdrPct);
  s.weapon = weapon;
  return s;
}

/** Short summary rows for the inventory screen. */
export function statRows(s) {
  return [
    ['Max HP', s.maxHp],
    ['Damage', `+${Math.round(s.damagePct)}%`],
    ['Attack speed', `${s.attackSpeedPct >= 0 ? '+' : ''}${Math.round(s.attackSpeedPct)}%`],
    ['Critical', `${s.critChance.toFixed(1)}% (x${(1 + s.critDmgPct / 100).toFixed(2)})`],
    ['Defense', `${Math.round(s.defense)}%`],
    ['Move speed', `${s.speedPct >= 0 ? '+' : ''}${Math.round(s.speedPct)}%`],
    ['Stamina / Mana', `${s.maxStamina} / ${s.maxMana}`],
    ['Resist F/I/P', `${s.resFire}/${s.resFrost}/${s.resPoison}%`],
    ...(s.cdrPct ? [['Cooldowns', `-${s.cdrPct}%`]] : []),
    ...(s.burnDps ? [['Burn', `${Math.round(s.burnDps * (1 + s.burnPct / 100))}/s`]] : []),
    ...(s.regen ? [['Regen', `${s.regen.toFixed(1)}/s`]] : []),
    ...(s.lifesteal ? [['Lifesteal', `${s.lifesteal}%`]] : []),
  ];
}
