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
