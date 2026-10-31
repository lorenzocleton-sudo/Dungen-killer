// Dungeon biomes: textures, fog, lighting, decoration and enemy mix.
// Random dungeons pick one per visit; the main dungeon is always a crypt
// whose enemy mix deepens with each level.
export const BIOMES = {
  crypt: {
    name: 'Crypt', title: 'The Shifting Depths',
    wall: 'stoneDark', hallWall: 'stoneWall', floor: 'flagstone', hallFloor: 'cobbleDark', stair: 'stone', ceiling: 'ceiling', pillar: 'stoneWall',
    fog: 0x040403, fogFar: 24, hemi: [0x4a4640, 0x0a0806, 1.3], lantern: 5.6, torch: 0xff8a3a, torchRate: 4, dust: [0.32, 0.3, 0.27],
    decor: ['bones', 'bones', 'rubble', 'sarcophagus'],
    enemies: [['hollow', 5], ['ghoul', 3], ['archer', 2], ['knight', 1]],
    mini: ['knight', 'hollow'],
    guardians: ['knight', 'brute', 'spider', 'knight', 'wolf'],
  },
  // ---- open / cave biomes (built by outdoor.js, not the crypt cell builder)
  forest: {
    name: 'Weeping Wood', title: 'The Weeping Wood', outdoor: true,
    floor: 'forestFloor', groundTint: [0.9, 0.95, 0.85],
    fog: 0x0c120c, fogFar: 30, hemi: [0x5a6a50, 0x10140a, 1.7], lantern: 5.6, dust: [0.35, 0.42, 0.25],
    enemies: [['wolf', 5], ['spider', 3], ['ghoul', 2], ['hag', 1]],
    mini: ['wolf', 'spider'],
  },
  jungle: {
    name: 'Verdant Maw', title: 'The Verdant Maw', outdoor: true,
    floor: 'dirtMoss', groundTint: [0.85, 1.05, 0.8], waterColor: 0x6a9a70,
    fog: 0x182a16, fogFar: 28, hemi: [0x8aa878, 0x1c2a16, 2.5], lantern: 5.4, dust: [0.45, 0.6, 0.35],
    enemies: [['vine_creeper', 3], ['panther', 3], ['poison_frog', 2], ['spider', 1]],
    mini: ['panther', 'vine_creeper'],
  },
  swamp: {
    name: 'Drowned Quarter', title: 'The Drowned Quarter', outdoor: true,
    floor: 'mud', groundTint: [0.9, 0.95, 0.85], waterColor: 0x7a9070,
    fog: 0x0c140e, fogFar: 24, hemi: [0x4a5a48, 0x0c100a, 1.6], lantern: 5.4, dust: [0.3, 0.4, 0.25],
    enemies: [['hag', 3], ['ghoul', 4], ['wraith', 2], ['hollow', 2]],
    mini: ['hag', 'ghoul'],
  },
  frozen: {
    name: 'Rimewastes', title: 'The Rimewastes', outdoor: true,
    floor: 'snow', groundTint: [0.95, 0.97, 1],
    fog: 0x2a3038, fogFar: 34, hemi: [0x9aa8c0, 0x283038, 1.8], lantern: 4.6, dust: [0.85, 0.9, 0.95],
    enemies: [['wraith', 4], ['wolf', 3], ['archer', 2], ['hollow', 2]],
    mini: ['wraith', 'wolf'],
  },
  mine: {
    name: 'Kilnworks', title: 'The Kilnworks', outdoor: true, lava: true,
    floor: 'mineFloor', groundTint: [1, 0.9, 0.85],
    fog: 0x1e0c06, fogFar: 26, hemi: [0x9a6048, 0x241008, 2.2], lantern: 6.0, dust: [0.45, 0.3, 0.2],
    enemies: [['imp', 4], ['brute', 1.5], ['archer', 2], ['hollow', 2]],
    mini: ['brute', 'imp'],
  },
};

// ---- main-dungeon depth bands: a new look every 5 levels (crypt cell builder)
const band = (o) => ({ band: true, stair: 'stone', ceiling: 'ceiling', torch: 0xff8a3a, torchRate: 4, decor: ['bones', 'rubble'], ...o });
Object.assign(BIOMES, {
  rootbound: band({ name: 'Rootbound Ossuary', title: 'The Rootbound Ossuary', wall: 'stoneMoss', hallWall: 'stoneMoss', floor: 'dirtMoss', hallFloor: 'forestFloor', pillar: 'bark',
    fog: 0x070b06, fogFar: 24, hemi: [0x4a5a40, 0x0a0c06, 1.4], lantern: 5.6, dust: [0.3, 0.4, 0.22], decor: ['bones', 'stump', 'mushroom', 'rubble'],
    mini: ['spider', 'wolf', 'knight', 'plague_bearer'] }),
  cathedral: band({ name: 'Cinder Cathedral', title: 'The Cinder Cathedral', wall: 'stoneWall', hallWall: 'stoneWall', floor: 'flagstone', hallFloor: 'cobble', pillar: 'stoneWall',
    fog: 0x120604, fogFar: 26, hemi: [0x7a4a38, 0x140806, 1.6], lantern: 5.2, torch: 0xff6a20, torchRate: 3, dust: [0.5, 0.3, 0.2], decor: ['bones', 'lavapool', 'rubble', 'sarcophagus'],
    mini: ['ember_golem', 'knight', 'imp', 'shade_assassin'] }),
  kennels: band({ name: 'The Hound Pits', title: 'The Hound Pits', wall: 'rock', hallWall: 'stoneDark', floor: 'mineFloor', hallFloor: 'mineFloor', pillar: 'ironDark',
    fog: 0x0a0806, fogFar: 22, hemi: [0x5a4a40, 0x0c0806, 1.4], lantern: 5.8, dust: [0.35, 0.3, 0.25], decor: ['bones', 'bones', 'cart', 'beam'],
    mini: ['wolf', 'panther', 'brute', 'gargoyle'] }),
  sunken: band({ name: 'The Sunken Palace', title: 'The Sunken Palace', wall: 'swampRock', hallWall: 'swampRock', floor: 'mud', hallFloor: 'flagstone', pillar: 'swampRock', water: true,
    fog: 0x0a1612, fogFar: 22, hemi: [0x48605a, 0x081010, 1.5], lantern: 5.6, torch: 0x80d0c0, dust: [0.3, 0.45, 0.4], decor: ['reeds', 'bones', 'rubble'],
    mini: ['drowned_knight', 'hag', 'wraith', 'plague_bearer'] }),
  court: band({ name: 'The Hollow Court', title: 'The Hollow Court', wall: 'stoneDark', hallWall: 'plaster', floor: 'cobbleDark', hallFloor: 'flagstone', pillar: 'stoneWall',
    fog: 0x0a0610, fogFar: 26, hemi: [0x5a4a70, 0x0a0610, 1.5], lantern: 5.4, torch: 0xc080ff, dust: [0.45, 0.4, 0.55], decor: ['sarcophagus', 'bones', 'crystal'],
    mini: ['rime_giant', 'bone_colossus', 'drowned_knight', 'shade_assassin', 'gargoyle'] }),
  abyss: band({ name: 'The Abyss', title: 'The Abyss', wall: 'rock', hallWall: 'rock', floor: 'rock', hallFloor: 'rock', pillar: 'rock', torchRate: 6,
    fog: 0x040208, fogFar: 20, hemi: [0x40305a, 0x040208, 1.3], lantern: 6.2, torch: 0x9060ff, dust: [0.4, 0.3, 0.6], decor: ['crystal', 'bones', 'rubble'],
    mini: ['bone_colossus', 'rime_giant', 'ember_golem', 'shade_assassin', 'drowned_knight', 'gargoyle'] }),
});

/** Random dungeons pick from these (the depth bands belong to the main dungeon). */
export const BIOME_IDS = Object.keys(BIOMES).filter((k) => !BIOMES[k].band);

/** Depth band biome for a main-dungeon level. */
export function bandFor(level) {
  if (level > 30) return 'abyss';
  return ['crypt', 'rootbound', 'cathedral', 'kennels', 'sunken', 'court'][Math.min(5, Math.floor((level - 1) / 5))];
}

/** Main dungeon enemy mix by level: new monsters join as you descend. */
export function mainLevelEnemies(level) {
  if (level <= 5) {
    const mix = [['hollow', 5], ['ghoul', 3], ['archer', 1.5]];
    if (level >= 2) mix.push(['spider', 2], ['wolf', 2]);
    if (level >= 3) mix.push(['brute', 1], ['wraith', 2], ['knight', 1]);
    if (level >= 4) mix.push(['imp', 2], ['hag', 2]);
    if (level >= 5) mix.push(['knight', 1.5], ['brute', 1]);
    return mix;
  }
  if (level <= 10) return [['hollow', 3], ['ghoul', 2], ['spider', 3], ['wolf', 3], ['archer', 2], ['knight', 1], ...(level >= 8 ? [['plague_bearer', 1.5]] : [])];
  if (level <= 15) return [['hollow', 2], ['imp', 3], ['archer', 2], ['knight', 1.5], ['hag', 1.5], ['ember_golem', 1], ...(level >= 13 ? [['shade_assassin', 1.5]] : [])];
  if (level <= 20) return [['wolf', 3], ['panther', 2], ['knight', 1.5], ['brute', 1], ['gargoyle', 2], ['shade_assassin', 1.5], ...(level >= 18 ? [['bone_colossus', 0.6]] : [])];
  if (level <= 25) return [['drowned_knight', 3], ['hag', 2], ['ghoul', 2], ['wraith', 2], ['plague_bearer', 1.5], ['gargoyle', 1.5]];
  if (level <= 30) return [['knight', 2], ['drowned_knight', 2], ['shade_assassin', 2], ['gargoyle', 2], ['rime_giant', 0.7], ['bone_colossus', 0.7], ['ember_golem', 1], ['archer', 1.5]];
  return [['drowned_knight', 2], ['shade_assassin', 2], ['gargoyle', 2], ['rime_giant', 1], ['bone_colossus', 1], ['ember_golem', 1.5], ['plague_bearer', 1.5], ['panther', 2], ['wraith', 1.5]];
}
