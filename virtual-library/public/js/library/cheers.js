// What the app says when you finish something (Pending → Done), per category.
// Picks one at random, never the same one twice in a row.

const CHEERS = {
  movie: [
    { emoji: '🍿', title: 'Credits rolled!', line: 'Popcorn status: tragically gone.' },
    { emoji: '🎬', title: "That's a wrap!", line: 'Your couch has a permanent you-shaped dent. Worth it.' },
    { emoji: '🏆', title: 'And the award goes to… you!', line: 'For outstanding achievement in sitting still.' },
    { emoji: '🎞️', title: 'Movie watched!', line: 'No spoilers were harmed in the making of this moment.' },
  ],
  series: [
    { emoji: '📺', title: 'Binge complete!', line: 'Drink some water. Maybe look at the sun.' },
    { emoji: '🛋️', title: 'Series finale: you!', line: '"Are you still watching?" Yes. Yes you were.' },
    { emoji: '😴', title: 'All episodes down!', line: 'Your sleep schedule sends its regards.' },
    { emoji: '🎉', title: 'Show finished!', line: 'Time to find a new one to ruin your weekends.' },
  ],
  book: [
    { emoji: '📚', title: 'The End!', line: 'Your bookmark is officially unemployed.' },
    { emoji: '🦉', title: 'Book conquered!', line: 'Your brain grew three sizes today.' },
    { emoji: '✨', title: 'Another one read!', line: 'Your to-read pile trembles in fear.' },
    { emoji: '🕯️', title: 'Last page turned!', line: '"Just one more chapter" finally ran out of chapters.' },
  ],
  comic: [
    { emoji: '💥', title: 'KA-POW!', line: 'Another one bites the panel.' },
    { emoji: '💬', title: 'To be continued… not!', line: 'That cliffhanger has nothing left on you.' },
    { emoji: '🦸', title: 'Heroic reading!', line: 'Your spine-to-shelf ratio is legendary.' },
    { emoji: '🖋️', title: 'Last panel read!', line: 'Right to left, left to right: you read it all.' },
  ],
  game: [
    { emoji: '🎮', title: 'GG!', line: 'Achievement unlocked: actually finished a game.' },
    { emoji: '🏆', title: 'Victory!', line: 'Your backlog lost a soldier today.' },
    { emoji: '👾', title: 'Final boss defeated!', line: 'Your controller deserves a nap.' },
    { emoji: '💾', title: 'Game complete!', line: 'Roll the credits. Skip nothing. You earned this.' },
  ],
};

let last = null;

/** { emoji, title, line } for finishing something in this category. */
export function cheerFor(category) {
  const options = CHEERS[category] ?? CHEERS.movie;
  const fresh = options.filter((c) => c !== last);
  last = fresh[Math.floor(Math.random() * fresh.length)];
  return last;
}
