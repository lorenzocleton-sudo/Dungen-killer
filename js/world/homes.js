// Furnished interiors for the town's houses: beds (rest), a small chest that
// refills once per day, bookshelves with lore, fireplaces, cooking pots,
// wardrobes, and sometimes a townsperson at home.
import * as THREE from '../../lib/three.module.min.js';
import { box, mesh, fire, interactable, npc, chest } from './props.js';
import { trs } from '../engine/geometry.js';

export const TOWN_LORE = [
  'A child\'s primer: "A is for Ash. B is for Bones. C is for the Catacombs, where Father went."',
  'A ledger of debts. The last page reads only: "Paid in full. He went down."',
  'A hymn to the Pale Flame, half the verses scratched out by a nervous hand.',
  'A map of the old town, before the wall. The catacombs were a quarry then.',
  'A letter never sent: "If the portal glows green, do not follow me."',
  'Notes on hollowing: "It is not death. It is forgetting what you were afraid of."',
  'A recipe for grave-wax candles. It calls for things you would rather not name.',
  'A soldier\'s diary: "The King\'s Hound went into the dark with us. Only it came back."',
];

const HOME_FOLK = [
  { name: 'Old Wenna', cloth: 'clothBrown', line: 'Close the door, the ash gets in everything.' },
  { name: 'Tomas the Cooper', cloth: 'cloth', line: 'Barrels, barrels. The dead don\'t need barrels. Thank the gods for the living.' },
  { name: 'Sister Hild', cloth: 'cloth', variant: 'staff', line: 'Sit by the fire a while. You look half hollowed already.' },
  { name: 'Young Pell', cloth: 'clothRed', scale: 0.8, line: 'Are you going down there again? Can I see your sword?' },
];

/** inner: hollowHouse interior record. idx: house number (stable ids for saves). */
export function furnishHome(area, inner, idx) {
  const game = area.game;
  const fx = -inner.nx, fz = -inner.nz;          // from the door into the room
  const rx = -fz, rz = fx;                        // to the right when walking in
  const across = (inner.nz !== 0 ? inner.x1 - inner.x0 : inner.z1 - inner.z0) / 2 - 0.5;
  const depth = (inner.nz !== 0 ? inner.z1 - inner.z0 : inner.x1 - inner.x0) / 2 - 0.5;
  const yaw = Math.atan2(fx, fz);
  const L = (u, v) => new THREE.Vector3(inner.x + rx * u + fx * v, 0, inner.z + rz * u + fz * v);
  const B = (tex, u, v, w, h, d, o = {}) => { const p = L(u, v); box(area, tex, p.x, (o.y || 0) + h / 2, p.z, w, h, d, { rot: yaw, tex: 1, ...o }); return p; };
  const day = () => Math.floor(game.clock.time / 600);

  // bed in the back-right corner
  const bed = B('woodDark', across - 0.6, depth - 1.1, 1.1, 0.45, 2.0);
  B('cloth', across - 0.6, depth - 1.0, 1.0, 0.12, 1.6, { y: 0.45, collide: false, shade: null });
  B('clothBrown', across - 0.6, depth - 0.15, 1.0, 0.18, 0.4, { y: 0.45, collide: false, shade: null });
  interactable(area, bed, 1.8, 'Rest in the bed', () => {
    const p = game.player;
    p.hp = p.maxHp; p.stamina = p.maxStamina;
    game.state.save();
    game.hud.speak('You sleep a dreamless hour. Wounds closed, breath steady. (Game saved)');
  });
  // small chest at the foot of the bed - refills once per day
  const cp = L(across - 0.6, depth - 2.6);
  const key = 'home' + idx;
  const ch = chest(area, cp.x, 0, cp.z, yaw + Math.PI, () => {
    const g = game, wd = g.state.world;
    if (wd.homeChests[key] === day()) { g.hud.speak('Empty. Whoever lives here will refill it tomorrow.'); return; }
    wd.homeChests[key] = day();
    g.loot.roll('home', cp, 1);
    g.state.addCurrency(5 + Math.floor(Math.random() * 20));
    g.hud.feed('You find a few ashes tucked away.', '#d8c080');
    if (Math.random() < 0.2) g.journal.readFor('town');
    g.state.save();
  });
  // home chests can be searched again each day: keep the prompt alive
  ch.label = 'Search the chest';
  const reopen = ch.onUse;
  ch.onUse = () => { reopen(); ch.enabled = true; };
  // fireplace in the back-left corner, a cooking pot beside it
  const fp = B('stoneDark', -across + 0.4, depth - 0.2, 1.4, 1.6, 0.8, { worldUV: 1 });
  B('stoneDark', -across + 0.4, depth - 0.2, 0.8, 2.2, 0.6, { y: 1.6, collide: false, shade: null });
  fire(area, fp.x - fx * 0.3, 0.35, fp.z - fz * 0.3, { size: 0.45, intensity: 6, range: 7, embers: 2 });
  const pot = L(-across + 1.5, depth - 0.7);
  mesh(area, 'ironDark', new THREE.CylinderGeometry(0.32, 0.24, 0.45, 8), trs(pot.x, 0.25, pot.z));
  interactable(area, pot, 1.5, 'Eat from the cooking pot', () => { game.player.heal(25); game.hud.speak('Thin stew, mostly turnip. It is warm, and that is enough.'); });
  // bookshelf on the left wall
  if (idx % 3 !== 2) {
    const bs = B('woodDark', -across, 0, 0.45, 2.2, 1.6);
    for (let i = 0; i < 3; i++) B('clothRed', -across + 0.24, 0, 0.03, 0.35, 1.4, { y: 0.4 + i * 0.6, collide: false, shade: () => 0.6 });
    interactable(area, bs, 1.8, 'Read from the bookshelf', () => {
      game.journal.readFor('town');
    });
  }
  // wardrobe on the right wall
  const wr = B('wood', across, -depth + 1.2, 0.6, 2.1, 1.2);
  interactable(area, wr, 1.6, 'Look in the wardrobe', () => {
    const wd = game.state.world;
    if (!wd['wardrobe' + idx] && idx % 4 === 1) { wd['wardrobe' + idx] = true; game.state.addItem('leather_hood'); game.hud.speak('Behind the coats: an old leather hood. Nobody will miss it.'); }
    else game.hud.speak(['Moth-eaten cloaks and a single good boot.', 'Funeral clothes, neatly folded.', 'Smells of cedar and old smoke.'][idx % 3]);
  });
  // a table in the middle
  B('woodDark', 0, -0.3, 1.2, 0.8, 0.9);
  // sometimes someone is home
  if (idx % 2 === 0) {
    const f = HOME_FOLK[(idx / 2) % HOME_FOLK.length];
    const p = L(-0.9, -0.2);
    npc(area, { ...f, x: p.x, z: p.z, yaw: yaw + Math.PI });
  }
}

const STORE_NPC = {
  alchemist: { name: 'Old Marrow', cloth: 'clothBrown', variant: 'hunched' }, jeweler: { name: 'Sabine the Jeweler', cloth: 'clothRed' },
  armorer: { name: 'Gerda the Armorer', cloth: 'clothBrown', scale: 1.1 }, tavern: { name: 'Barkeep Hollis', cloth: 'cloth' },
  enchanter: { name: 'Vesper', cloth: 'cloth', variant: 'staff' }, tailor: { name: 'Wren\u2019s Mother', cloth: 'clothRed' },
  stash: { name: 'Keeper of Keys', cloth: 'cloth', variant: 'hunched' }, weaponsmith: { name: 'Bryn the Weaponsmith', cloth: 'clothBrown', scale: 1.1 },
};

/** A house turned into a store: counter, shelves, a light, the shopkeeper. */
export function furnishStore(area, inner, shop) {
  const fx = -inner.nx, fz = -inner.nz, rx = -fz, rz = fx;
  const cx = inner.x, cz = inner.z;
  const depth = Math.abs(fx) ? (inner.x1 - inner.x0) : (inner.z1 - inner.z0);
  const back = depth / 2 - 1.2;
  const P = (f, r) => [cx + fx * f + rx * r, cz + fz * f + rz * r];
  const [kx, kz] = P(back - 1.4, 0);
  box(area, 'woodDark', kx, 0.5, kz, Math.abs(fx) ? 0.8 : 3.2, 1.0, Math.abs(fx) ? 3.2 : 0.8, { tex: 1 });
  for (const s2 of [-1.4, 1.4]) { const [sx, sz] = P(back + 0.5, s2); box(area, 'woodDark', sx, 1.2, sz, Math.abs(fx) ? 0.5 : 1.2, 2.4, Math.abs(fx) ? 1.2 : 0.5, { tex: 1 }); }
  const [lx, lz] = P(0, 0);
  fire(area, lx, 3.2, lz, { size: 0.25, intensity: 5, range: 8, embers: 0 });
  const [nx2, nz2] = P(back - 0.3, 0);
  const N = STORE_NPC[shop] || { name: 'Shopkeeper' };
  npc(area, { id: shop, name: N.name, talk: false, x: nx2, z: nz2, yaw: Math.atan2(-fx, -fz), cloth: N.cloth, variant: N.variant, scale: N.scale });
  const [ix, iz] = P(back - 2.4, 0);
  interactable(area, new THREE.Vector3(ix, 0, iz), 2.4, `Speak with ${N.name}`, () => area.game.openScreen('shop:' + shop));
  if (shop === 'tavern') for (const r of [-1.6, 1.6]) { const [tx, tz] = P(-0.5, r); box(area, 'woodDark', tx, 0.45, tz, 1.2, 0.9, 1.2, { tex: 1 }); }
}
