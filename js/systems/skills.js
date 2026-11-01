// SKILL WEB: ten paths around one connected web. Every path has ~22 nodes
// (passives, two actives, on-hit effects, movement unlocks for Storm) and two
// keystones with real trade-offs. Crossroads (hybrid) nodes sit between
// neighbouring paths and open from EITHER side. Skills are learned only at the
// Hall of Paths (respec there too, for a scaling ash cost).
//
// Node: { id, branch, x, y (web coordinates, root at the centre), name, desc,
//         max, requires: [ids], anyOf (hybrids), points, fee, keystone,
//         rank (renown rank needed), effects: { stat: perRank }, active }

export const TREE_W = 2600, TREE_H = 2600;
const CX = TREE_W / 2, CY = TREE_H / 2;

export const BRANCHES = {
  root: { name: 'Awakened', color: '#b8a888' },
  iron: { name: 'The Oathguard', color: '#b0b4bc', desc: 'Knights who believed a spoken vow binds the world itself.' },
  blood: { name: 'The Red Covenant', color: '#c03a3a', desc: 'They paid for strength in blood, and kept paying after the bill was settled.' },
  death: { name: 'The Bone Choir', color: '#a8a090', desc: 'Grave-singers who taught the dead to stand one more time.' },
  shadow: { name: 'The Veiled', color: '#8a9a7a', desc: 'Thieves who once stole a single hour from the night, and hid it.' },
  hunter: { name: 'The Long Watch', color: '#a07848', desc: 'Wardens of the royal forest, who never came in from the cold.' },
  storm: { name: 'The Thunderborn', color: '#d8d070', desc: 'Sky-priests who rode the last storm before the ash, and did not land.' },
  frost: { name: 'The Rimewatch', color: '#90c8f0', desc: 'Northern sentries frozen at their posts. Some of them still answer.' },
  ash: { name: 'The Cinder Choir', color: '#e08040', desc: 'Priests who sang to the fire beneath the mountains.' },
  faith: { name: 'The Hearth-Keepers', color: '#f0d890', desc: 'Those who tend the Hearth, and pray that the hour holds.' },
  beast: { name: 'The Wild Oath', color: '#70a050', desc: 'Beast-speakers of the southern colonies. The jungle still listens.' },
  hybrid: { name: 'Crossroads', color: '#c8a0d8', desc: 'Where two paths meet.' },
};
const ORDER = ['iron', 'blood', 'death', 'shadow', 'hunter', 'storm', 'frost', 'ash', 'faith', 'beast'];

const N = (id, branch, x, y, name, desc, effects, o = {}) => ({
  id, branch, name, desc, effects, max: o.max || 1, requires: o.req || [], points: o.points || (o.key ? 2 : 1),
  fee: o.fee, keystone: !!o.key, rank: o.rank || 0, active: o.active || null,
});

// Old Oathguard / Cinder Choir / Veiled nodes (ids kept so old saves keep their skills)
const OLD = [
  N('w_vigor', 'iron', 18, 138, 'Vigor', '+15 max HP per rank.', { maxHp: 15 }, { max: 3, req: ['root'] }),
  N('w_heavy', 'iron', 10, 124, 'Heavy Hand', '+8% melee damage per rank.', { damagePct: 8 }, { max: 3, req: ['w_vigor'] }),
  N('w_skin', 'iron', 26, 124, 'Iron Skin', 'Take 5% less damage per rank.', { defense: 5 }, { max: 3, req: ['w_vigor'] }),
  N('w_cleave', 'iron', 6, 110, 'Cleave', 'Your swings cover a 35% wider arc.', { arcPct: 35 }, { req: ['w_heavy'] }),
  N('w_wind', 'iron', 18, 110, 'Second Wind', 'Regenerate 1 HP per second.', { regen: 1 }, { req: ['w_skin'] }),
  N('w_blood', 'iron', 30, 110, 'Bloodthirst', 'Heal for 6% of damage dealt.', { lifesteal: 6 }, { req: ['w_skin'] }),
  N('w_endure', 'iron', 10, 96, 'Endurance', '+15 max stamina per rank.', { maxStamina: 15 }, { max: 3, req: ['w_cleave'] }),
  N('w_guard', 'iron', 26, 96, 'Barbed Guard', 'Attackers take 10% of the damage they deal.', { thornsPct: 10 }, { req: ['w_wind'] }),
  N('w_stagger', 'iron', 6, 82, 'Shatter', 'Hits stagger 30% harder and deal +5% damage.', { staggerPct: 30, damagePct: 5 }, { req: ['w_endure'] }),
  N('w_jugg', 'iron', 18, 82, 'Juggernaut', '+30 max HP and 6% less damage taken.', { maxHp: 30, defense: 6 }, { req: ['w_endure', 'w_guard'] }),
  N('w_bulwark', 'iron', 30, 82, 'Bulwark', 'Take 4% less damage per rank.', { defense: 4 }, { max: 2, req: ['w_guard'] }),
  N('w_berserk', 'iron', 10, 68, 'Berserker', '+25% damage while below 40% HP.', { berserkPct: 25 }, { req: ['w_stagger'] }),
  N('w_ironlung', 'iron', 26, 68, 'Iron Lungs', 'Stamina regenerates 15% faster per rank.', { staminaRegenPct: 15 }, { max: 2, req: ['w_jugg'] }),
  N('w_brutal', 'iron', 6, 54, 'Brutality', '+20% critical damage per rank.', { critDmgPct: 20 }, { max: 2, req: ['w_berserk'] }),
  N('w_titan', 'iron', 18, 54, 'Titan Blood', '+10% damage and +20 max HP.', { damagePct: 10, maxHp: 20 }, { req: ['w_berserk', 'w_ironlung'] }),
  N('w_spikes', 'iron', 30, 54, 'Spiked Mail', 'Attackers take another 15% of their damage.', { thornsPct: 15 }, { req: ['w_bulwark'] }),
  N('w_warcry', 'iron', 12, 40, 'War Cry', 'Kills restore 10 stamina.', { killStamina: 10 }, { req: ['w_brutal', 'w_titan'] }),
  N('w_unyield', 'iron', 26, 40, 'Unyielding', '+25 max HP and 6% less damage taken.', { maxHp: 25, defense: 6 }, { req: ['w_titan', 'w_spikes'] }),
  N('w_exec', 'iron', 12, 26, 'Executioner', 'KEYSTONE: +60% damage to enemies below 30% HP.', { executePct: 60 }, { req: ['w_warcry'], key: true, rank: 2 }),
  N('w_last', 'iron', 26, 26, 'Last Stand', 'KEYSTONE: once per dungeon visit, a killing blow leaves you at 1 HP, invulnerable for 2s.', { cheatDeath: 1 }, { req: ['w_unyield'], key: true, rank: 3 }),
  N('w_colossus', 'iron', 19, 12, 'Colossus', 'KEYSTONE: +60 max HP, +20% damage, +10% defense.', { maxHp: 60, damagePct: 20, defense: 10 }, { req: ['w_exec', 'w_last'], key: true, rank: 4, points: 3 }),
  N('m_kindle', 'ash', 50, 138, 'Kindling', 'Hits set foes alight: 3 fire damage per second per rank.', { burnDps: 3 }, { max: 3, req: ['root'] }),
  N('m_ward', 'ash', 42, 124, 'Ash Ward', 'Take 4% less damage per rank.', { defense: 4 }, { max: 2, req: ['m_kindle'] }),
  N('m_ember', 'ash', 58, 124, 'Ember Burst', 'Critical hits explode for 18 fire damage around the target.', { emberBurst: 18 }, { req: ['m_kindle'] }),
  N('m_flask', 'ash', 38, 110, 'Alchemy', 'Flasks heal 30% more per rank.', { flaskPct: 30 }, { max: 2, req: ['m_ward'] }),
  N('m_spark', 'ash', 50, 110, 'Spark', '+2 burn damage and +2% crit.', { burnDps: 2, critChance: 2 }, { req: ['m_ward', 'm_ember'] }),
  N('m_pale', 'ash', 62, 110, 'Pale Flame', 'Burns last longer and deal 50% more.', { burnPct: 50 }, { req: ['m_ember'] }),
  N('m_cinder', 'ash', 42, 96, 'Cinders', 'Burns deal 25% more per rank.', { burnPct: 25 }, { max: 2, req: ['m_flask', 'm_spark'] }),
  N('m_embrace', 'ash', 58, 96, 'Warm Embrace', 'Kills heal 4 HP; +10 max HP.', { killHeal: 4, maxHp: 10 }, { req: ['m_spark', 'm_pale'] }),
  N('m_siphon', 'ash', 38, 82, 'Soul Siphon', 'Each kill restores 8 HP.', { killHeal: 8 }, { req: ['m_cinder'] }),
  N('m_focus', 'ash', 50, 82, 'Focus', 'Attacks cost 15% less stamina; +10% stamina regen.', { attackCostPct: 15, staminaRegenPct: 10 }, { req: ['m_cinder', 'm_embrace'] }),
  N('m_fortune', 'ash', 62, 82, 'Ashen Fortune', '+20% ashes from kills per rank.', { ashPct: 20 }, { max: 2, req: ['m_embrace'] }),
  N('m_glass', 'ash', 42, 68, 'Glass Cannon', '+12% damage, but 5% more damage taken.', { damagePct: 12, defense: -5 }, { req: ['m_siphon', 'm_focus'] }),
  N('m_smoke', 'ash', 58, 68, 'Smoke Veil', 'Rolls grant 0.1s more invulnerability.', { rollIframes: 0.1 }, { req: ['m_focus', 'm_fortune'] }),
  N('m_brand', 'ash', 38, 54, 'Searing Brand', '+30% damage to enemies at full HP.', { firstStrikePct: 30 }, { req: ['m_glass'] }),
  N('m_heat', 'ash', 50, 54, 'White Heat', '+3 burn damage per rank.', { burnDps: 3 }, { max: 2, req: ['m_glass', 'm_smoke'] }),
  N('m_distill', 'ash', 62, 54, 'Distillation', 'Flasks heal 25% more; +10 max stamina.', { flaskPct: 25, maxStamina: 10 }, { req: ['m_smoke'] }),
  N('m_wildfire', 'ash', 44, 40, 'Wildfire', 'Ember bursts deal +12 damage; +3% crit.', { emberBurst: 12, critChance: 3 }, { req: ['m_brand', 'm_heat'] }),
  N('m_ashskin', 'ash', 56, 40, 'Ashen Skin', '5% less damage taken, regenerate 0.5 HP/s.', { defense: 5, regen: 0.5 }, { req: ['m_heat', 'm_distill'] }),
  N('m_pyre', 'ash', 44, 26, 'Pyre', 'KEYSTONE: every 5th hit releases a fire nova (35 dmg, 4m).', { pyre: 35 }, { req: ['m_wildfire'], key: true, rank: 2 }),
  N('m_phoenix', 'ash', 56, 26, 'Phoenix Brand', 'KEYSTONE: burning enemies spread their flames when they die.', { burnSpread: 1 }, { req: ['m_ashskin'], key: true, rank: 3 }),
  N('m_avatar', 'ash', 50, 12, 'Ashen Avatar', 'KEYSTONE: +8 burn damage, +15% damage, novas +20 damage.', { burnDps: 8, damagePct: 15, pyre: 20 }, { req: ['m_pyre', 'm_phoenix'], key: true, rank: 4, points: 3 }),
  N('r_fleet', 'shadow', 82, 138, 'Fleet Foot', '+6% move speed per rank.', { speedPct: 6 }, { max: 3, req: ['root'] }),
  N('r_quick', 'shadow', 74, 124, 'Quick Blade', '+8% attack speed per rank.', { attackSpeedPct: 8 }, { max: 3, req: ['r_fleet'] }),
  N('r_keen', 'shadow', 90, 124, 'Keen Edge', '+5% critical chance per rank.', { critChance: 5 }, { max: 3, req: ['r_fleet'] }),
  N('r_reach', 'shadow', 70, 110, 'Long Reach', '+0.4 m weapon reach.', { reach: 0.4 }, { req: ['r_quick'] }),
  N('r_step', 'shadow', 82, 110, 'Shadowstep', 'Sprinting is 25% faster.', { sprintPct: 25 }, { req: ['r_quick'] }),
  N('r_cruel', 'shadow', 94, 110, 'Cruel Wounds', '+30% critical damage per rank.', { critDmgPct: 30 }, { max: 2, req: ['r_keen'] }),
  N('r_tumble', 'shadow', 74, 96, 'Tumbler', 'Rolls cost 15% less stamina per rank.', { rollCostPct: 15 }, { max: 2, req: ['r_reach', 'r_step'] }),
  N('r_venom', 'shadow', 90, 96, 'Serrated Edge', 'Hits cause bleeding: 3 damage per second per rank.', { bleedDps: 3 }, { max: 2, req: ['r_cruel'] }),
  N('r_lucky', 'shadow', 70, 82, 'Grave Robber', '+25% item drop chance per rank.', { dropPct: 25 }, { max: 2, req: ['r_tumble'] }),
  N('r_evasion', 'shadow', 82, 82, 'Evasion', 'Rolls grant 0.08s more invulnerability per rank.', { rollIframes: 0.08 }, { max: 2, req: ['r_tumble'] }),
  N('r_frost', 'shadow', 94, 82, 'Frostbite', 'Hits chill enemies, slowing them by 30%.', { chillPct: 30 }, { req: ['r_venom'] }),
  N('r_ambush', 'shadow', 74, 68, 'Ambush', '+35% damage on attacks right after a roll.', { rollStrikePct: 35 }, { req: ['r_lucky', 'r_evasion'] }),
  N('r_opport', 'shadow', 90, 68, 'Opportunist', '+25% damage to enemies at full HP, +3% crit.', { firstStrikePct: 25, critChance: 3 }, { req: ['r_evasion', 'r_frost'] }),
  N('r_wind', 'shadow', 70, 54, 'Second Breath', '+15% stamina regen and +4% move speed.', { staminaRegenPct: 15, speedPct: 4 }, { req: ['r_ambush'] }),
  N('r_hamstring', 'shadow', 82, 54, 'Hamstring', 'Hits chill (20%) and bleed (2/s).', { chillPct: 20, bleedDps: 2 }, { req: ['r_ambush', 'r_opport'] }),
  N('r_assassin', 'shadow', 94, 54, 'Assassin', '+30% critical damage.', { critDmgPct: 30 }, { req: ['r_opport'] }),
  N('r_ghost', 'shadow', 76, 40, 'Ghost Step', 'Rolls go 25% further and cost 10% less.', { rollDistPct: 25, rollCostPct: 10 }, { req: ['r_wind', 'r_hamstring'] }),
  N('r_reaper', 'shadow', 88, 40, 'Reaper', 'Kills restore 15 stamina and 3 HP.', { killStamina: 15, killHeal: 3 }, { req: ['r_hamstring', 'r_assassin'] }),
  N('r_dance', 'shadow', 76, 26, 'Death\'s Dance', 'KEYSTONE: after a kill, your next hit is always critical.', { deathDance: 1 }, { req: ['r_ghost'], key: true, rank: 2 }),
  N('r_phantom', 'shadow', 88, 26, 'Phantom Blade', 'KEYSTONE: rolling through enemies cuts them for 30 damage.', { rollDamage: 30 }, { req: ['r_reaper'], key: true, rank: 3 }),
  N('r_sovereign', 'shadow', 82, 12, 'Night Sovereign', 'KEYSTONE: +10% crit, +15% attack speed, +10% move speed.', { critChance: 10, attackSpeedPct: 15, speedPct: 10 }, { req: ['r_dance', 'r_phantom'], key: true, rank: 4, points: 3 }),
];

// keystones get real trade-offs now
const TRADEOFF = {
  w_exec: [{ damagePct: -8 }, ' But -8% damage otherwise.'], w_last: [{ maxHpPct: -10 }, ' But -10% max HP.'],
  m_pyre: [{ attackSpeedPct: -8 }, ' But -8% attack speed.'], m_phoenix: [{ resFire: -20 }, ' But -20% fire resist.'],
  r_dance: [{ critDmgPct: -20 }, ' But -20% crit damage.'], r_phantom: [{ maxHp: -25 }, ' But -25 max HP.'],
};

// Ten paths: minor stats [stat, perRank, label], notables, actives, keystones.
const P = (minors, notables, actives, keys) => ({ minors, notables, actives, keys });
const PATHS = {
  iron: P(null, null, [['war_stomp', 'War Stomp'], ['iron_wall', 'Iron Wall']], null),
  ash: P(null, null, [['fireball', 'Fireball'], ['flame_nova', 'Flame Nova']], null),
  shadow: P(null, null, [['shadow_step', 'Shadow Step'], ['fan_of_knives', 'Fan of Knives']], null),
  blood: P([['lifesteal', 1, 'lifesteal %'], ['maxHp', 12, 'max HP'], ['damagePct', 4, '% damage']],
    [['Sanguine Edge', 'Hits bleed (3/s).', { bleedDps: 3 }], ['Hemophage', 'Kills heal 6 HP.', { killHeal: 6 }], ['Red Tithe', '+10% damage, -5% max HP.', { damagePct: 10, maxHpPct: -5 }],
      ['Clotting', 'Regenerate 1 HP/s.', { regen: 1 }], ['Frenzy', '+25% damage below 40% HP.', { berserkPct: 25 }], ['Vein Tap', '+3% lifesteal.', { lifesteal: 3 }],
      ['Bloodwake', 'Kills restore 12 stamina.', { killStamina: 12 }], ['Iron Blood', '+40 max HP.', { maxHp: 40 }], ['Haemorrhage', 'Bleeds +4/s, +10% crit damage.', { bleedDps: 4, critDmgPct: 10 }]],
    [['blood_rite', 'Blood Rite'], ['crimson_leech', 'Crimson Leech']],
    [['Sanguine Pact', 'KEYSTONE: +12% lifesteal and +20% damage, but no natural regeneration and potions heal half.', { lifesteal: 12, damagePct: 20, healPct: -50, regen: -3 }],
      ['Martyr', 'KEYSTONE: +60% damage below half HP, but max HP -20%.', { berserkPct: 60, maxHpPct: -20 }]]),
  death: P([['skillDmgPct', 5, '% skill damage'], ['maxMana', 10, 'mana'], ['executePct', 6, '% execute']],
    [['Grave Chill', 'Hits chill 15%.', { chillPct: 15 }], ['Ossuary', '+15% pet & summon damage.', { petDmgPct: 15 }], ['Deathless', 'Kills restore 6 mana.', { killMana: 6 }],
      ['Bone Armour', '+5% defence.', { defense: 5 }], ['Wither', 'Hits poison (3/s).', { poisonDps: 3 }], ['Choir of Bones', '+25% summon damage.', { petDmgPct: 25 }],
      ['Soul Harvest', 'Kills heal 4 HP and 4 mana.', { killHeal: 4, killMana: 4 }], ['Grim Focus', '-10% cooldowns.', { cdrPct: 10 }], ['Rot', 'Poison +4/s.', { poisonDps: 4 }]],
    [['raise_dead', 'Raise the Dead'], ['curse', 'Curse of Frailty']],
    [['Lichdom', 'KEYSTONE: slain foes rise as skeletons, but you take 15% more damage.', { raiseDead: 1, dmgTakenPct: 15 }],
      ['Necrotic Hunger', 'KEYSTONE: +40% skill damage, but your weapon hits deal 15% less.', { skillDmgPct: 40, damagePct: -15 }]]),
  hunter: P([['critChance', 1.5, '% crit'], ['reach', 0.1, 'm reach'], ['firstStrikePct', 8, '% first strike']],
    [['Steady Aim', '+20% damage to unwounded foes.', { firstStrikePct: 20 }], ['Snare Lore', 'Hits slow 15%.', { chillPct: 15 }], ['Fletcher', '+10% attack speed.', { attackSpeedPct: 10 }],
      ['Tracker', '+15% item find.', { dropPct: 15 }], ['Deadeye', '+25% crit damage.', { critDmgPct: 25 }], ['Trapper', '-10% cooldowns.', { cdrPct: 10 }],
      ['Quiver', '+20% elemental damage.', { elemDmgPct: 20 }], ['Woodsman', '+8% move speed.', { speedPct: 8 }], ['Big Game', '+30% damage to elites.', { eliteDmgPct: 30 }]],
    [['volley', 'Volley'], ['bear_trap', 'Bear Trap']],
    [['Sniper', 'KEYSTONE: +50% first-strike and +20% crit, but -15% attack speed.', { firstStrikePct: 50, critChance: 20, attackSpeedPct: -15 }],
      ['Pack Hunter', 'KEYSTONE: pets and companions +50% damage, but you deal 10% less.', { petDmgPct: 50, damagePct: -10 }]]),
  storm: P([['attackSpeedPct', 3, '% attack speed'], ['speedPct', 2, '% move speed'], ['shockChance', 3, '% shock']],
    [['Static', '5% chance to chain lightning.', { shockChance: 5 }], ['Tailwind', 'Dashes recharge 20% faster.', { dashRechargePct: 20 }], ['SKYWARD (double jump)', 'Unlocks the DOUBLE JUMP.', { doubleJump: 1 }],
      ['Conductor', '+15% elemental damage.', { elemDmgPct: 15 }], ['THIRD WIND (3rd dash)', 'Unlocks a THIRD DASH charge.', { dashCharges: 1 }], ['Galvanic', '+10% attack speed.', { attackSpeedPct: 10 }],
      ['THUNDERFALL (ground slam)', 'Unlocks the GROUND SLAM (in the air: look down + attack / dash, or C).', { groundSlam: 1 }], ['Overcharge', 'Shock chance +8%.', { shockChance: 8 }], ['Leaper', 'Jump 15% higher.', { jumpPct: 15 }]],
    [['chain_lightning', 'Chain Lightning'], ['thunder_dash', 'Thunder Dash']],
    [['Living Storm', 'KEYSTONE: every 4th hit calls lightning, but -10% max HP.', { stormCall: 1, maxHpPct: -10 }],
      ['Quicksilver Soul', 'KEYSTONE: +25% move and attack speed, but -8% defence.', { speedPct: 25, attackSpeedPct: 25, defense: -8 }]]),
  frost: P([['chillPct', 5, '% chill'], ['defense', 1.5, '% defence'], ['resFrost', 6, '% frost resist']],
    [['Rime Edge', 'Hits chill 20%.', { chillPct: 20 }], ['Cold Blood', '+20 max HP.', { maxHp: 20 }], ['Shatter', '+25% damage to unwounded foes.', { firstStrikePct: 25 }],
      ['Permafrost', '+6% defence.', { defense: 6 }], ['Glacial', '+15% elemental damage.', { elemDmgPct: 15 }], ['Frostbite', 'Hits chill 20% more.', { chillPct: 20 }],
      ['Winter Coat', '+30% frost resist.', { resFrost: 30 }], ['Icebound', '+40 max HP.', { maxHp: 40 }], ['Brittle', '+25% crit damage.', { critDmgPct: 25 }]],
    [['frost_nova', 'Frost Nova'], ['ice_lance', 'Ice Lance']],
    [['Absolute Zero', 'KEYSTONE: dashing releases a frost nova, but -10% attack speed.', { rollNova: 40, attackSpeedPct: -10 }],
      ['Glacier', 'KEYSTONE: +15% defence, but -15% move speed.', { defense: 15, speedPct: -15 }]]),
  faith: P([['regen', 0.4, 'HP/s'], ['flaskPct', 8, '% potion healing'], ['resAll', 2, '% all resist']],
    [['Warm Hands', 'Potions heal 20% more.', { flaskPct: 20 }], ['Vigil', '+25 max HP.', { maxHp: 25 }], ['Hearthlight', 'Regenerate 1 HP/s.', { regen: 1 }],
      ['Sanctuary', '+5% all resist.', { resAll: 5 }], ['Benediction', '+20% companion HP.', { allyHpPct: 20 }], ['Consecrate', 'Hits burn (2/s).', { burnDps: 2 }],
      ['Grace', '-10% cooldowns.', { cdrPct: 10 }], ['Devotion', '+15 mana regen per 10 s.', { manaRegen: 1.5 }], ['Martyr’s Light', 'Kills heal 5 HP.', { killHeal: 5 }]],
    [['holy_light', 'Holy Light'], ['aegis', 'Aegis']],
    [['Saint', 'KEYSTONE: regenerate 4 HP/s and +20% healing, but -15% damage.', { regen: 4, healPct: 20, damagePct: -15 }],
      ['Unbroken Vow', 'KEYSTONE: once per run, death leaves you standing; but -10% max HP.', { cheatDeath: 1, maxHpPct: -10 }]]),
  beast: P([['petDmgPct', 6, '% pet damage'], ['allyHpPct', 6, '% companion HP'], ['speedPct', 1.5, '% move speed']],
    [['Pack Bond', '+20% pet damage.', { petDmgPct: 20 }], ['Thick Hide', '+20 max HP.', { maxHp: 20 }], ['Feral', '+8% attack speed.', { attackSpeedPct: 8 }],
      ['Alpha', '+30% companion HP.', { allyHpPct: 30 }], ['Mauler', 'Hits bleed (3/s).', { bleedDps: 3 }], ['Wild Heart', 'Regenerate 1 HP/s.', { regen: 1 }],
      ['Hunting Call', '+25% pet damage.', { petDmgPct: 25 }], ['Predator', '+10% crit chance.', { critChance: 10 }], ['Spirit Hound', 'A spectral hound fights for you.', { packCall: 1 }]],
    [['call_wolf', 'Call of the Wolf'], ['roar', 'Primal Roar']],
    [['Beastmaster', 'KEYSTONE: pets and companions +80% damage, but -10% your damage.', { petDmgPct: 80, allyHpPct: 40, damagePct: -10 }],
      ['Shapeless', 'KEYSTONE: +15% damage and move speed, but -10% defence.', { damagePct: 15, speedPct: 15, defense: -10 }]]),
};

// slot layout per path: [ring, lane]; rings 1..8, lanes -1/0/1
const SLOTS = [[1, 0], [1, -1], [1, 1], [2, -1], [2, 0], [2, 1], [3, -1], [3, 0], [3, 1], [4, -1], [4, 0], [4, 1], [5, -1], [5, 0], [5, 1], [6, -1], [6, 0], [6, 1], [7, -1], [7, 0], [7, 1], [8, -0.6], [8, 0.6]];
const ACTIVE_SLOTS = [6, 13], KEY_SLOTS = [21, 22];

function place(pi, ring, lane) {
  const a = (pi / ORDER.length) * Math.PI * 2 - Math.PI / 2;
  const r = 260 + ring * 118;
  const px = -Math.sin(a), pz = Math.cos(a);
  const spread = 76 + ring * 8;
  return [Math.round(CX + Math.cos(a) * r + px * lane * spread), Math.round(CY + Math.sin(a) * r + pz * lane * spread)];
}

function buildWeb() {
  const out = [N('root', 'root', CX, CY, 'Awakened', 'You rose from the ash. Every path begins here.', {}, { fee: 0 })];
  out[0].x = CX; out[0].y = CY;
  const lanes = {};      // path -> 'ring:lane' -> id
  ORDER.forEach((b, pi) => {
    const spec = PATHS[b];
    let ids;
    if (!spec.minors) {
      // old path: its 21 nodes, actives inserted, two keystones last
      const old = OLD.filter((n) => n.branch === b);
      const keys = old.filter((n) => n.keystone).slice(0, 2);
      const rest = old.filter((n) => !keys.includes(n));
      ids = [];
      let k = 0;
      for (let i = 0; i < SLOTS.length; i++) {
        if (ACTIVE_SLOTS.includes(i)) { const [aid, an] = spec.actives[ACTIVE_SLOTS.indexOf(i)]; ids.push(N('a_' + aid, b, 0, 0, an, 'ACTIVE SKILL: assign it to your skill bar.', {}, { active: aid })); }
        else if (KEY_SLOTS.includes(i)) { const n = { ...keys[KEY_SLOTS.indexOf(i)] }; const t = TRADEOFF[n.id]; if (t) { n.effects = { ...n.effects, ...t[0] }; n.desc += t[1]; } ids.push(n); }
        else ids.push({ ...rest[k++] });
      }
    } else {
      ids = [];
      let mi = 0, ni = 0;
      for (let i = 0; i < SLOTS.length; i++) {
        const [ring, lane] = SLOTS[i];
        if (ACTIVE_SLOTS.includes(i)) { const [aid, an] = spec.actives[ACTIVE_SLOTS.indexOf(i)]; ids.push(N('a_' + aid, b, 0, 0, an, 'ACTIVE SKILL: assign it to your skill bar.', {}, { active: aid })); continue; }
        if (KEY_SLOTS.includes(i)) { const [nm, d, e] = spec.keys[KEY_SLOTS.indexOf(i)]; ids.push(N(`${b}_k${KEY_SLOTS.indexOf(i)}`, b, 0, 0, nm, d, e, { key: true, rank: KEY_SLOTS.indexOf(i) ? 3 : 2 })); continue; }
        if (lane === 0 && ring > 1 && ni < spec.notables.length || ring === 7) {
          const [nm, d, e] = spec.notables[ni++ % spec.notables.length];
          ids.push(N(`${b}_n${ni}`, b, 0, 0, nm, d, e)); continue;
        }
        const [stat, per, lab] = spec.minors[mi++ % 3];
        const ranks = 3;
        ids.push(N(`${b}_m${mi}`, b, 0, 0, `${BRANCHES[b].name.replace('The ', '')} ${['Rite', 'Lore', 'Vow', 'Mark', 'Gift', 'Way'][mi % 6]} ${['I', 'II', 'III', 'IV'][Math.floor((mi - 1) / 3)]}`,
          `+${per} ${lab} per rank.`, { [stat]: per }, { max: ranks }));
      }
    }
    // positions + requires by lane
    lanes[b] = {};
    ids.forEach((n, i) => {
      const [ring, lane] = SLOTS[i];
      [n.x, n.y] = place(pi, ring, lane);
      lanes[b][`${ring}:${lane}`] = n.id;
      let req;
      if (ring === 1 && lane === 0) req = ['root'];
      else if (ring === 1) req = [lanes[b]['1:0']];
      else if (ring === 8) req = [lanes[b][`7:${lane < 0 ? -1 : 1}`]];
      else req = [lanes[b][`${ring - 1}:${lane}`] || lanes[b][`${ring - 1}:0`]];
      n.requires = req;
      n.fee = n.fee ?? Math.round(ring * ring * 22 + (n.keystone ? 300 : 0));
      if (n.keystone && !n.rank) n.rank = 2;
      if (n.keystone) n.points = 2;
      n.max = n.max || 1;
      out.push(n);
    });
  });
  // crossroads: between neighbouring paths at rings 3 and 6, open from either side
  const HY = { 'iron|blood': ['Bloodied Steel', { lifesteal: 2, defense: 3 }], 'blood|death': ['Grave Blood', { killHeal: 4, poisonDps: 2 }], 'death|shadow': ['Silent Grave', { critChance: 3, executePct: 15 }],
    'shadow|hunter': ['Stalker', { firstStrikePct: 20, speedPct: 3 }], 'hunter|storm': ['Thunderstruck Arrows', { shockChance: 5, attackSpeedPct: 5 }], 'storm|frost': ['Hailstorm', { chillPct: 15, shockChance: 4 }],
    'frost|ash': ['Steam', { burnDps: 2, chillPct: 10 }], 'ash|faith': ['Sacred Fire', { burnDps: 3, regen: 0.5 }], 'faith|beast': ['Shepherd', { allyHpPct: 20, regen: 0.5 }], 'beast|iron': ['Warhound', { petDmgPct: 15, maxHp: 20 }] };
  ORDER.forEach((b, pi) => {
    const nb = ORDER[(pi + 1) % ORDER.length];
    const [nm, eff] = HY[`${b}|${nb}`];
    for (const ring of [3, 6]) {
      const a = ((pi + 0.5) / ORDER.length) * Math.PI * 2 - Math.PI / 2, r = 260 + ring * 118;
      const n = N(`hx_${b}_${ring}`, 'hybrid', 0, 0, ring === 3 ? nm : nm + ' II', `${BRANCHES[b].name} + ${BRANCHES[nb].name}: opens from either path.`, ring === 3 ? eff : Object.fromEntries(Object.entries(eff).map(([k, v]) => [k, v * 1.5])));
      n.x = Math.round(CX + Math.cos(a) * r); n.y = Math.round(CY + Math.sin(a) * r);
      n.requires = [lanes[b][`${ring}:1`], lanes[nb][`${ring}:-1`]]; n.anyOf = true; n.fee = ring * ring * 25;
      out.push(n);
    }
  });
  // old crossroads ids keep existing for old saves (refund otherwise): map them onto new hybrids
  return out;
}

export const SKILLS = buildWeb();
export const SKILL_MAP = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export const PATH_ORDER = ORDER;

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

function reqMet(prog, node) {
  if (!node.requires.length) return true;
  return node.anyOf ? node.requires.some((r) => rankOf(prog, r) > 0) : node.requires.every((r) => rankOf(prog, r) > 0);
}

/** Why a node can't be learned right now, or null if it can. renownRank: index. */
export function learnBlocker(prog, node, ashes, renownRank = 0, rankTitle = (i) => `rank ${i}`) {
  const r = rankOf(prog, node.id);
  if (r >= node.max) return 'Mastered';
  if (!reqMet(prog, node)) return `Requires ${node.requires.map((q) => SKILL_MAP[q].name).join(node.anyOf ? ' or ' : ' and ')}`;
  if (node.rank && renownRank < node.rank) return `Keystone: requires renown rank "${rankTitle(node.rank)}"`;
  if (prog.skillPoints < node.points) return `Needs ${node.points} skill point${node.points > 1 ? 's' : ''}`;
  if (ashes < node.fee) return `Needs ${node.fee} ashes`;
  return null;
}

/** Node is reachable (prerequisites met) - for drawing. */
export function isOpen(prog, node) { return reqMet(prog, node); }

/** Respec: refund every point; ash cost grows with each respec. */
export function respecCost(prog) { return Math.round(100 * Math.pow(1.6, prog.respecs || 0) + (prog.level || 1) * 15); }
export function respec(prog) {
  let pts = 0;
  for (const [id, n] of Object.entries(prog.skills)) if (id !== 'root' && SKILL_MAP[id]) pts += n * SKILL_MAP[id].points;
  prog.skills = { root: 1 };
  prog.skillPoints += pts;
  prog.respecs = (prog.respecs || 0) + 1;
  return pts;
}
