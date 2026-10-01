/** "2021 · Denis Villeneuve", leaving out whatever is unknown. */
export const metaLine = (item) => [item.year, item.creator].filter(Boolean).join(' · ');

/** 155 → "2h 35m", 120 → "2h", 45 → "45m"; nothing when it isn't known. */
export function formatRuntime(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ');
}

/** Newest first: finished items by when they were finished, pending ones by when they were added. */
export const byRecent = (a, b) => (b.finishedAt ?? b.addedAt) - (a.finishedAt ?? a.addedAt);
