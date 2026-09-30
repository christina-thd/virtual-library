// The grid of covers, or a message when there's nothing to show.
import { $, escapeHtml } from '../shared/dom.js';
import { byRecent } from '../shared/format.js';
import { categoryOf } from '../shared/library.js';
import { coverHtml } from '../ui/cover.js';
import { icon } from '../ui/icons.js';
import { starsHtml } from '../ui/stars.js';

function cardHtml(item, index) {
  const meta = item.rating ? starsHtml(item.rating) : escapeHtml(item.year ?? '');
  return `
    <button type="button" class="card" data-item="${item.id}" style="--i:${Math.min(index, 20)}">
      ${coverHtml(item)}
      <div class="card-title">${escapeHtml(item.title)}</div>
      <div class="card-meta">${meta}</div>
    </button>`;
}

function emptyHtml({ category, status, inCategory }) {
  const kind = categoryOf(category).plural.toLowerCase();
  const [title, hint] = !inCategory
    ? [`No ${kind} yet`, 'Tap + to hoard your first one.']
    : status === 'pending'
      ? ['Nothing pending', 'All caught up. Tap + to add something new.']
      : [`No finished ${kind} yet`, 'Things you mark as done show up here, with your rating.'];
  return `${icon(category)}<h2>${title}</h2><p>${hint}</p>`;
}

/**
 * Renders `items` (one category and status), newest first.
 * `animate` plays the cards' entrance, when the shelf is opened and when the tab changes.
 */
export function renderShelf(items, context, { animate = false } = {}) {
  const shelf = $('shelf');
  const empty = $('empty');
  const sorted = [...items].sort(byRecent);

  shelf.innerHTML = sorted.map(cardHtml).join('');
  shelf.classList.toggle('still', !animate);
  empty.hidden = sorted.length > 0;
  if (!sorted.length) empty.innerHTML = emptyHtml(context);
}
