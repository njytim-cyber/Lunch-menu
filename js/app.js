import { loadSampleData, loadCustomDishesToFoodData } from './data.js';
import {
    initDayCards,
    initDesktopDragAndDrop,
    initCategoryTabs,
    initSwipeGestures,
    initTabs,
    renderSavedState,
    addFoodToCard,
    removeFoodFromCard,
    initDesktopSidebars,
    initAddDishModal
} from './ui.js';
import { shareNative } from './share.js';
import { addFoodItem } from './state.js';

import { autoSuggest } from './suggest.js';
import { APP_VERSION } from './version.js';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load static food data
    loadSampleData();
    loadCustomDishesToFoodData();

    // 2. Initialize UI components
    initDayCards();
    initDesktopSidebars(); // Desktop Sidebar
    initDesktopDragAndDrop();
    initCategoryTabs(); // Desktop tabs
    initSwipeGestures();
    initTabs();
    initAddDishModal();

    // 3. Restore user's saved meal plan
    renderSavedState();

    // 4. Check Version
    checkVersion();
});

// Re-init drag on resize
window.addEventListener('resize', () => {
    initDesktopDragAndDrop();
});

// Global Helpers
function getActiveTab() {
    // Current toggle-btn has 'active' class
    const activeBtn = document.querySelector('.toggle-btn.active');
    return activeBtn ? activeBtn.dataset.tab : 'lunch';
}

function handleGlobalSuggest() {
    autoSuggest(getActiveTab());
}

function handleGlobalShare() {
    shareNative(getActiveTab());
}

// Version Control
function checkVersion() {
    const lastVersion = localStorage.getItem('app_version');
    if (lastVersion !== APP_VERSION) {
        const modal = document.getElementById('versionModal');
        if (modal) {
            // Update title dynamically if needed, or assume HTML matches
            modal.querySelector('h2').textContent = `✨ New in v${APP_VERSION}`;
            modal.classList.add('active');
        }
    }
}

function closeVersionModal() {
    document.getElementById('versionModal').classList.remove('active');
    localStorage.setItem('app_version', APP_VERSION);
}

// Export functions globally so HTML onclick handlers can find them
window.addFoodItem = addFoodItem;
window.shareNative = shareNative;
window.removeFoodFromCard = removeFoodFromCard;
window.addFoodToCard = addFoodToCard;
window.autoSuggest = autoSuggest;
window.handleGlobalSuggest = handleGlobalSuggest;
window.handleGlobalShare = handleGlobalShare;
window.closeVersionModal = closeVersionModal;
