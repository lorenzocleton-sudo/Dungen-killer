// RENOWN - the player's status in the realm. Gear never counts. It comes from:
//   * monsters slain, weighted by toughness (each boss type also counts once as a feat)
//   * skills learned (keystones count extra)
//   * lifetime ashes earned (spending never lowers it)
//   * deepest main-dungeon level reached
// Every source only ever grows, so renown never decreases (even on death).
import { events } from '../engine/events.js';
import { SKILL_MAP } from './skills.js';

export const RANKS = [
  { min: 0, title: 'Nobody', greet: 'Another ash-born. Keep walking.' },
  { min: 60, title: 'Wanderer', greet: 'You again. Still breathing, I see.' },
  { min: 200, title: 'Sellsword', greet: 'Word is you can hold a blade.' },
  { min: 500, title: 'Slayer', greet: 'The Slayer! The crypts grow quiet where you walk.' },
  { min: 1100, title: 'Champion', greet: 'Champion. The town owes you more than it can say.' },
  { min: 2200, title: 'Hero of the Realm', greet: 'Hero of the Realm... it is an honour.' },
  { min: 4000, title: 'King\'s Blade', greet: 'My lord, the King\'s Blade! Make way!' },
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
  get discount() { return [0, 0, 3, 6, 10, 14, 20][this.rankIndex]; }

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
    return `${npcName}: "${this.rank.greet}"`;
  }

  /** Heroes comment on your actual feats. */
  heroComment(heroName) {
    const r = this.data, i = this.rankIndex;
    const feats = Object.keys(r.feats);
    const lines = [];
    if (feats.length) {
      const last = feats.sort((a, b) => r.feats[b] - r.feats[a])[0];
      const name = this.game.enemyName ? this.game.enemyName(last) : last;
      lines.push(`They say you felled ${name}. I'd not have believed it a month ago.`);
    }
    if (r.deepest >= 3) lines.push(`Level ${r.deepest} of the catacombs... few come back from that deep.`);
    if (r.killCount >= 50) lines.push(`${r.killCount} of the dead put back in the ground. The dead remember you.`);
    if (i <= 1) lines.push('Go on, then. The crypts will teach you or bury you.', 'You smell of grave-dust. Good. It means you went down there.');
    if (i >= 4) lines.push('If the King has sense, he will send for you.');
    if (!lines.length) lines.push('Keep your blade sharp and your flask full.');
    return `${heroName}: "${lines[Math.floor(Math.random() * lines.length)]}"`;
  }
}
