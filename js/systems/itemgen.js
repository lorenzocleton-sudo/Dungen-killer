// LOOT: every generated item is BASE x MATERIAL x RARITY x RANDOM AFFIXES
// (+ item level, sockets, sets, named legendaries, mythics, curses).
//
// An inventory entry for a generated item is { uid, id: 'gen', qty: 1, g }:
//   g = { b: base, m: material, r: rarity, il: item level, a: [[affix, value]...],
//         s: [gemId|null...] sockets, set, u: unique (legendary/mythic id),
//         c: curse id, up: upgrade +N, lk: locked, new: fresh drop }
// defOf(item) turns that into a normal item definition (name, slot, stats...).

// ------------------------------------------------------------------ slots
export const SLOTS = ['weapon', 'head', 'chest', 'hands', 'legs', 'feet', 'cloak', 'ring1', 'ring2', 'amulet', 'belt', 'relic'];
export const SLOT_NAMES = { weapon: 'Weapon', head: 'Helmet', chest: 'Chest', hands: 'Gloves', legs: 'Legs', feet: 'Boots', cloak: 'Cloak', ring1: 'Ring', ring2: 'Ring', ring: 'Ring', amulet: 'Amulet', belt: 'Belt', relic: 'Relic' };
export const ARMOR_SLOTS = ['head', 'chest', 'hands', 'legs', 'feet', 'cloak'];
export const ACC_SLOTS = ['ring', 'amulet', 'belt', 'relic'];

// ------------------------------------------------------------------ rarity
export const RARITY = {
  normal: { name: 'Common', color: '#9a8e78', mul: 1, affixes: [0, 0], sockets: [0, 1] },
  special: { name: 'Special', color: '#5a9ad8', mul: 1.08, affixes: [1, 1], sockets: [0, 1] },
  rare: { name: 'Rare', color: '#b468e0', mul: 1.16, affixes: [2, 3], sockets: [1, 2] },
  legendary: { name: 'Legendary', color: '#ff8a20', mul: 1.28, affixes: [3, 4], sockets: [1, 2] },
  mythic: { name: 'Mythic', color: '#ff3a5a', mul: 1.4, affixes: [4, 5], sockets: [2, 3] },
};
export const RARITY_ORDER = ['normal', 'special', 'rare', 'legendary', 'mythic'];
/** Checked rarest first. */
export const ODDS = { mythic: 1 / 5000, legendary: 1 / 500, rare: 1 / 50, special: 1 / 5 };
export function rollRarity(luck = 1, rng = Math.random) {
  const r = rng();
  let acc = 0;
  for (const k of ['mythic', 'legendary', 'rare', 'special']) { acc += ODDS[k] * luck; if (r < acc) return k; }
  return 'normal';
}

// ------------------------------------------------------------------ materials (by depth)
export const MATERIALS = {
  rusted: { name: 'Rusted', tier: 0, mul: 0.8, tint: 0x8a6a50, min: 1 },
  iron: { name: 'Iron', tier: 1, mul: 1.0, tint: 0x9a9aa0, min: 1 },
  steel: { name: 'Steel', tier: 2, mul: 1.18, tint: 0xc8ccd4, min: 6 },
  blackiron: { name: 'Blackiron', tier: 3, mul: 1.38, tint: 0x4a4a54, min: 11 },
  sunsteel: { name: 'Sunsteel', tier: 4, mul: 1.62, tint: 0xe8c060, min: 16 },
  voidglass: { name: 'Voidglass', tier: 5, mul: 1.9, tint: 0x8a5ad0, min: 21 },
  hearthforged: { name: 'Hearthforged', tier: 6, mul: 2.25, tint: 0xff8a40, min: 27 },
};
export const MAT_IDS = Object.keys(MATERIALS);
export function materialFor(ilvl, rng = Math.random) {
  const ok = MAT_IDS.filter((m) => MATERIALS[m].min <= ilvl);
  // mostly the best two available, sometimes one lower
  const i = ok.length - 1 - (rng() < 0.55 ? 0 : rng() < 0.7 ? 1 : 2);
  return ok[Math.max(0, i)];
}

// ------------------------------------------------------------------ bases
// Weapons: own moveset each (see WEAPONS in combat profiles).
const W = (name, icon, o) => ({ slot: 'weapon', name, icon, ...o });
export const BASES = {
  sword: W('Sword', '⚔', { wtype: 'sword' }),
  greatsword: W('Greatsword', '⚔', { wtype: 'greatsword' }),
  axe: W('Axe', '⚒', { wtype: 'axe' }),
  greataxe: W('Great Axe', '⚒', { wtype: 'greataxe' }),
  mace: W('Mace', '✤', { wtype: 'mace' }),
  warhammer: W('Warhammer', '⚒', { wtype: 'warhammer' }),
  spear: W('Spear', '↑', { wtype: 'spear' }),
  halberd: W('Halberd', '↑', { wtype: 'halberd' }),
  dagger: W('Dagger', '†', { wtype: 'dagger' }),
  twinblades: W('Twin Blades', '⚔', { wtype: 'twinblades' }),
  scythe: W('Scythe', '☭', { wtype: 'scythe' }),
  whip: W('Whip', '∿', { wtype: 'whip' }),
  staff: W('Staff', '⚕', { wtype: 'staff' }),
  wand: W('Wand', '✦', { wtype: 'wand' }),
  bow: W('Bow', '➶', { wtype: 'bow' }),
  crossbow: W('Crossbow', '➶', { wtype: 'crossbow' }),
  knives: W('Throwing Knives', '†', { wtype: 'knives' }),
  shield: W('Shield', '⛨', { wtype: 'shield' }),
  tome: W('Tome', '❖', { wtype: 'tome' }),
  lantern: W('Lantern', '♨', { wtype: 'lantern' }),
  // armour: base HP + defence per piece
  helmet: { slot: 'head', name: 'Helm', icon: '◓', hp: 12, def: 3 },
  hood: { slot: 'head', name: 'Hood', icon: '◓', hp: 9, def: 2, aff: 'critChance' },
  cuirass: { slot: 'chest', name: 'Cuirass', icon: '▣', hp: 22, def: 6 },
  robe: { slot: 'chest', name: 'Robe', icon: '▣', hp: 14, def: 3, aff: 'maxMana' },
  gauntlets: { slot: 'hands', name: 'Gauntlets', icon: '✋', hp: 8, def: 2 },
  wraps: { slot: 'hands', name: 'Wraps', icon: '✋', hp: 6, def: 1, aff: 'attackSpeedPct' },
  greaves: { slot: 'legs', name: 'Greaves', icon: '‖', hp: 15, def: 4 },
  boots: { slot: 'feet', name: 'Boots', icon: '▄', hp: 8, def: 2, aff: 'speedPct' },
  cloak: { slot: 'cloak', name: 'Cloak', icon: '❦', hp: 10, def: 2, aff: 'dashRechargePct' },
  // accessories: one implicit stat
  ring: { slot: 'ring', name: 'Ring', icon: '○', imp: ['critChance', 2] },
  amulet: { slot: 'amulet', name: 'Amulet', icon: '✡', imp: ['damagePct', 4] },
  belt: { slot: 'belt', name: 'Belt', icon: '▬', imp: ['maxHp', 14] },
  relic: { slot: 'relic', name: 'Relic', icon: '✵', imp: ['cdrPct', 3] },
};
export const WEAPON_BASES = Object.keys(BASES).filter((b) => BASES[b].slot === 'weapon');
export const ARMOR_BASES = Object.keys(BASES).filter((b) => ARMOR_SLOTS.includes(BASES[b].slot));
export const ACC_BASES = ['ring', 'amulet', 'belt', 'relic'];

/** Base damage per weapon type (before material / item level / rarity). */
export const WEAPON_DMG = {
  sword: [15, 21], greatsword: [30, 40], axe: [20, 27], greataxe: [34, 46], mace: [18, 24], warhammer: [36, 48],
  spear: [17, 23], halberd: [28, 36], dagger: [9, 13], twinblades: [10, 14], scythe: [24, 32], whip: [14, 19],
  staff: [16, 22], wand: [8, 11], bow: [20, 28], crossbow: [34, 44], knives: [7, 10], shield: [12, 16], tome: [9, 12], lantern: [12, 16],
};

// ------------------------------------------------------------------ affixes (44)
// [id, label, stat, lo, hi, pools ('w' weapon, 'a' armour, 'j' jewellery), per-ilvl growth]
const AF = [
  ['dmg', 'Cruel', 'damagePct', 5, 12, 'wj', 0.35],
  ['atkspd', 'Swift', 'attackSpeedPct', 4, 10, 'wj', 0.08],
  ['crit', 'Keen', 'critChance', 2, 6, 'wj', 0.06],
  ['critdmg', 'Savage', 'critDmgPct', 10, 25, 'wj', 0.6],
  ['leech', 'of Thirst', 'lifesteal', 1, 4, 'wj', 0.05],
  ['hp', 'of Vigor', 'maxHp', 10, 25, 'aj', 2.4],
  ['hppct', 'Hale', 'maxHpPct', 4, 10, 'aj', 0.1],
  ['def', 'Warded', 'defense', 1, 4, 'a', 0.04],
  ['regen', 'of Mending', 'regen', 0.5, 2, 'aj', 0.06],
  ['burn', 'Searing', 'burnDps', 2, 5, 'w', 0.5],
  ['chill', 'Frigid', 'chillPct', 10, 25, 'w', 0.2],
  ['shock', 'of Storms', 'shockChance', 5, 12, 'w', 0.1],
  ['poison', 'Venomous', 'poisonDps', 2, 5, 'w', 0.5],
  ['bleed', 'Serrated', 'bleedDps', 2, 5, 'w', 0.5],
  ['thorns', 'Barbed', 'thornsPct', 5, 15, 'a', 0.2],
  ['move', 'of the Wind', 'speedPct', 3, 8, 'aj', 0.04],
  ['dashcd', 'of Haste', 'dashRechargePct', 8, 20, 'aj', 0.2],
  ['jump', 'of Leaping', 'jumpPct', 5, 12, 'a', 0.1],
  ['loot', 'of Plunder', 'dropPct', 8, 20, 'aj', 0.3],
  ['ash', 'of Ashes', 'ashPct', 8, 20, 'aj', 0.3],
  ['pet', 'of the Pack', 'petDmgPct', 10, 25, 'aj', 0.4],
  ['ally', 'of Fellowship', 'allyHpPct', 10, 25, 'aj', 0.4],
  ['coh', 'of Sparks', 'castOnHit', 4, 10, 'w', 0.08],
  ['cdr', 'of Focus', 'cdrPct', 4, 10, 'j', 0.08],
  ['mana', 'of Wisdom', 'maxMana', 10, 25, 'aj', 0.6],
  ['manareg', 'of Clarity', 'manaRegen', 1, 3, 'j', 0.05],
  ['stam', 'of Endurance', 'maxStamina', 8, 20, 'aj', 0.3],
  ['stamreg', 'of Breath', 'staminaRegenPct', 8, 20, 'aj', 0.2],
  ['rfire', 'of the Hearth', 'resFire', 8, 20, 'a', 0.25],
  ['rfrost', 'of the North', 'resFrost', 8, 20, 'a', 0.25],
  ['rpois', 'of Purity', 'resPoison', 8, 20, 'a', 0.25],
  ['rall', 'of Warding', 'resAll', 4, 8, 'j', 0.1],
  ['killheal', 'of Feasting', 'killHeal', 2, 6, 'wj', 0.3],
  ['killstam', 'of Second Wind', 'killStamina', 5, 12, 'wj', 0.1],
  ['exec', 'Merciless', 'executePct', 10, 25, 'w', 0.3],
  ['first', 'Ambusher’s', 'firstStrikePct', 10, 25, 'w', 0.3],
  ['reach', 'Long', 'reach', 0.1, 0.3, 'w', 0.004],
  ['skill', 'of Mastery', 'skillDmgPct', 8, 20, 'aj', 0.3],
  ['block', 'of the Bulwark', 'blockPct', 5, 12, 'a', 0.08],
  ['elem', 'Elemental', 'elemDmgPct', 8, 20, 'wj', 0.3],
  ['xp', 'of Learning', 'xpPct', 5, 12, 'j', 0.08],
  ['elite', 'of the Hunt', 'eliteDmgPct', 10, 25, 'wj', 0.3],
  ['stagger', 'Crushing', 'staggerPct', 10, 30, 'w', 0.3],
  ['flask', 'of the Apothecary', 'flaskPct', 10, 25, 'aj', 0.3],
];
export const AFFIXES = Object.fromEntries(AF.map(([id, label, stat, lo, hi, pools, grow]) => [id, { id, label, stat, lo, hi, pools, grow }]));
export const AFFIX_IDS = Object.keys(AFFIXES);
const PCT = new Set(['damagePct', 'attackSpeedPct', 'critChance', 'critDmgPct', 'lifesteal', 'maxHpPct', 'defense', 'chillPct', 'shockChance', 'thornsPct', 'speedPct', 'dashRechargePct', 'jumpPct', 'dropPct', 'ashPct', 'petDmgPct', 'allyHpPct', 'castOnHit', 'cdrPct', 'staminaRegenPct', 'resFire', 'resFrost', 'resPoison', 'resAll', 'executePct', 'firstStrikePct', 'skillDmgPct', 'blockPct', 'elemDmgPct', 'xpPct', 'eliteDmgPct', 'staggerPct', 'flaskPct']);

// ------------------------------------------------------------------ gems: 7 types x 5 grades
export const GEM_TYPES = {
  ruby: { name: 'Ruby', color: '#e04040', stat: 'maxHp', per: 12 },
  sapphire: { name: 'Sapphire', color: '#4070e0', stat: 'resFrost', per: 4, also: ['chillPct', 4] },
  emerald: { name: 'Emerald', color: '#40c060', stat: 'critChance', per: 1.2 },
  topaz: { name: 'Topaz', color: '#e0b030', stat: 'ashPct', per: 4, also: ['dropPct', 3] },
  amethyst: { name: 'Amethyst', color: '#a050e0', stat: 'lifesteal', per: 0.8 },
  onyx: { name: 'Onyx', color: '#606070', stat: 'defense', per: 1 },
  diamond: { name: 'Diamond', color: '#e0f0ff', stat: 'resAll', per: 2, also: ['damagePct', 2] },
};
export const GEM_GRADES = ['Chipped', 'Flawed', 'Clear', 'Flawless', 'Perfect'];
const GRADE_MUL = [1, 2, 3.5, 5.5, 8];
export const gemId = (type, grade) => `gem_${type}_${grade}`;
export function gemInfo(id) {
  const m = /^gem_(\w+)_(\d)$/.exec(id || '');
  if (!m || !GEM_TYPES[m[1]]) return null;
  const T = GEM_TYPES[m[1]], g = +m[2];
  const stats = { [T.stat]: +(T.per * GRADE_MUL[g]).toFixed(1) };
  if (T.also) stats[T.also[0]] = +(T.also[1] * GRADE_MUL[g]).toFixed(1);
  return { type: m[1], grade: g, name: `${GEM_GRADES[g]} ${T.name}`, color: T.color, stats };
}

// ------------------------------------------------------------------ curses
export const CURSES = {
  bloodprice: { name: 'Bloodprice', up: { damagePct: 40 }, down: { maxHpPct: -25 }, text: '+40% damage, but 25% less max HP' },
  hungering: { name: 'Hungering', up: { attackSpeedPct: 30 }, down: { noFlask: 1 }, text: '+30% attack speed, but flasks and potions do nothing' },
  glass: { name: 'Glass', up: { critDmgPct: 60 }, down: { dmgTakenPct: 30 }, text: '+60% crit damage, but you take 30% more damage' },
  leaden: { name: 'Leaden', up: { damagePct: 35, defense: 8 }, down: { speedPct: -20 }, text: '+35% damage, +8% defence, but 20% slower' },
  starving: { name: 'Starving', up: { lifesteal: 8 }, down: { healPct: -50, regen: -2 }, text: '+8% lifesteal, but half healing and no regeneration' },
  hollow: { name: 'Hollow', up: { ashPct: 60, dropPct: 40 }, down: { maxHpPct: -20 }, text: '+60% ashes and +40% drops, but 20% less max HP' },
};
export const CURSE_IDS = Object.keys(CURSES);

// ------------------------------------------------------------------ lore sets (2 / 4 / 6 pieces)
export const SETS = {
  oathguard: { name: 'Oathguard', color: '#b0b8c8', pieces: ['helmet', 'cuirass', 'gauntlets', 'greaves', 'boots', 'shield'],
    bonus: { 2: { maxHp: 40 }, 4: { defense: 8, blockPct: 15 }, 6: { thornsPct: 30, oathBulwark: 1 } }, text6: 'Blocking a hit releases a shockwave.' },
  cinder: { name: 'Cinder Choir', color: '#e08040', pieces: ['hood', 'robe', 'wraps', 'greaves', 'boots', 'staff'],
    bonus: { 2: { burnDps: 6 }, 4: { burnPct: 40, resFire: 20 }, 6: { killExplode: 60, castOnHit: 8 } }, text6: 'Slain foes burst into flame; sparks fly from your hits.' },
  veiled: { name: 'The Veiled', color: '#8a9a7a', pieces: ['hood', 'cloak', 'wraps', 'greaves', 'boots', 'dagger'],
    bonus: { 2: { critChance: 6 }, 4: { dashRechargePct: 30, speedPct: 6 }, 6: { deathDance: 1, dashInvis: 1 } }, text6: 'Dashing makes you unseen for 2s; kills make your next hit critical.' },
  drowned: { name: 'Drowned Court', color: '#50b0a0', pieces: ['helmet', 'cuirass', 'gauntlets', 'greaves', 'boots', 'halberd'],
    bonus: { 2: { resFrost: 20, maxHp: 30 }, 4: { chillPct: 30 }, 6: { tideNova: 1 } }, text6: 'Every 6th hit releases a crashing wave that slows everything nearby.' },
  rimewatch: { name: 'Rimewatch', color: '#a0d8ff', pieces: ['helmet', 'cuirass', 'gauntlets', 'greaves', 'cloak', 'bow'],
    bonus: { 2: { chillPct: 20 }, 4: { resFrost: 30, defense: 6 }, 6: { rollNova: 60 } }, text6: 'Dashing releases a frost nova.' },
  kilnwright: { name: 'Kilnwright', color: '#d09050', pieces: ['helmet', 'cuirass', 'gauntlets', 'boots', 'belt', 'warhammer'],
    bonus: { 2: { staggerPct: 30 }, 4: { quakeChance: 15, maxHp: 50 }, 6: { quakeChance: 15, damagePct: 25 } }, text6: 'Your blows shake the earth.' },
  houndtamer: { name: 'Hound-Tamer', color: '#b07850', pieces: ['hood', 'cuirass', 'wraps', 'greaves', 'boots', 'whip'],
    bonus: { 2: { petDmgPct: 30 }, 4: { allyHpPct: 40, speedPct: 5 }, 6: { packCall: 1 } }, text6: 'A spectral hound fights at your side.' },
  hollowcrown: { name: 'Hollow Crown', color: '#c8a040', pieces: ['helmet', 'cuirass', 'gauntlets', 'greaves', 'ring', 'greatsword'],
    bonus: { 2: { damagePct: 12 }, 4: { critDmgPct: 40, lifesteal: 4 }, 6: { executePct: 80, cheatDeath: 1 } }, text6: 'Execute the weak; once per run, death leaves you standing.' },
};
export const SET_IDS = Object.keys(SETS);

// ------------------------------------------------------------------ named legendaries (32) and mythics (13)
// fx: special effect keys handled by combat (see CombatSystem.proc*)
const LEG = (id, name, base, stats, text, lore) => ({ id, name, base, stats, text, lore });
export const LEGENDARIES = [
  LEG('kingsbane', 'Kingsbane', 'sword', { damagePct: 30, chainHit: 2 }, 'Every hit arcs to 2 more enemies.', 'Forged to kill a king. It has not yet been used for that.'),
  LEG('phoenix_heart', 'Heart of the Phoenix', 'amulet', { regen: 2, cheatDeath: 1, maxHp: 30 }, 'Once per visit, death leaves you standing.', 'It beats. Slowly. Not always in time.'),
  LEG('nameless_shroud', 'Shroud of the Nameless', 'cloak', { maxHp: 30, rollNova: 30 }, 'Dashing releases a frost nova.', 'Whoever wore it first is not remembered. That was the point.'),
  LEG('colossus_fists', 'Fists of the Colossus', 'gauntlets', { damagePct: 15, quakeChance: 20 }, '20% of hits shake the earth.', 'Too heavy for any living hand. You manage.'),
  LEG('ashen_crown', 'Crown of the Ashen Kings', 'helmet', { maxHp: 30, killExplode: 35, burnDps: 4 }, 'Slain foes explode in flame.', 'Seven kings wore it. Seven kings burned.'),
  LEG('mourning_edge', 'Mourning Edge', 'greatsword', { critDmgPct: 50, executePct: 40 }, 'Brutal executions.', 'The blade weeps black sap on cold days.'),
  LEG('widows_fang', 'Widow’s Fang', 'dagger', { critChance: 12, poisonDps: 8 }, 'Venom with every cut.', 'A wedding gift. The marriage was short.'),
  LEG('gravebell', 'The Gravebell', 'mace', { staggerPct: 80, quakeChance: 12 }, 'It rings when it lands.', 'Rung once for every Wanderer who did not come back.'),
  LEG('sunderer', 'Sunderer', 'greataxe', { damagePct: 40, bleedDps: 10 }, 'Opens deep wounds.', 'It split the gate of Vael. The gate is still split.'),
  LEG('tidecaller', 'Tidecaller', 'halberd', { chillPct: 40, tideNova: 1 }, 'Every 6th hit calls a wave.', 'Salt crusts the haft no matter how often it is cleaned.'),
  LEG('choirs_end', 'The Choir’s End', 'staff', { burnDps: 10, castOnHit: 15 }, 'Fireballs leap from your strikes.', 'The last note of the Cinder Choir, carved into ash-wood.'),
  LEG('starfall', 'Starfall Wand', 'wand', { shockChance: 25, elemDmgPct: 30 }, 'Lightning answers your bolts.', 'It points north even when you hold it still.'),
  LEG('heartstring', 'Heartstring', 'bow', { critChance: 10, pierceAll: 1 }, 'Arrows pierce everything.', 'Strung with something that was once a promise.'),
  LEG('verdict', 'The Verdict', 'crossbow', { damagePct: 45, firstStrikePct: 60 }, 'The first bolt is the sentence.', 'Every bolt is engraved with a name. Most are scratched out.'),
  LEG('thousand_cuts', 'A Thousand Cuts', 'knives', { attackSpeedPct: 25, bleedDps: 6 }, 'Bleeding everywhere.', 'There were never a thousand. It only felt like it.'),
  LEG('aegis_vael', 'Aegis of Vael', 'shield', { defense: 15, blockPct: 20, oathBulwark: 1 }, 'Blocks release a shockwave.', 'The lion on its face has worn to a blur of hands.'),
  LEG('last_psalm', 'The Last Psalm', 'tome', { skillDmgPct: 40, cdrPct: 15 }, 'Skills hit harder, come back sooner.', 'The final page is blank. You feel you should not write on it.'),
  LEG('wakelight', 'Wakelight', 'lantern', { burnDps: 12, killHeal: 6 }, 'Its flame feeds on the fallen.', 'Carried by the watchers of the dead. It never once went out.'),
  LEG('gloomreaper', 'Gloomreaper', 'scythe', { lifesteal: 8, killHealPct: 4 }, 'Each kill restores you.', 'It does not reap. It collects.'),
  LEG('serpent_lash', 'Serpent Lash', 'whip', { poisonDps: 10, reach: 0.6 }, 'Venom at a distance.', 'It moves a little when no one is holding it.'),
  LEG('twin_vows', 'The Twin Vows', 'twinblades', { critChance: 8, doubleStrike: 25 }, '25% chance to strike again.', 'Two oaths, one to each hand. Neither was kept.'),
  LEG('lionheart', 'Lionheart Plate', 'cuirass', { maxHp: 80, defense: 10, regen: 2 }, 'Unbreakable.', 'The lion of Vael, before the lion went hollow.'),
  LEG('ghoststep', 'Ghoststep Boots', 'boots', { speedPct: 15, dashCharges: 1 }, 'An extra dash.', 'Their footprints appear a moment after you leave.'),
  LEG('featherfall', 'Featherfall Greaves', 'greaves', { jumpPct: 25, doubleJump: 1 }, 'Grants a double jump.', 'Light as the ash they were found in.'),
  LEG('eyes_of_warden', 'Eyes of the Warden', 'hood', { critChance: 10, eliteDmgPct: 40 }, 'Sees the weakness in great foes.', 'Sir Corvane never closed them. Not once in four hundred years.'),
  LEG('band_of_embers', 'Band of Embers', 'ring', { burnDps: 8, burnSpread: 1 }, 'Flames jump from burning corpses.', 'Warm against the skin. Too warm.'),
  LEG('reapers_band', 'Reaper’s Band', 'ring', { critChance: 6, killStamina: 25, killHeal: 5 }, 'Kills restore you.', 'Taken from a finger that was not finished with it.'),
  LEG('hunters_seal', 'Hunter’s Seal', 'ring', { firstStrikePct: 50, dropPct: 25 }, 'First strikes devastate.', 'Stamped with the crest of a hunt that never ended.'),
  LEG('girdle_of_giants', 'Girdle of Giants', 'belt', { maxHp: 120, maxHpPct: 10 }, 'Enormous vitality.', 'Cut down from something much larger.'),
  LEG('sundial', 'The Broken Sundial', 'relic', { cdrPct: 20, manaRegen: 4 }, 'Skills recharge faster.', 'Its shadow points to an hour that never came.'),
  LEG('hearth_ember', 'Ember of the First Hearth', 'relic', { regen: 4, resAll: 15 }, 'Steady warmth.', 'Taken from the Hearth itself. It wants to go back.'),
  LEG('bloodmoon', 'Bloodmoon Amulet', 'amulet', { lifesteal: 6, berserkPct: 40 }, 'Fury when wounded.', 'The moon was red the night it was made. It has stayed red since.'),
];
export const MYTHICS = [
  LEG('hearthbrand', 'Hearthbrand', 'sword', { damagePct: 50, killHealPct: 10, killExplode: 60 }, 'Kills heal 10% of your HP and burst into fire.', 'The Hearth’s own flame, bound to a blade. It does not forgive being sheathed.'),
  LEG('hollow_crown', 'Crown of the Hollow King', 'helmet', { maxHp: 80, spectralKnights: 3 }, 'Three spectral knights fight for you.', 'It fits too well.'),
  LEG('clockstopper', 'Clockstopper', 'amulet', { cdrPct: 15, dashFreeze: 1 }, 'Dashing freezes nearby enemies for 3s (20s cooldown).', 'The Veiled stole one hour. This is what they kept it in.'),
  LEG('voidreaver', 'Voidreaver', 'scythe', { damagePct: 40, voidDouble: 1 }, 'Every hit strikes twice; the second ignores armour.', 'Below the Abyss, something forged this. It wanted to be found.'),
  LEG('ouroboros', 'Ouroboros Ring', 'ring', { cheatDeath: 1, regen: 3 }, 'Cheat death once per run.', 'It has no beginning. You checked.'),
  LEG('wings_of_ash', 'Wings of Ash', 'cloak', { doubleJump: 1, glide: 1, speedPct: 10 }, 'Double jump; hold jump to glide.', 'Ash, held in the shape of wings by sheer stubbornness.'),
  LEG('thousand_hour', 'Thousand-Hour Blade', 'greatsword', { damagePct: 20, growingDamage: 1 }, 'Gains +1% damage per kill this run (up to +150%).', 'Forged in the stilled hour. Every second of it.'),
  LEG('ember_heart', 'Emberheart', 'relic', { resFire: 100, burnSpread: 1, burnDps: 15 }, 'Immune to fire; burning foes spread their flames.', 'The fire beneath the mountains had a heart. Now you do too.'),
  LEG('stilled_hour', 'The Stilled Hour', 'amulet', { stillTime: 1, maxHp: 60 }, 'Below 30% HP, time slows around you for 4s (60s cooldown).', 'One hour, held still. It is heavier than it looks.'),
  LEG('grave_lantern', 'Lantern of the Grave', 'lantern', { raiseDead: 1, burnDps: 10 }, 'Slain foes rise as skeletons that fight for you.', 'Its light makes the dead remember what they were for.'),
  LEG('storm_crown', 'Storm Crown', 'helmet', { stormCall: 1, shockChance: 20 }, 'Every 4th hit calls lightning on 3 enemies.', 'It crackles when a lie is told nearby. It crackles often.'),
  LEG('bloodtide', 'Bloodtide', 'twinblades', { lifesteal: 15, overhealShield: 1 }, 'Massive lifesteal; overhealing becomes a shield.', 'The tide comes in red. It always has.'),
  LEG('abyssal_bow', 'Abyssal Bow', 'bow', { pierceAll: 1, splitShot: 3, damagePct: 30 }, 'Arrows pierce all and split into three.', 'Strung with a thread of the Abyss. It hums when it is hungry.'),
];
export const UNIQUES = Object.fromEntries([...LEGENDARIES.map((l) => [l.id, { ...l, rarity: 'legendary' }]), ...MYTHICS.map((l) => [l.id, { ...l, rarity: 'mythic' }])]);

// ------------------------------------------------------------------ generation
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const ri = (a, b, rng) => a + Math.floor(rng() * (b - a + 1));

function rollAffixValue(id, ilvl, rng) {
  const A = AFFIXES[id];
  const v = A.lo + (A.hi - A.lo) * rng() + A.grow * ilvl;
  return A.hi < 1 ? +v.toFixed(2) : A.hi < 10 && !PCT.has(A.stat) ? +v.toFixed(1) : Math.round(v);
}

function poolFor(slot) { return slot === 'weapon' ? 'w' : ARMOR_SLOTS.includes(slot) ? 'a' : 'j'; }

/**
 * Generate an item. o: { ilvl, rarity, base, slot, set, unique, cursed, rng }
 * Returns the g record (put it in an inventory entry with id 'gen').
 */
export function generateItem(o = {}) {
  const rng = o.rng || Math.random;
  const ilvl = Math.max(1, Math.round(o.ilvl || 1));
  let rarity = o.rarity || rollRarity(1, rng);
  const g = { il: ilvl, r: rarity, a: [], s: [], up: 0 };
  // named legendary / mythic
  let U = o.unique ? UNIQUES[o.unique] : null;
  if (!U && (rarity === 'legendary' || rarity === 'mythic') && !o.set && (o.unique !== false)) U = pick(rarity === 'mythic' ? MYTHICS : LEGENDARIES, rng);
  if (U) { g.u = U.id; g.b = U.base; rarity = g.r = U.rarity || rarity; }
  else if (o.set && SETS[o.set]) { g.set = o.set; g.b = o.base || pick(SETS[o.set].pieces, rng); }
  else {
    let base = o.base;
    if (!base) {
      const slot = o.slot || (rng() < 0.4 ? 'weapon' : rng() < 0.65 ? 'armor' : 'acc');
      base = slot === 'weapon' ? pick(WEAPON_BASES, rng) : slot === 'armor' ? pick(ARMOR_BASES, rng) : slot === 'acc' ? pick(ACC_BASES, rng)
        : pick(Object.keys(BASES).filter((b) => BASES[b].slot === slot || (slot.startsWith('ring') && BASES[b].slot === 'ring')), rng);
    }
    g.b = base;
  }
  const B = BASES[g.b];
  g.m = ACC_SLOTS.includes(B.slot) ? null : materialFor(ilvl, rng);
  // affixes: Common 0, Special 1, Rare 2-3, Legendary 3-4 (+unique), Mythic 4-5 (+game-changer)
  const R = RARITY[rarity];
  const n = ri(R.affixes[0], R.affixes[1], rng) - (U ? 1 : 0);
  const pool = AFFIX_IDS.filter((id) => AFFIXES[id].pools.includes(poolFor(B.slot)));
  for (let i = 0; i < n && pool.length; i++) {
    const id = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    g.a.push([id, rollAffixValue(id, ilvl, rng)]);
  }
  // sockets
  const sk = ri(R.sockets[0], R.sockets[1], rng);
  for (let i = 0; i < Math.min(3, sk); i++) g.s.push(null);
  // curses: rare, but always a real trade
  if (o.cursed || (o.cursed !== false && rarity !== 'normal' && rng() < 0.04)) g.c = pick(CURSE_IDS, rng);
  g.new = 1;
  return g;
}

/** Item name from its parts. */
export function itemName(g) {
  if (g.n) return g.n;
  const B = BASES[g.b];
  if (g.u) return UNIQUES[g.u].name;
  const mat = g.m ? MATERIALS[g.m].name + ' ' : '';
  if (g.set) return `${SETS[g.set].name} ${B.name}`;
  const pre = g.a.find(([id]) => !AFFIXES[id].label.startsWith('of '));
  const suf = g.a.find(([id]) => AFFIXES[id].label.startsWith('of '));
  return `${pre ? AFFIXES[pre[0]].label + ' ' : ''}${mat}${B.name}${suf ? ' ' + AFFIXES[suf[0]].label : ''}`;
}

/** Turn a generated record into a full item definition. */
export function genDef(g) {
  const B = BASES[g.b] || BASES.sword;
  const R = RARITY[g.r] || RARITY.normal;
  const M = g.m ? MATERIALS[g.m] : null;
  const mm = M ? M.mul : 1;
  const il = g.il || 1;
  const up = g.up || 0;
  const stats = {};
  const add = (k, v) => { stats[k] = +(((stats[k] || 0) + v)).toFixed(2); };
  let dmg = null;
  if (B.slot === 'weapon') {
    const [lo, hi] = WEAPON_DMG[B.wtype];
    const k = mm * (1 + il * 0.16) * R.mul * (1 + up * 0.08);
    dmg = [Math.round(lo * k), Math.round(hi * k)];
  } else if (ARMOR_SLOTS.includes(B.slot)) {
    add('maxHp', Math.round(B.hp * mm * (1 + il * 0.1) * R.mul * (1 + up * 0.06)));
    add('defense', +(B.def * (0.7 + (M ? M.tier : 0) * 0.08)).toFixed(1));
    if (B.aff) add(B.aff, B.aff === 'maxMana' ? 10 : B.aff === 'dashRechargePct' ? 6 : 3);
  } else if (B.imp) add(B.imp[0], +(B.imp[1] * (1 + il * 0.05) * R.mul).toFixed(1));
  for (const [id, v] of g.a) add(AFFIXES[id].stat, v * (1 + up * 0.03));
  if (g.u) for (const [k, v] of Object.entries(UNIQUES[g.u].stats)) add(k, typeof v === 'number' && v > 1 && !['spectralKnights', 'splitShot', 'dashCharges'].includes(k) ? Math.round(v * (1 + il * 0.02)) : v);
  if (g.c) { for (const [k, v] of Object.entries(CURSES[g.c].up)) add(k, v); for (const [k, v] of Object.entries(CURSES[g.c].down)) add(k, v); }
  for (const gid of g.s || []) { const gi = gid && gemInfo(gid); if (gi) for (const [k, v] of Object.entries(gi.stats)) add(k, v); }
  const name = itemName(g) + (up ? ` +${up}` : '');
  const color = g.c ? '#a060c0' : R.color;
  const value = Math.round((20 + il * 9) * mm * [1, 2.5, 6, 18, 50][RARITY_ORDER.indexOf(g.r)] * (1 + up * 0.15));
  const U = g.u ? UNIQUES[g.u] : null;
  return {
    gen: true, name, kind: 'gear', slot: B.slot, base: g.b, wtype: B.wtype || null, model: B.wtype || null, rarity: g.r, ilvl: il, material: g.m,
    tint: M ? M.tint : null, dmg, stats, value, icon: [B.icon, color], set: g.set || null, unique: g.u || null, cursed: g.c || null,
    sockets: g.s || [], upgrade: up, locked: !!g.lk,
    desc: U ? `${U.rarity === 'mythic' ? 'MYTHIC' : 'LEGENDARY'}: ${U.text}` : g.set ? `Set: ${SETS[g.set].name}` : `${R.name} ${B.name.toLowerCase()} · item level ${il}`,
    lore: U ? U.lore : null,
    curseText: g.c ? `CURSED (${CURSES[g.c].name}): ${CURSES[g.c].text}` : null,
  };
}

/** Salvage: what a piece of gear breaks down into. */
export function salvageYield(def) {
  const tier = def.material ? MATERIALS[def.material].tier : 1;
  const ore = ['ore_iron', 'ore_iron', 'ore_steel', 'ore_blackiron', 'ore_sunsteel', 'ore_voidglass', 'ore_hearth'][tier];
  const ri2 = RARITY_ORDER.indexOf(def.rarity || 'normal');
  const out = [[ore, 1 + Math.floor((def.ilvl || 1) / 8)]];
  if (ri2 >= 1) out.push([['ess_fire', 'ess_frost', 'ess_storm', 'ess_shadow', 'ess_life'][(def.ilvl || 1) % 5], ri2]);
  if (ri2 >= 3) out.push(['ess_void', ri2 - 2]);
  return { items: out, ashes: Math.round((def.value || 10) * 0.15) };
}

export function statLabel(k, v) {
  const L = {
    maxHp: 'HP', maxHpPct: '% max HP', defense: '% defence', damagePct: '% damage', attackSpeedPct: '% attack speed', critChance: '% crit chance', critDmgPct: '% crit damage',
    lifesteal: '% lifesteal', regen: 'HP/s', burnDps: 'burn/s', chillPct: '% chill', shockChance: '% shock chance', poisonDps: 'poison/s', bleedDps: 'bleed/s', thornsPct: '% thorns',
    speedPct: '% move speed', dashRechargePct: '% dash recharge', jumpPct: '% jump height', dropPct: '% item find', ashPct: '% ash find', petDmgPct: '% pet damage',
    allyHpPct: '% companion HP', castOnHit: '% cast fireball on hit', cdrPct: '% cooldown reduction', maxMana: 'mana', manaRegen: 'mana/s', maxStamina: 'stamina',
    staminaRegenPct: '% stamina regen', resFire: '% fire resist', resFrost: '% frost resist', resPoison: '% poison resist', resAll: '% all resist', killHeal: 'HP per kill',
    killStamina: 'stamina per kill', executePct: '% damage to low-HP foes', firstStrikePct: '% first-strike damage', reach: 'm reach', skillDmgPct: '% skill damage',
    blockPct: '% block', elemDmgPct: '% elemental damage', xpPct: '% XP', eliteDmgPct: '% damage to elites', staggerPct: '% stagger', flaskPct: '% potion healing',
    dmgTakenPct: '% damage taken', healPct: '% healing', burnPct: '% burn damage', quakeChance: '% quake chance', berserkPct: '% damage when wounded',
    dashCharges: 'dash charge', doubleJump: 'double jump', groundSlam: 'ground slam', killHealPct: '% HP per kill',
  };
  const lab = L[k];
  if (!lab) return null;
  const n = Math.abs(v) < 10 && v % 1 ? (+v).toFixed(1) : Math.round(v);
  return `${v > 0 ? '+' : ''}${n}${lab[0] === '%' || lab[0] === 'm' && lab.length < 3 ? '' : ' '}${lab}`;
}
