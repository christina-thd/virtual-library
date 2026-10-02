/**
 * An element of the page by its id (index.html always has it).
 * @param {string} id
 * @returns {HTMLElement}
 */
export const $ = (id) => document.getElementById(id);

/**
 * The element a tap was on, or inside, that matches `selector`, or null: one listener for a whole list.
 * @param {Event} event
 * @param {string} selector
 * @returns {HTMLElement | null}
 */
export const closest = (event, selector) => /** @type {Element} */ (event.target).closest(selector);

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for safe use inside HTML (titles come from catalogs and from what you type). */
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
