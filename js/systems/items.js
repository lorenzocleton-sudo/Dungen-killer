// Item database. Every item the game knows about lives here.
//   kind: 'material' (sell only) | 'consumable' (use) | 'gear' (equip) | 'relic' (sell, valuable)
//   value: base price in ashes. Shops sell at value, buy from you at SELL_RATE * value.
//   stats (gear): maxHp, defense (% less damage taken), damagePct, attackSpeedPct,
//                 critChance, speedPct, reach
//   icon: [glyph, colour] used by the inventory UI
export const SELL_RATE = 0.5;

export const SLOTS = ['weapon', 'head', 'chest', 'hands', 'ring'];
export const SLOT_NAMES = { weapon: 'Weapon', head: 'Head', chest: 'Body', hands: 'Hands', ring: 'Ring' };

export const ITEMS = {
  // ---- consumables
  ashen_flask: { name: 'Ashen Flask', kind: 'consumable', value: 25, heal: 45, icon: ['⚗', '#d08a3a'], desc: 'Warm, bitter draught. Restores 45 HP over a moment.' },
  // ---- materials / loot to sell
  bone_shard: { name: 'Bone Shard', kind: 'material', value: 6, icon: ['†', '#b8b09a'], desc: 'Splinter of an old soldier.' },
  grave_wax: { name: 'Grave Wax', kind: 'material', value: 10, icon: ['●', '#a89a70'], desc: 'Tallow scraped from crypt candles.' },
  tattered_cloth: { name: 'Tattered Banner', kind: 'material', value: 14, icon: ['⚑', '#8a3a2a'], desc: 'A rag of some forgotten house.' },
  black_iron: { name: 'Black Iron Scrap', kind: 'material', value: 22, icon: ['■', '#6a6a70'], desc: 'Dense iron from a fallen knight.' },
  ember_relic: { name: 'Smouldering Relic', kind: 'relic', value: 90, icon: ['✦', '#ff8a30'], desc: 'Still warm. Collectors pay well.' },
  gold_tooth: { name: 'Gold Tooth', kind: 'relic', value: 40, icon: ['▲', '#d8b040'], desc: 'Someone will want this.' },
  // ---- gear
  rusted_sword: { name: 'Rusted Sword', kind: 'gear', slot: 'weapon', model: 'sword', value: 0, stats: {}, icon: ['⚔', '#9a8a70'], desc: 'Your old blade. Dull, but it remembers.' },
  longsword: { name: 'Knight\'s Longsword', kind: 'gear', slot: 'weapon', model: 'longsword', value: 160, stats: { damagePct: 18, reach: 0.25 }, icon: ['⚔', '#c8c0b0'], desc: 'Balanced and long.' },
  war_axe: { name: 'Executioner\'s Axe', kind: 'gear', slot: 'weapon', model: 'axe', value: 320, stats: { damagePct: 40, attackSpeedPct: -12 }, icon: ['⚒', '#b07050'], desc: 'Slow, brutal, final.' },
  ash_blade: { name: 'Ashen Blade', kind: 'gear', slot: 'weapon', model: 'ashblade', value: 520, stats: { damagePct: 30, critChance: 6, attackSpeedPct: 8 }, icon: ['⚔', '#ff9a50'], desc: 'Forged in a pyre that never cooled.' },
  leather_hood: { name: 'Leather Hood', kind: 'gear', slot: 'head', value: 60, stats: { maxHp: 10, defense: 3 }, icon: ['◓', '#8a6a4a'], desc: 'Keeps the rain and some blows off.' },
  dented_helm: { name: 'Dented Helm', kind: 'gear', slot: 'head', value: 110, stats: { maxHp: 15, defense: 6 }, icon: ['◓', '#8a8a90'], desc: 'Pried from a hollow soldier.' },
  knight_helm: { name: 'Fallen Knight Helm', kind: 'gear', slot: 'head', value: 260, stats: { maxHp: 25, defense: 10, speedPct: -3 }, icon: ['◓', '#b0b0b8'], desc: 'The visor is cracked. The oath is not.' },
  gambeson: { name: 'Quilted Gambeson', kind: 'gear', slot: 'chest', value: 90, stats: { maxHp: 20, defense: 5 }, icon: ['▣', '#8a7050'], desc: 'Layers of stitched linen.' },
  hauberk: { name: 'Iron Hauberk', kind: 'gear', slot: 'chest', value: 280, stats: { maxHp: 40, defense: 12, speedPct: -5 }, icon: ['▣', '#9090a0'], desc: 'Heavy rings of black iron.' },
  pilgrim_robe: { name: 'Pilgrim Robe', kind: 'gear', slot: 'chest', value: 150, stats: { maxHp: 10, speedPct: 8, attackSpeedPct: 5 }, icon: ['▣', '#5a6a5a'], desc: 'Light, and blessed by someone.' },
  hunter_gloves: { name: 'Hunter\'s Gloves', kind: 'gear', slot: 'hands', value: 140, stats: { attackSpeedPct: 10 }, icon: ['✋', '#8a6a4a'], desc: 'Supple. Quick hands live longer.' },
  knight_gauntlet: { name: 'Fallen Gauntlet', kind: 'gear', slot: 'hands', value: 200, stats: { damagePct: 12, defense: 4 }, icon: ['✋', '#a0a0a8'], desc: 'Heavy fist of a dead champion.' },
  rusted_ring: { name: 'Rusted Ring', kind: 'gear', slot: 'ring', value: 50, stats: { critChance: 3 }, icon: ['○', '#a07a50'], desc: 'Tarnished, but lucky.' },
  ember_ring: { name: 'Ring of Embers', kind: 'gear', slot: 'ring', value: 240, stats: { critChance: 7, damagePct: 5 }, icon: ['○', '#ff7a30'], desc: 'Warm against the skin.' },
  vigor_ring: { name: 'Ring of Vigor', kind: 'gear', slot: 'ring', value: 220, stats: { maxHp: 30 }, icon: ['○', '#c04040'], desc: 'Your heart beats a little louder.' },
};

/** What the Ashen Market sells. */
export const SHOP_STOCK = [
  'ashen_flask', 'leather_hood', 'gambeson', 'rusted_ring', 'hunter_gloves', 'longsword',
  'pilgrim_robe', 'vigor_ring', 'ember_ring', 'hauberk', 'war_axe', 'ash_blade',
];

/** Enemy drop tables: [itemId, chance]. */
export const DROP_TABLES = {
  hollow: [['bone_shard', 0.45], ['tattered_cloth', 0.15], ['dented_helm', 0.05], ['rusted_ring', 0.04], ['ashen_flask', 0.08]],
  ghoul: [['grave_wax', 0.45], ['bone_shard', 0.25], ['gold_tooth', 0.08], ['ashen_flask', 0.06]],
  knight: [['black_iron', 0.7], ['ember_relic', 0.35], ['knight_gauntlet', 0.18], ['knight_helm', 0.15], ['longsword', 0.12]],
  chest: [['ashen_flask', 0.8], ['gold_tooth', 0.6], ['ember_relic', 0.35], ['hunter_gloves', 0.15], ['ember_ring', 0.08], ['hauberk', 0.08]],
};

export function itemDef(id) { return ITEMS[id]; }
export function sellPrice(id) { return Math.max(1, Math.floor((ITEMS[id]?.value || 0) * SELL_RATE)); }

export function statLine(stats = {}) {
  const lbl = { maxHp: 'HP', defense: '% defense', damagePct: '% damage', attackSpeedPct: '% attack speed', critChance: '% crit', speedPct: '% move speed', reach: 'm reach' };
  return Object.entries(stats).map(([k, v]) => `${v > 0 ? '+' : ''}${v}${lbl[k] && lbl[k][0] === '%' || lbl[k] && lbl[k][0] === 'm' ? '' : ' '}${lbl[k] || k}`).join(', ');
}
