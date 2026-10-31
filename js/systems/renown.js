// RENOWN - the player's status in the realm. Gear never counts. It comes from:
//   * monsters slain, weighted by toughness (each boss type also counts once as a feat)
//   * skills learned (keystones count extra)
//   * lifetime ashes earned (spending never lowers it)
//   * deepest main-dungeon level reached
// Every source only ever grows, so renown never decreases (even on death).
import { events } from '../engine/events.js';
import { SKILL_MAP } from './skills.js';
import { FOLK_LINES, HERO_LINES, RANK_EPITHET, BOSS_LORE, pick } from '../../data/lore.js';

export const RANKS = [
  { min: 0, title: 'Nobody' },
  { min: 60, title: 'Wanderer' },
  { min: 300, title: 'Slayer' },
  { min: 900, title: 'Champion' },
  { min: 2000, title: 'Hero of the Realm' },
  { min: 4000, title: 'King\'s Blade' },
];

export const FEAT_RENOWN = 250;   // first kill of each boss type
const SCORE = { skill: 10, keystone: 60, ashesPer: 20, level: 80 };

export function newRenown() {
  return { kills: 0, feats: {}, skillsEver: 0, keystonesEver: 0, lifetimeAshes: 0, deepest: 0, bonus: 0, killCount: 0 };
}

export class Renown {
  constructor(game) {
    this.game = game;
    events.on('enemyKilled', ({ enemy }) => this.onKill(enemy));
    events.on('skillLearned', ({ id }) => {
      const r = this.data;
      r.skillsEver++;
      if (SKILL_MAP[id] && SKILL_MAP[id].keystone) r.keystonesEver++;
      this.changed();
    });
    events.on('ashesEarned', ({ amount }) => { this.data.lifetimeAshes += amount; this.changed(true); });
    this.lastRank = null;
  }

  get data() {
    const st = this.game.state;
    if (!st.renown) st.renown = newRenown();
    return st.renown;
  }

  onKill(enemy) {
    const r = this.data, d = enemy.def;
    r.killCount++;
    r.kills += d.renown || Math.max(1, Math.round(d.hp / 25));
    if (d.boss && !r.feats[enemy.type]) {
      r.feats[enemy.type] = Date.now();
      this.game.hud.feed(`Feat of arms: ${d.name} slain (+${FEAT_RENOWN} renown)`, '#f0d070');
    }
    this.changed();
  }

  reachLevel(n) { if (n > this.data.deepest) { this.data.deepest = n; this.changed(); } }

  /** Skills already learned count once (e.g. after migrating an old save). */
  noteSkills() {
    const r = this.data, sk = this.game.state.progression.skills;
    const learned = Object.entries(sk).filter(([id]) => id !== 'root').reduce((a, [, n]) => a + n, 0);
    const keys = Object.entries(sk).filter(([id, n]) => n > 0 && SKILL_MAP[id]?.keystone).length;
    r.skillsEver = Math.max(r.skillsEver, learned);
    r.keystonesEver = Math.max(r.keystonesEver, keys);
    this.changed(true);
  }

  get score() {
    const r = this.data;
    return Math.floor(r.kills + Object.keys(r.feats).length * FEAT_RENOWN + r.skillsEver * SCORE.skill
      + r.keystonesEver * SCORE.keystone + r.lifetimeAshes / SCORE.ashesPer + r.deepest * SCORE.level + r.bonus);
  }

  /** Admin: make the score exactly `v` via the bonus term. */
  setScore(v) { this.data.bonus += v - this.score; this.changed(); }

  get rankIndex() {
    const s = this.score;
    let i = 0;
    while (i + 1 < RANKS.length && s >= RANKS[i + 1].min) i++;
    return i;
  }

  get rank() { return RANKS[this.rankIndex]; }

  info() {
    const i = this.rankIndex, s = this.score, next = RANKS[i + 1];
    const r = this.data;
    return {
      score: s, index: i, rank: RANKS[i], next,
      progress: next ? (s - RANKS[i].min) / (next.min - RANKS[i].min) : 1,
      parts: [
        ['Monsters slain', Math.floor(r.kills), `${r.killCount} kills`],
        ['Feats (bosses)', Object.keys(r.feats).length * FEAT_RENOWN, `${Object.keys(r.feats).length} bosses`],
        ['Skills learned', r.skillsEver * SCORE.skill + r.keystonesEver * SCORE.keystone, `${r.skillsEver} ranks, ${r.keystonesEver} keystones`],
        ['Ashes earned', Math.floor(r.lifetimeAshes / SCORE.ashesPer), `${Math.floor(r.lifetimeAshes)} lifetime`],
        ['Deepest level', r.deepest * SCORE.level, `level ${r.deepest}`],
      ],
    };
  }

  /** Shop discount in % for the current rank. */
  get discount() { return [0, 0, 5, 10, 15, 20][this.rankIndex]; }

  /** How people call you at your rank. */
  get epithet() { return RANK_EPITHET[this.rankIndex]; }

  changed(quiet) {
    const i = this.rankIndex;
    if (this.lastRank !== null && i > this.lastRank) {
      this.game.hud.banner(RANKS[i].title, 'your renown grows');
      this.game.hud.feed(`Renown rank: ${RANKS[i].title}`, '#f0d070');
      events.emit('renownRankUp', { index: i });
    }
    this.lastRank = i;
  }

  // ------------------------------------------------------------ talk
  /** What a townsperson says, based on rank. */
  greeting(npcName) {
    return `${npcName}: "${pick(FOLK_LINES[this.rankIndex])}"`;
  }

  /** Hearth heroes talk about themselves, and sometimes about your feats. */
  heroComment(heroName) {
    const r = this.data;
    const own = HERO_LINES[heroName] || ['Feed the fire.'];
    const feats = Object.keys(r.feats);
    if (feats.length && Math.random() < 0.3) {
      const last = feats.sort((a, b) => r.feats[b] - r.feats[a])[0];
      const who = BOSS_LORE[last] ? BOSS_LORE[last].title : last;
      return `${heroName}: "${who}... you went that deep? Then you are ${this.epithet} now."`;
    }
    return `${heroName}: "${pick(own)}"`;
  }
}
