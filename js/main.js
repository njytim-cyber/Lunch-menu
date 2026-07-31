import { loadDishes } from './domain/dishes.js';
import { generateWeek } from './domain/generator.js';
import { createStore } from './core/store.js';
import { DAYS } from './core/week.js';
import { injectSprite } from './ui/icons.js';
import { createDispatcher } from './ui/actions.js';
import { renderWeek } from './ui/day-card.js';
import { renderPicker, openSheet, closeSheet } from './ui/picker.js';
import { openModal, closeAll, showToast } from './ui/modals.js';
import { renderHistory } from './ui/history-view.js';
import { APP_VERSION } from './version.js';

const todayKey = () => DAYS[(new Date().getDay() + 6) % 7];

async function boot() {
  await injectSprite(document);
  const index = await loadDishes();
  const store = createStore({ storage: localStorage, index });

  const scrim = document.getElementById('scrim');
  const picker = document.getElementById('picker');
  let activeMeal = 'lunch';
  let pickerTarget = { meal: 'lunch', day: 'monday', category: null };

  function render() {
    const week = store.currentWeek();
    renderWeek(document.getElementById('lunchGrid'), { meal: 'lunch', week, store, todayKey: todayKey() });
    renderWeek(document.getElementById('dinnerGrid'), { meal: 'dinner', week, store, todayKey: todayKey() });
    document.getElementById('lunch-page').hidden = activeMeal !== 'lunch';
    document.getElementById('dinner-page').hidden = activeMeal !== 'dinner';
    for (const btn of document.querySelectorAll('[data-action="show-meal"]')) {
      btn.setAttribute('aria-selected', String(btn.dataset.meal === activeMeal));
    }
  }

  store.subscribe(render);

  const dispatcher = createDispatcher(document.body);

  dispatcher
    .on('show-meal', (el) => { activeMeal = el.dataset.meal; render(); })

    .on('generate-week', () => {
      const base = store.currentWeek();
      store.setWeek(generateWeek({
        index,
        history: store.history(),
        weekKey: base.weekOf,
        base,                       // carries pinned dishes through
      }));
      showToast(document, 'Week generated');
    })

    .on('clear-meal', () => {
      store.clearMeal(activeMeal);
      showToast(document, `${activeMeal === 'lunch' ? 'Lunch' : 'Dinner'} cleared`);
    })

    .on('open-picker', (el) => {
      pickerTarget = { meal: el.dataset.meal, day: el.dataset.day, category: null };
      renderPicker(picker, { ...pickerTarget, state: store.getState(), store, index });
      openSheet(picker, scrim);
    })

    .on('pick-category', (el) => {
      pickerTarget = { ...pickerTarget, category: el.dataset.category || null };
      renderPicker(picker, { ...pickerTarget, state: store.getState(), store, index });
    })

    .on('add-dish', (el) => {
      store.addDish(el.dataset.meal, el.dataset.day, el.dataset.dish);
      closeSheet(picker, scrim);
    })

    .on('dish-tap', (el) => {
      const { meal, day, dish } = el.dataset;
      store.removeDish(meal, day, dish);
      showToast(document, 'Removed');
    })

    // Pinning survives Generate and Clear — the generator fills around it.
    .on('toggle-pin', (el, event) => {
      event.stopPropagation();      // the pin sits inside the dish row
      const { meal, day, dish } = el.dataset;
      store.toggleLock(meal, day, dish);
      showToast(document, store.isLocked(meal, day, dish) ? 'Pinned' : 'Unpinned');
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
      showToast(document, 'Copied to this week');
    })

    .on('open-add-dish', () => {
      const select = document.getElementById('newDishCategory');
      select.innerHTML = (index.categories[activeMeal] ?? [])
        .map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`)
        .join('');
      document.getElementById('newDishName').value = '';
      openModal(document, 'addDishModal', scrim);
    })

    .on('save-custom-dish', () => {
      const name = document.getElementById('newDishName').value.trim();
      if (!name) return;
      const category = document.getElementById('newDishCategory').value;
      store.addCustomDish({ name, meal: activeMeal, category });
      closeAll(document);
      showToast(document, `${name} added`);
    })

    .on('close-overlays', () => { closeAll(document); });

  dispatcher.attach();

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
    '<p role="alert" class="boot-error">Something went wrong loading the app. Please refresh.</p>');
});
