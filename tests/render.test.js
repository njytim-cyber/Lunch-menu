// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { indexDishes } from '../js/domain/dishes.js';
import { createStore } from '../js/core/store.js';
import { buildLastUsedIndex } from '../js/core/history.js';
import { renderToday, renderWeekGrid } from '../js/ui/day-card.js';
import { renderPicker } from '../js/ui/picker.js';
import { renderHistory } from '../js/ui/history-view.js';
import { escapeHtml } from '../js/ui/escape.js';
import { roleOf, inRoleOrder } from '../js/ui/roles.js';
import { weekAsText } from '../js/ui/share.js';

// Read via cwd, not import.meta.url: under the jsdom environment import.meta.url
// is an http:// URL and readFileSync rejects it.
const manifest = JSON.parse(readFileSync('data/dishes.json', 'utf8'));
const index = indexDishes(manifest);

function fakeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}

const mkStore = () =>
  createStore({ storage: fakeStorage(), index, now: () => new Date('2026-07-29T10:00:00') });

/** A full Wednesday dinner, added out of grammatical order on purpose. */
function seedWednesdayDinner(store) {
  store.addDish('dinner', 'wednesday', 'corn-soup');       // soup
  store.addDish('dinner', 'wednesday', 'curry-chicken');   // protein
  store.addDish('dinner', 'wednesday', 'rice');            // staple
  store.addDish('dinner', 'wednesday', 'kai-lan');         // vegetable
}

describe('escapeHtml', () => {
  it('neutralises angle brackets and quotes', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });
});

describe('roles', () => {
  const r = (id, meal) => roleOf(index.byId.get(id), meal);

  it('classifies the dinner grammar', () => {
    expect(r('rice', 'dinner')).toBe('staple');
    expect(r('kai-lan', 'dinner')).toBe('veg');
    expect(r('curry-chicken', 'dinner')).toBe('protein');
    expect(r('corn-soup', 'dinner')).toBe('soup');
  });

  it('treats every protein category as one role', () => {
    for (const id of ['fried-salmon', 'mapo-tofu', 'cereal-prawns', 'tomato-egg-stirfry']) {
      expect(r(id, 'dinner'), id).toBe('protein');
    }
  });

  it('treats rice as a main at lunch but a staple at dinner', () => {
    expect(r('chicken-rice', 'lunch')).toBe('main');
    expect(r('rice', 'dinner')).toBe('staple');
  });

  it('sorts a dinner into staple, vegetable, protein, soup', () => {
    const placements = [
      { id: 'corn-soup' }, { id: 'curry-chicken' }, { id: 'rice' }, { id: 'kai-lan' },
    ];
    const ordered = inRoleOrder(placements, 'dinner', id => index.byId.get(id));
    expect(ordered.map(p => p.id)).toEqual(['rice', 'kai-lan', 'curry-chicken', 'corn-soup']);
  });
});

describe('renderToday', () => {
  let el, store;

  beforeEach(() => {
    document.body.innerHTML = '<div id="today"></div>';
    el = document.getElementById('today');
    store = mkStore();
  });

  // 2026-07-29 is a Wednesday -> index 2
  const render = () => renderToday(el, { week: store.currentWeek(), store, todayIndex: 2 });

  it('names the day and labels it as today', () => {
    render();
    expect(el.querySelector('.today__day').textContent).toBe('Wednesday');
    expect(el.querySelector('.eyebrow--accent').textContent).toBe('Today');
  });

  it('shows both meals', () => {
    render();
    const labels = [...el.querySelectorAll('.meal .eyebrow')].map(n => n.textContent);
    expect(labels).toEqual(['Lunch', 'Dinner']);
  });

  it('renders dinner in grammatical order regardless of insertion order', () => {
    seedWednesdayDinner(store);
    render();
    const roles = [...el.querySelectorAll('.meal:last-child .row')].map(n => n.dataset.role);
    expect(roles).toEqual(['staple', 'veg', 'protein', 'soup']);
  });

  it('opens a swap rather than deleting when a dish is tapped', () => {
    seedWednesdayDinner(store);
    render();
    const btn = el.querySelector('.row__swap');
    expect(btn.dataset.action).toBe('open-swap');
    expect(btn.dataset.dish).toBe('rice');
    expect(btn.dataset.meal).toBe('dinner');
    expect(btn.dataset.day).toBe('wednesday');
  });

  it('marks a pinned dish', () => {
    seedWednesdayDinner(store);
    store.toggleLock('dinner', 'wednesday', 'curry-chicken');
    render();
    const row = [...el.querySelectorAll('.row')].find(n => n.dataset.role === 'protein');
    expect(row.classList.contains('row--pinned')).toBe(true);
    expect(row.querySelector('.row__pinned').textContent.trim()).toBe('Pinned');
  });

  it('invites action on an empty meal', () => {
    render();
    expect(el.querySelector('.meal__empty').textContent).toBe('Nothing planned');
  });

  it('renders no emoji characters', () => {
    seedWednesdayDinner(store);
    render();
    expect(el.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('escapes a custom dish name containing markup', () => {
    const d = store.addCustomDish({ name: '<img src=x onerror=alert(1)>', meal: 'lunch', category: 'rice' });
    store.addDish('lunch', 'wednesday', d.id);
    render();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.row__name').textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('renderWeekGrid', () => {
  let el, store;

  beforeEach(() => {
    document.body.innerHTML = '<div id="week"></div>';
    el = document.getElementById('week');
    store = mkStore();
  });

  const render = () => renderWeekGrid(el, { week: store.currentWeek(), store, todayIndex: 2 });

  it('renders the other six days', () => {
    render();
    expect(el.querySelectorAll('.day')).toHaveLength(6);
  });

  it('omits today, which the hero already shows', () => {
    render();
    expect(el.querySelector('[data-day="wednesday"]')).toBeNull();
  });

  it('dims days already past', () => {
    render();
    expect(el.querySelector('[data-day="monday"]').classList.contains('day--past')).toBe(true);
    expect(el.querySelector('[data-day="friday"]').classList.contains('day--past')).toBe(false);
  });

  it('is idempotent', () => {
    render(); render();
    expect(el.querySelectorAll('.day')).toHaveLength(6);
  });
});

describe('renderPicker', () => {
  let sheet, store;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="picker">
        <h2 id="pickerTitle"></h2>
        <div id="pickerActions" hidden></div>
        <nav id="pickerCategories"></nav>
        <ul id="pickerItems"></ul>
      </div>`;
    sheet = document.getElementById('picker');
    store = mkStore();
  });

  const paint = (extra) => renderPicker(sheet, {
    meal: 'dinner', day: 'wednesday', state: store.getState(), store, index,
    lastUsed: buildLastUsedIndex(store.history()),
    weekOf: store.currentWeek().weekOf,
    category: null,
    ...extra,
  });

  const names = () => [...sheet.querySelectorAll('.option__name')].map(n => n.textContent);

  it('names the dish being changed', () => {
    paint({ mode: 'swap', dishId: 'curry-chicken' });
    expect(sheet.querySelector('#pickerTitle').textContent).toBe('Change Curry Chicken');
  });

  it('offers pin and remove when swapping', () => {
    paint({ mode: 'swap', dishId: 'curry-chicken' });
    const actions = sheet.querySelector('#pickerActions');
    expect(actions.hidden).toBe(false);
    expect(actions.querySelector('[data-action="toggle-pin"]')).not.toBeNull();
    expect(actions.querySelector('[data-action="remove-dish"]')).not.toBeNull();
  });

  it('hides those actions when adding', () => {
    paint({ mode: 'add' });
    expect(sheet.querySelector('#pickerActions').hidden).toBe(true);
  });

  it('restricts a swap to dishes of the same role', () => {
    paint({ mode: 'swap', dishId: 'curry-chicken' });
    const ids = [...sheet.querySelectorAll('.option')].map(el => el.dataset.dish);
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) {
      expect(roleOf(index.byId.get(id), 'dinner'), id).toBe('protein');
    }
  });

  it('never offers a vegetable as a protein substitute', () => {
    paint({ mode: 'swap', dishId: 'curry-chicken' });
    expect([...sheet.querySelectorAll('.option')].map(el => el.dataset.dish)).not.toContain('kai-lan');
  });

  it('marks the dish currently in the slot', () => {
    paint({ mode: 'swap', dishId: 'curry-chicken' });
    expect(sheet.querySelector('.option--current').dataset.dish).toBe('curry-chicken');
  });

  it('labels every option with when it was last cooked', () => {
    paint({ mode: 'add' });
    const metas = [...sheet.querySelectorAll('.option__meta')].map(n => n.textContent);
    expect(metas.length).toBeGreaterThan(0);
    expect(metas.every(Boolean)).toBe(true);
    expect(metas[0]).toBe('Not cooked yet');
  });

  it('orders least-recently-cooked first', () => {
    store.addDish('dinner', 'monday', 'curry-chicken');
    store.rollToWeek('2026-08-03');
    const paint2 = () => renderPicker(sheet, {
      mode: 'add', meal: 'dinner', day: 'monday', state: store.getState(), store, index,
      lastUsed: buildLastUsedIndex(store.history()),
      weekOf: store.currentWeek().weekOf, category: null,
    });
    paint2();
    // Cooked last week, so it must sink below everything never cooked.
    expect(names().indexOf('Curry Chicken')).toBe(names().length - 1);
    const meta = [...sheet.querySelectorAll('.option')]
      .find(el => el.dataset.dish === 'curry-chicken')
      .querySelector('.option__meta').textContent;
    expect(meta).toBe('Last week');
  });

  it('lets a category chip widen the choice beyond the role', () => {
    paint({ mode: 'swap', dishId: 'curry-chicken', category: 'vegetables' });
    const ids = [...sheet.querySelectorAll('.option')].map(el => el.dataset.dish);
    expect(ids).toContain('kai-lan');
  });

  it('includes custom dishes', () => {
    const d = store.addCustomDish({ name: 'Ikan Bilis Sambal', meal: 'dinner', category: 'fish' });
    paint({ mode: 'add' });
    expect([...sheet.querySelectorAll('.option')].map(el => el.dataset.dish)).toContain(d.id);
  });
});

describe('weekAsText', () => {
  it('renders a shareable week', () => {
    const store = mkStore();
    store.addDish('lunch', 'monday', 'chicken-rice');
    seedWednesdayDinner(store);
    const text = weekAsText(store.currentWeek(), store);

    expect(text).toContain('Weekly Meals ·');
    expect(text).toContain('MON');
    expect(text).toContain('Lunch: Hainanese Chicken Rice');
    expect(text).toContain('WED');
    expect(text).toContain('Dinner: ');
    expect(text).toContain('Curry Chicken');
  });

  it('omits days with nothing planned', () => {
    const store = mkStore();
    store.addDish('lunch', 'monday', 'chicken-rice');
    expect(weekAsText(store.currentWeek(), store)).not.toContain('TUE');
  });

  it('contains no emoji', () => {
    const store = mkStore();
    seedWednesdayDinner(store);
    expect(weekAsText(store.currentWeek(), store)).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('renderHistory', () => {
  let container, store;

  beforeEach(() => {
    document.body.innerHTML = '<div id="historyList"></div>';
    container = document.getElementById('historyList');
    store = mkStore();
  });

  it('shows an empty state before any week is archived', () => {
    renderHistory(container, { store });
    expect(container.querySelector('.empty')).not.toBeNull();
  });

  it('lists an archived week with a copy action', () => {
    store.addDish('lunch', 'monday', 'chicken-rice');
    store.rollToWeek('2026-08-03');
    renderHistory(container, { store });
    expect(container.querySelectorAll('.history-week')).toHaveLength(1);
    expect(container.querySelector('[data-action="copy-week"]').dataset.week).toBe('2026-07-27');
    expect(container.textContent).toContain('Hainanese Chicken Rice');
  });
});
