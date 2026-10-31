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

| | Move | Look | Hit | Menu |
|---|---|---|---|---|
| Keyboard + mouse | WASD | mouse (click to lock pointer) | click / Space | Esc |
| Touch | left-thumb joystick (appears where you touch) | swipe the right side | HIT button | ☰ button |
| Gamepad | left stick | right stick | A / RT / RB / X | Start (B to close) |

The game uses whichever input you touched last and shows matching hints. The
touch controls only appear in touch mode. You can set look sensitivity, invert
Y and PS1 mode (vertex jitter + 15-bit dither) in the menu.

## Game rules

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
js/world/dungeon.js           ASCII-map dungeon builder, spawns, flow-field pathing
js/world/props.js             torches, portals, houses, well, NPCs, ...
js/world/sky.js               sky dome, clouds, stars, moon
js/entities/enemyTypes.js     enemy stats + low-poly models (hollow, ghoul, knight)
js/entities/enemy.js          generic enemy AI (idle/alert/chase/windup/strike/recover/stagger/dead)
js/entities/enemyManager.js   spawn/update/cleanup
js/systems/combat.js          player hit detection, damage numbers, kill rewards
js/systems/loot.js            placeholder items, drop tables, pickups
js/systems/state.js           SAVED / RUN state + localStorage
js/systems/clock.js           world clock + day/night phase
js/systems/skills.js          skill-tree stub (branches: iron / ash / shadow)
js/systems/settings.js        user settings
js/ui/hud.js, js/ui/menu.js   HUD and pause menu (Settings / Inventory / Skills)
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
