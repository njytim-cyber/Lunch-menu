// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { indexDishes } from '../js/domain/dishes.js';
import { createStore } from '../js/core/store.js';
import { renderWeek } from '../js/ui/day-card.js';
import { renderPicker } from '../js/ui/picker.js';
import { renderHistory } from '../js/ui/history-view.js';
import { escapeHtml } from '../js/ui/escape.js';

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

describe('escapeHtml', () => {
  it('neutralises angle brackets and quotes', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });
});

describe('renderWeek', () => {
  let container, store;

  beforeEach(() => {
    document.body.innerHTML = '<div id="grid"></div>';
    container = document.getElementById('grid');
    store = mkStore();
  });

  const render = () => renderWeek(container, {
    meal: 'lunch', week: store.currentWeek(), store, todayKey: 'wednesday',
  });

  it('renders seven day cards', () => {
    render();
    expect(container.querySelectorAll('.day-card')).toHaveLength(7);
  });

  it('labels each card with its day', () => {
    render();
    expect(container.querySelector('[data-day="monday"] .day-card__header').textContent).toBe('Monday');
  });

  it('marks today', () => {
    render();
    expect(container.querySelector('[data-day="wednesday"]').classList.contains('day-card--today')).toBe(true);
  });

  it('renders a dish name, not an emoji', () => {
    store.addDish('lunch', 'monday', 'bee-hoon');
    render();
    expect(container.querySelector('[data-day="monday"] .dish__name').textContent).toBe('Fried Bee Hoon');
  });

  it('renders no emoji characters anywhere', () => {
    store.addDish('lunch', 'monday', 'bee-hoon');
    render();
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('renders an svg icon for each dish', () => {
    store.addDish('lunch', 'monday', 'bee-hoon');
    render();
    expect(container.querySelector('[data-day="monday"] svg use')).not.toBeNull();
  });

  it('gives each dish a data-action for removal', () => {
    store.addDish('lunch', 'monday', 'bee-hoon');
    render();
    const el = container.querySelector('[data-day="monday"] .dish__body');
    expect(el.dataset.action).toBe('dish-tap');
    expect(el.dataset.dish).toBe('bee-hoon');
    expect(el.dataset.meal).toBe('lunch');
    expect(el.dataset.day).toBe('monday');
  });

  it('gives each dish a pin toggle', () => {
    store.addDish('lunch', 'monday', 'bee-hoon');
    render();
    const pin = container.querySelector('[data-day="monday"] .dish__pin');
    expect(pin.dataset.action).toBe('toggle-pin');
    expect(pin.getAttribute('aria-pressed')).toBe('false');
  });

  it('marks pinned dishes and reflects it on the pin control', () => {
    store.addDish('lunch', 'monday', 'bee-hoon');
    store.toggleLock('lunch', 'monday', 'bee-hoon');
    render();
    expect(container.querySelector('.dish').classList.contains('dish--locked')).toBe(true);
    expect(container.querySelector('.dish__pin').getAttribute('aria-pressed')).toBe('true');
  });

  it('is idempotent — re-rendering does not duplicate cards', () => {
    render(); render(); render();
    expect(container.querySelectorAll('.day-card')).toHaveLength(7);
  });

  it('renders custom dishes by name with the fallback icon', () => {
    const d = store.addCustomDish({ name: 'Nasi Goreng', meal: 'lunch', category: 'rice' });
    store.addDish('lunch', 'tuesday', d.id);
    render();
    expect(container.querySelector('[data-day="tuesday"] .dish__name').textContent).toBe('Nasi Goreng');
  });

  it('escapes a custom dish name containing markup', () => {
    const d = store.addCustomDish({ name: '<img src=x onerror=alert(1)>', meal: 'lunch', category: 'rice' });
    store.addDish('lunch', 'friday', d.id);
    render();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-day="friday"] .dish__name').textContent)
      .toBe('<img src=x onerror=alert(1)>');
  });

  it('renders an empty card without throwing', () => {
    expect(() => render()).not.toThrow();
    expect(container.querySelector('[data-day="friday"] .day-card__items').children).toHaveLength(0);
  });
});

describe('renderPicker', () => {
  let sheet, store;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="picker"><nav id="pickerCategories"></nav><div id="pickerItems"></div></div>`;
    sheet = document.getElementById('picker');
    store = mkStore();
  });

  const render = (meal = 'lunch', category = null) =>
    renderPicker(sheet, { meal, day: 'monday', state: store.getState(), store, index, category });

  it('lists an "All" chip plus one per category', () => {
    render('dinner');
    const tabs = sheet.querySelectorAll('#pickerCategories [data-action="pick-category"]');
    expect(tabs.length).toBe(manifest.categories.dinner.length + 1);
  });

  it('shows only dishes for the selected meal', () => {
    render('lunch');
    const ids = [...sheet.querySelectorAll('[data-dish]')].map(el => el.dataset.dish);
    expect(ids).not.toContain('rice');
    expect(ids.every(id => index.byId.get(id).meals.includes('lunch'))).toBe(true);
  });

  it('filters to one category when given', () => {
    render('dinner', 'vegetables');
    const ids = [...sheet.querySelectorAll('[data-dish]')].map(el => el.dataset.dish);
    expect(ids.length).toBeGreaterThan(6);
    expect(ids.every(id => index.byId.get(id).category === 'vegetables')).toBe(true);
  });

  it('tags each option with the target day and meal', () => {
    render('lunch');
    const el = sheet.querySelector('[data-dish]');
    expect(el.dataset.action).toBe('add-dish');
    expect(el.dataset.day).toBe('monday');
    expect(el.dataset.meal).toBe('lunch');
  });

  it('includes custom dishes for that meal', () => {
    const d = store.addCustomDish({ name: 'Nasi Goreng', meal: 'lunch', category: 'rice' });
    render('lunch');
    expect([...sheet.querySelectorAll('[data-dish]')].map(el => el.dataset.dish)).toContain(d.id);
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
    store.addDish('lunch', 'monday', 'bee-hoon');
    store.rollToWeek('2026-08-03');
    renderHistory(container, { store });
    expect(container.querySelectorAll('.history-week')).toHaveLength(1);
    expect(container.querySelector('[data-action="copy-week"]').dataset.week).toBe('2026-07-27');
    expect(container.textContent).toContain('Fried Bee Hoon');
  });
});
