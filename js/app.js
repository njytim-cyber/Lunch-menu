import { loadSampleData } from './data.js';
import {
    initDayCards,
    initDesktopDragAndDrop,
    initCategoryTabs,
    initSwipeGestures,
    initTabs,
    renderSavedState,
    addFoodToCard,
    removeFoodFromCard
} from './ui.js';
import { shareNative } from './share.js';
import { addFoodItem } from './state.js';

import { autoSuggest } from './suggest.js';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load static food data
    loadSampleData();

    // 2. Initialize UI components
    initDayCards();
    initDesktopDragAndDrop();
    initCategoryTabs(); // Desktop tabs
    initSwipeGestures();
    initTabs();

    // 3. Restore user's saved meal plan
    renderSavedState();
});

// Re-init drag on resize
window.addEventListener('resize', () => {
    initDesktopDragAndDrop();
});

// Export functions globally so HTML onclick handlers can find them
// (Since module scripts have their own scope)
window.addFoodItem = addFoodItem;
window.shareNative = shareNative;
window.removeFoodFromCard = removeFoodFromCard;
window.addFoodToCard = addFoodToCard;
window.autoSuggest = autoSuggest;
