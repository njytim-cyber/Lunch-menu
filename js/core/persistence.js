import { weekKey } from './week.js';
import { emptyWeek, addPlacement, toggleLockAt, dayIndex } from './plan.js';
import { FALLBACK_ICON } from '../domain/dishes.js';

export const STORAGE_KEY = 'weeklyMeals_v3';
const LEGACY = { plan: 'weeklyMealPlan_v1', custom: 'customDishes_v1', recipes: 'recipes_v1' };

/**
 * Every v1 display name -> its v3 dish id.
 *
 * The v3 rename pass changed almost every name ("Chicken Rice" ->
 * "Hainanese Chicken Rice", "Pork Rib Soup" -> "Bak Kut Teh"), so
 * fallback matching by name would strand nearly all existing user data
 * as orphaned custom dishes. This map must stay exhaustive over the v1
 * catalogue.
 *
 * Names absent here and unmatched by the manifest become custom dishes —
 * which is the correct outcome for the five dishes dropped in v3
 * (Bee Hoon and Seaweed Chicken, Fish Ball Noodle, Cabbage, Baby Kailan,
 * Sliced Pork with Parsley). Their history is preserved, they just no
 * longer appear in the picker.
 */
export const RENAME_MAP = {
  // --- lunch ---
  'Rigatoni': 'rigatoni',
  'Mushroom Fusilli': 'mushroom-fusilli',
  'Cheese and Pepper pasta': 'cheese-pepper-pasta',
  'Pistachio Pesto with chicken': 'pistachio-pesto-chicken',
  'Cheesy Rigatoni': 'cheesy-rigatoni',
  'Chicken Pasta and Broccoli': 'chicken-pasta-broccoli',
  'Chicken Rice': 'chicken-rice',
  'Soy Chicken and Chye Sim': 'soy-chicken-chye-sim',
  'Chicken and Mushroom Rice': 'chicken-mushroom-rice',
  'Porridge': 'porridge',
  'Fried Rice': 'fried-rice',
  'Crispy Noodle': 'crispy-noodle',
  'Bee Hoon': 'bee-hoon',
  'Mee Sua Soup': 'mee-sua-soup',
  'Kway Teow Soup': 'kway-teow-soup',

  // --- dinner: staple and vegetables ---
  'Rice': 'rice',
  'Kai Lan': 'kai-lan',
  'Kailan': 'kai-lan',
  'Baby Spinach': 'baby-spinach',
  'Red Spinach': 'red-spinach',
  'Kang Kong': 'kang-kong',
  'WaWa Vegetable': 'wawa-vegetable',
  'Broccoli': 'broccoli',

  // --- dinner: fish ---
  'Sliced Fish with Ginger': 'steam-fish-ginger-spring-onion',
  'Steam Fish (Ginger/Spring Onion)': 'steam-fish-ginger-spring-onion',
  'Steam Fish Pomfret': 'steam-fish-pomfret',
  'Steam Fish White Pomfret': 'steam-fish-pomfret',
  'Fried Seabass': 'fried-seabass',
  'Fried Salmon': 'fried-salmon',
  'Claypot Sliced Fish with Eggplant': 'claypot-fish-eggplant',

  // --- dinner: pork ---
  'Steamed Minced Pork': 'steamed-minced-pork',
  'Sliced Pork with Sichuan Veg': 'sliced-pork-sichuan-claypot',
  'Pork with Egg and Tau Pok': 'pork-egg-tau-pok',
  'Japanese Pork Cutlet': 'japanese-pork-cutlet',

  // --- dinner: chicken ---
  'Steamed Chicken with Mushrooms': 'steamed-chicken-mushrooms',
  'Chicken with Salted Bean Paste': 'chicken-salted-bean-paste',
  'Curry Chicken': 'curry-chicken',
  'Fried Chicken Wing': 'fried-chicken-wing',

  // --- dinner: soups (retagged from their old protein categories) ---
  'Fish and Fish Soup': 'fish-and-fish-soup',
  'Corn Soup': 'corn-soup',
  'Pork Rib Soup': 'pork-rib-soup',

  // --- dinner: eggs, prawn, tofu ---
  'Egg with Onion': 'egg-onion-carrot',
  'Egg with Carrot': 'egg-onion-carrot',
  'Egg with Tomato': 'tomato-egg-stirfry',
  'Claypot Tofu': 'claypot-tofu',
  'Crispy Prawn Ball': 'crispy-prawn-ball',
  'Prawn with Glass Noodle': 'prawn-glass-noodle',
};

export function emptyState(week = weekKey()) {
  return { version: 3, weeks: [emptyWeek(week)], custom: [], recipes: {} };
}

function slugify(name) {
  return `custom-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/** Resolve a legacy display name to a v3 dish id, or null if unknown. */
function resolveName(name, index) {
  const mapped = RENAME_MAP[name];
  if (mapped && index.byId.has(mapped)) return mapped;
  const match = index.all.find(d => d.name.toLowerCase() === String(name).toLowerCase());
  return match ? match.id : null;
}

/**
 * Convert the three v1 blobs into v3 state. Pure.
 * `legacy` is { mealPlan, customDishes, recipes }, each already parsed.
 */
export function migrateV1(legacy, index) {
  const state = emptyState();
  const week = state.weeks[0];
  const nameToId = new Map();          // legacy name -> resolved id, for recipe re-keying

  const registerCustom = (name, meal, category) => {
    const id = slugify(name);
    if (!state.custom.some(c => c.id === id)) {
      state.custom.push({
        id, name, meals: [meal],
        category: category ?? 'other', prep: 'unknown',
        icon: FALLBACK_ICON, description: '', isCustom: true,
      });
    }
    nameToId.set(name, id);
    return id;
  };

  // Custom dishes first, so plan items can resolve against them.
  for (const meal of ['lunch', 'dinner']) {
    for (const d of legacy.customDishes?.[meal] ?? []) {
      const known = resolveName(d.name, index);
      if (known) nameToId.set(d.name, known);
      else registerCustom(d.name, meal, d.category);
    }
  }

  // Plan items. addPlacement de-duplicates, which matters because the v3
  // merges can collapse two legacy dishes onto one id in the same slot.
  for (const meal of ['lunch', 'dinner']) {
    for (const [dayName, items] of Object.entries(legacy.mealPlan?.[meal] ?? {})) {
      const day = dayIndex(dayName);
      if (day < 0) continue;                       // unknown day key — skip rather than throw
      for (const item of items ?? []) {
        const id = resolveName(item.name, index)
          ?? nameToId.get(item.name)
          ?? registerCustom(item.name, meal, item.category);
        addPlacement(week, meal, day, id);
        if (item.locked) toggleLockAt(week, meal, day, id);
      }
    }
  }

  // Recipes: name-keyed -> id-keyed.
  for (const [name, text] of Object.entries(legacy.recipes ?? {})) {
    const id = resolveName(name, index) ?? nameToId.get(name) ?? slugify(name);
    state.recipes[id] = text;
  }

  return state;
}

function parse(raw, fallback) {
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

/** Load v3 state, migrating from v1 on first run. Never throws. */
export function load(storage, index) {
  const existing = parse(storage.getItem(STORAGE_KEY), null);
  if (existing && existing.version === 3) return existing;

  const hasLegacy = storage.getItem(LEGACY.plan) != null;
  if (!hasLegacy) return emptyState();

  return migrateV1({
    mealPlan: parse(storage.getItem(LEGACY.plan), { lunch: {}, dinner: {} }),
    customDishes: parse(storage.getItem(LEGACY.custom), { lunch: [], dinner: [] }),
    recipes: parse(storage.getItem(LEGACY.recipes), {}),
  }, index);
}

export function save(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state', e);
  }
}
