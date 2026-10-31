// All lore text for Dungen Killer lives here. Short, sad, understated.
// Canon: the world burned; Emberwick survives inside one stolen, stilled hour,
// held by the Hearth. Below lie the Deeps - the remains of the old realm Aurelan.

export const WORLD = {
  town: 'Emberwick',
  townLine: 'one hour, held still',
  hearth: 'the Hearth',
  realm: 'Aurelan',
  title: 'Emberwick holds one hour. Feed the fire.',
  deathSub: 'The Hearth gathers your ash. What you found below stays below.',
  warmLoot: 'Warm loot - unbound until carried through a portal alive',
};

/** Area banners: name + one flavour line. */
export const AREA_LORE = {
  town: { name: 'Emberwick', line: 'one hour, held still' },
  castle: { name: 'The King\'s Castle', line: 'the hearth-fire burns in the great hall, and does not flicker' },
  dungeon: { name: 'The Catacombs', line: 'royal crypts of the Line of Vael, descending toward the root of the fire' },
  crypt: { name: 'The Shifting Depths', line: 'time below is so broken the land rearranges between visits' },
  forest: { name: 'The Weeping Wood', line: 'the royal hunting forest. The trees died standing, and still drip black sap' },
  jungle: { name: 'The Verdant Maw', line: 'the southern colonies, where Sundering heat made things grow without stopping' },
  swamp: { name: 'The Drowned Quarter', line: 'the flooded lower city. The bells still ring under the water' },
  frozen: { name: 'The Rimewastes', line: 'northern holdfasts, frozen in the ash-winter. The soldiers are still at their posts' },
  mine: { name: 'The Kilnworks', line: 'where the fire was woken. It still burns. The Choir still sings' },
  rootbound: { name: 'The Rootbound Ossuary', line: 'roots found the dead before the priests did, and kept them' },
  cathedral: { name: 'The Cinder Cathedral', line: 'the Choir\u2019s mother-church. The candles were never lit; they were always burning' },
  kennels: { name: 'The Hound Pits', line: 'where the King\u2019s beasts were bred for a war that came from below' },
  sunken: { name: 'The Sunken Palace', line: 'the old seat of the Line of Vael, under a sea that should not be this deep' },
  court: { name: 'The Hollow Court', line: 'the throne beneath the throne. Someone has been sitting in it for four hundred years' },
  abyss: { name: 'The Abyss', line: 'below the root of the fire there is no time at all. It will never heal' },
  pit: { name: 'The Proving Pit', line: 'the Oathguard trained here once. The sand remembers every fall' },
};

/** Boss title cards (on encounter) and last words (on death). */
export const BOSS_LORE = {
  grave_warden: { title: 'Sir Corvane, First Shield of the Oathguard', sub: 'still keeping a vow he forgot the reason for', death: '"Pass, then. Someone must."' },
  brood_mother: { title: 'The Brood Mother', sub: 'grown vast on the deep fire\'s warmth, fed the dead until there were no more', death: 'Silence. One by one, her eggs go dark.' },
  ashen_abbot: { title: 'Merrow, the Ashen Abbot', sub: 'who lit the Sundering, and believes one more song will finish it', death: '"The song... was nearly done."' },
  kings_hound: { title: 'The Hollow King\'s Hound', sub: 'a king\'s crest burned into its hide, older than the King\'s, and cracked', death: 'A long howl. Far below, something answers.' },
  hollow_king: { title: 'The Hollow King', sub: 'Aldric\u2019s true form \u2014 what sat the throne while the Hearth held the hour', death: '"Let it... run, then. Let it all run."' },
  drowned_lord: { title: 'Prince Edric Vael, the Drowned Lord', sub: 'the king\'s brother, left behind when the flood gates closed', death: '"Tell my brother... the water was cold."' },
};

/** Renown ranks as people say them. Gear never counts - it's only warm loot that survived. */
export const RANK_EPITHET = ['another one', 'the new one', 'the one who came back', 'Hearth-sworn', 'the Ash-bearer', 'the King\'s own'];

/** What ordinary folk of Emberwick say, by renown rank (0-5). */
export const FOLK_LINES = [
  ['...', 'Another one. Mind the fire.', 'Hm.'],
  ['The new one. You\'ll learn the way of it.', 'Welcome to Emberwick. Nothing changes here. That\'s the point.'],
  ['You\'re the one who came back. Most don\'t, the first few times.', 'They say you went deep and walked out again.'],
  ['Hearth-sworn. The fire burns easier with you about.', 'The great hall will have you now. Don\'t let it go to your head.'],
  ['The Ash-bearer! The King himself will see you.', 'Ash-bearer. Feed the fire, and the fire remembers you.'],
  ['The King\'s own. I... yes. Of course. Anything.', 'King\'s own. They say you\'ve seen what he hasn\'t told us.'],
];

/** Named townsfolk with their own voice (by rank where it matters). */
export const NPC_LINES = {
  merchant: ['I buy anything. I ask nothing. That is why I am still here.', 'Warm loot? Cold now, if you carried it through. Let\'s see it.', 'Ash for ash. The castle pays me, I pay you. The fire eats either way.'],
  master: ['Sit. My eyes are gone, but I hear the Deeps on you.', 'Iron, Ash, Shadow. I swore to all three. All three cast me out. Learn from both halves of that.', 'The first Wanderers... I heard one of them, once. Below. Calling a name I did not know.', 'Skill is memory. The Hearth keeps memory. That is why what I teach you survives your deaths.'],
  keeper: ['My animals don\'t age either. The fox has been a kit for four hundred years.', 'The owls are said to remember the world before. They look at you as if they know you.', 'Don\'t feed them ash. They don\'t need it. Only we do.'],
  servant: ['His Majesty? Oh, he doesn\'t eat. Not since before the fire.', 'We set his table every evening. Every evening it\'s the same evening.'],
  cook: ['Out of my kitchen unless you\'re hungry. Here - take a crust.', 'Bread doesn\'t go stale here. Nothing does. Still tastes of ash.'],
  prisoner: ['They say the Hound was once the King\'s favourite. Before.', 'Count the King\'s rings next time. He wears the old ones. The ones they buried.'],
  widow: ['My husband went below. He comes back sometimes. He doesn\'t know me.', 'Don\'t count your deaths, love. The ones who count are the ones who stop coming back.'],
  warden: ['The gate stays shut. There\'s nothing out there but the hour running out.', 'Through the portals, Wanderer. Not the gate.'],
  beggar: ['Ash for an old man? Not for me - for the fire. Always for the fire.', 'I was a Wanderer. I stopped. Now I don\'t remember why I started.'],
  smith: ['Sunsteel never cools. I\'ve been holding this blade to the anvil since the Sundering.', 'Bring me sunsteel and I\'ll... no. No one brings sunsteel back.'],
};

/** The King, by renown rank. He never mentions his brother. */
export const KING_LINES = [
  'Who let this one in? Come back when the realm knows your name.',
  'Another Wanderer. The fire thanks you for your ash. So do I.',
  'You come back more often than most. Good. The Hearth is hungry, and I pay well.',
  'Hearth-sworn. Emberwick stands because of hands like yours. Sit, if you like. The hour is long.',
  'Ash-bearer. Kneel - no, stand. I have few enough who still stand. Ask what you will.',
  'My own blade. There are things below I would have you find. Things that were mine. Bring them home... if they will come.',
];

/** Hearth heroes: other Wanderers. Some have died hundreds of times. Hint, never state. */
export const HERO_LINES = {
  'Ser Aldric': ['I swore an oath once. I still feel the shape of it, if not the words.', 'Three hundred and twelve. No - I told myself I\'d stop counting.', 'The Warden let me pass, once. I don\'t remember what was on the other side.', 'Guard the portals, they told me. I forget who told me.'],
  'Ysolde of the Pale': ['Sit with us. The fire is the only warm thing left.', 'Each time I come back, I keep a little less. I don\'t go below anymore.', 'I had a sister. I\'m sure I had a sister.', 'Your face is new. Keep it that way as long as you can.'],
  'Brann the Kindled': ['The Choir still sings in the Kilnworks. Some nights I sing along.', 'Fire doesn\'t lie. People do. The fire told me that.', 'Merrow was a good man, once. That\'s the worst of it.'],
  'Wren': ['The Weeping Wood remembers its hunters. Don\'t let it remember you.', 'I stopped going below. Now I just... watch the portals.', 'Every return, the sky\'s a different colour. Every return, I\'m a little less sure it\'s me coming home.'],
  'Brother Hale': ['The Hearth rebuilds you from ash. It doesn\'t always remember the shape.', 'Pray if you like. The fire listens. I don\'t know if anything else does.', 'I died in the bell tower. Woke here. The ring I\'d found was gone. It was never mine.', 'Walk with me a while. Walking keeps the mind in one piece.'],
  'Kestrel': ['Warm loot, cold hands. That\'s the trade.', 'Gear\'s just loot that survived. Everyone knows that. What survives of you?', 'I can steal anything. I tried to steal back an hour once. The Veiled beat me to it.'],
  'Dame Orsa': ['The Oathguard buried something under the catacombs. I swore on the Iron to never say what.', 'The great hall\'s fire doesn\'t flicker. Have you noticed? Not once.', 'Hearth-sworn, then. Wear it lightly. The Hearth weighs more than it looks.'],
  'Sergeant Brask': ['Eyes front. Nothing comes up from below. Nothing has to.', 'Forty years on the wall. Same hour. Same wall.'],
  'Lady Ysmay': ['The King walks these halls at night. There is no night. He walks them anyway.', 'Stand straight in the great hall. He notices.'],
  'Court Mage Orrin': ['The chronicles are complete except for one page. Someone tore it out. Someone careful.', 'Time is a fire, Wanderer. Ours is banked very low.'],
};

/**
 * Lore notes. Each is saved to the Lore Journal once found.
 * where: 'hearth' | 'town' | 'castle' | 'catacombs' | 'catacombs:N' | biome id | 'any'
 */
export const NOTES = [
  { id: 'n01', where: 'hearth', title: 'Carved above the Hearth', text: 'Feed the fire. Whatever else you forget, feed the fire.' },
  { id: 'n02', where: 'town', title: 'A Wanderer\'s scrawl', text: 'Day eleven below. Or forty. The sky changed when I got home, so the old woman knew before I did.' },
  { id: 'n03', where: 'mine', title: 'Choir hymn', text: 'Sunsteel does not cool. Abbot Merrow says neither will we.' },
  { id: 'n04', where: 'swamp', title: 'Scratched on a bell', text: 'I took a ring from the Drowned Quarter. Died at the bell tower. Woke at the fire with empty hands. The ring was never mine.' },
  { id: 'n05', where: 'castle', title: 'The Old Master', text: 'The Veiled stole an hour from the night. Fools ask what they did with it. Look around you.' },
  { id: 'n06', where: 'castle', title: 'Burnt letter, castle cells', text: 'Edric, forgive me. The gates had to close.' },
  { id: 'n07', where: 'jungle', title: 'Carved into a tree', text: 'The vines in the Maw move when no one is looking. The vines in the Maw move when everyone is looking.' },
  { id: 'n08', where: 'town', title: 'Under a pillow', text: 'Do not count your deaths. The ones who count are the ones who stop coming back.' },
  { id: 'n09', where: 'catacombs:4', title: 'Tomb inscription, level four', text: 'Here lies the Line of Vael. All of them. Even the one still breathing upstairs.' },
  { id: 'n10', where: 'town', title: 'Menagerie ledger', text: 'The owl looked at me like it knew my name from before. I don\'t remember having a name before.' },
  // --- the old world
  { id: 'n11', where: 'catacombs', title: 'Oathguard tablet', text: 'A vow spoken is a nail driven into the world. Speak carefully, or the world will hang crooked.' },
  { id: 'n12', where: 'catacombs:1', title: 'Oathguard note', text: 'We buried him. I swear on the Iron, we buried him.' },
  { id: 'n13', where: 'mine', title: 'Kiln ledger', text: 'Third smelting. The ore sings when it melts. The priests say that is a good sign.' },
  { id: 'n14', where: 'mine', title: 'Kiln ledger, later', text: 'The singing does not stop when the furnace goes out. We have stopped going out.' },
  { id: 'n15', where: 'catacombs', title: 'Veiled marking', text: 'One hour. Cut cleanly, wrapped in black, carried up the stair. Leave nothing to say who held it.' },
  { id: 'n16', where: 'forest', title: 'Huntsman\'s tally', text: 'Royal hunt, autumn. Two stags, one boar. The King laughed. The red moon rose early.' },
  { id: 'n17', where: 'forest', title: 'Carved in black sap', text: 'The trees did not fall. They are still waiting for someone to tell them to.' },
  { id: 'n18', where: 'frozen', title: 'Holdfast order', text: 'Hold the line until relieved. - Captain, Rime Gate. (There is no record of relief.)' },
  { id: 'n19', where: 'frozen', title: 'Frozen soldier\'s hand', text: 'Tell Mara the snow is pretty. Don\'t tell her the rest.' },
  { id: 'n20', where: 'swamp', title: 'Lower city notice', text: 'By order of the Crown, the flood gates will be sealed at the third bell. Residents of the lower city are to proceed upward.' },
  { id: 'n21', where: 'swamp', title: 'Under the notice, scratched', text: 'The third bell rang at the second.' },
  { id: 'n22', where: 'jungle', title: 'Colonial survey', text: 'Growth rate since the Sundering: incalculable. The surveyor before me was found inside a tree.' },
  { id: 'n23', where: 'jungle', title: 'Temple offering bowl', text: 'We asked the green to stop. It heard "grow".' },
  // --- the Sundering
  { id: 'n24', where: 'castle', title: 'Astrologer\'s warning', text: 'The King will die on the night of the red moon. I have checked it eleven times. I am not brave enough to tell him.' },
  { id: 'n25', where: 'castle', title: 'Royal decree', text: 'There will be no red moon. There will be no night at all, if need be. - Aldric Vael' },
  { id: 'n26', where: 'mine', title: 'Abbot Merrow\'s sermon', text: 'Night is only the fire sleeping. We shall wake it. We shall sing until morning never ends.' },
  { id: 'n27', where: 'catacombs', title: 'Crypt-keeper\'s rota', text: 'Feed the spider the third-row dead. Not the royals. Never the royals. (Ink changes.) The royals as well.' },
  // --- why things are as they are
  { id: 'n28', where: 'town', title: 'Hearth-keeper\'s rule', text: 'A stopped hour starves. Feed it ash from below, or time comes back all at once, four hundred years in a single breath.' },
  { id: 'n29', where: 'town', title: 'Child\'s rhyme', text: 'Down through the crack and up through the door, the sky turns over, the hour wants more.' },
  { id: 'n30', where: 'town', title: 'Wanderer\'s advice', text: 'What you find below is warm. Carry it through the portal alive and it cools, and then it is yours. Die with it and it stays where it was.' },
  { id: 'n31', where: 'town', title: 'Torn journal', text: 'I knew the old master\'s name once. I knew mine. I keep the fire fed and I do not go below anymore.' },
  { id: 'n32', where: 'castle', title: 'Hearth-keepers\' invoice', text: 'For the blessing of Always-Day upon the town: four hundred measures of ash. Paid by the Crown.' },
  // --- the hidden truth (hints only)
  { id: 'n33', where: 'castle', title: 'Library: On the Red Moon', text: 'The red moon rises once in four lifetimes. On that night the - [the last page has been torn out]' },
  { id: 'n34', where: 'castle', title: 'A servant\'s whisper', text: 'His Majesty hasn\'t eaten since before the fire. We set the plate anyway. It is always the same plate.' },
  { id: 'n35', where: 'castle', title: 'Note by the great mirror', text: 'Do not stand the King before this glass. He does not like what is not there.' },
  { id: 'n36', where: 'catacombs:3', title: 'Kennel master\'s record', text: 'The hound wears the royal crest. Branded the night of the red moon. The King\'s own hand, but older. Cracked.' },
  { id: 'n37', where: 'catacombs:5', title: 'Last Oathguard', text: 'At the bottom of the stair, something breathes in an hour that never ends. We sealed it. We swore. We did not say what.' },
  { id: 'n38', where: 'any', title: 'Wanderer\'s chalk', text: 'If you find this, I went down again. If I come back, I won\'t know I wrote it.' },
  { id: 'n39', where: 'any', title: 'Ash-stained page', text: 'The Hearth rebuilds you from ash. Ash does not remember everything it was.' },
  { id: 'n40', where: 'any', title: 'Scratched on a shield', text: 'The first Wanderers are still down here. Listen at the stairs. They are still counting.' },
  { id: 'n41', where: 'any', title: 'Veiled riddle', text: 'What did the thieves steal that you are standing in?' },
];

export const NOTE_MAP = Object.fromEntries(NOTES.map((n) => [n.id, n]));

/** Lore line for every special / rare / legendary item. */
export const ITEM_LORE = {
  warden_blade: 'Issued to the crypt-keepers. They kept it sharp long after there was anything to keep.',
  bone_cleaver: 'Butchers in the lower city used these. Then the water came.',
  scout_hood: 'Veiled scouts wore grey so the night would not notice them.',
  iron_coif: 'Oathguard recruits swore their first vow in this.',
  brigandine: 'Rivets of common iron. Someone wanted to be remembered as ordinary.',
  runner_coat: 'Couriers of Aurelan were paid by the hour. They ran very fast, near the end.',
  grip_gloves: 'Kiln-hands wore these to hold sunsteel. It burned through, eventually.',
  guard_gauntlets: 'The knuckles are worn smooth from knocking on a gate that never opened.',
  wind_ring: 'Breath was precious in the Kilnworks. This ring was worth a life there.',
  luck_ring: 'Every gravedigger in Emberwick claims to have found this ring first.',
  bloodletter: 'An Oathguard blade, turned. A vow broken bleeds forever.',
  frostbrand: 'Pulled from a holdfast gate in the Rimewastes. It still remembers the cold.',
  ember_crown: 'A Choir cantor\'s circlet. It hums, very quietly, a song with no end.',
  thorn_mail: 'Forged for a knight who swore no one would ever touch him. No one did.',
  vampire_grip: 'Veiled thieves took more than coin. This took the rest.',
  dancer_wraps: 'The Veiled danced on the last night. They knew it would not end.',
  reaper_ring: 'Worn by the crypt-keepers who fed the Brood Mother. Their stamina was legendary.',
  hunter_ring: 'Signet of the royal huntsmen. The Weeping Wood still waits for them.',
  kingsbane: 'Forged to kill a king who would not die. It is still waiting for the right one.',
  phoenix_heart: 'A Choir relic: the first ember of the Sundering, cooled into stone. It is not quite cold.',
  nameless_shroud: 'The Veiled who stole the hour wore shrouds without names. This is one of them. Its owner never came back for it.',
  colossus_fists: 'The Oathguard\'s first vow was spoken with these fists on the anvil. The world shook. It is still shaking.',
  ashen_kings_crown: 'The Line of Vael wore crowns of sunsteel. This one was buried. It did not want to be.',
  royal_signet: 'Aldric\'s seal. The wax impression shows a crest, unbroken. The one on the Hound is older.',
};

/** Shown on the death screen. */
export const DEATH_LINES = [
  'The Hearth gathers your ash. What you found below stays below.',
  'Skill is memory. The Hearth keeps memory.',
  'Warm loot never was yours. It stays where it fell.',
  'The fire calls you home. It always will.',
  'You wake beside the Hearth. The hour has not moved.',
];

/** Shown while travelling between areas. */
export const TIPS = [
  'Every five minutes below turns the town\'s sky once.',
  'Ash feeds the Hearth. The castle buys it; the whole town runs on it.',
  'Warm loot is unbound until you carry it through a portal alive.',
  'Renown cannot fall. Only deeds count - never gear.',
  'Roll through a telegraphed attack. The red ground is honest.',
  'The Old Master teaches the three Paths: Oathguard, Cinder Choir, and the Veiled.',
  'Feed the fire. Whatever else you forget, feed the fire.',
  'The Deeps rearrange themselves. The Catacombs do not.',
  'Shallow water slows you. Deep water does not let you in at all.',
];

/** Skill path names (the three old orders). */
export const PATHS = {
  iron: { name: 'The Oathguard', desc: 'Knights who believed a spoken vow binds the world itself.' },
  ash: { name: 'The Cinder Choir', desc: 'Priests who sang to the fire beneath the mountains.' },
  shadow: { name: 'The Veiled', desc: 'Thieves who once stole a single hour from the night, and hid it.' },
};

export function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
