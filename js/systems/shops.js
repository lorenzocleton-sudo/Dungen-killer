// The stores of Emberwick. Every shop has an NPC, a lore line, stock that
// improves with renown and depth, sell prices, a buyback tab, and restocks
// once per run (the stock seed changes when a run starts).
import { ITEMS, SHOP_STOCK, COSMETICS, gemId, GEM_TYPES } from './items.js';
import { generateItem, rollRarity, RARITY_ORDER } from './itemgen.js';
import { makeRng } from '../engine/textures.js';
import { events } from '../engine/events.js';

export const SHOPS = {
  market: { name: 'The Ashen Market', npc: 'Hooded Merchant', line: 'Everything here was found below. Most of it was someone’s.', tabs: ['buy', 'sell', 'buyback'] },
  armorer: { name: 'The Armorer', npc: 'Gerda the Armorer', line: 'Plate doesn’t remember who wore it. That’s its kindness.', tabs: ['buy', 'sell', 'buyback'] },
  weaponsmith: { name: 'The Weaponsmith', npc: 'The Smith', line: 'Bring me ore and ashes. I’ll make it sing. Up to ten times.', tabs: ['buy', 'upgrade', 'sell', 'buyback'] },
  alchemist: { name: 'The Alchemist', npc: 'Old Marrow', line: 'Three weak draughts make one strong one. Mostly.', tabs: ['buy', 'brew', 'sell', 'buyback'] },
  jeweler: { name: 'The Jeweler', npc: 'Sabine the Jeweler', line: 'Stones from the Deeps hold a little of the hour. Wear them close.', tabs: ['buy', 'sockets', 'combine', 'sell', 'buyback'] },
  enchanter: { name: 'The Enchanter', npc: 'Vesper', line: 'One word on the metal can be unsaid. Only one. It costs more each time.', tabs: ['enchant', 'sell', 'buyback'] },
  runeforge: { name: 'The Runeforge', npc: 'Kiln-Master Odo', line: 'Ore, essence, intent. The forge does the rest.', tabs: ['craft', 'salvage', 'sell', 'buyback'] },
  blackmarket: { name: 'The Black Market', npc: 'A Voice in the Alley', line: 'Don’t ask where. Don’t ask who. Do ask the price.', tabs: ['buy', 'sell', 'buyback'] },
  gambler: { name: 'The Gambler', npc: 'Lucky Tam', line: 'Sealed bundles from the Deeps. Could be junk. Could be a crown.', tabs: ['gamble', 'sell', 'buyback'] },
  tailor: { name: 'The Tailor', npc: 'Wren’s Mother', line: 'You can’t mend the world. You can mend a cloak.', tabs: ['buy', 'wardrobe', 'sell', 'buyback'] },
  cartographer: { name: 'The Cartographer', npc: 'Ines the Cartographer', line: 'The Deeps change. My maps change faster.', tabs: ['buy', 'sell', 'buyback'] },
  tavern: { name: 'The Ember & Crow (Tavern)', npc: 'Barkeep Hollis', line: 'Sit. Drink. Hire someone braver than you.', tabs: ['companions', 'rumors'] },
  stash: { name: 'The Stash House', npc: 'Keeper of Keys', line: 'What you leave here stays exactly where you left it. Exactly.', tabs: ['stash'] },
  menagerie: { name: 'The Menagerie', npc: 'Menagerie Keeper', line: 'They don’t age. They don’t forget. They do get hungry.', tabs: ['pets'] },
  gardener: { name: 'The Hearth Garden', npc: 'Gardener Ama', line: 'Things grow again. I didn’t think I’d live to say it. I suppose I didn’t.', tabs: ['buy', 'sell', 'buyback'], minRestore: 80 },
};

// cartographer maps: dungeon modifiers for the next main-dungeon level you enter
export const MAPS = {
  map_plenty: { name: 'Map of Plenty', desc: 'Next main-dungeon level: +60% item find.', mod: { loot: 60 }, value: 200 },
  map_peril: { name: 'Map of Peril', desc: 'Next level: enemies +30% damage, +60% XP, +2 item level.', mod: { dmg: 1.3, xp: 1.6, ilvl: 2 }, value: 260 },
  map_haste: { name: 'Map of Haste', desc: 'Next level: enemies are hasted, loot +3 item level.', mod: { haste: true, ilvl: 3 }, value: 320 },
  map_insight: { name: 'Map of Insight', desc: 'Next level: the whole map is revealed.', mod: { reveal: true }, value: 120 },
  map_hoard: { name: 'Map of the Hoard', desc: 'Next level: an Ash Hoarder is sure to be there.', mod: { hoarder: true }, value: 400 },
};
for (const [id, m] of Object.entries(MAPS)) ITEMS[id] = { name: m.name, kind: 'consumable', value: m.value, map: id, icon: ['☷', '#d8c090'], desc: m.desc + ' (Use it in town.)' };

const RUMORS = [
  'They say the Grave Warden opens the way if you never stop moving. Dash through his sweeps.',
  'The Brood Mother’s eggs go dark when she dies. Kill her quickly or drown in spiders.',
  'Mimics breathe. Chests don’t. Listen before you open.',
  'Shades are near-invisible until they strike. Smoke bombs make them lose you too.',
  'Big things slam the ground. Jump the ring, don’t run from it.',
  'Conquer a level — every last thing on it — and the Waystone lets you start below it.',
  'An Ash Hoarder runs. Never fights. Catch it and you’re rich for a week.',
  'There’s a niche high on some walls. Climb. People leave things up there.',
  'Some walls are cracked. Hit them. Not everything in the Deeps is solid.',
  'The King has no reflection. Don’t say I said so.',
  'When the Hearth is healed, they say, the hour will end gently. When it isn’t... it won’t.',
  'The Silent One drinks alone. Only comes to those who have been very deep.',
  'Below level thirty there’s no floor to the dark. The Abyss. Nobody has seen the bottom.',
  'The Proving Pit pays better the deeper you’ve been. And the sand is very hungry.',
];
export const rumor = () => RUMORS[Math.floor(Math.random() * RUMORS.length)];

export class ShopSystem {
  constructor(game) {
    this.game = game;
    this.cache = {};
    events.on('runStarted', () => { const w = game.state.world; w.shopSeed = (w.shopSeed || 1) + 1; this.cache = {}; });
  }

  get rank() { return this.game.renown ? this.game.renown.rankIndex : 0; }
  get depth() { return Math.max(1, this.game.state.world.deepest || 1); }
  get restore() { return this.game.restoration ? this.game.restoration.value : 0; }

  /** Price you pay (renown discount applies). */
  price(value, mul = 1) { return Math.max(1, Math.round(value * mul * (1 - (this.game.renown ? this.game.renown.discount : 0) / 100))); }

  /** Stock for a shop: [{ key, id, g?, price }]. Restocks every run. */
  stock(shop) {
    const w = this.game.state.world;
    const seed = (w.shopSeed || 1) * 1000 + Object.keys(SHOPS).indexOf(shop);
    if (this.cache[shop] && this.cache[shop].seed === seed) return this.cache[shop].list;
    const rng = makeRng(seed);
    const r = this.rank, D = this.depth, list = [];
    const stat = (id, mul = 1) => ITEMS[id] && list.push({ key: id, id, price: this.price(ITEMS[id].value, mul) });
    const gen = (o, mul = 1) => { const g = generateItem({ rng, ...o }); delete g.new; list.push({ key: 'g' + list.length, id: 'gen', g, price: 0, mul }); };
    const luck = 1 + r * 0.6 + (this.restore >= 40 ? 1 : 0);
    const il = () => Math.max(1, D + Math.floor(rng() * 3) - 1 + Math.floor(r / 2));
    switch (shop) {
      case 'market':
        stat('ashen_flask'); for (let i = 0; i <= Math.min(4, Math.floor(r / 1.5) + (this.restore >= 40 ? 1 : 0)); i++) stat('hp_potion_' + i);
        stat('bomb'); stat('antidote'); stat('smoke_bomb');
        for (const id of SHOP_STOCK) if ((ITEMS[id].minRank || 0) <= r && ITEMS[id].kind === 'gear') stat(id);
        if (r >= 3) stat('return_scroll', 1.5);
        break;
      case 'armorer': for (let i = 0; i < 7; i++) gen({ ilvl: il(), slot: 'armor', rarity: rollRarity(luck, rng) === 'normal' ? 'normal' : rng() < 0.7 ? 'special' : 'rare' }); break;
      case 'weaponsmith': for (let i = 0; i < 7; i++) gen({ ilvl: il(), slot: 'weapon', rarity: rollRarity(luck, rng) === 'normal' ? 'normal' : rng() < 0.7 ? 'special' : 'rare' }); break;
      case 'alchemist':
        for (const t of ['hp', 'st', 'mp']) for (let i = 0; i <= Math.min(4, r + 1); i++) stat(`${t}_potion_${i}`);
        stat('antidote'); stat('fire_flask'); stat('smoke_bomb'); stat('bomb'); stat('oil_fire'); stat('oil_frost'); stat('oil_poison');
        break;
      case 'jeweler': for (const t of Object.keys(GEM_TYPES)) for (let g = 0; g <= Math.min(2, Math.floor(r / 2)); g++) stat(gemId(t, g), 1.2); break;
      case 'blackmarket': for (let i = 0; i < 4; i++) gen({ ilvl: il() + 2, rarity: rng() < 0.02 + r * 0.004 ? 'legendary' : 'rare' }, 2.5); break;
      case 'tailor': for (const [id, c] of Object.entries(COSMETICS)) if (id !== 'festival_lantern') stat(id); break;
      case 'cartographer': for (const id of Object.keys(MAPS)) if (id !== 'map_hoard' || r >= 3) stat(id); break;
      case 'gardener': for (let i = 2; i <= 4; i++) { stat('hp_potion_' + i, 0.8); stat('mp_potion_' + i, 0.8); } stat('return_scroll', 1.2); break;
    }
    this.cache[shop] = { seed, list };
    return list;
  }

  /** Gambler: an unidentified bundle of a category. */
  gamble(cat) {
    const D = this.depth, r = this.rank;
    const g = generateItem({ ilvl: D + 1, slot: cat, rarity: rollRarity(1.6 + r * 0.3) });
    return g;
  }
  gamblePrice() { return this.price(60 + this.depth * 22); }

  /** Weaponsmith upgrade +1..+10: ashes + ore by the item's material tier. */
  upgradeCost(def) {
    const n = (def.upgrade || 0) + 1;
    const ore = ['ore_iron', 'ore_iron', 'ore_steel', 'ore_blackiron', 'ore_sunsteel', 'ore_voidglass', 'ore_hearth'][Math.min(6, (def.material ? ['rusted', 'iron', 'steel', 'blackiron', 'sunsteel', 'voidglass', 'hearthforged'].indexOf(def.material) : 1))];
    return { ashes: Math.round((40 + (def.ilvl || 1) * 10) * n * n * 0.6), ore, oreN: n, chance: n <= 5 ? 1 : 1 - (n - 5) * 0.12 };
  }

  /** Enchanter: rerolling an affix gets dearer each time on the same item. */
  enchantCost(def, g) { return this.price((80 + (def.ilvl || 1) * 15) * Math.pow(1.5, g.ench || 0) * (1 + RARITY_ORDER.indexOf(def.rarity))); }
}
