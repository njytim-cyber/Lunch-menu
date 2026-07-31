/**
 * Escape text for interpolation into an innerHTML template.
 *
 * Dish names are user-authored (custom dishes) and manifest-authored, and
 * both reach the DOM through template strings. Every interpolation of a
 * name MUST pass through here.
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
