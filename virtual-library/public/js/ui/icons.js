// Line icons (24×24, drawn with the current text color).

const PATHS = {
  movie: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21"/>',
  series: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="m8 3 4 4 4-4"/>',
  book: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v14H7.5A2.5 2.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-4"/>',
  game: '<path d="M6.5 11h4M8.5 9v4M15 12h.01M17.5 10h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-3.96 3.43l-.9 6.3a2.6 2.6 0 0 0 4.56 2.04L7.9 15h8.2l1.5 1.77a2.6 2.6 0 0 0 4.56-2.04l-.9-6.3A4 4 0 0 0 17.3 5z"/>',
  back: '<path d="m14.5 5-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5M12 16h.01"/>',
};

const STAR = '<path d="M12 3.2l2.7 5.5 6 .9-4.35 4.2 1.03 6L12 16.95 6.62 19.8l1.03-6L3.3 9.6l6-.9z"/>';

export const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;

export const star = (className = '') => `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`;
