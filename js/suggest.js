import { foodData, addItemToState, clearState } from './state.js';
import { addFoodToCard, showToast, renderSavedState } from './ui.js';

export function autoSuggest(mealType) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // Clear existing items for this meal type first
    // Note: This matches "fill in", often implying a fresh set or filling empty slots.
    // Given the complex constraints for dinner, it's easier to clear and regenerate the week
    // or just fill empty days? 
    // User said "suggested menu icon... that will randomly fill in". 
    // Usually means "Generate a plan". I'll clear current mealType plan and regenerate.

    // We need a clearMealType function in state, but for now we can arguably just 
    // clear by overwriting. Ideally we shouldn't wipe everything if user has some locks,
    // but for this MVP "Suggest" usually implies "Draft me a plan".

    // Let's implement a clear-for-meal-type in the loop by removing items first?
    // Or just append? If I append, I might exceed limits.
    // I will clear the visual cards and state for that meal type first.

    // Actually, to interact with the UI correctly, I should interact via `ui.js` helper 
    // or `state.js`. `clearState` in state.js clears EVERYTHING. 
    // Let's just create a new plan logic here.

    let generatedCount = 0;

    days.forEach(day => {
        const card = document.querySelector(`.day-card[data-day="${day}"][data-meal="${mealType}"]`);
        if (!card) return;

        // Clear existing items from card (and state)
        // This is a bit manual via DOM, better to have a clear method.
        // For now, I'll select all remove buttons and click them to trigger state update + UI remove
        card.querySelectorAll('.remove-btn').forEach(btn => btn.click());

        if (mealType === 'lunch') {
            generateLunchForDay(card, day);
        } else {
            generateDinnerForDay(card, day);
        }
        generatedCount++;
    });

    showToast(`Suggested menu generated for ${mealType}! 💡`, 'success');
}

function generateLunchForDay(card, day) {
    // Lunch: Random 1 item
    const items = foodData.lunch;
    if (items.length === 0) return;

    const randomItem = items[Math.floor(Math.random() * items.length)];
    addFoodToCard(card, randomItem.name, randomItem.emoji, randomItem.category, true);
}

function generateDinnerForDay(card, day) {
    // Dinner Constraints:
    // 1. Rice (Mandatory)
    // 2. Exactly 1 Veg (max 1)
    // 3. Exactly 1 Protein (max 1)
    // 4. Optional: 1 Soup (max 1)
    // 5. Total 3-4 dishes

    const candidates = {
        rice: foodData.dinner.filter(i => i.category === 'rice'),
        veg: foodData.dinner.filter(i => i.category === 'vegetables'),
        protein: foodData.dinner.filter(i => ['chicken', 'fish', 'pork', 'eggs', 'prawn'].includes(i.category)),
        soup: foodData.dinner.filter(i => i.category === 'soup'),
    };

    // 1. Add Rice
    let riceItem = candidates.rice.find(i => i.name === 'Rice');
    if (!riceItem && candidates.rice.length > 0) riceItem = candidates.rice[0];
    if (riceItem) {
        addFoodToCard(card, riceItem.name, riceItem.emoji, riceItem.category, true);
    }

    // 2. Pick exactly 1 Veg
    if (candidates.veg.length > 0) {
        const item = getRandom(candidates.veg);
        addFoodToCard(card, item.name, item.emoji, item.category, true);
    }

    // 3. Pick exactly 1 Protein
    if (candidates.protein.length > 0) {
        const item = getRandom(candidates.protein);
        addFoodToCard(card, item.name, item.emoji, item.category, true);
    }

    // 4. Randomly add 1 Soup (50% chance to reach 4 items)
    if (candidates.soup.length > 0 && Math.random() > 0.5) {
        const item = getRandom(candidates.soup);
        addFoodToCard(card, item.name, item.emoji, item.category, true);
    }
}

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
