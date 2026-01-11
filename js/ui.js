import { foodData, mealPlan, addItemToState, removeItemFromState } from './state.js';

// ============================================
// DOM ELEMENTS
// ============================================

export const bottomSheet = document.getElementById('bottomSheet');
export const bottomSheetOverlay = document.getElementById('bottomSheetOverlay');
export const bottomSheetContent = document.getElementById('bottomSheetContent');
export const bottomSheetTabs = document.getElementById('bottomSheetTabs');
export const closeBtn = document.getElementById('closeBottomSheet');

// ============================================
// TOAST NOTIFICATIONS
// ============================================

export function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}

// ============================================
// TAB NAVIGATION
// ============================================

export function initTabs() {
    const tabBtns = document.querySelectorAll('.toggle-btn');
    const pages = document.querySelectorAll('.page');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            // Update active tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show corresponding page
            pages.forEach(page => {
                page.classList.remove('active');
                if (page.id === `${targetTab}-page`) {
                    page.classList.add('active');
                }
            });

            // Close bottom sheet if open
            closeBottomSheet();
        });
    });
}

export function switchTab(tabName) {
    const btn = document.querySelector(`.toggle-btn[data-tab="${tabName}"]`);
    if (btn && !btn.classList.contains('active')) {
        btn.click();
    }
}

// ============================================
// BOTTOM SHEET FUNCTIONALITY
// ============================================

let currentDayCard = null;

export function openBottomSheet(dayCard) {
    currentDayCard = dayCard;
    const mealType = dayCard.dataset.meal;

    // Update title
    const dayName = dayCard.dataset.day.charAt(0).toUpperCase() + dayCard.dataset.day.slice(1);
    const mealTitle = mealType.charAt(0).toUpperCase() + mealType.slice(1);
    const maxItems = parseInt(dayCard.dataset.maxItems) || 1;
    const limitText = maxItems === 1 ? '1 item only' : `${maxItems} items max`;

    document.querySelector('.bottom-sheet-title').textContent = `${dayName} ${mealTitle} (${limitText})`;

    // Populate category tabs
    populateBottomSheetTabs(mealType);

    // Populate food items
    populateBottomSheetContent(mealType, 'all');

    // Show bottom sheet
    bottomSheet.classList.add('active');
    bottomSheetOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

export function closeBottomSheet() {
    bottomSheet.classList.remove('active');
    bottomSheetOverlay.classList.remove('active');
    document.body.style.overflow = '';
    currentDayCard = null;
}

// Set up close listeners
if (closeBtn) closeBtn.addEventListener('click', closeBottomSheet);
if (bottomSheetOverlay) bottomSheetOverlay.addEventListener('click', closeBottomSheet);

function populateBottomSheetTabs(mealType) {
    // Shared categories for both lunch and dinner
    const allCategories = [
        { id: 'all', label: 'All' },
        { id: 'noodles', label: '🍜 Noodles' },
        { id: 'rice', label: '🍚 Rice' },
        { id: 'vegetables', label: '🥬 Vegetables' },
        { id: 'chicken', label: '🍗 Chicken' },
        { id: 'fish', label: '🐟 Fish' },
        { id: 'pork', label: '🥩 Pork' },
        { id: 'eggs', label: '🥚 Eggs' },
        { id: 'prawn', label: '🦐 Prawn' },
        { id: 'soup', label: '🍲 Soup' },
        { id: 'pasta', label: '🍝 Pasta' }
    ];

    // Count items per category
    const items = foodData[mealType];
    const categoryCounts = items.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        acc['all'] = (acc['all'] || 0) + 1;
        return acc;
    }, {});

    // Filter categories with items > 0
    const activeCategories = allCategories.filter(cat => categoryCounts[cat.id] > 0);

    bottomSheetTabs.innerHTML = activeCategories.map(cat => `
        <button class="category-tab ${cat.id === 'all' ? 'active' : ''}" 
                data-category="${cat.id}" 
                data-meal="${mealType}">
            ${cat.label} <span class="tab-count">${categoryCounts[cat.id]}</span>
        </button>
    `).join('');

    // Add click handlers
    bottomSheetTabs.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            bottomSheetTabs.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            populateBottomSheetContent(mealType, tab.dataset.category);
        });
    });
}

function populateBottomSheetContent(mealType, category) {
    const items = foodData[mealType].filter(item =>
        category === 'all' || item.category === category
    );

    bottomSheetContent.innerHTML = items.map(item => `
        <div class="food-item" data-name="${item.name}" data-emoji="${item.emoji}" data-category="${item.category}">
            <span class="food-emoji">${item.emoji}</span>
            <span class="food-name">${item.name}</span>
        </div>
    `).join('');

    // Add click handlers for selection
    bottomSheetContent.querySelectorAll('.food-item').forEach(item => {
        item.addEventListener('click', () => selectFoodItem(item));
    });
}

function selectFoodItem(foodItemEl) {
    if (!currentDayCard) return;

    const maxItems = parseInt(currentDayCard.dataset.maxItems) || 1;
    const currentItems = currentDayCard.querySelectorAll('.day-card-content .food-item').length;

    if (currentItems >= maxItems) {
        // If max is 1 (Lunch), we replace the existing item
        if (maxItems === 1) {
            clearDayCard(currentDayCard);
            // Also need to clear state for this day/meal
            const day = currentDayCard.dataset.day;
            const mealType = currentDayCard.dataset.meal;
            // Remove from state (index 0 since only 1 item)
            removeItemFromState(day, mealType, 0);
        } else {
            // For multi-item (Dinner), we still block because we don't know which one to replace
            showToast(`Maximum ${maxItems} items allowed! Remove one first.`, 'error');
            return;
        }
    }

    const name = foodItemEl.dataset.name;
    const emoji = foodItemEl.dataset.emoji;
    const category = foodItemEl.dataset.category;

    addFoodToCard(currentDayCard, name, emoji, category, true); // true = save to state
    closeBottomSheet();
    showToast(`Added ${name}!`, 'success');
}

/**
 * Adds food to the DOM card.
 * @param {HTMLElement} dayCard 
 * @param {string} name 
 * @param {string} emoji 
 * @param {string} category 
 * @param {boolean} shouldSave - Whether to trigger state save (true for user action, false for loading)
 */
export function addFoodToCard(dayCard, name, emoji, category, shouldSave = false) {
    const content = dayCard.querySelector('.day-card-content');
    const day = dayCard.dataset.day;
    const mealType = dayCard.dataset.meal;

    // Create food item
    const foodItem = document.createElement('div');
    foodItem.className = 'food-item';
    foodItem.dataset.name = name;
    foodItem.dataset.category = category;
    foodItem.dataset.emoji = emoji;
    foodItem.innerHTML = `
        <span class="food-emoji">${emoji}</span>
        <span class="food-name">${name}</span>
        <button class="remove-btn">×</button>
    `;

    // Add remove listener
    foodItem.querySelector('.remove-btn').addEventListener('click', (e) => removeFoodFromCard(e.target, e));

    content.appendChild(foodItem);
    dayCard.classList.add('has-items');
    updateDayCardState(dayCard);

    if (shouldSave) {
        addItemToState(day, mealType, { name, emoji, category });
    }
}

export function removeFoodFromCard(btn, event) {
    event.stopPropagation();
    const foodItem = btn.parentElement;
    const dayCard = foodItem.closest('.day-card');

    // Find index for state removal
    const content = dayCard.querySelector('.day-card-content');
    const items = Array.from(content.querySelectorAll('.food-item'));
    const index = items.indexOf(foodItem);
    const day = dayCard.dataset.day;
    const mealType = dayCard.dataset.meal;

    foodItem.remove();
    updateDayCardState(dayCard);

    // Update state
    if (index !== -1) {
        removeItemFromState(day, mealType, index);
    }

    showToast('Item removed', 'success');
}

function updateDayCardState(dayCard) {
    const hasItems = dayCard.querySelectorAll('.day-card-content .food-item').length > 0;
    if (hasItems) {
        dayCard.classList.add('has-items');
    } else {
        dayCard.classList.remove('has-items');
    }
}

// ============================================
// DAY CARD & INIT
// ============================================

export function clearDayCard(dayCard) {
    const content = dayCard.querySelector('.day-card-content');
    const items = content.querySelectorAll('.food-item');
    items.forEach(item => item.remove());
    dayCard.classList.remove('has-items');
}

// ============================================
// DAY CARD & INIT
// ============================================

export function initDayCards() {
    document.querySelectorAll('.day-card').forEach(card => {
        // Accessibility
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Add food to ${card.dataset.day} ${card.dataset.meal}`);

        const handleInteraction = (e) => {
            // Don't open if clicking on remove button
            if (e.target.classList.contains('remove-btn')) return;

            // Allow opening even if full to support replacement (especially for lunch)
            // const maxItems = parseInt(card.dataset.maxItems) || 1;
            // const currentItems = card.querySelectorAll('.day-card-content .food-item').length;
            // if (currentItems >= maxItems) ... (removed to allow replacement)

            // On desktop (>=1024px), show the food container instead of bottom sheet
            if (window.innerWidth >= 1024) {
                currentDayCard = card; // Set active card for replacement

                // Visual feedback for selection
                document.querySelectorAll('.day-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');

                const mealType = card.dataset.meal;
                const foodContainer = document.querySelector(`#${mealType}-page .food-container`);
                if (foodContainer) {
                    // Hide all food containers first
                    document.querySelectorAll('.food-container').forEach(fc => fc.classList.remove('active'));
                    // Show the relevant one
                    foodContainer.classList.add('active');
                }
                return;
            }

            openBottomSheet(card);
        };

        card.addEventListener('click', handleInteraction);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleInteraction(e);
            }
        });
    });
}

// ============================================
// DESKTOP DRAG AND DROP
// ============================================

let draggedItem = null;

export function initDesktopDragAndDrop() {
    // Only enable on larger screens (desktop)
    if (window.innerWidth < 1024) return;

    const foodContainers = document.querySelectorAll('.food-items');
    const dayCards = document.querySelectorAll('.day-card');

    foodContainers.forEach(container => {
        container.querySelectorAll('.food-item').forEach(item => {
            item.setAttribute('draggable', true);
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
        });
    });

    dayCards.forEach(card => {
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragenter', handleDragEnter);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'copy';
    setTimeout(() => this.style.opacity = '0.4', 0);
}

function handleDragEnd() {
    this.classList.remove('dragging');
    this.style.opacity = '1';
    document.querySelectorAll('.day-card').forEach(card => card.classList.remove('drag-over'));
    draggedItem = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function handleDragEnter(e) {
    e.preventDefault();
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (!this.contains(e.relatedTarget)) {
        this.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (!draggedItem) return;

    const dayCard = this;
    const maxItems = parseInt(dayCard.dataset.maxItems) || 1;
    const currentItems = dayCard.querySelectorAll('.day-card-content .food-item').length;

    if (currentItems >= maxItems) {
        if (maxItems === 1) {
            // Replace logic for drag drop
            clearDayCard(dayCard);
            const day = dayCard.dataset.day;
            const mealType = dayCard.dataset.meal;
            removeItemFromState(day, mealType, 0);
        } else {
            showToast(`Maximum ${maxItems} items allowed!`, 'error');
            return;
        }
    }

    const name = draggedItem.dataset.name || draggedItem.querySelector('.food-name').textContent;
    const emoji = draggedItem.dataset.emoji || draggedItem.querySelector('.food-emoji').textContent;
    const category = draggedItem.dataset.category || 'all';

    addFoodToCard(dayCard, name, emoji, category, true); // true = save to state
    showToast(`Added ${name}!`, 'success');
}

// ============================================
// CATEGORY TABS (Desktop)
// ============================================

export function initCategoryTabs() {
    document.querySelectorAll('.food-container .category-tabs').forEach(container => {
        const mealType = container.dataset.meal;
        const tabs = container.querySelectorAll('.category-tab');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                filterDesktopFoodItems(mealType, tab.dataset.category);
            });
        });
    });
}

function filterDesktopFoodItems(mealType, category) {
    const container = document.getElementById(`${mealType}-food-items`);
    if (!container) return;

    container.querySelectorAll('.food-item').forEach(item => {
        if (category === 'all' || item.dataset.category === category) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ============================================
// SWIPE GESTURES
// ============================================

export function initSwipeGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    const threshold = 50;

    document.addEventListener('touchstart', (e) => {
        if (e.target.closest('.bottom-sheet') ||
            e.target.closest('.food-items') ||
            e.target.closest('.category-tabs')) {
            return;
        }
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (e.target.closest('.bottom-sheet') ||
            e.target.closest('.food-items') ||
            e.target.closest('.category-tabs')) {
            return;
        }

        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;

        handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY, threshold);
    }, { passive: true });
}

function handleSwipe(startX, startY, endX, endY, threshold) {
    const diffX = startX - endX;
    const diffY = startY - endY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > threshold) {
        if (diffX > 0) {
            switchTab('dinner');
        } else {
            switchTab('lunch');
        }
    }
}

// ============================================
// RENDER SAVED STATE
// ============================================

export function renderSavedState() {
    // Render Lunch
    Object.keys(mealPlan.lunch).forEach(day => {
        const items = mealPlan.lunch[day];
        const card = document.querySelector(`.day-card[data-day="${day}"][data-meal="lunch"]`);
        if (card && items) {
            items.forEach(item => {
                addFoodToCard(card, item.name, item.emoji, item.category, false);
            });
        }
    });

    // Render Dinner
    Object.keys(mealPlan.dinner).forEach(day => {
        const items = mealPlan.dinner[day];
        const card = document.querySelector(`.day-card[data-day="${day}"][data-meal="dinner"]`);
        if (card && items) {
            items.forEach(item => {
                addFoodToCard(card, item.name, item.emoji, item.category, false);
            });
        }
    });
}
// ============================================
// DESKTOP SIDEBAR
// ============================================

export function initDesktopSidebars() {
    populateDesktopSidebar('lunch');
    populateDesktopSidebar('dinner');
}

function populateDesktopSidebar(mealType) {
    const container = document.getElementById(`${mealType}-food-items`);
    if (!container) return;

    const items = foodData[mealType];
    container.innerHTML = items.map(item => `
        <div class="food-item" 
             draggable="true"
             data-name="${item.name}" 
             data-emoji="${item.emoji}" 
             data-category="${item.category}">
            <span class="food-emoji">${item.emoji}</span>
            <span class="food-name">${item.name}</span>
        </div>
    `).join('');

    // Add listeners
    container.querySelectorAll('.food-item').forEach(item => {
        // Drag events
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);

        // Click to add/replace
        item.addEventListener('click', () => {
            if (currentDayCard && currentDayCard.dataset.meal === mealType) {
                selectFoodItem(item);
            } else {
                showToast('Please select a day card first', 'info');
            }
        });
    });
}
