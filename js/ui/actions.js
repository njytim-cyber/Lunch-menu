/**
 * One delegated click listener for the whole app.
 *
 * Replaces inline onclick="" attributes and the window.* function exports
 * they required. Handler names live in a registry that can be audited in
 * one place, instead of being resolved from strings scattered through HTML.
 */
export function createDispatcher(root) {
  const handlers = new Map();

  function onClick(event) {
    const el = event.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    const handler = handlers.get(el.dataset.action);
    if (!handler) return;
    handler(el, event);
  }

  return {
    on(name, handler) { handlers.set(name, handler); return this; },
    attach() { root.addEventListener('click', onClick); },
    detach() { root.removeEventListener('click', onClick); },
  };
}
