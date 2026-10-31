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
  // renown-gated shop wares
  champion_blade: { name: 'Champion\'s Blade', kind: 'gear', slot: 'weapon', model: 'longsword', value: 700, minRank: 3, stats: { damagePct: 38, critChance: 4, reach: 0.2 }, icon: ['\u2694', '#e8d8b0'], desc: 'Sold only to those the town trusts.' },
  realm_plate: { name: 'Plate of the Realm', kind: 'gear', slot: 'chest', value: 900, minRank: 4, stats: { maxHp: 60, defense: 16, maxStamina: 10 }, icon: ['\u25A3', '#d8d0c0'], desc: 'Bears the royal crest.' },
  royal_signet: { name: 'Royal Signet', kind: 'gear', slot: 'ring', value: 1200, minRank: 5, stats: { damagePct: 12, critChance: 6, staminaRegenPct: 20 }, icon: ['\u25CB', '#f0d070'], desc: 'Given to the King\'s chosen.' },
  vigor_ring: { name: 'Ring of Vigor', kind: 'gear', slot: 'ring', value: 220, stats: { maxHp: 30 }, icon: ['○', '#c04040'], desc: 'Your heart beats a little louder.' },
};

// ------------------------------------------------------------ reward rarities
// special  : a little better than shop gear, never overpowered
// rare     : good stats + one special effect
// legendary: unique, build-defining effect
export const RARITY = {
  normal: { name: 'Common', color: '#8a7e68' },
  special: { name: 'Special', color: '#5a9ad8' },
  rare: { name: 'Rare', color: '#b468e0' },
  legendary: { name: 'Legendary', color: '#ff8a20' },
};

const R = (rarity, id, def) => { ITEMS[id] = { ...def, rarity, kind: 'gear' }; return id; };
const S = 'special', RR = 'rare', L = 'legendary';
export const RARITY_ITEMS = {
  special: [
    R(S, 'warden_blade', { name: 'Warden\'s Longsword', slot: 'weapon', model: 'longsword', value: 260, stats: { damagePct: 22, reach: 0.3 }, icon: ['⚔', '#9ac0e8'], desc: 'Kept sharp by a jailer who never sleeps.' }),
    R(S, 'bone_cleaver', { name: 'Bone Cleaver', slot: 'weapon', model: 'axe', value: 300, stats: { damagePct: 34, attackSpeedPct: -6 }, icon: ['⚒', '#9ac0e8'], desc: 'Heavy, notched, honest.' }),
    R(S, 'scout_hood', { name: 'Scout\'s Hood', slot: 'head', value: 150, stats: { maxHp: 12, speedPct: 4 }, icon: ['◓', '#9ac0e8'], desc: 'Light, and good for hearing footsteps.' }),
    R(S, 'iron_coif', { name: 'Riveted Coif', slot: 'head', value: 200, stats: { maxHp: 20, defense: 7 }, icon: ['◓', '#9ac0e8'], desc: 'Solid rings, solid head.' }),
    R(S, 'brigandine', { name: 'Brigandine', slot: 'chest', value: 320, stats: { maxHp: 35, defense: 10 }, icon: ['▣', '#9ac0e8'], desc: 'Plates sewn between cloth.' }),
    R(S, 'runner_coat', { name: 'Runner\'s Coat', slot: 'chest', value: 260, stats: { maxHp: 15, maxStamina: 20, speedPct: 5 }, icon: ['▣', '#9ac0e8'], desc: 'For those who live by leaving.' }),
    R(S, 'grip_gloves', { name: 'Grip Gloves', slot: 'hands', value: 220, stats: { attackSpeedPct: 9, damagePct: 4 }, icon: ['✋', '#9ac0e8'], desc: 'Tar on the palms.' }),
    R(S, 'guard_gauntlets', { name: 'Guard Gauntlets', slot: 'hands', value: 240, stats: { defense: 5, maxHp: 15 }, icon: ['✋', '#9ac0e8'], desc: 'Dented by many blocked blows.' }),
    R(S, 'wind_ring', { name: 'Ring of Breath', slot: 'ring', value: 260, stats: { staminaRegenPct: 20, maxStamina: 10 }, icon: ['○', '#9ac0e8'], desc: 'Your lungs feel larger.' }),
    R(S, 'luck_ring', { name: 'Gravedigger\'s Ring', slot: 'ring', value: 240, stats: { dropPct: 20, ashPct: 10 }, icon: ['○', '#9ac0e8'], desc: 'Dug up, cleaned, worn.' }),
  ],
  rare: [
    R(RR, 'bloodletter', { name: 'Bloodletter', slot: 'weapon', model: 'longsword', value: 600, stats: { damagePct: 30, bleedDps: 5 }, icon: ['⚔', '#c890f0'], desc: 'Special: every hit opens a bleeding wound.' }),
    R(RR, 'frostbrand', { name: 'Frostbrand', slot: 'weapon', model: 'ashblade', value: 650, stats: { damagePct: 28, chillPct: 40 }, icon: ['⚔', '#a0d8ff'], desc: 'Special: hits chill enemies, slowing them 40%.' }),
    R(RR, 'ember_crown', { name: 'Crown of Cinders', slot: 'head', value: 600, stats: { maxHp: 25, burnDps: 5 }, icon: ['◓', '#c890f0'], desc: 'Special: your hits set enemies alight.' }),
    R(RR, 'thorn_mail', { name: 'Thornmail', slot: 'chest', value: 700, stats: { maxHp: 45, defense: 12, thornsPct: 25 }, icon: ['▣', '#c890f0'], desc: 'Special: attackers take 25% of their damage.' }),
    R(RR, 'vampire_grip', { name: 'Vampire Grip', slot: 'hands', value: 650, stats: { attackSpeedPct: 8, lifesteal: 8 }, icon: ['✋', '#c890f0'], desc: 'Special: heal 8% of damage dealt.' }),
    R(RR, 'dancer_wraps', { name: 'Dancer\'s Wraps', slot: 'hands', value: 620, stats: { speedPct: 6, rollIframes: 0.15 }, icon: ['✋', '#c890f0'], desc: 'Special: rolls grant longer invulnerability.' }),
    R(RR, 'reaper_ring', { name: 'Reaper\'s Band', slot: 'ring', value: 680, stats: { critChance: 6, killStamina: 20 }, icon: ['○', '#c890f0'], desc: 'Special: kills restore 20 stamina.' }),
    R(RR, 'hunter_ring', { name: 'Hunter\'s Seal', slot: 'ring', value: 700, stats: { damagePct: 8, firstStrikePct: 40 }, icon: ['○', '#c890f0'], desc: 'Special: +40% damage to unwounded foes.' }),
  ],
  legendary: [
    R(L, 'kingsbane', { name: 'Kingsbane', slot: 'weapon', model: 'ashblade', value: 2500, stats: { damagePct: 55, critChance: 8, chainHit: 2 }, icon: ['⚔', '#ffb050'], desc: 'LEGENDARY: every hit arcs to 2 more enemies nearby.' }),
    R(L, 'phoenix_heart', { name: 'Heart of the Phoenix', slot: 'ring', value: 2500, stats: { regen: 2, cheatDeath: 1, maxHp: 30 }, icon: ['○', '#ffb050'], desc: 'LEGENDARY: once per visit, death leaves you standing.' }),
    R(L, 'nameless_shroud', { name: 'Shroud of the Nameless', slot: 'chest', value: 2500, stats: { maxHp: 40, rollIframes: 0.15, rollNova: 30 }, icon: ['▣', '#ffb050'], desc: 'LEGENDARY: rolling releases a frost nova (30 dmg, chills).' }),
    R(L, 'colossus_fists', { name: 'Fists of the Colossus', slot: 'hands', value: 2500, stats: { damagePct: 20, quakeChance: 20 }, icon: ['✋', '#ffb050'], desc: 'LEGENDARY: 20% of hits shake the earth (45 dmg, 3m).' }),
    R(L, 'ashen_kings_crown', { name: 'Crown of the Ashen Kings', slot: 'head', value: 2500, stats: { maxHp: 30, killExplode: 35, burnDps: 4 }, icon: ['◓', '#ffb050'], desc: 'LEGENDARY: slain foes explode in flame (35 dmg).' }),
  ],
};

/** What the Ashen Market sells. */
export const SHOP_STOCK = [
  'ashen_flask', 'leather_hood', 'gambeson', 'rusted_ring', 'hunter_gloves', 'longsword',
  'pilgrim_robe', 'vigor_ring', 'ember_ring', 'hauberk', 'war_axe', 'ash_blade',
  'champion_blade', 'realm_plate', 'royal_signet',
];

/** Enemy drop tables: [itemId, chance]. */
export const DROP_TABLES = {
  hollow: [['bone_shard', 0.45], ['tattered_cloth', 0.15], ['dented_helm', 0.05], ['rusted_ring', 0.04], ['ashen_flask', 0.08]],
  ghoul: [['grave_wax', 0.45], ['bone_shard', 0.25], ['gold_tooth', 0.08], ['ashen_flask', 0.06]],
  knight: [['black_iron', 0.7], ['ember_relic', 0.35], ['knight_gauntlet', 0.18], ['knight_helm', 0.15], ['longsword', 0.12]],
  wolf: [['bone_shard', 0.35], ['gold_tooth', 0.05], ['ashen_flask', 0.05]],
  spider: [['grave_wax', 0.35], ['black_iron', 0.06], ['ashen_flask', 0.07]],
  hag: [['tattered_cloth', 0.4], ['gold_tooth', 0.12], ['ashen_flask', 0.1], ['vigor_ring', 0.02]],
  wraith: [['bone_shard', 0.3], ['ember_relic', 0.06], ['ashen_flask', 0.07]],
  imp: [['ember_relic', 0.1], ['grave_wax', 0.3], ['ember_ring', 0.02]],
  brute: [['black_iron', 0.8], ['gold_tooth', 0.3], ['hauberk', 0.06], ['war_axe', 0.05]],
  archer: [['bone_shard', 0.45], ['hunter_gloves', 0.03], ['ashen_flask', 0.06]],
  boss: [['ember_relic', 1], ['black_iron', 1], ['ashen_flask', 1], ['gold_tooth', 0.8], ['ember_ring', 0.3], ['hauberk', 0.25], ['ash_blade', 0.15]],
  chest: [['ashen_flask', 0.8], ['gold_tooth', 0.6], ['ember_relic', 0.35], ['hunter_gloves', 0.15], ['ember_ring', 0.08], ['hauberk', 0.08]],
};

export function itemDef(id) { return ITEMS[id]; }
export function sellPrice(id) { return Math.max(1, Math.floor((ITEMS[id]?.value || 0) * SELL_RATE)); }

export function statLine(stats = {}) {
  const lbl = { maxHp: 'HP', defense: '% defense', damagePct: '% damage', attackSpeedPct: '% attack speed', critChance: '% crit', speedPct: '% move speed', reach: 'm reach',
    maxStamina: 'stamina', staminaRegenPct: '% stamina regen', dropPct: '% drops', ashPct: '% ashes', bleedDps: 'bleed/s', chillPct: '% chill', burnDps: 'burn/s', thornsPct: '% thorns',
    lifesteal: '% lifesteal', rollIframes: 's roll i-frames', killStamina: 'stamina per kill', firstStrikePct: '% first strike', regen: 'HP/s', cheatDeath: 'revive', chainHit: 'chain', rollNova: 'roll nova', quakeChance: '% quake', killExplode: 'kill blast' };
  return Object.entries(stats).map(([k, v]) => `${v > 0 ? '+' : ''}${v}${lbl[k] && lbl[k][0] === '%' || lbl[k] && lbl[k][0] === 'm' ? '' : ' '}${lbl[k] || k}`).join(', ');
}
