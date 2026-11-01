// Item database. Every item the game knows about lives here.
//   kind: 'material' (sell only) | 'consumable' (use) | 'gear' (equip) | 'relic' (sell, valuable)
//   value: base price in ashes. Shops sell at value, buy from you at SELL_RATE * value.
//   stats (gear): maxHp, defense (% less damage taken), damagePct, attackSpeedPct,
//                 critChance, speedPct, reach
//   icon: [glyph, colour] used by the inventory UI
import { SLOTS as GEN_SLOTS, SLOT_NAMES as GEN_SLOT_NAMES, RARITY as GEN_RARITY, genDef, GEM_TYPES, GEM_GRADES, gemId, gemInfo } from './itemgen.js';

export const SELL_RATE = 0.5;

export const SLOTS = GEN_SLOTS;
export const SLOT_NAMES = GEN_SLOT_NAMES;

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
  champion_blade: { name: 'Champion\'s Blade', kind: 'gear', slot: 'weapon', model: 'longsword', value: 700, minRank: 2, stats: { damagePct: 38, critChance: 4, reach: 0.2 }, icon: ['\u2694', '#e8d8b0'], desc: 'Sold only to those the town trusts.' },
  realm_plate: { name: 'Plate of the Realm', kind: 'gear', slot: 'chest', value: 900, minRank: 3, stats: { maxHp: 60, defense: 16, maxStamina: 10 }, icon: ['\u25A3', '#d8d0c0'], desc: 'Bears the royal crest.' },
  royal_signet: { name: 'Royal Signet', kind: 'gear', slot: 'ring', value: 1200, minRank: 4, stats: { damagePct: 12, critChance: 6, staminaRegenPct: 20 }, icon: ['\u25CB', '#f0d070'], desc: 'Given to the King\'s chosen.' },
  vigor_ring: { name: 'Ring of Vigor', kind: 'gear', slot: 'ring', value: 220, stats: { maxHp: 30 }, icon: ['○', '#c04040'], desc: 'Your heart beats a little louder.' },
};

// ------------------------------------------------------------ reward rarities
// special  : a little better than shop gear, never overpowered
// rare     : good stats + one special effect
// legendary: unique, build-defining effect
export const RARITY = GEN_RARITY;

const R = (rarity, id, def) => { ITEMS[id] = { ...def, slot: def.slot === 'ring' ? 'ring' : def.slot, rarity, kind: 'gear' }; return id; };
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

// ------------------------------------------------------------ consumables, materials, gems, keys, cosmetics
const POT = ['Minor', 'Lesser', '', 'Greater', 'Supreme'];
for (let i = 0; i < 5; i++) {
  ITEMS['hp_potion_' + i] = { name: `${POT[i]} Healing Potion`.trim(), kind: 'consumable', value: [20, 45, 90, 180, 360][i], heal: [40, 80, 150, 280, 500][i], potion: 'hp', grade: i, icon: ['\u2697', '#e04040'], desc: `Restores ${[40, 80, 150, 280, 500][i]} HP over a moment.` };
  ITEMS['st_potion_' + i] = { name: `${POT[i]} Stamina Draught`.trim(), kind: 'consumable', value: [15, 35, 70, 140, 280][i], stamina: [50, 100, 200, 300, 500][i], potion: 'st', grade: i, icon: ['\u2697', '#60c060'], desc: 'Restores stamina and speeds its return for a while.' };
  ITEMS['mp_potion_' + i] = { name: `${POT[i]} Mana Tonic`.trim(), kind: 'consumable', value: [15, 35, 70, 140, 280][i], mana: [40, 80, 150, 250, 400][i], potion: 'mp', grade: i, icon: ['\u2697', '#5070e0'], desc: 'Restores mana.' };
}
Object.assign(ITEMS, {
  bomb: { name: 'Black Powder Bomb', kind: 'consumable', value: 40, throwable: 'bomb', icon: ['\u25CF', '#c0a080'], desc: 'Throw (G): explodes for heavy damage in a 4 m radius.' },
  fire_flask: { name: 'Fire Flask', kind: 'consumable', value: 45, throwable: 'fire', icon: ['\u2668', '#ff7030'], desc: 'Throw (G): bursts into a burning pool.' },
  smoke_bomb: { name: 'Smoke Bomb', kind: 'consumable', value: 40, throwable: 'smoke', icon: ['\u2601', '#a0a0a0'], desc: 'Use: enemies lose sight of you for 4 s.' },
  antidote: { name: 'Antidote', kind: 'consumable', value: 25, cure: true, icon: ['\u271A', '#90e060'], desc: 'Cures poison and wards it off for 30 s.' },
  oil_fire: { name: 'Fire Oil', kind: 'consumable', value: 50, oil: 'fire', icon: ['\u25B2', '#ff8040'], desc: 'Coat your weapon: hits burn for 60 s.' },
  oil_frost: { name: 'Frost Oil', kind: 'consumable', value: 50, oil: 'frost', icon: ['\u25B2', '#80c0ff'], desc: 'Coat your weapon: hits chill for 60 s.' },
  oil_poison: { name: 'Venom Oil', kind: 'consumable', value: 50, oil: 'poison', icon: ['\u25B2', '#90d040'], desc: 'Coat your weapon: hits poison for 60 s.' },
  return_scroll: { name: 'Scroll of Return', kind: 'consumable', value: 400, returnHome: true, icon: ['\u2709', '#f0d080'], desc: 'Rare. Read it to walk home through the ash, keeping everything you carry.' },
  vault_key: { name: 'Vault Key', kind: 'key', value: 30, icon: ['\u26BF', '#d8b040'], desc: 'Opens a locked vault on this level. It crumbles if you leave.' },
  // crafting materials (per tier) and essences
  hide: { name: 'Beast Hide', kind: 'material', value: 8, icon: ['\u25A7', '#a07850'], desc: 'Tough, tanned by nothing.' },
  ore_iron: { name: 'Iron Ore', kind: 'material', value: 6, icon: ['\u25C6', '#9a9aa0'], desc: 'Crafting: tier 1.' },
  ore_steel: { name: 'Steel Ingot', kind: 'material', value: 12, icon: ['\u25C6', '#c8ccd4'], desc: 'Crafting: tier 2.' },
  ore_blackiron: { name: 'Blackiron Ingot', kind: 'material', value: 22, icon: ['\u25C6', '#5a5a64'], desc: 'Crafting: tier 3.' },
  ore_sunsteel: { name: 'Sunsteel Ingot', kind: 'material', value: 40, icon: ['\u25C6', '#e8c060'], desc: 'Crafting: tier 4.' },
  ore_voidglass: { name: 'Voidglass Shard', kind: 'material', value: 70, icon: ['\u25C6', '#8a5ad0'], desc: 'Crafting: tier 5.' },
  ore_hearth: { name: 'Hearth-Iron', kind: 'material', value: 120, icon: ['\u25C6', '#ff8a40'], desc: 'Crafting: tier 6. Still warm.' },
  ess_fire: { name: 'Fire Essence', kind: 'material', value: 18, icon: ['\u2737', '#ff7030'], desc: 'Elemental essence.' },
  ess_frost: { name: 'Frost Essence', kind: 'material', value: 18, icon: ['\u2737', '#80c0ff'], desc: 'Elemental essence.' },
  ess_storm: { name: 'Storm Essence', kind: 'material', value: 18, icon: ['\u2737', '#e0e080'], desc: 'Elemental essence.' },
  ess_shadow: { name: 'Shadow Essence', kind: 'material', value: 18, icon: ['\u2737', '#8060a0'], desc: 'Elemental essence.' },
  ess_life: { name: 'Life Essence', kind: 'material', value: 18, icon: ['\u2737', '#60e080'], desc: 'Elemental essence.' },
  ess_void: { name: 'Void Essence', kind: 'material', value: 80, icon: ['\u2737', '#c040ff'], desc: 'From legendary things, broken.' },
});
for (const t of Object.keys(GEM_TYPES)) for (let gr = 0; gr < 5; gr++) {
  const info = gemInfo(gemId(t, gr));
  ITEMS[gemId(t, gr)] = { name: info.name, kind: 'gem', value: [30, 90, 260, 700, 1800][gr], icon: ['\u25C7', GEM_TYPES[t].color], gem: true, desc: `Socket into gear. ${Object.entries(info.stats).map(([k, v]) => `+${v} ${k}`).join(', ')}. Combine 3 at the Jeweler for the next grade.` };
}
// cosmetics: dyes (your sleeves + slash), cloak patterns, portal colours
export const COSMETICS = {
  dye_crimson: { name: 'Crimson Dye', type: 'dye', color: 0x9a2a2a }, dye_ash: { name: 'Ash-Grey Dye', type: 'dye', color: 0x6a6a6a },
  dye_royal: { name: 'Royal Blue Dye', type: 'dye', color: 0x2a3a8a }, dye_gold: { name: 'Gilded Dye', type: 'dye', color: 0xb08a30 },
  dye_bone: { name: 'Bone-White Dye', type: 'dye', color: 0xd8d0c0 }, dye_moss: { name: 'Moss Dye', type: 'dye', color: 0x4a6a3a },
  cloak_ember: { name: 'Pattern: Embers', type: 'cloak', color: 0xd06020 }, cloak_raven: { name: 'Pattern: Raven', type: 'cloak', color: 0x202028 },
  cloak_lion: { name: 'Pattern: Lion of Vael', type: 'cloak', color: 0xc8a040 }, cloak_tide: { name: 'Pattern: Tide', type: 'cloak', color: 0x308080 },
  portal_gold: { name: 'Portal Colour: Gold', type: 'portal', color: 'gold' }, portal_violet: { name: 'Portal Colour: Violet', type: 'portal', color: 'purple' },
  portal_ember: { name: 'Portal Colour: Ember', type: 'portal', color: 'red' },
  festival_lantern: { name: 'Festival Lantern (Hearth healed)', type: 'cloak', color: 0xffd080 },
};
for (const [id, c] of Object.entries(COSMETICS)) ITEMS[id] = { name: c.name, kind: 'cosmetic', value: 150, icon: ['\u2740', typeof c.color === 'number' ? '#' + c.color.toString(16).padStart(6, '0') : '#e0c070'], cosmetic: c, desc: 'Cosmetic. Apply it at the Tailor.' };
export { GEM_TYPES, GEM_GRADES, gemId, gemInfo };

// legacy fixed gear -> weapon type + estimated item level
const LEGACY_WTYPE = { sword: 'sword', longsword: 'sword', ashblade: 'sword', axe: 'axe' };
for (const [id, d] of Object.entries(ITEMS)) {
  if (d.kind !== 'gear') continue;
  if (d.slot === 'weapon') d.wtype = LEGACY_WTYPE[d.model] || 'sword';
  d.ilvl = d.ilvl || Math.max(1, Math.round((d.value || 40) / 70));
}

const genCache = new WeakMap();
/** Definition of an inventory entry (static item or generated gear). */
export function defOf(item) {
  if (!item) return null;
  if (item.id !== 'gen') return ITEMS[item.id] || null;
  if (!item.g) return null;
  let d = genCache.get(item.g);
  if (!d) { d = genDef(item.g); genCache.set(item.g, d); }
  return d;
}
/** Call after changing a generated item (upgrade, gem, enchant, lock). */
export function touchItem(item) { if (item && item.g) genCache.delete(item.g); }

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
  home: [['ashen_flask', 0.25], ['bone_shard', 0.4], ['gold_tooth', 0.15], ['grave_wax', 0.3], ['tattered_cloth', 0.2]],
  chest: [['ashen_flask', 0.8], ['gold_tooth', 0.6], ['ember_relic', 0.35], ['hunter_gloves', 0.15], ['ember_ring', 0.08], ['hauberk', 0.08]],
};

export function itemDef(id) { return ITEMS[id]; }
/** Sell price of an inventory entry (or a static item id). */
export function sellPrice(x) {
  const d = typeof x === 'string' ? ITEMS[x] : defOf(x);
  return Math.max(1, Math.floor(((d && d.value) || 0) * SELL_RATE));
}

export function statLine(stats = {}) {
  const lbl = { maxHp: 'HP', defense: '% defense', damagePct: '% damage', attackSpeedPct: '% attack speed', critChance: '% crit', speedPct: '% move speed', reach: 'm reach',
    maxStamina: 'stamina', staminaRegenPct: '% stamina regen', dropPct: '% drops', ashPct: '% ashes', bleedDps: 'bleed/s', chillPct: '% chill', burnDps: 'burn/s', thornsPct: '% thorns',
    lifesteal: '% lifesteal', rollIframes: 's roll i-frames', killStamina: 'stamina per kill', firstStrikePct: '% first strike', regen: 'HP/s', cheatDeath: 'revive', chainHit: 'chain', rollNova: 'roll nova', quakeChance: '% quake', killExplode: 'kill blast' };
  return Object.entries(stats).map(([k, v]) => `${v > 0 ? '+' : ''}${v}${lbl[k] && lbl[k][0] === '%' || lbl[k] && lbl[k][0] === 'm' ? '' : ' '}${lbl[k] || k}`).join(', ');
}
