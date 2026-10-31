// Skill tree. No classes: three paths (Iron / Ash / Shadow) branch from one
// root, with hybrid nodes between neighbouring paths. The mix of learned nodes
// steers the build. Skills can only be LEARNED at the trainer in town (Hall
// of Paths); keystones also need enough Renown. The inventory shows the tree
// read-only.
//
// Node: { id, name, desc, branch, x (0-100), y (0-160, root at the bottom),
//         max (ranks), requires: [ids] (all needed), points, fee (ashes/rank),
//         keystone, rank (renown rank index needed), effects: { stat: perRank } }

export const TREE_W = 100, TREE_H = 160;

export const BRANCHES = {
  root: { name: 'Awakened', color: '#b8a888' },
  iron: { name: 'Path of Iron', color: '#b0b4bc', desc: 'Steel, endurance, crushing blows.' },
  ash: { name: 'Path of Ash', color: '#e08040', desc: 'Forbidden flame and pale sorcery.' },
  shadow: { name: 'Path of Shadow', color: '#8a9a7a', desc: 'Speed, precision, the knife in the dark.' },
  hybrid: { name: 'Crossroads', color: '#c8a0d8', desc: 'Where two paths meet.' },
};

const N = (id, branch, x, y, name, desc, effects, o = {}) => ({
  id, branch, x, y, name, desc, effects,
  max: o.max || 1, requires: o.req || [], points: o.points || (o.key ? 2 : 1),
  fee: o.fee ?? Math.round((160 - y) / 14) * 25,
  keystone: !!o.key, capstone: !!o.key, rank: o.rank || 0,
});

export const SKILLS = [
  N('root', 'root', 50, 152, 'Awakened', 'You rose from the ash. Every path begins here.', {}, { fee: 0 }),

  // ======================= PATH OF IRON (x 6-30)
  N('w_vigor', 'iron', 18, 138, 'Vigor', '+15 max HP per rank.', { maxHp: 15 }, { max: 3, req: ['root'] }),
  N('w_heavy', 'iron', 10, 124, 'Heavy Hand', '+8% melee damage per rank.', { damagePct: 8 }, { max: 3, req: ['w_vigor'] }),
  N('w_skin', 'iron', 26, 124, 'Iron Skin', 'Take 5% less damage per rank.', { defense: 5 }, { max: 3, req: ['w_vigor'] }),
  N('w_cleave', 'iron', 6, 110, 'Cleave', 'Your swings cover a 35% wider arc.', { arcPct: 35 }, { req: ['w_heavy'] }),
  N('w_wind', 'iron', 18, 110, 'Second Wind', 'Regenerate 1 HP per second.', { regen: 1 }, { req: ['w_skin'] }),
  N('w_blood', 'iron', 30, 110, 'Bloodthirst', 'Heal for 6% of damage dealt.', { lifesteal: 6 }, { req: ['w_skin'] }),
  N('w_endure', 'iron', 10, 96, 'Endurance', '+15 max stamina per rank.', { maxStamina: 15 }, { max: 3, req: ['w_cleave'] }),
  N('w_guard', 'iron', 26, 96, 'Barbed Guard', 'Attackers take 10% of the damage they deal.', { thornsPct: 10 }, { req: ['w_wind'] }),
  N('w_stagger', 'iron', 6, 82, 'Shatter', 'Hits stagger 30% harder and deal +5% damage.', { staggerPct: 30, damagePct: 5 }, { req: ['w_endure'] }),
  N('w_jugg', 'iron', 18, 82, 'Juggernaut', '+30 max HP and 6% less damage taken.', { maxHp: 30, defense: 6 }, { req: ['w_endure', 'w_guard'] }),
  N('w_bulwark', 'iron', 30, 82, 'Bulwark', 'Take 4% less damage per rank.', { defense: 4 }, { max: 2, req: ['w_guard'] }),
  N('w_berserk', 'iron', 10, 68, 'Berserker', '+25% damage while below 40% HP.', { berserkPct: 25 }, { req: ['w_stagger'] }),
  N('w_ironlung', 'iron', 26, 68, 'Iron Lungs', 'Stamina regenerates 15% faster per rank.', { staminaRegenPct: 15 }, { max: 2, req: ['w_jugg'] }),
  N('w_brutal', 'iron', 6, 54, 'Brutality', '+20% critical damage per rank.', { critDmgPct: 20 }, { max: 2, req: ['w_berserk'] }),
  N('w_titan', 'iron', 18, 54, 'Titan Blood', '+10% damage and +20 max HP.', { damagePct: 10, maxHp: 20 }, { req: ['w_berserk', 'w_ironlung'] }),
  N('w_spikes', 'iron', 30, 54, 'Spiked Mail', 'Attackers take another 15% of their damage.', { thornsPct: 15 }, { req: ['w_bulwark'] }),
  N('w_warcry', 'iron', 12, 40, 'War Cry', 'Kills restore 10 stamina.', { killStamina: 10 }, { req: ['w_brutal', 'w_titan'] }),
  N('w_unyield', 'iron', 26, 40, 'Unyielding', '+25 max HP and 6% less damage taken.', { maxHp: 25, defense: 6 }, { req: ['w_titan', 'w_spikes'] }),
  N('w_exec', 'iron', 12, 26, 'Executioner', 'KEYSTONE: +60% damage to enemies below 30% HP.', { executePct: 60 }, { req: ['w_warcry'], key: true, rank: 3 }),
  N('w_last', 'iron', 26, 26, 'Last Stand', 'KEYSTONE: once per dungeon visit, a killing blow leaves you at 1 HP, invulnerable for 2s.', { cheatDeath: 1 }, { req: ['w_unyield'], key: true, rank: 4 }),
  N('w_colossus', 'iron', 19, 12, 'Colossus', 'KEYSTONE: +60 max HP, +20% damage, +10% defense.', { maxHp: 60, damagePct: 20, defense: 10 }, { req: ['w_exec', 'w_last'], key: true, rank: 5, points: 3 }),

  // ======================= PATH OF ASH (x 38-62)
  N('m_kindle', 'ash', 50, 138, 'Kindling', 'Hits set foes alight: 3 fire damage per second per rank.', { burnDps: 3 }, { max: 3, req: ['root'] }),
  N('m_ward', 'ash', 42, 124, 'Ash Ward', 'Take 4% less damage per rank.', { defense: 4 }, { max: 2, req: ['m_kindle'] }),
  N('m_ember', 'ash', 58, 124, 'Ember Burst', 'Critical hits explode for 18 fire damage around the target.', { emberBurst: 18 }, { req: ['m_kindle'] }),
  N('m_flask', 'ash', 38, 110, 'Alchemy', 'Flasks heal 30% more per rank.', { flaskPct: 30 }, { max: 2, req: ['m_ward'] }),
  N('m_spark', 'ash', 50, 110, 'Spark', '+2 burn damage and +2% crit.', { burnDps: 2, critChance: 2 }, { req: ['m_ward', 'm_ember'] }),
  N('m_pale', 'ash', 62, 110, 'Pale Flame', 'Burns last longer and deal 50% more.', { burnPct: 50 }, { req: ['m_ember'] }),
  N('m_cinder', 'ash', 42, 96, 'Cinders', 'Burns deal 25% more per rank.', { burnPct: 25 }, { max: 2, req: ['m_flask', 'm_spark'] }),
  N('m_embrace', 'ash', 58, 96, 'Warm Embrace', 'Kills heal 4 HP; +10 max HP.', { killHeal: 4, maxHp: 10 }, { req: ['m_spark', 'm_pale'] }),
  N('m_siphon', 'ash', 38, 82, 'Soul Siphon', 'Each kill restores 8 HP.', { killHeal: 8 }, { req: ['m_cinder'] }),
  N('m_focus', 'ash', 50, 82, 'Focus', 'Attacks cost 15% less stamina; +10% stamina regen.', { attackCostPct: 15, staminaRegenPct: 10 }, { req: ['m_cinder', 'm_embrace'] }),
  N('m_fortune', 'ash', 62, 82, 'Ashen Fortune', '+20% ashes from kills per rank.', { ashPct: 20 }, { max: 2, req: ['m_embrace'] }),
  N('m_glass', 'ash', 42, 68, 'Glass Cannon', '+12% damage, but 5% more damage taken.', { damagePct: 12, defense: -5 }, { req: ['m_siphon', 'm_focus'] }),
  N('m_smoke', 'ash', 58, 68, 'Smoke Veil', 'Rolls grant 0.1s more invulnerability.', { rollIframes: 0.1 }, { req: ['m_focus', 'm_fortune'] }),
  N('m_brand', 'ash', 38, 54, 'Searing Brand', '+30% damage to enemies at full HP.', { firstStrikePct: 30 }, { req: ['m_glass'] }),
  N('m_heat', 'ash', 50, 54, 'White Heat', '+3 burn damage per rank.', { burnDps: 3 }, { max: 2, req: ['m_glass', 'm_smoke'] }),
  N('m_distill', 'ash', 62, 54, 'Distillation', 'Flasks heal 25% more; +10 max stamina.', { flaskPct: 25, maxStamina: 10 }, { req: ['m_smoke'] }),
  N('m_wildfire', 'ash', 44, 40, 'Wildfire', 'Ember bursts deal +12 damage; +3% crit.', { emberBurst: 12, critChance: 3 }, { req: ['m_brand', 'm_heat'] }),
  N('m_ashskin', 'ash', 56, 40, 'Ashen Skin', '5% less damage taken, regenerate 0.5 HP/s.', { defense: 5, regen: 0.5 }, { req: ['m_heat', 'm_distill'] }),
  N('m_pyre', 'ash', 44, 26, 'Pyre', 'KEYSTONE: every 5th hit releases a fire nova (35 dmg, 4m).', { pyre: 35 }, { req: ['m_wildfire'], key: true, rank: 3 }),
  N('m_phoenix', 'ash', 56, 26, 'Phoenix Brand', 'KEYSTONE: burning enemies spread their flames when they die.', { burnSpread: 1 }, { req: ['m_ashskin'], key: true, rank: 4 }),
  N('m_avatar', 'ash', 50, 12, 'Ashen Avatar', 'KEYSTONE: +8 burn damage, +15% damage, novas +20 damage.', { burnDps: 8, damagePct: 15, pyre: 20 }, { req: ['m_pyre', 'm_phoenix'], key: true, rank: 5, points: 3 }),

  // ======================= PATH OF SHADOW (x 70-94)
  N('r_fleet', 'shadow', 82, 138, 'Fleet Foot', '+6% move speed per rank.', { speedPct: 6 }, { max: 3, req: ['root'] }),
  N('r_quick', 'shadow', 74, 124, 'Quick Blade', '+8% attack speed per rank.', { attackSpeedPct: 8 }, { max: 3, req: ['r_fleet'] }),
  N('r_keen', 'shadow', 90, 124, 'Keen Edge', '+5% critical chance per rank.', { critChance: 5 }, { max: 3, req: ['r_fleet'] }),
  N('r_reach', 'shadow', 70, 110, 'Long Reach', '+0.4 m weapon reach.', { reach: 0.4 }, { req: ['r_quick'] }),
  N('r_step', 'shadow', 82, 110, 'Shadowstep', 'Sprinting is 25% faster.', { sprintPct: 25 }, { req: ['r_quick'] }),
  N('r_cruel', 'shadow', 94, 110, 'Cruel Wounds', '+30% critical damage per rank.', { critDmgPct: 30 }, { max: 2, req: ['r_keen'] }),
  N('r_tumble', 'shadow', 74, 96, 'Tumbler', 'Rolls cost 15% less stamina per rank.', { rollCostPct: 15 }, { max: 2, req: ['r_reach', 'r_step'] }),
  N('r_venom', 'shadow', 90, 96, 'Serrated Edge', 'Hits cause bleeding: 3 damage per second per rank.', { bleedDps: 3 }, { max: 2, req: ['r_cruel'] }),
  N('r_lucky', 'shadow', 70, 82, 'Grave Robber', '+25% item drop chance per rank.', { dropPct: 25 }, { max: 2, req: ['r_tumble'] }),
  N('r_evasion', 'shadow', 82, 82, 'Evasion', 'Rolls grant 0.08s more invulnerability per rank.', { rollIframes: 0.08 }, { max: 2, req: ['r_tumble'] }),
  N('r_frost', 'shadow', 94, 82, 'Frostbite', 'Hits chill enemies, slowing them by 30%.', { chillPct: 30 }, { req: ['r_venom'] }),
  N('r_ambush', 'shadow', 74, 68, 'Ambush', '+35% damage on attacks right after a roll.', { rollStrikePct: 35 }, { req: ['r_lucky', 'r_evasion'] }),
  N('r_opport', 'shadow', 90, 68, 'Opportunist', '+25% damage to enemies at full HP, +3% crit.', { firstStrikePct: 25, critChance: 3 }, { req: ['r_evasion', 'r_frost'] }),
  N('r_wind', 'shadow', 70, 54, 'Second Breath', '+15% stamina regen and +4% move speed.', { staminaRegenPct: 15, speedPct: 4 }, { req: ['r_ambush'] }),
  N('r_hamstring', 'shadow', 82, 54, 'Hamstring', 'Hits chill (20%) and bleed (2/s).', { chillPct: 20, bleedDps: 2 }, { req: ['r_ambush', 'r_opport'] }),
  N('r_assassin', 'shadow', 94, 54, 'Assassin', '+30% critical damage.', { critDmgPct: 30 }, { req: ['r_opport'] }),
  N('r_ghost', 'shadow', 76, 40, 'Ghost Step', 'Rolls go 25% further and cost 10% less.', { rollDistPct: 25, rollCostPct: 10 }, { req: ['r_wind', 'r_hamstring'] }),
  N('r_reaper', 'shadow', 88, 40, 'Reaper', 'Kills restore 15 stamina and 3 HP.', { killStamina: 15, killHeal: 3 }, { req: ['r_hamstring', 'r_assassin'] }),
  N('r_dance', 'shadow', 76, 26, 'Death\'s Dance', 'KEYSTONE: after a kill, your next hit is always critical.', { deathDance: 1 }, { req: ['r_ghost'], key: true, rank: 3 }),
  N('r_phantom', 'shadow', 88, 26, 'Phantom Blade', 'KEYSTONE: rolling through enemies cuts them for 30 damage.', { rollDamage: 30 }, { req: ['r_reaper'], key: true, rank: 4 }),
  N('r_sovereign', 'shadow', 82, 12, 'Night Sovereign', 'KEYSTONE: +10% crit, +15% attack speed, +10% move speed.', { critChance: 10, attackSpeedPct: 15, speedPct: 10 }, { req: ['r_dance', 'r_phantom'], key: true, rank: 5, points: 3 }),

  // ======================= CROSSROADS (hybrids between neighbouring paths)
  N('h_temper', 'hybrid', 34, 103, 'Tempered Flame', 'Iron + Ash: 3% lifesteal, +2 burn damage.', { lifesteal: 3, burnDps: 2 }, { req: ['w_blood', 'm_flask'] }),
  N('h_forge', 'hybrid', 34, 75, 'Forge-Blessed', 'Iron + Ash: 5% less damage taken, kills heal 4 HP.', { defense: 5, killHeal: 4 }, { req: ['w_bulwark', 'm_siphon'] }),
  N('h_molten', 'hybrid', 34, 47, 'Molten Skin', 'Iron + Ash: attackers take 15% damage, burns +20%.', { thornsPct: 15, burnPct: 20 }, { req: ['w_spikes', 'm_brand'] }),
  N('h_smolder', 'hybrid', 66, 103, 'Smoldering Edge', 'Ash + Shadow: hits bleed (2/s) and burn (+2/s).', { bleedDps: 2, burnDps: 2 }, { req: ['m_pale', 'r_reach'] }),
  N('h_gravefort', 'hybrid', 66, 75, 'Grave Fortune', 'Ash + Shadow: +15% ashes, +15% drop chance.', { ashPct: 15, dropPct: 15 }, { req: ['m_fortune', 'r_lucky'] }),
  N('h_quicksilver', 'hybrid', 66, 47, 'Quicksilver', 'Ash + Shadow: +8% attack speed, +10% stamina regen.', { attackSpeedPct: 8, staminaRegenPct: 10 }, { req: ['m_distill', 'r_wind'] }),
];

export const SKILL_MAP = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function xpForLevel(level) { return 100 + (level - 1) * 60; }

/** Fresh progression record (part of the SAVED state, never lost on death). */
export function newProgression() {
  return { level: 1, xp: 0, skillPoints: 1, skills: { root: 1 } };
}

export function addXp(prog, amount) {
  prog.xp += amount;
  let gained = 0;
  while (prog.xp >= xpForLevel(prog.level)) {
    prog.xp -= xpForLevel(prog.level);
    prog.level++; prog.skillPoints++; gained++;
  }
  return gained;
}

export function rankOf(prog, id) { return (prog.skills && prog.skills[id]) || 0; }

/** Why a node can't be learned right now, or null if it can. renownRank: index. */
export function learnBlocker(prog, node, ashes, renownRank = 0, rankTitle = (i) => `rank ${i}`) {
  const r = rankOf(prog, node.id);
  if (r >= node.max) return 'Mastered';
  for (const req of node.requires) if (rankOf(prog, req) < 1) return `Requires ${SKILL_MAP[req].name}`;
  if (node.rank && renownRank < node.rank) return `Keystone: requires renown rank "${rankTitle(node.rank)}"`;
  if (prog.skillPoints < node.points) return `Needs ${node.points} skill point${node.points > 1 ? 's' : ''}`;
  if (ashes < node.fee) return `Needs ${node.fee} ashes`;
  return null;
}

/** Node is reachable (prerequisites met) - for drawing. */
export function isOpen(prog, node) {
  return node.requires.every((req) => rankOf(prog, req) > 0);
}
