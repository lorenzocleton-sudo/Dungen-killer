// End-of-dungeon reward roll for random dungeons, with bad-luck protection.
// Checked rarest first: 1/500 Legendary, 1/50 Rare, 1/5 Special, else normal.
// Pity (saved): 50 runs without Rare-or-better -> guaranteed Rare;
//               300 runs without a Legendary   -> guaranteed Legendary.
import { RARITY, RARITY_ITEMS } from './items.js';
import { events } from '../engine/events.js';

export const ODDS = { legendary: 1 / 500, rare: 1 / 50, special: 1 / 5 };
export const PITY = { rare: 50, legendary: 300 };

export class Rewards {
  constructor(game) {
    this.game = game;
    this.forceNext = null;      // admin: force the next chest's rarity
  }

  get pity() {
    const st = this.game.state;
    if (!st.pity) st.pity = { sinceRare: 0, sinceLegendary: 0 };
    return st.pity;
  }

  /** Decide a chest's rarity (does not touch pity counters). */
  roll(rng = Math.random) {
    if (this.forceNext) { const f = this.forceNext; this.forceNext = null; return f; }
    const p = this.pity;
    if (p.sinceLegendary >= PITY.legendary) return 'legendary';
    if (p.sinceRare >= PITY.rare) return 'rare';
    const r = rng();
    if (r < ODDS.legendary) return 'legendary';
    if (r < ODDS.legendary + ODDS.rare) return 'rare';
    if (r < ODDS.legendary + ODDS.rare + ODDS.special) return 'special';
    return 'normal';
  }

  /** A completed run's chest was opened with this rarity: update pity. */
  record(rarity) {
    const p = this.pity;
    if (rarity === 'legendary') { p.sinceLegendary = 0; p.sinceRare = 0; }
    else if (rarity === 'rare') { p.sinceRare = 0; p.sinceLegendary++; }
    else { p.sinceRare++; p.sinceLegendary++; }
    events.emit('rewardRolled', { rarity, pity: { ...p } });
  }

  randomItem(rarity) {
    const list = RARITY_ITEMS[rarity];
    return list ? list[Math.floor(Math.random() * list.length)] : null;
  }

  color(rarity) { return RARITY[rarity] ? RARITY[rarity].color : RARITY.normal.color; }

  /** Open a reward chest: spawn the rarity item + some common loot. */
  open(rarity, pos) {
    const g = this.game;
    if (this.forceNext) { rarity = this.forceNext; this.forceNext = null; }
    this.record(rarity);
    const item = this.randomItem(rarity);
    if (item) g.loot.spawn(item, pos, 0);
    g.loot.roll('chest', pos, rarity === 'normal' ? 3 : 2);
    if (rarity !== 'normal') g.hud.banner(`${RARITY[rarity].name} reward`, 'fortune smiles on the bold');
    g.hud.feed(`Reward chest: ${RARITY[rarity].name}`, this.color(rarity));
    g.state.save();
  }
}
