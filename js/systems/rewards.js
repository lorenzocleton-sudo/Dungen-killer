// End-of-run reward chests, with bad-luck protection. Checked rarest first:
// 1/5000 Mythic, 1/500 Legendary, 1/50 Rare, 1/5 Special, else Common.
// Pity (saved): 50 runs without Rare-or-better -> Rare; 300 without a
// Legendary -> Legendary; 1000 without a Mythic -> Mythic.
import { RARITY, ODDS, generateItem, rollRarity, SET_IDS } from './itemgen.js';
import { events } from '../engine/events.js';

export { ODDS };
export const PITY = { rare: 50, legendary: 300, mythic: 1000 };

export class Rewards {
  constructor(game) {
    this.game = game;
    this.forceNext = null;      // admin: force the next chest's rarity
  }

  get pity() {
    const st = this.game.state;
    st.pity = Object.assign({ sinceRare: 0, sinceLegendary: 0, sinceMythic: 0 }, st.pity || {});
    return st.pity;
  }

  /** Decide a chest's rarity (does not touch pity counters). */
  roll(rng = Math.random) {
    if (this.forceNext) { const f = this.forceNext; this.forceNext = null; return f; }
    const p = this.pity;
    if (p.sinceMythic >= PITY.mythic) return 'mythic';
    if (p.sinceLegendary >= PITY.legendary) return 'legendary';
    if (p.sinceRare >= PITY.rare) return 'rare';
    return rollRarity(1, rng);
  }

  /** A completed run's chest was opened with this rarity: update pity. */
  record(rarity) {
    const p = this.pity;
    if (rarity === 'mythic') { p.sinceMythic = 0; p.sinceLegendary = 0; p.sinceRare = 0; }
    else if (rarity === 'legendary') { p.sinceLegendary = 0; p.sinceRare = 0; p.sinceMythic++; }
    else if (rarity === 'rare') { p.sinceRare = 0; p.sinceLegendary++; p.sinceMythic++; }
    else { p.sinceRare++; p.sinceLegendary++; p.sinceMythic++; }
    events.emit('rewardRolled', { rarity, pity: { ...p } });
  }

  /** A generated item record of a rarity (12% of rare+ drops are set pieces). */
  randomItem(rarity, ilvl) {
    const il = ilvl || this.game.loot.areaIlvl();
    const set = (rarity === 'rare' || rarity === 'legendary') && Math.random() < 0.12 ? SET_IDS[Math.floor(Math.random() * SET_IDS.length)] : null;
    return generateItem({ ilvl: il, rarity, set });
  }

  color(rarity) { return RARITY[rarity] ? RARITY[rarity].color : RARITY.normal.color; }

  /** Open a reward chest: spawn the rarity item + some common loot. */
  open(rarity, pos) {
    const g = this.game;
    if (this.forceNext) { rarity = this.forceNext; this.forceNext = null; }
    this.record(rarity);
    g.loot.spawnGen(this.randomItem(rarity), pos, 0);
    g.loot.roll('chest', pos, rarity === 'normal' ? 3 : 2);
    if (Math.random() < 0.3 && g.journal) g.journal.readFor(g.area.biomeId || 'any', 'any');
    if (rarity !== 'normal') g.hud.banner(`${RARITY[rarity].name} reward`, 'fortune smiles on the bold');
    g.hud.feed(`Reward chest: ${RARITY[rarity].name}`, this.color(rarity));
    g.state.save();
  }
}
