/** "2021 · Denis Villeneuve", leaving out whatever is unknown. */
export const metaLine = (item) => [item.year, item.creator].filter(Boolean).join(' · ');

/** Newest first: finished items by when they were finished, pending ones by when they were added. */
export const byRecent = (a, b) => (b.finishedAt ?? b.addedAt) - (a.finishedAt ?? a.addedAt);
