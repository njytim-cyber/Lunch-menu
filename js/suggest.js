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
    // 2. Veg (Min 1)
    // 3. Protein (Min 1)
    // 4. Max 1 soup
    // 5. Total 3-4 dishes (Data max is 4. So we aim for 4 items: Rice + 3 dishes)

    const candidates = {
        rice: foodData.dinner.filter(i => i.category === 'rice'),
        veg: foodData.dinner.filter(i => i.category === 'vegetables'),
        protein: foodData.dinner.filter(i => ['chicken', 'fish', 'pork', 'eggs', 'prawn'].includes(i.category)),
        soup: foodData.dinner.filter(i => i.category === 'soup'),
        others: foodData.dinner.filter(i => ['beverage', 'dessert'].includes(i.category)), // if any
        pasta: foodData.dinner.filter(i => i.category === 'pasta'), // treating as main/protein alternative or carb
        noodles: foodData.dinner.filter(i => i.category === 'noodles'),
    };

    // Note: User said "Rice for all meals". I will enforce Rice.
    // Assuming 'Rice' exists in categories. I see 'rice' category in data.js.
    // Wait, in data.js I added 'Rice' item with category 'rice'. 

    // 1. Add Rice
    let riceItem = candidates.rice.find(i => i.name === 'Rice');
    if (!riceItem && candidates.rice.length > 0) riceItem = candidates.rice[0];
    if (riceItem) {
        addFoodToCard(card, riceItem.name, riceItem.emoji, riceItem.category, true);
    }

    // We have 3 slots left.
    // Need: 1 Veg, 1 Protein.
    // Optional: 1 Soup or another Veg/Protein.

    const pickedItems = [];

    // 2. Pick 1 Veg
    if (candidates.veg.length > 0) {
        const item = getRandom(candidates.veg);
        pickedItems.push(item);
    }

    // 3. Pick 1 Protein
    if (candidates.protein.length > 0) {
        const item = getRandom(candidates.protein);
        pickedItems.push(item);
    }

    // 4. Pick 1 Random for the last slot (Veg or Protein or Soup)
    // Max 1 soup constraint means we can pick soup here if we haven't yet.
    // (We haven't, pickedItems only has Veg/Protein so far).

    const leftovers = [
        ...candidates.veg,
        ...candidates.protein,
        ...candidates.soup
    ].filter(i => !pickedItems.includes(i)); // unique check might need ID but object ref is fine if from same array

    if (leftovers.length > 0) {
        // Simple random pick from pool
        let lastItem = getRandom(leftovers);

        // Retry if we picked duplicate (unlikely with filter but strictly speaking names match)
        // I'll assume unique objects.

        pickedItems.push(lastItem);
    }

    // Add them to card
    pickedItems.forEach(item => {
        addFoodToCard(card, item.name, item.emoji, item.category, true);
    });
}

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
