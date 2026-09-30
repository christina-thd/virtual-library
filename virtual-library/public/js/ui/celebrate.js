// A celebration: a burst of confetti and a card with a message, on top of everything.
// The page needs <div class="cheer" id="cheer"></div>. Tapping the card dismisses it.
import { $, escapeHtml } from '../shared/dom.js';

const PIECES = 48;
const SHOW_MS = 3600;

let timer = null;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Confetti shot up from the middle of the screen, falling in the given colors. */
function confetti(colors) {
  const burst = document.createElement('div');
  burst.className = 'confetti';
  burst.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < PIECES; i++) {
    const piece = document.createElement('i');
    const angle = (Math.random() - 0.5) * Math.PI * 0.9;          // spread around straight up
    const power = 200 + Math.random() * 260;
    piece.style.setProperty('--dx', `${Math.sin(angle) * power}px`);
    piece.style.setProperty('--dy', `${-Math.cos(angle) * power * 0.6}px`);
    piece.style.setProperty('--fall', `${260 + Math.random() * 360}px`);
    piece.style.setProperty('--spin', `${(Math.random() - 0.5) * 1080}deg`);
    piece.style.setProperty('--delay', `${Math.random() * 120}ms`);
    piece.style.background = colors[i % colors.length];
    if (i % 3 === 0) piece.classList.add('round');
    burst.append(piece);
  }
  document.body.append(burst);
  setTimeout(() => burst.remove(), 2200);
}

/**
 * @param {{ emoji: string, title: string, line: string }} message
 * @param {string[]} colors   confetti colors (CSS colors)
 */
export function celebrate({ emoji, title, line }, colors) {
  const card = $('cheer');
  card.innerHTML = `
    <span class="cheer-emoji" aria-hidden="true">${emoji}</span>
    <span class="cheer-text"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(line)}</span></span>`;
  card.classList.remove('show');
  void card.offsetWidth;                            // restart the entrance if one is still showing
  card.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => card.classList.remove('show'), SHOW_MS);
  if (!reducedMotion()) confetti(colors);
}

export function installCelebrate() {
  $('cheer').addEventListener('click', () => {
    clearTimeout(timer);
    $('cheer').classList.remove('show');
  });
}
