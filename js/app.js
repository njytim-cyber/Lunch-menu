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
    initAddDishModal,
    initRecipeModal,
    initDeleteConfirmModal
} from './ui.js';
import { shareNative } from './share.js';
import { addFoodItem, mealPlan, saveMealPlan } from './state.js';

import { autoSuggest } from './suggest.js';
import {
    openTemplatesModal,
    closeTemplatesModal,
    startCreatingTemplate,
    saveNewTemplate,
    loadSavedTemplate
} from './templates.js';
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

    // 4. Init recipe modal (after state is rendered so existing items get handlers)
    initRecipeModal();

    // 5. Init delete confirmation modal
    initDeleteConfirmModal();

    // 6. Check Version
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
    shareNative();
}

function handleGlobalClear() {
    const mealType = getActiveTab();
    const cards = document.querySelectorAll(`.day-card[data-meal="${mealType}"]`);

    // Clear all food items from cards
    cards.forEach(card => {
        const day = card.dataset.day;
        const foodItems = card.querySelectorAll('.day-card-content .food-item');
        foodItems.forEach(item => item.remove());
        card.classList.remove('has-items');

        // Clear from state
        if (mealPlan[mealType] && mealPlan[mealType][day]) {
            mealPlan[mealType][day] = [];
        }
    });

    saveMealPlan();

    // Show toast
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} menu cleared!`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 2500);
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

// ============================================
// NUTRITION PANEL
// ============================================

function toggleNutritionPanel() {
    const panel = document.getElementById('nutritionPanel');
    if (!panel) return;
    panel.classList.toggle('expanded');
    updateNutritionStats();
}

function updateNutritionStats() {
    const mealType = getActiveTab();
    const statsContainer = document.getElementById('nutritionStats');
    if (!statsContainer) return;

    // Count items by category
    const categoryCounts = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    let totalItems = 0;
    let daysWithItems = 0;

    days.forEach(day => {
        const items = mealPlan[mealType]?.[day] || [];
        if (items.length > 0) daysWithItems++;
        items.forEach(item => {
            const cat = item.category || 'other';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            totalItems++;
        });
    });

    // Generate stats HTML
    const categoryEmojis = {
        noodles: '🍜', rice: '🍚', vegetables: '🥬', chicken: '🍗',
        fish: '🐟', pork: '🥩', eggs: '🥚', prawn: '🦐',
        soup: '🍲', pasta: '🍝', other: '🍽️'
    };

    let statsHTML = `<div class="stat-item total"><span class="stat-label">📅 Days Planned:</span><span class="stat-value">${daysWithItems}/7</span></div>`;
    statsHTML += `<div class="stat-item total"><span class="stat-label">🍽️ Total Items:</span><span class="stat-value">${totalItems}</span></div>`;
    statsHTML += '<div class="stat-divider"></div>';

    const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    sortedCategories.forEach(([cat, count]) => {
        const emoji = categoryEmojis[cat] || '🍽️';
        const label = cat.charAt(0).toUpperCase() + cat.slice(1);
        statsHTML += `<div class="stat-item"><span class="stat-label">${emoji} ${label}:</span><span class="stat-value">${count}</span></div>`;
    });

    if (sortedCategories.length === 0) {
        statsHTML += '<div class="stat-empty">No items planned yet</div>';
    }

    statsContainer.innerHTML = statsHTML;
}

// Initialize nutrition stats listeners after DOM is ready
setTimeout(() => {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setTimeout(updateNutritionStats, 100);
        });
    });
}, 100);

// ============================================
// FOOD DRAWER (Collapsible)
// ============================================

function toggleFoodDrawer(mealType) {
    const drawerId = mealType === 'lunch' ? 'lunchFoodDrawer' : 'dinnerFoodDrawer';
    const drawer = document.getElementById(drawerId);
    if (drawer) {
        drawer.classList.toggle('expanded');
    }
}

// ============================================
// HEADER MENU (Kebab Dropdown)
// ============================================

function toggleHeaderMenu() {
    const menu = document.getElementById('headerMenuDropdown');
    if (menu) {
        menu.classList.toggle('active');
    }
}

function closeHeaderMenu() {
    const menu = document.getElementById('headerMenuDropdown');
    if (menu) {
        menu.classList.remove('active');
    }
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('headerMenuDropdown');
    const btn = document.querySelector('.kebab-btn');

    if (menu && menu.classList.contains('active')) {
        // Close if click is NOT inside menu AND NOT on the toggle button
        if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
            menu.classList.remove('active');
        }
    }
});

// ============================================
// HELP MODAL
// ============================================

function showHelpModal() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeHelpModal() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Close help modal on backdrop click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('helpModal');
    if (modal && e.target === modal) {
        modal.classList.remove('active');
    }
});

// Export functions globally so HTML onclick handlers can find them
window.addFoodItem = addFoodItem;
window.shareNative = shareNative;
window.removeFoodFromCard = removeFoodFromCard;
window.addFoodToCard = addFoodToCard;
window.autoSuggest = autoSuggest;
window.handleGlobalSuggest = handleGlobalSuggest;
window.handleGlobalShare = handleGlobalShare;
window.handleGlobalClear = handleGlobalClear;
window.closeVersionModal = closeVersionModal;
window.toggleNutritionPanel = toggleNutritionPanel;
window.updateNutritionStats = updateNutritionStats;
window.toggleFoodDrawer = toggleFoodDrawer;
window.toggleHeaderMenu = toggleHeaderMenu;
window.showHelpModal = showHelpModal;
window.closeHelpModal = closeHelpModal;
window.openTemplatesModal = openTemplatesModal;
window.closeTemplatesModal = closeTemplatesModal;
window.startCreatingTemplate = startCreatingTemplate;
window.saveNewTemplate = saveNewTemplate;
window.loadSavedTemplate = loadSavedTemplate;
