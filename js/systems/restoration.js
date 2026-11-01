// WORLD RESTORATION (0-100 %, saved). Slain story bosses heal the world most;
// Conquests, kills (small, capped), depth and renown milestones and companion
// quests add more. Lore: ash and slain guardians let time flow back safely -
// at 100 % the Stilled Hour ends without four hundred years crashing in.
// One value blends the hub and the first levels from ruined to healed
// (sky, sun, fog, light, plants). Levels 26+ and the Abyss never heal.
import { events } from '../engine/events.js';

export const STAGES = [
  [0, 'Ash sky, a red sun, dead trees.'],
  [20, 'The ash thins. The sun turns orange. The first grass.'],
  [40, 'Colour returns: flowers, birds, new faces, better wares.'],
  [60, 'Blue between the clouds. Trees leaf again. The first levels grow lighter.'],
  [80, 'A clear sky. A busy town. Gardens at the castle. A new shop.'],
  [100, 'Healed. The festival of the Hearth. The hour ends gently.'],
];

export class Restoration {
  constructor(game) {
    this.game = game;
    events.on('renownRankUp', () => this.add(3, 'renown'));
    events.on('areaChanged', () => {
      const a = game.area;
      if (a && a.level && a.level <= 25 && a.id === 'dungeon') {
        const w = game.state.world;
        w.restoreDepth = w.restoreDepth || 0;
        if (a.level > w.restoreDepth) { this.add(0.8 * (a.level - w.restoreDepth), 'depth'); w.restoreDepth = a.level; }
      }
    });
  }

  get value() { return Math.max(0, Math.min(100, this.game.state.world.restoration || 0)); }
  set value(v) { this.game.state.world.restoration = Math.max(0, Math.min(100, v)); this.onChange(); }

  add(n, src) {
    const before = this.value;
    this.game.state.world.restoration = Math.min(100, before + n);
    const after = this.value;
    const w = this.game.state.world;
    w.restoreParts = w.restoreParts || {};
    w.restoreParts[src] = +((w.restoreParts[src] || 0) + n).toFixed(2);
    for (const [t, text] of STAGES) if (before < t && after >= t) this.game.hud.banner(`The world heals: ${t}%`, text);
    if (n >= 1) this.game.hud.feed(`World Restoration +${n.toFixed(1)}% (${after.toFixed(0)}%)`, '#a0e0a0');
    this.onChange();
  }

  /** Each kill heals a tiny bit, capped at 15 % in total. */
  kill() {
    const w = this.game.state.world;
    if ((w.killRestore || 0) >= 15) return;
    w.killRestore = (w.killRestore || 0) + 0.02;
    this.game.state.world.restoration = Math.min(100, this.value + 0.02);
  }

  onChange() {
    const g = this.game, v = this.value;
    const town = g.areas.town;
    if (town && town.applyRestoration) town.applyRestoration(v);
    if (v >= 100 && !g.state.world.festival) this.festival();
  }

  festival() {
    const g = this.game, w = g.state.world;
    w.festival = true;
    const was = g.state.inRun; g.state.inRun = false; g.state.addItem('festival_lantern', 1); g.state.inRun = was;
    g.hud.banner('THE HOUR ENDS', 'gently, as the Hearth promised');
    const lines = [
      'The Hearth’s flame steadies, and for the first time in four hundred years, it flickers.',
      'Somewhere a bell rings the next hour. Nobody in Emberwick remembers how to count it.',
      'The owls blink. The widow laughs. The King’s chair stands empty, and no one is afraid of it.',
      'You are given a lantern for the festival. It is warm, and it is yours.',
    ];
    lines.forEach((l, i) => setTimeout(() => g.hud.speak(l, 5.5), 3000 + i * 6000));
    g.state.save();
  }
}
