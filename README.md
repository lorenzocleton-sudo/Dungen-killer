# Dungen Killer — demo

A first-person dark-fantasy action demo in three.js. It aims for a Dark Souls
mood in PS2-era low-poly graphics. It's plain HTML and JS modules with no build
step and no external assets. Every texture is painted procedurally at startup.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

ES modules need a web server (`file://` won't work). three.js r170 is
vendored in `lib/`, so the game works offline and on GitHub Pages.

## Controls

| | Move | Jump | Dash | Look | Hit | Block | Skills | Use | Potion | Item | Inventory | Map | Menu |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Keyboard + mouse | WASD | Space | Shift | mouse | click / F | right-click | 1-4 | E | R | G | I / Tab | M | Esc |
| Touch | left joystick | JUMP | DASH | swipe right side | HIT | BLOCK | skill buttons | USE | FLASK | ITEM | ◈ | tap minimap | ☰ |
| Gamepad | left stick | A | B | right stick | X / RT | LT (hold) | D-pad | Y | LB | RB | Back | R3 | Start |

Ground slam (once unlocked): C / L3, or look straight down in the air and dash/attack. Companion orders: O / ORD. Waystone level select: L (in town).

**Admin / debug menu:** F1, the ADM button (touch), tap the HUD status line 5 times, or hold LB+RB and press Start.

## The world

The world burned. One town survived: **Emberwick**, held still inside one
stolen hour by **the Hearth**. Beyond the portals lie the Deeps: the remains of
the old realm of Aurelan. You are a Wanderer, bound to the Hearth: when you die
it rebuilds you from ash, but what you found below (warm loot) stays below. All
lore text lives in `data/lore.js`; notes you find are kept in the Lore Journal.

## Game rules

* **Movement** is Doom-style: fast running costs nothing, instant acceleration, jump with full air control and strafe-jumping, ledge mantling, fall damage only from big drops. **Dash** (2 recharging charges, i-frames, works in the air). Double jump, a 3rd dash and the ground slam are unlocked in the Storm path (or by gear). Stamina is for attacks, blocking and skills; mana for active skills.
* **Main dungeon**: 30 levels (a new look every 5), then the endless **Abyss**. Every level ends in a guardian arena with Descend / Return gates. Story guardians at 5/10/15/20/25, **the Hollow King** (3 phases) at 30; other guardians are elites with affixes (burning, frozen, vampiric, shielded, splitting, hasted). Difficulty is **fixed per level**: the Waystone shows danger (green / yellow / red / skull) and the recommended level; XP drops off on levels far below you.
* **Conquest**: optional hard mode per level (+150% HP/damage, more elites, traps, no shrines, kill everything). Conquered levels get a crown; the Waystone lets you start after your highest conquest. First clears give a Rare reward and renown.
* **The Proving Pit** (purple portal, west wall): wave arena by tier, elite waves every 5, guardians every 10, a 10 s break with "Leave now", best wave saved per tier.
* **Loot** = base × material × rarity × affixes: 20 weapon types with their own movesets (melee, bows, crossbows, staves, wands, knives, tomes, lanterns, shields), 6 armour + 5 accessory slots, 7 materials by depth, Common / Special 1/5 / Rare 1/50 / Legendary 1/500 / Mythic 1/5000 (pity: Rare 50, Legendary 300, Mythic 1000 runs), 44 affixes, gem sockets (7 gems × 5 grades), 8 lore sets, 32 named Legendaries, 13 Mythics, cursed items. Inventory sort / filter / compare / lock / salvage; a tabbed stash in town.
* **Skill web**: 10 paths (Oathguard, Red Covenant, Bone Choir, Veiled, Long Watch, Thunderborn, Rimewatch, Cinder Choir, Hearth-Keepers, Wild Oath), 251 nodes with crossroads between neighbours, 2 keystones per path with trade-offs, 20 active skills on a 4-slot bar. Learn and respec at the Hall of Paths.
* **Stores**: Market, Armorer, Weaponsmith (+1..+10), Alchemist (brewing), Jeweler (sockets, combining), Enchanter (reroll an affix), Runeforge (craft, salvage), Black Market, Gambler, Tailor (cosmetics), Cartographer (dungeon maps), Tavern (companions, rumours), Stash House, Menagerie (pets), and the Hearth Garden at 80% restoration. All restock per run and have buyback.
* **Companions** (Tavern): Bram, Sister Ilse, Nix, Hedda, Father Oswin, Korr, Mirelle and the Silent One; bring one companion and one pet. They level up, take your gear, follow orders, can be revived, and have a personal quest.
* **World Restoration** (0-100%): bosses, conquests, depth and renown milestones, quests and kills heal the world. The hub and the first levels blend from ash to healed; 100% brings the festival.
* **Ascension** after the Hollow King: back to level 1 with your gear and skills, permanent bonus points, tougher enemies.
* **Renown** (status) comes only from deeds and unlocks discounts, stock, keystones and the castle's rooms. Death loses the run's warm loot (and companions' run gear); the Hearth keeps everything else.

## Code layout

```
index.html, css/style.css     DOM shell + HUD/menu styling
lib/three.module.min.js       vendored three.js r170
js/main.js                    Game: wires systems, area registry, loop, death/respawn
js/config.js                  tuning numbers
js/engine/
  renderer.js                 ~400x225 render target + post pass (grade, vignette, damage flash)
  textures.js                 seeded procedural 64x64 canvas textures (stone, cobble, wood, iron, ...)
  materials.js                material factory
  geometry.js                 box/roof helpers + StaticBatcher (merges level geometry per material)
  collision.js                AABB world: walls, floors, stairs (step-up), line of sight
  lights.js                   pooled point lights that follow the nearest torches
  particles.js                embers / dust / sparks
  events.js                   event bus (hook point for future systems)
js/input/input.js             keyboard+mouse, touch, gamepad -> one interface
js/player/player.js           movement, gravity, camera, HP
js/player/weapon.js           first-person sword + swing timeline
js/world/area.js              base Area class (scene, collision, lights, portals)
js/world/town.js              town layout + DAY/NIGHT palettes
js/world/dungeon.js           dungeon builder (ASCII map or generated cells), flow-field pathing
js/world/dungeonGen.js        random dungeon generator (rooms, corridors, stairs, boss arena, validation)
js/world/biomes.js            dungeon biomes + main-level enemy mix
js/world/outdoorGen.js        open/cave layout generators (clearings, rivers, caves, lava)
js/world/outdoor.js           terrain, natural instanced borders, biome features
js/engine/nav.js              nav grid from collision + A* for enemies
js/systems/journal.js         Lore Journal
js/systems/itemgen.js         item generation: bases, materials, rarity, affixes, gems, sets, legendaries, mythics, curses
js/systems/shops.js           stores, stock, restock, services
js/systems/actives.js         active skills + skill bar
js/systems/progression.js     recommended levels, danger, XP falloff, gear score, ascension
js/systems/restoration.js     World Restoration
js/entities/allies.js         companions, pets, summons
js/entities/weaponModels.js   shared weapon models (edge-forward convention) + the bow
js/world/pit.js               the Proving Pit
js/systems/ending.js          ending stub (Hearth choice)
data/lore.js                  all lore text
js/world/castle.js            the King's castle (rooms, guards gated by renown)
js/world/homes.js             furnished house interiors
js/world/props.js             torches, portals, houses, well, NPCs, ...
js/world/sky.js               sky dome, clouds, stars, moon
js/entities/enemyTypes.js     enemy stats + low-poly models (hollow, ghoul, knight)
js/entities/enemy.js          generic enemy AI (idle/alert/chase/windup/strike/recover/stagger/dead)
js/entities/enemyManager.js   spawn/update/cleanup
js/entities/bosses.js         boss brain: telegraphed attack patterns, phase 2
js/entities/projectiles.js    enemy projectiles + ground telegraphs
js/systems/combat.js          player hit detection, damage numbers, kill rewards
js/systems/items.js           item database, shop stock, drop tables
js/systems/stats.js           derived stats (base + gear + skills)
js/systems/loot.js            drops and pickups
js/systems/renown.js          renown score, ranks, greetings
js/systems/rewards.js         reward-chest rarity roll + pity
js/systems/state.js           SAVED / RUN state, stash, save versioning + migration chain (v1 -> v4)
js/systems/clock.js           world clock + day/night phase
js/systems/skills.js          skill tree (iron / ash / shadow), costs, requirements
js/systems/settings.js        user settings
js/ui/hud.js, js/ui/menu.js   HUD and settings menu
js/ui/screens.js              inventory, shop and trainer panels (drawn skill tree)
js/ui/nav.js                  gamepad/arrow-key spatial navigation for panels
js/ui/minimap.js              minimap + full map with fog of war
js/ui/admin.js                hidden admin/debug menu
```

### Extending

* **New area:** subclass `Area`, build it with the props, and register it in
  `AREA_FACTORIES` in `main.js`. Portals name their `target` area id.
* **New enemy:** add an entry to `ENEMY_TYPES` (stats + `build()` model) and put
  it in a spawn list.
* **Loot / economy:** `ITEMS` and `DROP_TABLES` in `loot.js`. `GameState` keeps
  `currency`, `items` and `gear` in both SAVED and RUN.
* **Skills:** fill `SKILL_TREE` nodes with `effects`, then add a stats system
  that reads `state.progression.unlocked`.
* **Story / dialogue:** town NPCs carry `id` and `role`. The game emits events
  you can subscribe to: `areaChanged`, `enemyKilled`, `itemPickedUp`,
  `runCommitted` and `runLost`.
