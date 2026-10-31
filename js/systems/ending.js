// ENDING STUB (no ending yet - hints only for now).
//
// The truth: King Aldric Vael died on the night of the Sundering. The king on
// the throne is his refusal to die, held together by the Veiled's stolen hour
// (the Hearth). His true remains - the HOLLOW KING - lie at the bottom of the
// Catacombs, still dying inside an hour that never ends.
//
// The future final descent offers one choice:
//   'extinguish' - put out the Hearth: time returns, Emberwick dies, the world heals.
//   'succeed'    - take the Hollow King's place: Emberwick lives forever, unchanged.
export const ENDINGS = {
  extinguish: { id: 'extinguish', title: 'Let the Hour End', summary: 'Put out the Hearth. Time returns. Emberwick ages four hundred years in a breath. The world heals.' },
  succeed: { id: 'succeed', title: 'Keep the Hour', summary: 'Take the Hollow King\'s place in the dark. Emberwick lives forever, unchanged.' },
};

/** Requirements for reaching the choice (to be implemented with the final descent). */
export function endingAvailable(state) {
  return false; // e.g. deepest > 5 && all five bosses beaten && renown rank King's Blade
}

export function chooseEnding(game, id) {
  // TODO: final descent area (the Hollow King), cinematic, credits, new-game+.
  console.warn('Ending not implemented yet:', id);
}
