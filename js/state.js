// State Management with LocalStorage

const STORAGE_KEY = 'weeklyMealPlan_v1';

export const foodData = {
    lunch: [],
    dinner: []
};

// Start with empty meal plan or load from storage
export const mealPlan = loadMealPlan() || {
    lunch: {},
    dinner: {}
};

function loadMealPlan() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.error('Failed to load meal plan', e);
        return null;
    }
}

export function saveMealPlan() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mealPlan));
    } catch (e) {
        console.error('Failed to save meal plan', e);
    }
}

export function addFoodItem(name, emoji, mealType = 'lunch', category = 'all') {
    foodData[mealType].push({ name, emoji, category });
}

export function getFoodItems(mealType) {
    return foodData[mealType] || [];
}

// Helpers to update state (though UI primarily manipulates DOM, we should ideally sync state)
// Since the current implementation relies heavily on DOM state, we will implementing a 
// "sync from DOM" or "update state on action" approach.
// For this refactor, we will focus on ensuring the "mealPlan" object tracks what's on the screen
// so we can save it.

export function addItemToState(day, mealType, item) {
    if (!mealPlan[mealType]) mealPlan[mealType] = {};
    if (!mealPlan[mealType][day]) mealPlan[mealType][day] = [];

    mealPlan[mealType][day].push(item);
    saveMealPlan();
}

export function removeItemFromState(day, mealType, itemIndex) {
    if (!mealPlan[mealType] || !mealPlan[mealType][day]) return;

    // Remove item at index
    mealPlan[mealType][day].splice(itemIndex, 1);
    saveMealPlan();
}

export function clearState() {
    mealPlan.lunch = {};
    mealPlan.dinner = {};
    saveMealPlan();
}

// Custom Dishes
const CUSTOM_DISHES_KEY = 'customDishes_v1';

export const customDishes = loadCustomDishes() || {
    lunch: [],
    dinner: []
};

function loadCustomDishes() {
    try {
        const stored = localStorage.getItem(CUSTOM_DISHES_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.error('Failed to load custom dishes', e);
        return null;
    }
}

export function saveCustomDishes() {
    try {
        localStorage.setItem(CUSTOM_DISHES_KEY, JSON.stringify(customDishes));
    } catch (e) {
        console.error('Failed to save custom dishes', e);
    }
}

export function addCustomDish(name, emoji, mealType, category) {
    if (!customDishes[mealType]) customDishes[mealType] = [];

    // Check if dish already exists
    const exists = customDishes[mealType].some(d => d.name.toLowerCase() === name.toLowerCase());
    if (exists) return false;

    customDishes[mealType].push({ name, emoji, category, isCustom: true });
    saveCustomDishes();
    return true;
}

export function removeCustomDish(mealType, name) {
    if (!customDishes[mealType]) return;

    customDishes[mealType] = customDishes[mealType].filter(d => d.name !== name);
    saveCustomDishes();
}

// ============================================
// RECIPES
// ============================================

const RECIPES_KEY = 'recipes_v1';

export const recipes = loadRecipes() || {};

function loadRecipes() {
    try {
        const stored = localStorage.getItem(RECIPES_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.error('Failed to load recipes', e);
        return null;
    }
}

export function saveRecipes() {
    try {
        localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
    } catch (e) {
        console.error('Failed to save recipes', e);
    }
}

export function getRecipe(dishName) {
    return recipes[dishName] || '';
}

export function setRecipe(dishName, recipeText) {
    recipes[dishName] = recipeText;
    saveRecipes();
}

