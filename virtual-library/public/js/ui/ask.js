// A small sheet with a question and two answers, on top of the sheet that asked (e.g. "Save changes?" when closing
// an item with unsaved changes). The page needs the #askLayer markup (index.html).
import { $ } from '../shared/dom.js';
import { createSheet } from './sheet.js';

let resolveOpen = null;                            // the ask() waiting for an answer
let answer = null;

const sheet = createSheet($('askLayer'), {
  // answers once the sheet has gone (one step back in history), so whoever asked can close their own sheet next
  onClose: () => {
    resolveOpen?.(answer);
    resolveOpen = null;
  },
});

$('askLayer').addEventListener('click', (e) => {
  const button = /** @type {Element} */ (e.target).closest('[data-answer]');
  if (!button) return;
  answer = /** @type {HTMLElement} */ (button).dataset.answer;
  sheet.close();
});

/**
 * Asks a question. Resolves with the tapped answer's `id`, or null when it's swiped away (or back is pressed).
 * @param {{ title: string, yes: { id: string, label: string }, no: { id: string, label: string } }} question
 * @returns {Promise<string | null>}
 */
export function ask({ title, yes, no }) {
  answer = null;
  $('askTitle').textContent = title;
  $('askYes').textContent = yes.label;
  $('askYes').dataset.answer = yes.id;
  $('askNo').textContent = no.label;
  $('askNo').dataset.answer = no.id;
  return new Promise((resolve) => {
    resolveOpen = resolve;
    sheet.open();
  });
}
