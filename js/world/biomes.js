// Dungeon biomes: textures, fog, lighting, decoration and enemy mix.
// Random dungeons pick one per visit; the main dungeon is always a crypt
// whose enemy mix deepens with each level.
export const BIOMES = {
  crypt: {
    name: 'Crypt', title: 'The Shifting Crypt',
    wall: 'stoneDark', hallWall: 'stoneWall', floor: 'flagstone', hallFloor: 'cobbleDark', stair: 'stone', ceiling: 'ceiling', pillar: 'stoneWall',
    fog: 0x040403, fogFar: 24, hemi: [0x4a4640, 0x0a0806, 1.3], lantern: 5.6, torch: 0xff8a3a, torchRate: 4, dust: [0.32, 0.3, 0.27],
    decor: ['bones', 'bones', 'rubble', 'sarcophagus'],
    enemies: [['hollow', 5], ['ghoul', 3], ['archer', 2], ['knight', 1]],
    mini: ['knight', 'hollow'],
  },
  forest: {
    name: 'Dark Forest', title: 'The Hollow Wood',
    wall: 'hedge', hallWall: 'hedge', floor: 'forestFloor', hallFloor: 'forestFloor', stair: 'rock', ceiling: null, pillar: 'bark', open: true,
    fog: 0x0a120a, fogFar: 24, hemi: [0x5a7050, 0x10140a, 1.9], lantern: 5.6, torch: 0xffa040, torchRate: 7, dust: [0.35, 0.42, 0.25],
    decor: ['tree', 'tree', 'stump', 'mushroom', 'bones'],
    enemies: [['wolf', 5], ['spider', 3], ['ghoul', 2], ['hag', 1]],
    mini: ['wolf', 'spider'],
  },
  swamp: {
    name: 'Flooded Swamp', title: 'The Drowned Fen',
    wall: 'swampRock', hallWall: 'swampRock', floor: 'mud', hallFloor: 'mud', stair: 'swampRock', ceiling: 'swampRock', pillar: 'bark', water: true,
    fog: 0x0a120a, fogFar: 20, hemi: [0x3a4a36, 0x0a0c08, 1.25], lantern: 5.4, torch: 0xffa850, torchRate: 5, dust: [0.3, 0.4, 0.25],
    decor: ['reeds', 'reeds', 'deadtree', 'bones'],
    enemies: [['hag', 3], ['ghoul', 4], ['spider', 2], ['hollow', 2]],
    mini: ['hag', 'ghoul'],
  },
  frozen: {
    name: 'Frozen Ruins', title: 'The Frostbound Ruin',
    wall: 'iceWall', hallWall: 'iceWall', floor: 'snow', hallFloor: 'snow', stair: 'iceWall', ceiling: 'iceWall', pillar: 'ice',
    fog: 0x141a22, fogFar: 26, hemi: [0x8090a8, 0x182028, 1.5], lantern: 5.0, torch: 0xffa060, torchRate: 4, dust: [0.75, 0.8, 0.88],
    decor: ['icicle', 'rubble', 'crystal', 'bones'],
    enemies: [['wraith', 4], ['wolf', 3], ['archer', 2], ['hollow', 2]],
    mini: ['wraith', 'wolf'],
  },
  mine: {
    name: 'Burning Mine', title: 'The Cinder Deep',
    wall: 'rock', hallWall: 'rock', floor: 'mineFloor', hallFloor: 'mineFloor', stair: 'rock', ceiling: 'rock', pillar: 'beam',
    fog: 0x120602, fogFar: 22, hemi: [0x6a4030, 0x140804, 1.3], lantern: 5.2, torch: 0xff6a20, torchRate: 4, dust: [0.45, 0.3, 0.2],
    decor: ['beam', 'lavapool', 'rubble', 'cart'],
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
