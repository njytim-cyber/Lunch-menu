import { FALLBACK_ICON } from '../domain/dishes.js';

let injected = false;

/**
 * Inline the sprite once so <use href="#id"> resolves without a
 * per-icon network request. Safe to call repeatedly.
 */
export async function injectSprite(doc = document, url = 'icons/sprite.svg') {
  if (injected) return;
  injected = true;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`sprite ${res.status}`);
    const host = doc.createElement('div');
    host.hidden = true;
    host.innerHTML = await res.text();
    doc.body.prepend(host);
  } catch (e) {
    console.error('Icon sprite failed to load', e);
  }
}

export function hasSymbol(doc, iconId) {
  return Boolean(doc.getElementById(iconId));
}

/**
 * Markup for one dish icon. Decorative — the dish name carries the
 * accessible meaning, so the svg is hidden from assistive tech.
 */
export function iconMarkup(iconId, doc = document) {
  const id = iconId && hasSymbol(doc, iconId) ? iconId : FALLBACK_ICON;
  return `<svg class="dish-icon" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
}
