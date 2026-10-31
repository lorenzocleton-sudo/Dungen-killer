// Skill tree STUB. No classes: the player spends points in branches and the
// mix of unlocked nodes steers the build (warrior / mage / rogue ...).
// Only the data structure exists for now; nodes have no effects yet.
//
// Node shape:
//   { id, name, desc, cost, requires: [nodeIds], effects: { stat: delta } }
// Effects are meant to be read by a future StatSystem, e.g.
//   effects: { maxHp: +10 } or { meleeDamage: 0.1 } (10% more)

export const SKILL_TREE = {
  branches: [
    {
      id: 'warrior', name: 'Path of Iron', desc: 'Steel, endurance, crushing blows.',
      nodes: [
        { id: 'w_vigor', name: '???', desc: 'Not yet discovered.', cost: 1, requires: [], effects: {} },
        { id: 'w_heft', name: '???', desc: 'Not yet discovered.', cost: 1, requires: ['w_vigor'], effects: {} },
      ],
    },
    {
      id: 'mage', name: 'Path of Ash', desc: 'Forbidden flame and pale sorcery.',
      nodes: [
        { id: 'm_spark', name: '???', desc: 'Not yet discovered.', cost: 1, requires: [], effects: {} },
        { id: 'm_focus', name: '???', desc: 'Not yet discovered.', cost: 1, requires: ['m_spark'], effects: {} },
      ],
    },
    {
      id: 'rogue', name: 'Path of Shadow', desc: 'Speed, poison, the knife in the dark.',
      nodes: [
        { id: 'r_step', name: '???', desc: 'Not yet discovered.', cost: 1, requires: [], effects: {} },
        { id: 'r_edge', name: '???', desc: 'Not yet discovered.', cost: 1, requires: ['r_step'], effects: {} },
      ],
    },
  ],
};

export function xpForLevel(level) { return 100 + (level - 1) * 60; }

/** Fresh progression record (part of the SAVED state, never lost on death). */
export function newProgression() {
  return { level: 1, xp: 0, skillPoints: 0, unlocked: [] };
}

/** Add XP, returns number of levels gained. */
export function addXp(prog, amount) {
  prog.xp += amount;
  let gained = 0;
  while (prog.xp >= xpForLevel(prog.level)) {
    prog.xp -= xpForLevel(prog.level);
    prog.level++; prog.skillPoints++; gained++;
  }
  return gained;
}

export function canUnlock(prog, node) {
  return false; // stub: skill tree content comes later
}
