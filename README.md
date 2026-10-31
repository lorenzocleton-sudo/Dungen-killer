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

| | Move | Sprint (2×) | Look | Hit | Use / talk | Flask | Inventory | Menu |
|---|---|---|---|---|---|---|---|---|
| Keyboard + mouse | WASD | hold Shift, or double-tap W | mouse (click to lock) | click / Space | E | R | I / Tab | Esc |
| Touch | left-thumb joystick | RUN button (toggle) | swipe right side | HIT | USE (appears when near) | FLASK | ◈ button | ☰ |
| Gamepad | left stick | click L3 (toggle on/off) | right stick | A / RT | Y | LB | Back/Select | Start |

The game uses whichever input you touched last and shows matching hints. The
touch controls only appear in touch mode. You can set look sensitivity, invert
Y and PS1 mode (vertex jitter + 15-bit dither) in the menu.

## Game rules

* **The Ashen Market** (west building, walk inside): buy flasks, weapons, armour
  and rings; sell loot for ashes.
* **The Hall of Paths** (east building): the only place skills can be learned.
  Skills cost skill points (one per level) plus a fee in ashes. The skill tree
  (Iron / Ash / Shadow, 25 nodes) can be viewed from the inventory but only
  upgraded here.
* **Inventory** has its own button: equipment slots (weapon, head, body, hands,
  ring), your stats, items, and a Skill Tree tab. Items marked red were found
  this run and are lost if you die.
* **Two portals**: the fixed *Sunken Catacombs* and the *Shifting Depths*, a new
  random layout every visit (with a guarded chest in the deepest room).

* **Town (Ashen Hollow)** is the safe hub. It has no enemies and wounds heal slowly.
* **Portal** (north end of town) leads to **The Sunken Catacombs**. There's a
  portal back at the dungeon entrance.
* **World clock** only runs while you're in the dungeon. Every 5 minutes of
  dungeon time flips the town between DAY and NIGHT. The HUD shows the dungeon
  timer and what the town will be when you return.
* **SAVED vs RUN**: anything you gain in the dungeon (ashes, items, gear) is
  RUN state. Leave through the portal alive and it merges into SAVED. Die and
  it's lost, and you wake in town. Skill progression (XP and level) is always
  kept.
* SAVED state, progression and the world clock are saved in `localStorage`.

## Code layout

```
index.html, css/style.css     DOM shell + HUD/menu styling
lib/three.module.min.js       vendored three.js r170
js/main.js                    Game: wires systems, area registry, loop, death/respawn
js/config.js                  tuning numbers
js/engine/
  renderer.js                 ~400x225 render target + post pass (grade, vignette, dither, damage flash)
  textures.js                 seeded procedural 64x64 canvas textures (stone, cobble, wood, iron, ...)
  materials.js                material factory + PS1 vertex-snap shader patch
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
js/world/dungeonGen.js        random dungeon generator (rooms, corridors, stairs, validation)
js/world/props.js             torches, portals, houses, well, NPCs, ...
js/world/sky.js               sky dome, clouds, stars, moon
js/entities/enemyTypes.js     enemy stats + low-poly models (hollow, ghoul, knight)
js/entities/enemy.js          generic enemy AI (idle/alert/chase/windup/strike/recover/stagger/dead)
js/entities/enemyManager.js   spawn/update/cleanup
js/systems/combat.js          player hit detection, damage numbers, kill rewards
js/systems/items.js           item database, shop stock, drop tables
js/systems/stats.js           derived stats (base + gear + skills)
js/systems/loot.js            drops and pickups
js/systems/state.js           SAVED / RUN state + localStorage
js/systems/clock.js           world clock + day/night phase
js/systems/skills.js          skill tree (iron / ash / shadow), costs, requirements
js/systems/settings.js        user settings
js/ui/hud.js, js/ui/menu.js   HUD and settings menu
js/ui/screens.js              inventory, shop and trainer panels (drawn skill tree)
js/ui/nav.js                  gamepad/arrow-key spatial navigation for panels
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
