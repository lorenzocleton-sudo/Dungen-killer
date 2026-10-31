// Skill tree. No classes: three paths branch from one root, and the mix of
// learned nodes steers the build (warrior / mage / rogue).
// Skills can only be LEARNED at the trainer in town (Hall of Paths); the
// inventory screen shows the tree read-only.
//
// Node: { id, name, desc, branch, x, y (layout, 0-100), max (ranks),
//         requires: [ids] (all needed), points (per rank), fee (ashes per rank),
//         effects: { stat: valuePerRank } }
// Stats are summed by stats.js.

export const BRANCHES = {
  root: { name: 'Awakened', color: '#b8a888' },
  iron: { name: 'Path of Iron', color: '#b0b4bc', desc: 'Steel, endurance, crushing blows.' },
  ash: { name: 'Path of Ash', color: '#e08040', desc: 'Forbidden flame and pale sorcery.' },
  shadow: { name: 'Path of Shadow', color: '#8a9a7a', desc: 'Speed, precision, the knife in the dark.' },
};

const N = (id, branch, x, y, name, desc, effects, o = {}) => ({
  id, branch, x, y, name, desc, effects,
  max: o.max || 1, requires: o.req || [], points: o.points || 1, fee: o.fee ?? Math.round((100 - y) / 16) * 30,
  capstone: !!o.cap,
});

export const SKILLS = [
  N('root', 'root', 50, 95, 'Awakened', 'You rose from the ash. Every path begins here.', {}, { fee: 0 }),
  // ---------------- Path of Iron
  N('w_vigor', 'iron', 18, 80, 'Vigor', '+15 max HP per rank.', { maxHp: 15 }, { max: 3, req: ['root'] }),
  N('w_heavy', 'iron', 10, 64, 'Heavy Hand', '+8% melee damage per rank.', { damagePct: 8 }, { max: 3, req: ['w_vigor'] }),
  N('w_skin', 'iron', 25, 64, 'Iron Skin', 'Take 5% less damage per rank.', { defense: 5 }, { max: 3, req: ['w_vigor'] }),
  N('w_cleave', 'iron', 5.5, 48, 'Cleave', 'Your swings cover a 35% wider arc.', { arcPct: 35 }, { req: ['w_heavy'] }),
  N('w_wind', 'iron', 16, 48, 'Second Wind', 'Regenerate 1 HP per second.', { regen: 1 }, { req: ['w_skin'] }),
  N('w_blood', 'iron', 27, 48, 'Bloodthirst', 'Heal for 6% of damage dealt.', { lifesteal: 6 }, { req: ['w_skin'] }),
  N('w_jugg', 'iron', 12, 32, 'Juggernaut', '+30 max HP and 6% less damage taken.', { maxHp: 30, defense: 6 }, { req: ['w_cleave', 'w_wind'] }),
  N('w_exec', 'iron', 20, 13, 'Executioner', '+60% damage to enemies below 30% HP.', { executePct: 60 }, { req: ['w_jugg', 'w_blood'], cap: true, points: 2 }),
  // ---------------- Path of Ash
  N('m_kindle', 'ash', 50, 80, 'Kindling', 'Hits set foes alight: 3 fire damage per second per rank.', { burnDps: 3 }, { max: 3, req: ['root'] }),
  N('m_ward', 'ash', 43, 64, 'Ash Ward', 'Take 4% less damage per rank.', { defense: 4 }, { max: 2, req: ['m_kindle'] }),
  N('m_ember', 'ash', 57, 64, 'Ember Burst', 'Critical hits explode for 18 fire damage around the target.', { emberBurst: 18 }, { req: ['m_kindle'] }),
  N('m_flask', 'ash', 40, 48, 'Alchemy', 'Flasks heal 30% more per rank.', { flaskPct: 30 }, { max: 2, req: ['m_ward'] }),
  N('m_pale', 'ash', 60, 48, 'Pale Flame', 'Burns last longer and deal 50% more.', { burnPct: 50 }, { req: ['m_ember'] }),
  N('m_siphon', 'ash', 44, 32, 'Soul Siphon', 'Each kill restores 8 HP.', { killHeal: 8 }, { req: ['m_flask'] }),
  N('m_fortune', 'ash', 57, 32, 'Ashen Fortune', '+20% ashes from kills per rank.', { ashPct: 20 }, { max: 2, req: ['m_pale'] }),
  N('m_pyre', 'ash', 50, 13, 'Pyre', 'Every 5th hit releases a fire nova (35 dmg, 4m).', { pyre: 35 }, { req: ['m_siphon', 'm_fortune'], cap: true, points: 2 }),
  // ---------------- Path of Shadow
  N('r_fleet', 'shadow', 82, 80, 'Fleet Foot', '+6% move speed per rank.', { speedPct: 6 }, { max: 3, req: ['root'] }),
  N('r_quick', 'shadow', 74, 64, 'Quick Blade', '+8% attack speed per rank.', { attackSpeedPct: 8 }, { max: 3, req: ['r_fleet'] }),
  N('r_keen', 'shadow', 90, 64, 'Keen Edge', '+5% critical chance per rank.', { critChance: 5 }, { max: 3, req: ['r_fleet'] }),
  N('r_reach', 'shadow', 73, 48, 'Long Reach', '+0.4 m weapon reach.', { reach: 0.4 }, { req: ['r_quick'] }),
  N('r_step', 'shadow', 84, 48, 'Shadowstep', 'Sprinting is 25% faster.', { sprintPct: 25 }, { req: ['r_quick'] }),
  N('r_cruel', 'shadow', 94.5, 48, 'Cruel Wounds', '+30% critical damage per rank.', { critDmgPct: 30 }, { max: 2, req: ['r_keen'] }),
  N('r_lucky', 'shadow', 89, 32, 'Grave Robber', '+25% item drop chance per rank.', { dropPct: 25 }, { max: 2, req: ['r_cruel'] }),
  N('r_dance', 'shadow', 80, 13, 'Death\'s Dance', 'After a kill, your next hit is always critical.', { deathDance: 1 }, { req: ['r_step', 'r_lucky'], cap: true, points: 2 }),
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

/** Why a node can't be learned right now, or null if it can. */
export function learnBlocker(prog, node, ashes) {
  const r = rankOf(prog, node.id);
  if (r >= node.max) return 'Mastered';
  for (const req of node.requires) if (rankOf(prog, req) < 1) return `Requires ${SKILL_MAP[req].name}`;
  if (prog.skillPoints < node.points) return `Needs ${node.points} skill point${node.points > 1 ? 's' : ''}`;
  if (ashes < node.fee) return `Needs ${node.fee} ashes`;
  return null;
}

/** Node is reachable (prerequisites met) - for drawing. */
export function isOpen(prog, node) {
  return node.requires.every((req) => rankOf(prog, req) > 0);
}
