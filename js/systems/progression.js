// Depth progression helpers: recommended levels, danger ratings, XP falloff,
// gear score, Ascension. Difficulty per dungeon level is FIXED (see
// levelHpMul/levelDmgMul in enemy.js); only the player gets stronger.

/** Player level the game expects for a main-dungeon level. */
export function recommendedLevel(L) { return Math.round(1 + (L - 1) * 1.5); }

/** Average item level of equipped gear (weapon counts double). */
export function gearScore(state, defOf) {
  let sum = 0, n = 0;
  for (const [slot, uid] of Object.entries(state.equipped)) {
    const f = state.find(uid);
    if (!f) continue;
    const d = defOf(f.item);
    if (!d || d.kind !== 'gear') continue;
    const il = d.ilvl || Math.max(1, Math.round((d.value || 40) / 60));
    const w = slot === 'weapon' ? 2 : 1;
    sum += il * w; n += w;
  }
  return n ? sum / Math.max(n, 6) : 0;
}

/** Player "power level", comparable to recommendedLevel(). */
export function powerLevel(game) {
  const st = game.state;
  const gs = gearScore(st, game.defOf);
  return st.progression.level * 0.55 + gs * 1.5 * 0.45 + (st.ascension ? st.ascension.level * 3 : 0);
}

/** Danger of a level for the current character: green / yellow / red / skull. */
export function dangerFor(L, game) {
  const d = powerLevel(game) - recommendedLevel(L);
  if (d >= 2) return { id: 'green', label: 'Safe', color: '#70c060', icon: '●' };
  if (d >= -3) return { id: 'yellow', label: 'Fair', color: '#e0c050', icon: '●' };
  if (d >= -9) return { id: 'red', label: 'Dangerous', color: '#e05040', icon: '●' };
  return { id: 'skull', label: 'Deadly', color: '#d0d0d0', icon: '☠' };
}

/** XP multiplier: farming levels far below you gives little XP (loot unchanged). */
export function xpMul(L, playerLevel) {
  const over = playerLevel - recommendedLevel(L) - 4;
  return over <= 0 ? 1 : Math.max(0.1, 1 - over * 0.12);
}

/** Ascension makes every enemy tougher. */
export function ascensionMul(state) { return 1 + 0.3 * ((state.ascension && state.ascension.level) || 0); }
