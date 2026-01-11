import { loadSampleData } from './data.js';
import {
    initDayCards,
    initDesktopDragAndDrop,
    initCategoryTabs,
    initDesktopSidebars,
    initSwipeGestures,
    initTabs,
    renderSavedState,
    addFoodToCard,
    removeFoodFromCard,
    clearDayCard,
    showToast
} from './ui.js';
import { shareNative } from './share.js';
import { addFoodItem, mealPlan, clearMealType } from './state.js';

import { autoSuggest } from './suggest.js';
import { APP_VERSION } from './version.js';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load static food data
    loadSampleData();

    // 2. Initialize UI components
    initDayCards();
    initDesktopDragAndDrop();
    initCategoryTabs(); // Desktop tabs
    initDesktopSidebars(); // Populate sidebar items
    initSwipeGestures();
    initTabs();

    // 3. Restore user's saved meal plan OR generate default
    const hasLunch = Object.values(mealPlan.lunch || {}).some(arr => arr && arr.length > 0);
    const hasDinner = Object.values(mealPlan.dinner || {}).some(arr => arr && arr.length > 0);

    if (!hasLunch && !hasDinner) {
        // First time or empty - generate default menu
        autoSuggest('lunch');
        autoSuggest('dinner');
    } else {
        renderSavedState();
    }

    // 4. Check Version
    checkVersion();

    // 5. Attach Global Event Listeners
    attachGlobalListeners();
});

// Re-init drag on resize
window.addEventListener('resize', () => {
    initDesktopDragAndDrop();
});

// Global Helpers (LOCALLY SCOPED)
function getActiveTab() {
    // Current toggle-btn has 'active' class
    const activeBtn = document.querySelector('.toggle-btn.active');
    return activeBtn ? activeBtn.dataset.tab : 'lunch';
}

function attachGlobalListeners() {
    const suggestBtn = document.getElementById('suggestBtn');
    if (suggestBtn) {
        suggestBtn.addEventListener('click', () => autoSuggest(getActiveTab()));
    }

    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => shareNative());
    }

    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => clearAll(getActiveTab()));
    }

    const closeX = document.getElementById('modalCloseX');
    if (closeX) closeX.addEventListener('click', closeVersionModal);

    const closeBtn = document.getElementById('modalCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeVersionModal);
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

function clearAll(mealType) {
    const page = document.getElementById(`${mealType}-page`);
    if (!page) return;

    const dayCards = page.querySelectorAll('.day-card');
    let clearedCount = 0;

    dayCards.forEach(card => {
        const items = card.querySelectorAll('.day-card-content .food-item');
        if (items.length > 0) {
            clearedCount += items.length;
            clearDayCard(card);
        }
    });

    // Clear state for this meal type
    clearMealType(mealType);

    if (clearedCount > 0) {
        showToast(`Cleared ${clearedCount} item${clearedCount > 1 ? 's' : ''} from ${mealType}!`, 'success');
    } else {
        showToast(`No items to clear in ${mealType}`, 'info');
    }
}
