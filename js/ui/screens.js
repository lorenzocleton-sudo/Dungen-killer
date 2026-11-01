// Full-screen panels: INVENTORY (items, equipment, renown, skills, journal,
// ascension), every STORE in Emberwick (buy / sell / buyback + services:
// upgrade, brew, sockets, combine, enchant, craft, salvage, gamble, wardrobe,
// companions, pets, stash), the TRAINER (skill web + respec), the WAYSTONE
// level select and the PROVING PIT tier select.
// All HTML; mouse/touch click, gamepad/arrow keys via SpatialNav.
import { ITEMS, SLOTS, SLOT_NAMES, sellPrice, RARITY, defOf, touchItem, gemInfo, gemId, GEM_TYPES, COSMETICS } from '../systems/items.js';
import { AFFIXES, SETS, statLabel, salvageYield, generateItem, rollRarity, MATERIALS, BASES, WEAPON_BASES, ARMOR_BASES, ACC_BASES, RARITY_ORDER, AFFIX_IDS } from '../systems/itemgen.js';
import { SKILLS, SKILL_MAP, BRANCHES, rankOf, learnBlocker, isOpen, xpForLevel, TREE_W, TREE_H, PATH_ORDER, respecCost, respec } from '../systems/skills.js';
import { ACTIVES } from '../systems/actives.js';
import { RANKS } from '../systems/renown.js';
import { NOTES, NOTE_MAP, ITEM_LORE, RANK_EPITHET } from '../../data/lore.js';
import { statRows, setCounts } from '../systems/stats.js';
import { SpatialNav } from './nav.js';
import { dangerFor, recommendedLevel } from '../systems/progression.js';
import { STORY_LEVELS } from '../entities/enemyTypes.js';
import { BIOMES, bandFor } from '../world/biomes.js';
import { SHOPS, MAPS, rumor } from '../systems/shops.js';
import { COMPANIONS, PETS } from '../entities/allies.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TAB_NAMES = {
  items: 'Items', status: 'Renown', tree: 'Skill Web', journal: 'Lore Journal', ascension: 'Ascension', levels: 'Levels', pit: 'Tiers',
  buy: 'Buy', sell: 'Sell', buyback: 'Buyback', upgrade: 'Upgrade', brew: 'Brew', sockets: 'Sockets', combine: 'Combine Gems', enchant: 'Enchant',
  craft: 'Craft', salvage: 'Salvage', gamble: 'Gamble', wardrobe: 'Wardrobe', companions: 'Companions', rumors: 'Rumors', stash: 'Stash', pets: 'Pets', respec: 'Respec',
};
const FILTERS = [['all', 'All'], ['weapon', 'Weapons'], ['armor', 'Armour'], ['jewel', 'Jewellery'], ['gem', 'Gems'], ['use', 'Usable'], ['mat', 'Materials']];
const SORTS = [['rarity', 'Rarity'], ['ilvl', 'Item level'], ['slot', 'Type'], ['new', 'Newest']];

export class Screens {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('panel');
    this.nav = new SpatialNav(this.root);
    this.open = false;
    this.mode = null;
    this.tab = null;
    this.sel = null;
    this.msg = '';
    this.filter = 'all'; this.sort = 'rarity'; this.stashTab = 0; this.treeFilter = 'all'; this.search = '';
    this.root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      this.act(el.dataset.act, el.dataset);
    });
    this.root.addEventListener('input', (e) => { if (e.target.id === 'tree-search') { this.search = e.target.value; this.highlightSearch(); } });
    this.root.addEventListener('change', (e) => { if (e.target.id === 'tree-filter') { this.treeFilter = e.target.value; this.render(); } });
    this.root.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  }

  get shopId() { return this.mode.startsWith('shop:') ? this.mode.slice(5) : null; }
  tabsFor(mode) {
    if (mode === 'inventory') return ['items', 'status', 'tree', 'journal', ...((this.game.state.ascension.level || this.game.state.world.conquered[30] || (this.game.state.world.deepest || 0) > 30) ? ['ascension'] : [])];
    if (mode === 'trainer') return ['tree', 'respec'];
    if (mode === 'levels') return ['levels'];
    if (mode === 'pit') return ['pit'];
    if (mode === 'shop') return ['buy', 'sell', 'buyback'];
    if (this.shopIdOf(mode)) return SHOPS[this.shopIdOf(mode)].tabs;
    return ['items'];
  }
  shopIdOf(mode) { return mode && mode.startsWith('shop:') ? mode.slice(5) : null; }

  show(mode, tab) {
    if (mode === 'shop') mode = 'shop:market';
    this.mode = mode;
    this.tab = tab || this.tabsFor(mode)[0];
    this.sel = null; this.msg = '';
    if (this.shopId) this.msg = `${SHOPS[this.shopId].npc}: "${SHOPS[this.shopId].line}"`;
    this.open = true;
    this.root.classList.remove('hidden');
    this.render();
    if (this.game.input.device !== 'touch') this.nav.ensure();
  }

  hide() { this.open = false; this.root.classList.add('hidden'); this.nav.clear(); }

  // ------------------------------------------------------------ helpers
  def(it) { return defOf(it); }
  price(id, mul = 1) { return this.game.shops.price(ITEMS[id].value, mul); }
  entryPrice(e) { return e.id === 'gen' ? this.game.shops.price(defOf(e).value, e.mul || 1) : e.price; }
  itemFilter(d) {
    switch (this.filter) {
      case 'weapon': return d.slot === 'weapon';
      case 'armor': return ['head', 'chest', 'hands', 'legs', 'feet', 'cloak'].includes(d.slot);
      case 'jewel': return ['ring', 'amulet', 'belt', 'relic'].includes(d.slot);
      case 'gem': return d.kind === 'gem';
      case 'use': return d.kind === 'consumable' || d.kind === 'cosmetic';
      case 'mat': return d.kind === 'material' || d.kind === 'relic' || d.kind === 'key';
      default: return true;
    }
  }
  sorted(items) {
    const ri = (d) => (d.rarity ? RARITY_ORDER.indexOf(d.rarity) : -1);
    const k = this.sort;
    return items.map((it) => ({ it, d: defOf(it) })).filter((x) => x.d && this.itemFilter(x.d)).sort((a, b) =>
      k === 'rarity' ? ri(b.d) - ri(a.d) || (b.d.ilvl || 0) - (a.d.ilvl || 0)
        : k === 'ilvl' ? (b.d.ilvl || 0) - (a.d.ilvl || 0)
          : k === 'slot' ? String(a.d.slot || a.d.kind).localeCompare(String(b.d.slot || b.d.kind))
            : b.it.uid - a.it.uid).map((x) => x.it);
  }

  // ------------------------------------------------------------ actions
  act(a, d) {
    const g = this.game, st = g.state, sh = g.shops;
    const f = d.uid ? st.find(+d.uid) : null;
    const it = f && f.item, def = it && defOf(it);
    const say = (m) => { this.msg = m; };
    switch (a) {
      case 'close': g.closeScreen(); return;
      case 'tab': this.tab = d.tab; this.sel = null; this.msg = ''; break;
      case 'sel': this.sel = +d.uid; this.msg = ''; break;
      case 'filter': this.filter = d.f; break;
      case 'sort': this.sort = d.s; break;
      case 'slot': { const uid = st.equipped[d.slot]; this.sel = uid ?? null; if (!uid) say(`Nothing equipped (${SLOT_NAMES[d.slot]}).`); break; }
      case 'equip': if (st.equip(+d.uid)) say('Equipped.'); break;
      case 'unequip': say(st.unequip(d.slot) ? 'Removed.' : 'You need a weapon in hand.'); break;
      case 'lock': st.toggleLock(+d.uid); say(def && !def.locked ? 'Unlocked.' : 'Locked: it can’t be sold or salvaged.'); break;
      case 'use': {
        if (!def) break;
        if (def.map) { g.state.world.mapMod = def.map; st.removeItem(it.uid, 1); say(`${def.name}: it will guide your next main-dungeon level.`); break; }
        if (def.kind === 'cosmetic') { this.applyCosmetic(it.id); break; }
        if (!g.combat.useConsumable(it.id)) say('You can’t use that now.');
        if (!st.find(+d.uid)) this.sel = null;
        break;
      }
      case 'quick': st.quick = it.id; say(`${def.name} is now your quick item (G / ITEM / RB).`); break;
      case 'salvage': this.salvage(+d.uid); break;
      case 'salvageall': {
        let n = 0;
        for (const x of [...st.saved.items, ...st.run.items]) { const dd = defOf(x); if (dd && dd.kind === 'gear' && dd.rarity === 'normal' && !dd.locked && !st.isEquipped(x.uid) && x.id === 'gen') { this.salvage(x.uid, true); n++; } }
        say(n ? `Salvaged ${n} common items.` : 'Nothing common to salvage.');
        break;
      }
      // ---- shop
      case 'stock': this.sel = d.key; this.msg = ''; break;
      case 'buy': {
        const e = sh.stock(this.shopId || 'market').find((x) => x.key === d.key);
        if (!e) break;
        const p = this.entryPrice(e);
        if (!st.spend(p)) { say('Not enough ashes.'); break; }
        const was = st.inRun; st.inRun = false;
        if (e.id === 'gen') { st.addGen(e.g); const L = sh.stock(this.shopId); L.splice(L.indexOf(e), 1); } else st.addItem(e.id, 1);
        st.inRun = was; st.save();
        say(`Bought ${e.id === 'gen' ? defOf(e).name : ITEMS[e.id].name}.`);
        break;
      }
      case 'sell': {
        if (!it) break;
        if (st.isEquipped(it.uid)) { say('Unequip it first.'); break; }
        if (def.locked) { say('It’s locked.'); break; }
        if (f.run) { say('Warm loot can’t be sold until you bring it home.'); break; }
        const price = sellPrice(it);
        const one = it.qty > 1 ? { ...it, qty: 1, uid: st.nextUid++ } : it;
        st.removeItem(it.uid, 1);
        st.buyback.unshift({ item: one, price }); st.buyback.length = Math.min(12, st.buyback.length);
        st.addCurrency(price); st.save();
        say(`Sold for ${price} ashes.`);
        if (!st.find(+d.uid)) this.sel = null;
        break;
      }
      case 'sellall': {
        let total = 0;
        for (const x of [...st.saved.items]) {
          const dd = defOf(x);
          if (!dd || (dd.kind !== 'material' && dd.kind !== 'relic') || /^ore_|^ess_|^hide$/.test(x.id)) continue;
          total += sellPrice(x) * x.qty; st.removeItem(x.uid, x.qty);
        }
        st.addCurrency(total); st.save();
        say(total ? `Sold all trinkets for ${total} ashes (crafting materials kept).` : 'No trinkets to sell.');
        this.sel = null;
        break;
      }
      case 'buyback': {
        const i = +d.i, b = st.buyback[i];
        if (!b) break;
        if (!st.spend(b.price)) { say('Not enough ashes.'); break; }
        st.buyback.splice(i, 1);
        st.saved.items.push(b.item); st.save();
        say('Bought back.');
        break;
      }
      // ---- services
      case 'upgrade': this.upgrade(it, def); break;
      case 'brew': this.brew(d.t, +d.gr); break;
      case 'socket': this.socket(it, def, d.gem); break;
      case 'unsocket': this.unsocket(it, def, +d.i); break;
      case 'addsocket': this.addSocket(it, def); break;
      case 'combine': this.combineGem(d.gem); break;
      case 'enchant': this.enchant(it, def, +d.i); break;
      case 'craft': this.craft(d.base, d.tier); break;
      case 'craftbase': this.craftBase = d.b; break;
      case 'gamble': this.gamble(d.cat); break;
      case 'cosmetic': this.applyCosmetic(d.id); break;
      case 'hire': this.hire(d.id); break;
      case 'bring': st.companions.active = st.companions.active === d.id ? null : d.id; say(st.companions.active ? `${COMPANIONS[d.id].name} will come with you.` : 'You will go alone.'); st.save(); break;
      case 'cgear': this.companionGear(d.id, d.slot); break;
      case 'buypet': this.buyPet(d.id); break;
      case 'bringpet': st.companions.pet = st.companions.pet === d.id ? null : d.id; st.save(); break;
      case 'rumor': say(`Hollis leans in: "${rumor()}"`); break;
      case 'stashtab': this.stashTab = +d.t; break;
      case 'tostash': if (!st.toStash(+d.uid, this.stashTab)) say('Can’t store that (equipped, warm loot, or the tab is full).'); else { this.sel = null; st.save(); } break;
      case 'fromstash': st.fromStash(+d.uid, this.stashTab); st.save(); break;
      // ---- skills
      case 'node': this.sel = d.id; this.msg = ''; break;
      case 'enter': { const L = +d.level; g.closeScreen(); g.enterDungeonLevel(L, false, d.cq === '1'); return; }
      case 'pittier': { const T = +d.tier; g.closeScreen(); g.enterPit(T); return; }
      case 'zoom': this.zoom = Math.max(0.3, Math.min(1.4, (this.zoom || 0.5) * (d.z === 'in' ? 1.2 : 1 / 1.2))); break;
      case 'learn': {
        const why = st.learn(d.id, g.renown.rankIndex, (p, n, ash, rk) => learnBlocker(p, n, ash, rk, (i) => RANKS[i].title), rankOf);
        say(why || `Learned ${SKILL_MAP[d.id].name}.`);
        if (!why) { st.save(); const A = SKILL_MAP[d.id].active; if (A && !st.skillbar.includes(A)) { const i = st.skillbar.indexOf(null); if (i >= 0) st.skillbar[i] = A; } }
        break;
      }
      case 'bar': { const A = SKILL_MAP[d.id].active; const i = +d.i; const j = st.skillbar.indexOf(A); if (j >= 0) st.skillbar[j] = null; st.skillbar[i] = A; st.save(); say(`${ACTIVES[A].name} on slot ${i + 1}.`); break; }
      case 'respec': {
        const c = respecCost(st.progression);
        if (!st.spend(c)) { say(`Respec costs ${c} ashes.`); break; }
        const pts = respec(st.progression); st.skillbar = [null, null, null, null];
        g.combat.refreshStats(); st.save(); say(`The paths are unwalked again. ${pts} points returned.`);
        break;
      }
      // ---- ascension
      case 'ascend': this.ascend(); break;
      case 'ascpt': { const A = st.ascension; if (A.points > 0) { A.points--; A.spent[d.k] = (A.spent[d.k] || 0) + 1; g.combat.refreshStats(); st.save(); } break; }
    }
    if (it) touchItem(it);
    const focusKey = this.nav.current && this.nav.current.dataset.key;
    this.render();
    if (focusKey) { const el = this.root.querySelector(`[data-key="${focusKey}"]`); if (el) this.nav.focus(el, false); }
    if (g.input.device !== 'touch') this.nav.ensure();
  }

  handleInput(input) {
    if (input.consume('cancel') || input.consume('nav_back')) { this.game.closeScreen(); return; }
    if (input.consume('inventory') || input.consume('menu')) { this.game.closeScreen(); return; }
    const tabs = this.tabsFor(this.mode);
    const ti = tabs.indexOf(this.tab);
    if (input.consume('tab_next') && tabs.length > 1) this.act('tab', { tab: tabs[(ti + 1) % tabs.length] });
    if (input.consume('tab_prev') && tabs.length > 1) this.act('tab', { tab: tabs[(ti + tabs.length - 1) % tabs.length] });
    this.nav.handle(input);
  }

  // ------------------------------------------------------------ services
  salvage(uid, quiet) {
    const st = this.game.state, f = st.find(uid);
    if (!f) return;
    const d = defOf(f.item);
    if (!d || d.kind !== 'gear') { this.msg = 'Only gear can be salvaged.'; return; }
    if (d.locked || st.isEquipped(uid)) { this.msg = 'Locked or equipped.'; return; }
    const y = salvageYield(d);
    st.removeItem(uid, 1);
    const was = st.inRun; st.inRun = f.run;
    for (const [id, n] of y.items) st.addItem(id, n);
    st.addCurrency(y.ashes); st.inRun = was;
    if (!quiet) this.msg = `Salvaged into ${y.items.map(([id, n]) => `${n} ${ITEMS[id].name}`).join(', ')} and ${y.ashes} ashes.`;
    this.sel = null;
  }

  upgrade(it, def) {
    const st = this.game.state;
    if (!def || def.kind !== 'gear' || !it.g) { this.msg = 'Choose a crafted or found item (not an old relic).'; return; }
    if ((def.upgrade || 0) >= 10) { this.msg = 'It can’t take any more. +10 is the limit.'; return; }
    const c = this.game.shops.upgradeCost(def);
    if (st.count(c.ore) < c.oreN) { this.msg = `Needs ${c.oreN} ${ITEMS[c.ore].name}.`; return; }
    if (!st.spend(c.ashes)) { this.msg = `Needs ${c.ashes} ashes.`; return; }
    for (let i = 0; i < c.oreN; i++) st.consume(c.ore);
    if (Math.random() < c.chance) { it.g.up = (it.g.up || 0) + 1; this.msg = `The Smith: "There. +${it.g.up}. Listen to it ring."`; }
    else this.msg = 'The Smith: "...The metal refused. Your ore is spent. Try again."';
    touchItem(it); this.game.combat.refreshStats(); st.save();
  }

  brew(t, gr) {
    const st = this.game.state, from = `${t}_potion_${gr}`, to = `${t}_potion_${gr + 1}`;
    if (!ITEMS[to]) return;
    if (st.count(from) < 3) { this.msg = `Needs 3 ${ITEMS[from].name}.`; return; }
    const cost = 20 + gr * 30;
    if (!st.spend(cost)) { this.msg = `Brewing costs ${cost} ashes.`; return; }
    for (let i = 0; i < 3; i++) st.consume(from);
    const was = st.inRun; st.inRun = false; st.addItem(to, 1); st.inRun = was;
    this.msg = `Old Marrow hands you a ${ITEMS[to].name}.`; st.save();
  }

  socket(it, def, gem) {
    const st = this.game.state;
    if (!it || !it.g) return;
    const i = it.g.s.indexOf(null);
    if (i < 0) { this.msg = 'No free socket.'; return; }
    if (!st.count(gem)) return;
    st.consume(gem); it.g.s[i] = gem;
    touchItem(it); this.game.combat.refreshStats(); this.msg = `${ITEMS[gem].name} set.`; st.save();
  }

  unsocket(it, def, i) {
    const st = this.game.state;
    const gem = it && it.g && it.g.s[i];
    if (!gem) return;
    const cost = 25 + gemInfo(gem).grade * 40;
    if (!st.spend(cost)) { this.msg = `Removing it costs ${cost} ashes.`; return; }
    it.g.s[i] = null; const was = st.inRun; st.inRun = false; st.addItem(gem, 1); st.inRun = was;
    touchItem(it); this.game.combat.refreshStats(); this.msg = 'Gem removed intact.'; st.save();
  }

  addSocket(it, def) {
    const st = this.game.state;
    if (!it || !it.g) return;
    if (it.g.s.length >= 3) { this.msg = 'Three sockets is the most anything can hold.'; return; }
    const cost = 150 * (it.g.s.length + 1) * (1 + (def.ilvl || 1) / 10) | 0;
    if (!st.spend(cost)) { this.msg = `A new socket costs ${cost} ashes.`; return; }
    it.g.s.push(null); touchItem(it); this.msg = 'Sabine cuts a new socket.'; st.save();
  }

  combineGem(gem) {
    const st = this.game.state, info = gemInfo(gem);
    if (!info || info.grade >= 4) return;
    if (st.count(gem) < 3) { this.msg = 'Needs three of the same gem.'; return; }
    const cost = 30 + info.grade * 60;
    if (!st.spend(cost)) { this.msg = `Combining costs ${cost} ashes.`; return; }
    for (let i = 0; i < 3; i++) st.consume(gem);
    const was = st.inRun; st.inRun = false; st.addItem(gemId(info.type, info.grade + 1), 1); st.inRun = was;
    this.msg = `Three became one: ${ITEMS[gemId(info.type, info.grade + 1)].name}.`; st.save();
  }

  enchant(it, def, i) {
    const st = this.game.state;
    if (!it || !it.g || !it.g.a[i]) return;
    const cost = this.game.shops.enchantCost(def, it.g);
    if (!st.spend(cost)) { this.msg = `Rerolling costs ${cost} ashes.`; return; }
    const B = BASES[it.g.b];
    const pool = B.slot === 'weapon' ? 'w' : ['head', 'chest', 'hands', 'legs', 'feet', 'cloak'].includes(B.slot) ? 'a' : 'j';
    const have = new Set(it.g.a.map(([id]) => id));
    const opts = AFFIX_IDS.filter((id) => AFFIXES[id].pools.includes(pool) && !have.has(id));
    const id = opts[Math.floor(Math.random() * opts.length)];
    const A = AFFIXES[id];
    const v = A.lo + (A.hi - A.lo) * Math.random() + A.grow * it.g.il;
    it.g.a[i] = [id, A.hi < 1 ? +v.toFixed(2) : A.hi < 10 ? +v.toFixed(1) : Math.round(v)];
    it.g.ench = (it.g.ench || 0) + 1;
    touchItem(it); this.game.combat.refreshStats();
    this.msg = `Vesper unsays a word and speaks another: ${statLabel(A.stat, it.g.a[i][1])}.`; st.save();
  }

  craft(base, tier) {
    const st = this.game.state;
    const mats = ['rusted', 'iron', 'steel', 'blackiron', 'sunsteel', 'voidglass', 'hearthforged'];
    const t = +tier, ore = ['ore_iron', 'ore_iron', 'ore_steel', 'ore_blackiron', 'ore_sunsteel', 'ore_voidglass', 'ore_hearth'][t];
    const need = 3 + t;
    if (st.count(ore) < need) { this.msg = `Needs ${need} ${ITEMS[ore].name}.`; return; }
    const cost = 60 + t * 90;
    if (!st.spend(cost)) { this.msg = `Crafting costs ${cost} ashes.`; return; }
    for (let i = 0; i < need; i++) st.consume(ore);
    // an essence improves the odds
    const ess = ['ess_void', 'ess_fire', 'ess_frost', 'ess_storm', 'ess_shadow', 'ess_life'].find((e) => st.count(e));
    let luck = 2;
    if (ess) { st.consume(ess); luck = ess === 'ess_void' ? 12 : 5; }
    const g = generateItem({ ilvl: Math.max(1, MATERIALS[mats[t]].min + 2), base, rarity: rollRarity(luck) });
    g.m = mats[t];
    const was = st.inRun; st.inRun = false; st.addGen(g); st.inRun = was;
    this.msg = `The forge roars. ${defOf({ id: 'gen', g }).name}${ess ? ` (the ${ITEMS[ess].name} sang in the fire)` : ''}.`; st.save();
  }

  gamble(cat) {
    const st = this.game.state, price = this.game.shops.gamblePrice();
    if (!st.spend(price)) { this.msg = `A bundle costs ${price} ashes.`; return; }
    const g = this.game.shops.gamble(cat);
    const was = st.inRun; st.inRun = false; const it = st.addGen(g); st.inRun = was;
    const d = defOf(it);
    this.msg = `Lucky Tam cuts the twine: ${RARITY[d.rarity].name} — ${d.name}!`;
    this.sel = it.uid; st.save();
  }

  applyCosmetic(id) {
    const st = this.game.state, c = COSMETICS[id];
    if (!c || !st.count(id)) return;
    const cos = st.world.cosmetics;
    cos[c.type] = cos[c.type] === id ? null : id;
    this.game.combat.refreshStats();
    if (this.game.applyCosmetics) this.game.applyCosmetics();
    this.msg = cos[c.type] ? `${c.name} applied.` : `${c.name} removed.`; st.save();
  }

  hire(id) {
    const st = this.game.state, C = COMPANIONS[id];
    if (st.companions.hired[id]) return;
    if (C.late && (st.world.deepest || 0) < 20 && (this.game.restoration ? this.game.restoration.value : 0) < 60) { this.msg = 'The Silent One does not look up. (Reach level 20 or heal the world to 60%.)'; return; }
    if (!st.spend(this.game.shops.price(C.cost))) { this.msg = `${C.name} wants ${this.game.shops.price(C.cost)} ashes.`; return; }
    st.companions.hired[id] = { level: 1, xp: 0, loyalty: 0, gear: {} };
    st.companions.active = id;
    this.msg = `${C.name}: "${C.lines.hire}"`; st.save();
  }

  companionGear(id, slot) {
    const st = this.game.state, rec = st.companions.hired[id];
    if (!rec) return;
    if (this.sel == null) { delete rec.gear[slot]; this.msg = 'Gear taken back.'; return; }
    const f = st.find(this.sel), d = f && defOf(f.item);
    const ok = d && d.kind === 'gear' && (slot === 'weapon' ? d.slot === 'weapon' : slot === 'armor' ? ['head', 'chest', 'hands', 'legs', 'feet', 'cloak'].includes(d.slot) : d.slot === 'ring');
    if (!ok) { this.msg = `Select a ${slot} in your items first.`; return; }
    if (Object.values(st.equipped).includes(this.sel)) { this.msg = 'You are wearing that.'; return; }
    rec.gear[slot] = this.sel; this.msg = `${COMPANIONS[id].name} takes the ${d.name}.`; st.save();
  }

  buyPet(id) {
    const st = this.game.state, P = PETS[id];
    st.companions.pets = st.companions.pets || {};
    if (st.companions.pets[id]) return;
    if (!st.spend(this.game.shops.price(P.cost))) { this.msg = `The keeper wants ${this.game.shops.price(P.cost)} ashes.`; return; }
    st.companions.pets[id] = 1; st.companions.pet = id;
    this.msg = `The ${P.name} decides you are acceptable.`; st.save();
  }

  ascend() {
    const g = this.game, st = g.state;
    if (!(st.world.conquered[30] || (st.world.bosses.hollow_king || 0) > 0)) { this.msg = 'Only those who have felled the Hollow King may ascend.'; return; }
    if (st.progression.level < 30) { this.msg = 'Reach level 30 first.'; return; }
    const A = st.ascension;
    A.level++; A.points += 3;
    st.progression.level = 1; st.progression.xp = 0;
    g.combat.refreshStats(); st.save();
    g.hud.banner(`ASCENSION ${A.level}`, 'you begin again, carrying everything you are');
    this.msg = `Ascension ${A.level}: you keep your gear and skills, gain 3 Ascension points; every enemy is ${30 * A.level}% tougher.`;
  }

  // ------------------------------------------------------------ rendering
  render() {
    const tv = this.root.querySelector('#tree-view');
    const prevScroll = tv && this._treeTab === this.tab + this.mode ? [tv.scrollLeft, tv.scrollTop] : null;
    this._treeTab = this.tab + this.mode;
    this._render();
    this.afterRender(prevScroll);
  }

  title() {
    const sid = this.shopId;
    if (sid) return SHOPS[sid].name;
    return { inventory: 'Inventory', trainer: 'Hall of Paths', levels: 'The Waystone — choose your depth', pit: 'The Proving Pit' }[this.mode] || '';
  }

  _render() {
    const g = this.game, st = g.state, p = st.progression;
    const tabs = this.tabsFor(this.mode).map((id) =>
      `<button class="tab focusable ${id === this.tab ? 'active' : ''}" data-act="tab" data-tab="${id}" data-key="tab-${id}">${TAB_NAMES[id] || id}</button>`).join('');
    const xpPct = Math.round((p.xp / xpForLevel(p.level)) * 100);
    const head = `
      <div class="pn-head">
        <div class="pn-title">${esc(this.title())}</div>
        <div class="pn-money"><b>${st.saved.currency}</b> ashes${st.inRun ? ` <span class="run">+${st.run.currency} warm</span>` : ''}</div>
        <div class="pn-level">Lv ${p.level}${st.ascension.level ? ` ✦${st.ascension.level}` : ''} <span class="xpbar"><span style="width:${xpPct}%"></span></span> ${p.skillPoints} pt${p.skillPoints === 1 ? '' : 's'}</div>
        <button class="pn-close focusable" data-act="close" data-key="close">✕</button>
      </div>
      <div class="pn-tabs">${tabs}</div>`;
    const R = {
      items: () => this.renderItems(), tree: () => this.renderTree(this.mode === 'trainer'), status: () => this.renderStatus(), journal: () => this.renderJournal(),
      levels: () => this.renderLevels(), pit: () => this.renderPit(), ascension: () => this.renderAscension(), respec: () => this.renderRespec(),
      buy: () => this.renderBuy(), sell: () => this.renderSell(), buyback: () => this.renderBuyback(), upgrade: () => this.renderService('upgrade'),
      brew: () => this.renderBrew(), sockets: () => this.renderService('sockets'), combine: () => this.renderCombine(), enchant: () => this.renderService('enchant'),
      craft: () => this.renderCraft(), salvage: () => this.renderService('salvage'), gamble: () => this.renderGamble(), wardrobe: () => this.renderWardrobe(),
      companions: () => this.renderCompanions(), rumors: () => this.renderRumors(), stash: () => this.renderStash(), pets: () => this.renderPets(),
    };
    const body = (R[this.tab] || (() => ''))();
    this.root.innerHTML = `<div class="pn-box mode-${this.mode.replace(':', '-')}">${head}<div class="pn-body">${body}</div>
      <div class="pn-msg">${esc(this.msg)}</div>
      <div class="pn-hint">${this.hint()}</div></div>`;
    this.nav.current = null;
  }

  hint() {
    const d = this.game.input.device;
    if (d === 'gamepad') return 'D-pad move · A select · RB/LT switch tab · B close';
    if (d === 'kbm') return 'Click or arrows + Enter · I / Esc close';
    return 'Tap to select · ✕ to close';
  }

  rarityStyle(d) {
    if (!d || !d.rarity) return '';
    const c = d.cursed ? '#a060c0' : RARITY[d.rarity].color;
    return `box-shadow: inset 0 0 0 2px ${c}${d.rarity === 'legendary' || d.rarity === 'mythic' ? `, 0 0 10px ${c}` : ''}`;
  }

  itemCell(it, opts = {}) {
    const d = defOf(it);
    if (!d) return '';
    const st = this.game.state;
    const eq = st.isEquipped(it.uid);
    return `<button class="cell focusable r-${d.rarity || 'none'} ${this.sel === it.uid ? 'sel' : ''} ${it.run ? 'runitem' : ''} ${eq ? 'eq' : ''}" style="${this.rarityStyle(d)}"
      data-act="${opts.act || 'sel'}" data-uid="${it.uid}" data-key="i${it.uid}" title="${esc(d.name)}">
      <span class="glyph" style="color:${d.icon[1]}">${d.icon[0]}</span>
      ${it.qty > 1 ? `<span class="qty">${it.qty}</span>` : ''}${eq ? '<span class="eqm">E</span>' : ''}${d.locked ? '<span class="lk">⚿</span>' : ''}${it.g && it.g.new ? '<span class="nw">•</span>' : ''}${d.ilvl && d.kind === 'gear' ? `<span class="il">${d.ilvl}</span>` : ''}</button>`;
  }

  filterBar(withSort = true) {
    return `<div class="fbar">${FILTERS.map(([k, l]) => `<button class="focusable ${this.filter === k ? 'on' : ''}" data-act="filter" data-f="${k}" data-key="f-${k}">${l}</button>`).join('')}
      ${withSort ? `<span class="sep">sort:</span>${SORTS.map(([k, l]) => `<button class="focusable ${this.sort === k ? 'on' : ''}" data-act="sort" data-s="${k}" data-key="s-${k}">${l}</button>`).join('')}` : ''}</div>`;
  }

  renderItems() {
    const st = this.game.state;
    const eq = st.equippedDefs();
    const slots = SLOTS.map((s) => {
      const e = eq[s];
      return `<button class="slot focusable ${e && this.sel === e.uid ? 'sel' : ''}" data-act="slot" data-slot="${s}" data-key="slot-${s}" style="${this.rarityStyle(e)}">
        <span class="slot-name">${SLOT_NAMES[s]}</span>
        <span class="slot-item">${e ? `<span style="color:${e.icon[1]}">${e.icon[0]}</span> ${esc(e.name)}${e.run ? ' <span class="run">*</span>' : ''}` : '<i>empty</i>'}</span></button>`;
    }).join('');
    const stats = statRows(this.game.player.stats).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    const sets = Object.entries(setCounts(st)).map(([id, n]) => `<div class="setline" style="color:${SETS[id].color}">${SETS[id].name} ${n}/6</div>`).join('');
    const items = this.sorted(st.allItems());
    const grid = items.length ? items.map((it) => this.itemCell(it)).join('') : '<div class="empty">Nothing here.</div>';
    return `<div class="inv-layout">
      <div class="inv-left"><div class="slots">${slots}</div><div class="stats">${stats}${sets}</div></div>
      <div class="inv-right">${this.filterBar()}<div class="grid">${grid}</div>
        <div class="legend"><span class="runbox"></span> warm loot — unbound until carried through a portal alive
          <button class="focusable small" data-act="salvageall" data-key="salvall">Salvage all Common</button></div>
        ${this.itemDetail()}</div>
    </div>`;
  }

  /** Item card + comparison with what you wear in that slot. */
  itemCard(d, f) {
    const R = d.rarity ? RARITY[d.rarity] : null;
    const lines = [];
    if (d.dmg) lines.push(`<div class="d-dmg">${d.dmg[0]}–${d.dmg[1]} damage · ${d.wtype}</div>`);
    if (d.stats) for (const [k, v] of Object.entries(d.stats)) { const l = statLabel(k, v); if (l) lines.push(`<div>${l}</div>`); }
    if (d.sockets && d.sockets.length) lines.push(`<div class="d-sock">${d.sockets.map((s) => s ? `<span style="color:${gemInfo(s).color}">◆ ${gemInfo(s).name}</span>` : '<span>◇ empty socket</span>').join(' ')}</div>`);
    let setTxt = '';
    if (d.set) { const S = SETS[d.set]; const have = setCounts(this.game.state)[d.set] || 0; setTxt = `<div class="d-set" style="color:${S.color}">${S.name} set (${have} worn): ${[2, 4, 6].map((t) => `<span class="${have >= t ? 'on' : ''}">${t}: ${Object.entries(S.bonus[t]).map(([k, v]) => statLabel(k, v) || '').filter(Boolean).join(', ')}${t === 6 ? ' ' + S.text6 : ''}</span>`).join(' · ')}</div>`; }
    return `<div class="d-name" style="${R ? `color:${d.cursed ? '#c080e0' : R.color}` : ''}"><span style="color:${d.icon[1]}">${d.icon[0]}</span> ${esc(d.name)} ${f && f.item.qty > 1 ? '×' + f.item.qty : ''}${f && f.run ? ' <span class="run">(warm)</span>' : ''}</div>
      <div class="d-kind">${R ? `<span style="color:${R.color}">${R.name}</span> · ` : ''}${d.kind === 'gear' ? SLOT_NAMES[d.slot] : d.kind[0].toUpperCase() + d.kind.slice(1)}${d.ilvl ? ` · item level ${d.ilvl}` : ''}${d.material ? ` · ${MATERIALS[d.material].name}` : ''} · sells for ${f ? sellPrice(f.item) : Math.floor(d.value / 2)}</div>
      <div class="d-stats">${lines.join('')}</div>${setTxt}
      ${d.curseText ? `<div class="d-curse">${esc(d.curseText)}</div>` : ''}
      <div class="d-desc">${esc(d.desc || '')}</div>
      ${d.lore || (f && ITEM_LORE[f.item.id]) ? `<div class="d-lore">${esc(d.lore || ITEM_LORE[f.item.id])}</div>` : ''}`;
  }

  compare(d) {
    if (!d || d.kind !== 'gear') return '';
    const st = this.game.state;
    const slot = d.slot === 'ring' ? 'ring1' : d.slot;
    const cur = st.equippedDefs()[slot];
    if (!cur || cur.uid === this.sel) return '';
    const keys = new Set([...Object.keys(d.stats || {}), ...Object.keys(cur.stats || {})]);
    const rows = [];
    if (d.dmg && cur.dmg) { const a = (d.dmg[0] + d.dmg[1]) / 2, b = (cur.dmg[0] + cur.dmg[1]) / 2; rows.push(`<span class="${a >= b ? 'up' : 'down'}">${a >= b ? '▲' : '▼'} ${Math.abs(a - b).toFixed(0)} avg damage</span>`); }
    for (const k of keys) {
      const dv = (d.stats[k] || 0) - ((cur.stats && cur.stats[k]) || 0);
      if (Math.abs(dv) < 0.05) continue;
      const l = statLabel(k, Math.abs(dv)); if (!l) continue;
      rows.push(`<span class="${dv > 0 ? 'up' : 'down'}">${dv > 0 ? '▲' : '▼'} ${l.replace(/^\+/, '')}</span>`);
    }
    return rows.length ? `<div class="d-compare">vs ${esc(cur.name)}: ${rows.join(' ')}</div>` : '';
  }

  itemDetail(mode) {
    const st = this.game.state;
    if (this.sel == null) return '<div class="detail muted">Select an item.</div>';
    const f = st.find(this.sel);
    if (!f) return '<div class="detail muted">Select an item.</div>';
    const d = defOf(f.item);
    const eqSlot = Object.entries(st.equipped).find(([, u]) => u === f.item.uid)?.[0];
    const btn = (act, label, extra = '') => `<button class="focusable" data-act="${act}" data-uid="${f.item.uid}" ${extra} data-key="${act}-${f.item.uid}">${label}</button>`;
    const btns = [];
    if (mode === 'sell') btns.push(btn('sell', `Sell for ${sellPrice(f.item)}`));
    else if (mode === 'stash') btns.push(btn('tostash', `Store in ${st.stash.names[this.stashTab]}`));
    else if (mode) btns.push(...this.serviceButtons(mode, f, d));
    else {
      if (d.kind === 'gear' && !eqSlot) btns.push(btn('equip', 'Equip'));
      if (eqSlot && eqSlot !== 'weapon') btns.push(`<button class="focusable" data-act="unequip" data-slot="${eqSlot}" data-key="unequip">Unequip</button>`);
      if (d.kind === 'consumable' || d.kind === 'cosmetic') btns.push(btn('use', d.map ? 'Use map' : d.kind === 'cosmetic' ? 'Apply' : 'Use'));
      if (d.kind === 'consumable' && !d.map) btns.push(btn('quick', 'Set as quick item'));
      if (f.item.id === 'gen') btns.push(btn('lock', d.locked ? 'Unlock' : 'Lock'));
      if (d.kind === 'gear' && !eqSlot && !d.locked) btns.push(btn('salvage', 'Salvage'));
    }
    return `<div class="detail">${this.itemCard(d, f)}${this.compare(d)}<div class="d-btns">${btns.join('')}</div></div>`;
  }

  // ------------------------------------------------------------ shops
  renderBuy() {
    const sid = this.shopId || 'market';
    const stock = this.game.shops.stock(sid);
    const st = this.game.state;
    const rows = stock.map((e) => {
      const d = e.id === 'gen' ? defOf(e) : ITEMS[e.id];
      const price = this.entryPrice(e);
      return `<button class="row-item focusable ${this.sel === e.key ? 'sel' : ''} ${st.saved.currency >= price ? '' : 'poor'}" style="${this.rarityStyle(d)}" data-act="stock" data-key="${e.key}">
        <span class="glyph" style="color:${d.icon[1]}">${d.icon[0]}</span>
        <span class="ri-name">${esc(d.name)}${e.id !== 'gen' && st.count(e.id) ? ` <small>(own ${st.count(e.id)})</small>` : ''}<small>${d.dmg ? d.dmg.join('–') + ' dmg · ' : ''}${d.ilvl && d.kind === 'gear' ? 'ilvl ' + d.ilvl : esc(d.desc || '').slice(0, 70)}</small></span>
        <span class="ri-price">${price}</span></button>`;
    }).join('') || '<div class="empty">Sold out until your next run.</div>';
    const disc = this.game.renown.discount;
    let detail = `<div class="detail muted">${disc ? `Your renown earns a ${disc}% discount. ` : ''}Stock improves with renown and depth, and is renewed after every run.</div>`;
    const e = stock.find((x) => x.key === this.sel);
    if (e) {
      const d = e.id === 'gen' ? defOf(e) : ITEMS[e.id];
      detail = `<div class="detail">${this.itemCard(d, null)}${this.compare(d)}<div class="d-btns"><button class="focusable" data-act="buy" data-key="${e.key}">Buy for ${this.entryPrice(e)} ashes</button></div></div>`;
    }
    return `<div class="shop-layout"><div class="rows">${rows}</div>${detail}</div>`;
  }

  renderSell() {
    const st = this.game.state;
    const items = this.sorted(st.saved.items.map((i) => ({ ...i, run: false })));
    const grid = items.length ? items.map((it) => this.itemCell(it)).join('') : '<div class="empty">Nothing to sell.</div>';
    return `<div class="shop-layout"><div>${this.filterBar()}<div class="grid">${grid}</div>
      <button class="focusable sellall" data-act="sellall" data-key="sellall">Sell all trinkets (relics & loot; crafting materials kept)</button></div>
      ${this.itemDetail('sell')}</div>`;
  }

  renderBuyback() {
    const bb = this.game.state.buyback;
    if (!bb.length) return '<div class="empty">Nothing sold recently.</div>';
    return `<div class="rows">${bb.map((b, i) => { const d = defOf(b.item); return `<button class="row-item focusable" data-act="buyback" data-i="${i}" data-key="bb${i}" style="${this.rarityStyle(d)}"><span class="glyph" style="color:${d.icon[1]}">${d.icon[0]}</span><span class="ri-name">${esc(d.name)}</span><span class="ri-price">${b.price}</span></button>`; }).join('')}</div>`;
  }

  /** Services that work on a selected item from your pack. */
  renderService(kind) {
    const st = this.game.state;
    const pick = (d) => d && d.kind === 'gear' && (kind !== 'upgrade' || d.gen) && (kind !== 'enchant' || (d.gen && d.rarity !== 'normal'));
    const items = this.sorted(st.allItems()).filter((it) => pick(defOf(it)));
    const grid = items.length ? items.map((it) => this.itemCell(it)).join('') : '<div class="empty">You carry nothing this service can work on.</div>';
    const intro = { upgrade: 'Upgrades raise damage / armour (+1 to +10). Ore of the item’s material is needed; above +5 the metal may refuse.', sockets: 'Set gems into sockets, take them out, or cut a new socket (max 3).', enchant: 'Reroll ONE affix on an item. The price rises every time.', salvage: 'Break gear into ore, essences and ashes.' }[kind];
    return `<div class="shop-layout"><div><div class="small">${intro}</div>${this.filterBar(false)}<div class="grid">${grid}</div></div>${this.itemDetail(kind)}</div>`;
  }

  serviceButtons(kind, f, d) {
    const st = this.game.state, it = f.item, out = [];
    const b = (act, label, extra = '') => `<button class="focusable" data-act="${act}" data-uid="${it.uid}" ${extra} data-key="${act}-${it.uid}-${label.length}">${label}</button>`;
    if (kind === 'upgrade') {
      if (!d.gen) return ['<div class="blocker">Old relics can’t be upgraded.</div>'];
      const c = this.game.shops.upgradeCost(d);
      out.push(b('upgrade', (d.upgrade || 0) >= 10 ? 'Maxed (+10)' : `Upgrade to +${(d.upgrade || 0) + 1}: ${c.ashes} ashes, ${c.oreN} ${ITEMS[c.ore].name} (have ${st.count(c.ore)})${c.chance < 1 ? `, ${Math.round(c.chance * 100)}% chance` : ''}`));
    } else if (kind === 'sockets') {
      if (!it.g) return ['<div class="blocker">No sockets on old relics.</div>'];
      it.g.s.forEach((s, i) => { if (s) out.push(b('unsocket', `Remove ${gemInfo(s).name}`, `data-i="${i}"`)); });
      if (it.g.s.includes(null)) for (const t of Object.keys(GEM_TYPES)) for (let gr = 4; gr >= 0; gr--) { const id = gemId(t, gr); if (st.count(id)) out.push(b('socket', `Set ${ITEMS[id].name} (${st.count(id)})`, `data-gem="${id}"`)); }
      if (it.g.s.length < 3) out.push(b('addsocket', `Cut a socket (${150 * (it.g.s.length + 1) * (1 + (d.ilvl || 1) / 10) | 0} ashes)`));
    } else if (kind === 'enchant') {
      const cost = this.game.shops.enchantCost(d, it.g);
      it.g.a.forEach(([id, v], i) => out.push(b('enchant', `Reroll "${statLabel(AFFIXES[id].stat, v)}" (${cost})`, `data-i="${i}"`)));
    } else if (kind === 'salvage') {
      const y = salvageYield(d);
      out.push(b('salvage', `Salvage: ${y.items.map(([id, n]) => `${n} ${ITEMS[id].name}`).join(', ')}, ${y.ashes} ashes`));
    }
    return out;
  }

  renderBrew() {
    const st = this.game.state;
    const rows = [];
    for (const t of ['hp', 'st', 'mp']) for (let gr = 0; gr < 4; gr++) {
      const from = `${t}_potion_${gr}`, to = `${t}_potion_${gr + 1}`;
      rows.push(`<button class="row-item focusable ${st.count(from) >= 3 ? '' : 'poor'}" data-act="brew" data-t="${t}" data-gr="${gr}" data-key="brew-${t}${gr}">
        <span class="glyph" style="color:${ITEMS[to].icon[1]}">⚗</span><span class="ri-name">3 × ${ITEMS[from].name} → ${ITEMS[to].name}<small>you have ${st.count(from)}</small></span><span class="ri-price">${20 + gr * 30}</span></button>`);
    }
    return `<div class="rows">${rows.join('')}</div>`;
  }

  renderCombine() {
    const st = this.game.state, rows = [];
    for (const t of Object.keys(GEM_TYPES)) for (let gr = 0; gr < 4; gr++) {
      const id = gemId(t, gr), n = st.count(id);
      if (!n) continue;
      rows.push(`<button class="row-item focusable ${n >= 3 ? '' : 'poor'}" data-act="combine" data-gem="${id}" data-key="cmb-${id}"><span class="glyph" style="color:${GEM_TYPES[t].color}">◇</span>
        <span class="ri-name">3 × ${ITEMS[id].name} → ${ITEMS[gemId(t, gr + 1)].name}<small>you have ${n}</small></span><span class="ri-price">${30 + gr * 60}</span></button>`);
    }
    return rows.length ? `<div class="rows">${rows.join('')}</div>` : '<div class="empty">You carry no gems. They drop in the Deeps, or buy them here.</div>';
  }

  renderCraft() {
    const st = this.game.state;
    const mats = ['rusted', 'iron', 'steel', 'blackiron', 'sunsteel', 'voidglass', 'hearthforged'];
    const ores = ['ore_iron', 'ore_iron', 'ore_steel', 'ore_blackiron', 'ore_sunsteel', 'ore_voidglass', 'ore_hearth'];
    const sel = this.craftBase || 'sword';
    const bases = [...WEAPON_BASES, ...ARMOR_BASES, ...ACC_BASES].map((b) => `<button class="focusable small ${b === sel ? 'on' : ''}" data-act="craftbase" data-b="${b}" data-key="cb-${b}">${BASES[b].name}</button>`).join('');
    const tiers = [1, 2, 3, 4, 5, 6].map((t) => `<button class="row-item focusable ${st.count(ores[t]) >= 3 + t ? '' : 'poor'}" data-act="craft" data-base="${sel}" data-tier="${t}" data-key="cr-${t}">
      <span class="glyph" style="color:#${MATERIALS[mats[t]].tint.toString(16).padStart(6, '0')}">⚒</span><span class="ri-name">${MATERIALS[mats[t]].name} ${BASES[sel].name}<small>${3 + t} × ${ITEMS[ores[t]].name} (have ${st.count(ores[t])}) · an essence in your pack improves the rarity odds</small></span><span class="ri-price">${60 + t * 90}</span></button>`).join('');
    return `<div class="craft"><div class="fbar wrap">${bases}</div><div class="rows">${tiers}</div></div>`;
  }

  renderGamble() {
    const p = this.game.shops.gamblePrice();
    return `<div class="rows">${[['weapon', 'Sealed weapon bundle'], ['armor', 'Sealed armour bundle'], ['acc', 'Sealed trinket box']].map(([c, l]) =>
      `<button class="row-item focusable" data-act="gamble" data-cat="${c}" data-key="gb-${c}"><span class="glyph">?</span><span class="ri-name">${l}<small>unidentified · better odds than a drop</small></span><span class="ri-price">${p}</span></button>`).join('')}</div>`;
  }

  renderWardrobe() {
    const st = this.game.state, cos = st.world.cosmetics;
    const owned = Object.keys(COSMETICS).filter((id) => st.count(id));
    if (!owned.length) return '<div class="empty">You own no cosmetics yet. Buy dyes and patterns here.</div>';
    return `<div class="rows">${owned.map((id) => { const c = COSMETICS[id]; const on = cos[c.type] === id; return `<button class="row-item focusable ${on ? 'sel' : ''}" data-act="cosmetic" data-id="${id}" data-key="cos-${id}"><span class="glyph" style="color:${ITEMS[id].icon[1]}">❀</span><span class="ri-name">${c.name}<small>${c.type === 'dye' ? 'your sleeves and slash trail' : c.type === 'portal' ? 'the portals of Emberwick' : 'your cloak (shown in the inventory and on your sleeves)'}</small></span><span class="ri-price">${on ? 'worn' : 'apply'}</span></button>`; }).join('')}</div>`;
  }

  renderCompanions() {
    const st = this.game.state, c = st.companions;
    const rows = Object.entries(COMPANIONS).map(([id, C]) => {
      const rec = c.hired[id];
      const late = C.late && (st.world.deepest || 0) < 20 && (this.game.restoration ? this.game.restoration.value : 0) < 60;
      const gear = rec ? ['weapon', 'armor', 'ring'].map((s) => { const f = st.find(rec.gear[s]); const d = f && defOf(f.item); return `<button class="focusable small" data-act="cgear" data-id="${id}" data-slot="${s}" data-key="cg-${id}-${s}">${s}: ${d ? esc(d.name) : '—'}</button>`; }).join('') : '';
      const perks = C.tree.map(([n, dsc], i) => `<span class="${rec && (rec.level || 1) >= [3, 6, 10][i] ? 'on' : ''}" title="${esc(dsc)}">Lv${[3, 6, 10][i]} ${n}</span>`).join(' · ');
      return `<div class="comp ${c.active === id ? 'active' : ''}">
        <div class="comp-name">${late ? '???' : C.name} <small>${late ? 'sits alone, hood up' : C.title}</small></div>
        <div class="small">${rec ? `Level ${rec.level || 1} · loyalty ${rec.loyalty || 0}${(rec.loyalty || 0) >= 8 ? (rec.questDone ? ' · quest done' : ` · QUEST: ${C.quest.text}`) : ' (8 for their personal quest)'} · "${esc(C.lines.idle)}"` : late ? 'Reach level 20 of the Deeps or heal the world to 60%.' : `HP ${C.hp} · damage ${C.dmg} · ${C.role}`}</div>
        <div class="small perks">${perks}</div>
        <div class="d-btns">${rec ? `<button class="focusable" data-act="bring" data-id="${id}" data-key="br-${id}">${c.active === id ? 'Leave behind' : 'Bring along'}</button>${gear}` : `<button class="focusable" data-act="hire" data-id="${id}" data-key="hi-${id}">Hire (${this.game.shops.price(C.cost)} ashes, once)</button>`}</div></div>`;
    }).join('');
    return `<div class="small">Bring one companion and one pet. Select an item in your Inventory first, then press a gear slot to hand it over (RUN gear is lost if you die). Orders: O / ORD button cycles follow → hold → attack my target → stay back. Downed companions: stand beside them for 3 s.</div><div class="comps">${rows}</div>`;
  }

  renderPets() {
    const st = this.game.state, c = st.companions;
    c.pets = c.pets || {};
    return `<div class="comps">${Object.entries(PETS).map(([id, P]) => `<div class="comp ${c.pet === id ? 'active' : ''}"><div class="comp-name">${P.name}</div><div class="small">HP ${P.hp} · damage ${P.dmg}${P.ranged ? ' · ranged' : ''}</div>
      <div class="d-btns">${c.pets[id] ? `<button class="focusable" data-act="bringpet" data-id="${id}" data-key="bp-${id}">${c.pet === id ? 'Leave home' : 'Bring along'}</button>` : `<button class="focusable" data-act="buypet" data-id="${id}" data-key="pp-${id}">Adopt (${this.game.shops.price(P.cost)})</button>`}</div></div>`).join('')}</div>`;
  }

  renderRumors() { return `<div class="small">Barkeep Hollis knows a little about everything.</div><button class="focusable" data-act="rumor" data-key="rumor">Buy Hollis a drink (hear a rumor)</button>`; }

  renderStash() {
    const st = this.game.state, t = st.stash.tabs[this.stashTab];
    const tabs = st.stash.names.map((n, i) => `<button class="focusable ${i === this.stashTab ? 'on' : ''}" data-act="stashtab" data-t="${i}" data-key="st-${i}">${n} (${st.stash.tabs[i].length}/48)</button>`).join('');
    const stored = t.map((it) => { const d = defOf(it); return d ? `<button class="cell focusable" style="${this.rarityStyle(d)}" data-act="fromstash" data-uid="${it.uid}" data-key="sx${it.uid}" title="${esc(d.name)} (take)"><span class="glyph" style="color:${d.icon[1]}">${d.icon[0]}</span>${it.qty > 1 ? `<span class="qty">${it.qty}</span>` : ''}</button>` : ''; }).join('') || '<div class="empty">Empty.</div>';
    const mine = this.sorted(st.saved.items.map((i) => ({ ...i, run: false }))).map((it) => this.itemCell(it)).join('');
    return `<div class="fbar">${tabs}</div><div class="stash-layout"><div><div class="small">In the stash (tap to take):</div><div class="grid">${stored}</div></div>
      <div><div class="small">Your pack (select, then store):</div>${this.filterBar(false)}<div class="grid">${mine}</div>${this.itemDetail('stash')}</div></div>`;
  }

  renderAscension() {
    const st = this.game.state, A = st.ascension;
    const can = (st.world.bosses.hollow_king || 0) > 0 || st.world.conquered[30];
    const opts = [['damagePct', '+3% damage'], ['maxHpPct', '+3% max HP'], ['critChance', '+1% crit'], ['speedPct', '+1% move speed'], ['ashPct', '+5% ashes'], ['cdrPct', '+1% cooldowns']];
    return `<div class="asc"><div class="rank-title">Ascension ${A.level}</div>
      <div class="small">After the Hollow King falls you may ascend: your level resets to 1, you keep all gear and skills, and gain 3 permanent Ascension points. Every enemy becomes 30% tougher per Ascension.</div>
      <button class="focusable" data-act="ascend" data-key="ascend" ${can ? '' : 'disabled'}>${can ? 'Ascend (needs level 30)' : 'Fell the Hollow King first'}</button>
      <div class="small">Unspent points: ${A.points}</div>
      <div class="rows">${opts.map(([k, l]) => `<button class="row-item focusable" data-act="ascpt" data-k="${k}" data-key="ap-${k}"><span class="ri-name">${l}<small>taken ${A.spent[k] || 0}×</small></span><span class="ri-price">+</span></button>`).join('')}</div></div>`;
  }

  renderRespec() {
    const st = this.game.state, c = respecCost(st.progression);
    return `<div class="small">Unlearn every path and get your points back. The price rises each time (${st.progression.respecs || 0} so far).</div>
      <button class="focusable" data-act="respec" data-key="respec">Respec for ${c} ashes</button>`;
  }

  // ------------------------------------------------------------ the skill web
  renderTree(canLearn) {
    const st = this.game.state, prog = st.progression, ren = this.game.renown;
    if (!this.zoom) this.zoom = Math.min(0.62, Math.max(0.32, window.innerWidth * 0.55 / TREE_W));
    const z = this.zoom, W = TREE_W, H = TREE_H, flt = this.treeFilter;
    const dim = (n) => flt !== 'all' && n.branch !== flt && n.branch !== 'root' && !(n.branch === 'hybrid' && n.id.includes(flt));
    const lines = [];
    for (const n of SKILLS) for (const r of n.requires) {
      const a = SKILL_MAP[r];
      const lit = rankOf(prog, r) > 0 && rankOf(prog, n.id) > 0, open = rankOf(prog, r) > 0;
      lines.push(`<line x1="${a.x}" y1="${a.y}" x2="${n.x}" y2="${n.y}" class="${lit ? 'lit' : open ? 'open' : ''} ${n.anyOf ? 'any' : ''}" style="${lit ? `stroke:${BRANCHES[n.branch].color}` : ''}${dim(n) ? ';opacity:0.15' : ''}"/>`);
    }
    const nodes = SKILLS.map((n) => {
      const r = rankOf(prog, n.id);
      const state = r >= n.max ? 'max' : r > 0 ? 'part' : isOpen(prog, n) ? 'avail' : 'locked';
      const pips = n.max > 1 ? `<span class="pips">${'◆'.repeat(r)}${'◇'.repeat(n.max - r)}</span>` : '';
      const lock = n.rank && ren.rankIndex < n.rank ? '<span class="klock">♕</span>' : '';
      const act = n.active ? `<span class="act">${ACTIVES[n.active].icon}</span>` : '';
      return `<button class="node focusable ${state} ${n.keystone ? 'cap' : ''} ${n.branch === 'hybrid' ? 'hyb' : ''} ${n.active ? 'activ' : ''} ${this.sel === n.id ? 'sel' : ''} ${dim(n) ? 'dim' : ''}" style="left:${n.x}px;top:${n.y}px;--c:${BRANCHES[n.branch].color}"
        data-act="node" data-id="${n.id}" data-key="n-${n.id}" data-name="${esc(n.name.toLowerCase())}" title="${esc(n.name + ' — ' + n.desc)}">${lock}${act}<span class="nn">${esc(n.name)}</span>${pips}</button>`;
    }).join('');
    const labels = PATH_ORDER.map((b, i) => {
      const a = (i / PATH_ORDER.length) * Math.PI * 2 - Math.PI / 2, r = 1170;
      return `<div class="branch-label" style="left:${TREE_W / 2 + Math.cos(a) * r}px;top:${TREE_H / 2 + Math.sin(a) * r}px;color:${BRANCHES[b].color}" title="${esc(BRANCHES[b].desc)}">${BRANCHES[b].name}</div>`;
    }).join('');
    let detail = `<div class="detail muted">${canLearn ? 'The old master waits. Choose a path.' : 'Skills can only be learned at the Hall of Paths, in town.'}<br><small>Drag to pan · pinch or +/- to zoom · search or filter a path.</small></div>`;
    if (this.sel && SKILL_MAP[this.sel]) {
      const n = SKILL_MAP[this.sel];
      const r = rankOf(prog, n.id);
      const why = learnBlocker(prog, n, st.saved.currency, ren.rankIndex, (i) => RANKS[i].title);
      let btn = '';
      if (canLearn) btn = why ? `<div class="blocker">${esc(why)}</div>` : `<button class="focusable" data-act="learn" data-id="${n.id}" data-key="learn">Learn (${n.points} pt${n.points > 1 ? 's' : ''}${n.fee ? `, ${n.fee} ashes` : ''})</button>`;
      else if (r < n.max) btn = '<div class="blocker">Visit the Hall of Paths in town to learn this.</div>';
      if (n.active && r > 0) btn += `<div class="barset">Skill bar: ${[0, 1, 2, 3].map((i) => `<button class="focusable small ${st.skillbar[i] === n.active ? 'on' : ''}" data-act="bar" data-id="${n.id}" data-i="${i}" data-key="bar${i}">${i + 1}</button>`).join('')}</div>`;
      const A = n.active && ACTIVES[n.active];
      detail = `<div class="detail"><div class="d-name" style="color:${BRANCHES[n.branch].color}">${esc(n.name)} ${n.max > 1 ? `<small>rank ${r}/${n.max}</small>` : r ? '<small>learned</small>' : ''}</div>
        <div class="d-kind">${BRANCHES[n.branch].name}${n.keystone ? ` · keystone (renown: ${RANKS[n.rank].title})` : ''} · ${n.points} pt${n.points > 1 ? 's' : ''}${n.fee ? ` + ${n.fee} ashes` : ''}</div>
        <div class="d-desc">${esc(n.desc)}${A ? ` ${A.cost} mana, ${A.cd}s cooldown.` : ''}</div>
        ${n.branch !== 'hybrid' && n.branch !== 'root' ? `<div class="d-lore">${esc(BRANCHES[n.branch].desc)}</div>` : ''}<div class="d-btns">${btn}</div></div>`;
    }
    const opts = ['all', ...PATH_ORDER].map((b) => `<option value="${b}" ${flt === b ? 'selected' : ''}>${b === 'all' ? 'All paths' : BRANCHES[b].name}</option>`).join('');
    return `<div class="tree-layout">
      <div class="tree-view" id="tree-view">
        <div class="tree-tools"><input id="tree-search" class="focusable" placeholder="search skills" value="${esc(this.search)}"><select id="tree-filter" class="focusable">${opts}</select>
          <button class="focusable" data-act="zoom" data-z="out" data-key="zout">−</button><button class="focusable" data-act="zoom" data-z="in" data-key="zin">+</button></div>
        <div class="tree-sizer" style="width:${W * z}px;height:${H * z}px">
          <div class="tree" style="width:${W}px;height:${H}px;transform:scale(${z})">
            <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${lines.join('')}</svg>${labels}${nodes}</div></div></div>
      ${detail}</div>`;
  }

  highlightSearch() {
    const q = this.search.trim().toLowerCase();
    let first = null;
    for (const el of this.root.querySelectorAll('.node')) {
      const hit = q && el.dataset.name.includes(q);
      el.classList.toggle('found', !!hit);
      if (hit && !first) first = el;
    }
    const v = this.root.querySelector('#tree-view');
    if (first && v) { const z = this.zoom; v.scrollLeft = parseFloat(first.style.left) * z - v.clientWidth / 2; v.scrollTop = parseFloat(first.style.top) * z - v.clientHeight / 2; }
  }

  /** Centre the web on first open, keep scroll after; drag-to-pan and pinch zoom. */
  afterRender(prevScroll) {
    const v = this.root.querySelector('#tree-view');
    if (!v) return;
    if (prevScroll) { v.scrollLeft = prevScroll[0]; v.scrollTop = prevScroll[1]; }
    else { v.scrollTop = (v.scrollHeight - v.clientHeight) / 2; v.scrollLeft = (v.scrollWidth - v.clientWidth) / 2; }
    if (this.search) this.highlightSearch();
    v.onwheel = (e) => { if (!e.ctrlKey) return; e.preventDefault(); this.act('zoom', { z: e.deltaY < 0 ? 'in' : 'out' }); };
    let drag = null;
    v.onmousedown = (e) => { if (e.target.closest('.node, input, select, button')) return; drag = { x: e.clientX, y: e.clientY, l: v.scrollLeft, t: v.scrollTop }; };
    v.onmousemove = (e) => { if (!drag) return; v.scrollLeft = drag.l - (e.clientX - drag.x); v.scrollTop = drag.t - (e.clientY - drag.y); };
    v.onmouseup = v.onmouseleave = () => { drag = null; };
    let pinch = null;
    v.ontouchstart = (e) => { if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); };
    v.ontouchmove = (e) => {
      if (e.touches.length !== 2 || !pinch) return;
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (Math.abs(d - pinch) > 40) { this.act('zoom', { z: d > pinch ? 'in' : 'out' }); pinch = d; }
    };
  }

  renderLevels() {
    const g = this.game, w = g.state.world, conq = w.conquered || {};
    const plv = g.state.progression.level;
    const row = (L, label) => {
      const dz = dangerFor(L, g), rec = recommendedLevel(L);
      const story = STORY_LEVELS[L];
      const band = BIOMES[bandFor(L)];
      const crown = conq[L] ? '<span class="crown" title="Conquered">\u265B</span>' : '';
      return `<div class="lv-row"><span class="lv-dot" style="color:${dz.color}" title="${dz.label}">${dz.icon}</span>
        <span class="lv-name">${crown}${label || 'Level ' + L} <small>${esc(bandFor(L) === 'crypt' ? 'The Catacombs' : band.title)}${story ? ' \u00B7 ' + esc(g.enemyName(story)) : ''}</small></span>
        <span class="lv-rec">rec. Lv ${rec}${plv < rec - 8 ? ' \u2620' : ''}</span>
        <button class="focusable" data-act="enter" data-level="${L}" data-cq="0" data-key="lv${L}">Enter</button>
        <button class="focusable cq" data-act="enter" data-level="${L}" data-cq="1" data-key="cq${L}" title="+150% HP/damage, more elites, traps, no shrines; kill everything">Conquest</button></div>`;
    };
    const rows = g.startableLevels().map((L) => row(L)).join('');
    const abyss = (w.abyssBest || 0) > 30 || conq[30] ? row(31, 'The Abyss (depth 31)') : '';
    return `<div class="levels">
      <div class="small">Difficulty never changes per level: early levels grow easy to farm, deep ones outscale you until you level and gear up.
        Your power: Lv ${plv}${g.state.ascension && g.state.ascension.level ? ' \u00B7 Ascension ' + g.state.ascension.level : ''}. Deepest: ${w.deepest || 0}${w.abyssBest ? ' \u00B7 Abyss best ' + w.abyssBest : ''}.
        Conquer a level (kill every enemy in Conquest) to start at the next one.</div>
      <div class="lv-legend"><span style="color:#70c060">\u25CF safe</span> <span style="color:#e0c050">\u25CF fair</span> <span style="color:#e05040">\u25CF dangerous</span> <span>\u2620 deadly</span> \u00B7 \u265B conquered</div>
      ${rows}${abyss}</div>`;
  }
  renderPit() {
    const g = this.game, w = g.state.world, best = w.pitBest || {};
    const max = Math.max(1, w.deepest || 1);
    const tiers = [];
    for (let t = 1; t <= max; t++) tiers.push(t);
    const rows = tiers.reverse().map((t) => {
      const dz = dangerFor(t, g);
      return `<div class="lv-row"><span class="lv-dot" style="color:${dz.color}">${dz.icon}</span>
        <span class="lv-name">Tier ${t} <small>enemies of level ${t}+ \u00B7 loot item level ${t}+</small></span>
        <span class="lv-rec">best wave: ${best[t] || '-'}</span>
        <button class="focusable" data-act="pittier" data-tier="${t}" data-key="pt${t}">Fight</button></div>`;
    }).join('');
    return `<div class="levels"><div class="small">Waves grow harder; every 5th is elite, every 10th brings a guardian. Between waves you may leave and keep the loot. Death loses it. Tiers unlock with your deepest main-dungeon level.</div>${rows}</div>`;
  }
  renderStatus() {
    const r = this.game.renown.info();
    const parts = r.parts.map(([k, v, note]) => `<div><span>${k} <small>${note}</small></span><b>+${v}</b></div>`).join('');
    const ladder = RANKS.map((rk, i) => `<div class="ladder-step ${i <= r.index ? 'got' : ''} ${i === r.index ? 'cur' : ''}"><b>${rk.title}</b><span>${rk.min}</span></div>`).join('');
    const perks = [
      `Shop discount: ${this.game.renown.discount}%`,
      `Keystone skills: ${r.index >= 4 ? 'all' : r.index >= 3 ? 'tier II' : r.index >= 2 ? 'tier I' : 'locked (needs Slayer)'}`,
      `Castle: ${r.index >= 5 ? 'the King\'s private errands' : r.index >= 4 ? 'throne room + audience with the King' : r.index >= 3 ? 'great hall' : r.index >= 1 ? 'courtyard' : 'gates closed (needs Wanderer)'}`,
    ];
    return `<div class="status-layout">
      <div class="status-main">
        <div class="rank-title">${r.rank.title}</div>
        <div class="small">In Emberwick they call you "${RANK_EPITHET[r.index]}".</div>
        <div class="rank-score">${r.score} renown${r.next ? ` · ${r.next.min - r.score} to ${r.next.title}` : ' · highest rank'}</div>
        <div class="rank-bar"><span style="width:${Math.round(r.progress * 100)}%"></span></div>
        <div class="stats rank-parts">${parts}</div>
        <div class="small">Renown never falls, even in death. Gear does not count — only deeds.</div>
      </div>
      <div class="status-side"><div class="ladder">${ladder}</div><ul class="perks">${perks.map((p) => `<li>${p}</li>`).join('')}</ul></div>
    </div>`;
  }
  renderJournal() {
    const found = this.game.journal.found;
    if (!found.length) return '<div class="empty">No notes yet. Search bookshelves, chests and the remains of those who went before.</div>';
    const items = found.map((id) => NOTE_MAP[id]).filter(Boolean).map((n) => `<div class="note"><div class="note-title">${esc(n.title)}</div><div class="note-text">\u201C${esc(n.text)}\u201D</div></div>`).join('');
    return `<div class="journal"><div class="small">${found.length} of ${NOTES.length} fragments found</div>${items}</div>`;
  }}
