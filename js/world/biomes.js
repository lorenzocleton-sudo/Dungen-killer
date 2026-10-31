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

export const BIOME_IDS = Object.keys(BIOMES);

/** Main dungeon enemy mix by level: new monsters join as you descend. */
export function mainLevelEnemies(level) {
  const mix = [['hollow', 5], ['ghoul', 3], ['archer', 1.5]];
  if (level >= 2) mix.push(['spider', 2], ['wolf', 2]);
  if (level >= 3) mix.push(['brute', 1], ['wraith', 2], ['knight', 1]);
  if (level >= 4) mix.push(['imp', 2], ['hag', 2]);
  if (level >= 5) mix.push(['knight', 1.5], ['brute', 1]);
  return mix;
}
