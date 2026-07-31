import { loadDishes } from './domain/dishes.js';
import { generateWeek } from './domain/generator.js';
import { createStore } from './core/store.js';
import { DAYS } from './core/week.js';
import { buildLastUsedIndex } from './core/history.js';
import { idsIn } from './core/plan.js';
import { createDispatcher } from './ui/actions.js';
import { renderToday, renderWeekGrid } from './ui/day-card.js';
import { renderPicker, openSheet, closeSheet } from './ui/picker.js';
import { openModal, closeAll, showToast } from './ui/modals.js';
import { renderHistory } from './ui/history-view.js';
import { shareWeek } from './ui/share.js';
import { APP_VERSION } from './version.js';

const todayIndex = () => (new Date().getDay() + 6) % 7;

async function boot() {
  const index = await loadDishes();
  const store = createStore({ storage: localStorage, index });

  const scrim = document.getElementById('scrim');
  const picker = document.getElementById('picker');

  // The journey starts with a plan already on screen. An empty week is a
  // dead end, so fill it on open rather than making Generate a gate.
  if (idsIn(store.currentWeek()).size === 0) {
    const base = store.currentWeek();
    store.setWeek(generateWeek({
      index, history: store.history(), weekKey: base.weekOf, base,
    }));
  }

  let picking = { mode: 'add', meal: 'lunch', day: 'monday', dishId: null, category: null };

  function render() {
    const week = store.currentWeek();
    renderToday(document.getElementById('todaySlot'), { week, store, todayIndex: todayIndex() });
    renderWeekGrid(document.getElementById('weekGrid'), { week, store, todayIndex: todayIndex() });
  }

  function repaintPicker() {
    renderPicker(picker, {
      ...picking,
      state: store.getState(),
      store,
      index,
      lastUsed: buildLastUsedIndex(store.history()),
      weekOf: store.currentWeek().weekOf,
    });
  }

  store.subscribe(render);

  createDispatcher(document.body)
    .on('generate-week', () => {
      const base = store.currentWeek();
      store.setWeek(generateWeek({
        index, history: store.history(), weekKey: base.weekOf, base,
      }));
      showToast(document, 'New week drawn. Pinned dishes kept.');
    })

    .on('share-week', async () => {
      const result = await shareWeek(store.currentWeek(), store);
      if (result === 'copied') showToast(document, 'Week copied to clipboard');
      else if (result === 'failed') showToast(document, "Couldn't share. Try again.");
    })

    // Map explicitly rather than spreading el.dataset: the attribute is
    // data-dish but the picker's contract is dishId, and a silent
    // mismatch there disables the title, the actions, and the role filter
    // without throwing.
    .on('open-swap', (el) => {
      picking = {
        mode: 'swap',
        meal: el.dataset.meal,
        day: el.dataset.day,
        dishId: el.dataset.dish,
        category: null,
      };
      repaintPicker();
      openSheet(picker, scrim);
    })

    .on('open-picker', (el) => {
      picking = { mode: 'add', meal: el.dataset.meal, day: el.dataset.day, dishId: null, category: null };
      repaintPicker();
      openSheet(picker, scrim);
    })

    .on('pick-category', (el) => {
      picking = { ...picking, category: el.dataset.category || null };
      repaintPicker();
    })

    .on('choose-dish', (el) => {
      const { meal, day, dish } = el.dataset;
      if (picking.mode === 'swap' && picking.dishId && picking.dishId !== dish) {
        store.removeDish(meal, day, picking.dishId);
      }
      store.addDish(meal, day, dish);
      closeSheet(picker, scrim);
    })

    .on('remove-dish', (el) => {
      const { meal, day, dish } = el.dataset;
      store.removeDish(meal, day, dish);
      closeSheet(picker, scrim);
      showToast(document, 'Removed');
    })

    // Pinning survives Generate and Clear — the generator fills around it.
    .on('toggle-pin', (el) => {
      const { meal, day, dish } = el.dataset;
      store.toggleLock(meal, day, dish);
      showToast(document, store.isLocked(meal, day, dish) ? 'Pinned for next draw' : 'Unpinned');
      repaintPicker();
    })

    .on('open-history', () => {
      renderHistory(document.getElementById('historyList'), { store });
      openModal(document, 'historyModal', scrim);
    })

    .on('copy-week', (el) => {
      const past = store.history().find(w => w.weekOf === el.dataset.week);
      if (!past) return;
      // Keep the current week's identity; only its contents are copied.
      store.setWeek({ ...structuredClone(past), weekOf: store.currentWeek().weekOf });
      closeAll(document);
      showToast(document, 'Copied into this week');
    })

    .on('open-add-dish', () => {
      const select = document.getElementById('newDishCategory');
      const meal = picking.meal ?? 'dinner';
      select.innerHTML = (index.categories[meal] ?? [])
        .map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`)
        .join('');
      document.getElementById('newDishName').value = '';
      openModal(document, 'addDishModal', scrim);
    })

    .on('save-custom-dish', () => {
      const name = document.getElementById('newDishName').value.trim();
      if (!name) return;
      store.addCustomDish({
        name,
        meal: picking.meal ?? 'dinner',
        category: document.getElementById('newDishCategory').value,
      });
      closeAll(document);
      showToast(document, `${name} added to your dishes`);
    })

    .on('close-overlays', () => closeAll(document))
    .attach();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll(document);
  });

  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW registration failed', e));
  }
  console.info(`Weekly Meals v${APP_VERSION}`);
}

boot().catch(err => {
  console.error('Failed to start', err);
  document.body.insertAdjacentHTML('afterbegin',
    '<p role="alert" class="boot-error">Weekly Meals could not load. Refresh to try again.</p>');
});
