import { foodData, mealPlan, addItemToState, removeItemFromState, addCustomDish, removeCustomDish, getRecipe, setRecipe, toggleLockItem, isItemLocked, reorderItems } from './state.js';

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
// CONFETTI CELEBRATION
// ============================================

export function triggerConfetti() {
    const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84', '#ee5a24'];
    const confettiCount = 150;
    const container = document.createElement('div');
    container.className = 'confetti-container';
    container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10000; overflow: hidden;';
    document.body.appendChild(container);

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 10 + 5;
        const left = Math.random() * 100;
        const animDuration = Math.random() * 2 + 2;
        const delay = Math.random() * 0.5;

        // Random shapes: square, circle, or rectangle
        const shapes = ['50%', '0%', '0%'];
        const borderRadius = shapes[Math.floor(Math.random() * shapes.length)];
        const rotation = Math.random() * 360;

        confetti.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size * (Math.random() * 0.5 + 0.5)}px;
            background: ${color};
            left: ${left}%;
            top: -20px;
            border-radius: ${borderRadius};
            transform: rotate(${rotation}deg);
            animation: confettiFall ${animDuration}s ease-out ${delay}s forwards;
            opacity: 0;
        `;
        container.appendChild(confetti);
    }

    // Add keyframes if not exists
    if (!document.getElementById('confetti-keyframes')) {
        const style = document.createElement('style');
        style.id = 'confetti-keyframes';
        style.textContent = `
            @keyframes confettiFall {
                0% {
                    opacity: 1;
                    transform: translateY(0) rotate(0deg) scale(1);
                }
                50% {
                    opacity: 1;
                }
                100% {
                    opacity: 0;
                    transform: translateY(100vh) rotate(720deg) scale(0.5);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Clean up after animation
    setTimeout(() => container.remove(), 4000);
}

// ============================================
// UNDO ACTION SYSTEM
// ============================================

let undoStack = [];
let undoToastEl = null;
let undoTimeout = null;
const UNDO_TIMEOUT = 5000; // 5 seconds

function pushUndoAction(action) {
    undoStack.push(action);
    if (undoStack.length > 5) undoStack.shift(); // Keep only last 5
    showUndoToast(action);
}

function showUndoToast(action) {
    // Remove existing undo toast
    if (undoToastEl) {
        undoToastEl.remove();
        clearTimeout(undoTimeout);
    }

    undoToastEl = document.createElement('div');
    undoToastEl.className = 'undo-toast';
    undoToastEl.innerHTML = `
        <span class="undo-message">🗑️ ${action.itemName} removed</span>
        <button class="undo-btn">Undo</button>
    `;
    document.body.appendChild(undoToastEl);

    // Animate in
    setTimeout(() => undoToastEl.classList.add('show'), 10);

    // Undo button click
    undoToastEl.querySelector('.undo-btn').addEventListener('click', () => {
        performUndo();
    });

    // Auto-hide after timeout
    undoTimeout = setTimeout(() => {
        hideUndoToast();
    }, UNDO_TIMEOUT);
}

function hideUndoToast() {
    if (undoToastEl) {
        undoToastEl.classList.remove('show');
        setTimeout(() => {
            if (undoToastEl) undoToastEl.remove();
            undoToastEl = null;
        }, 300);
    }
}

function performUndo() {
    if (undoStack.length === 0) return;

    const action = undoStack.pop();

    if (action.type === 'remove') {
        // Find the day card
        const dayCard = document.querySelector(`.day-card[data-day="${action.day}"][data-meal="${action.mealType}"]`);
        if (dayCard) {
            addFoodToCard(dayCard, action.itemName, action.itemEmoji, action.itemCategory, true);
            showToast(`↩️ Restored ${action.itemName}!`, 'success');
        }
    }

    hideUndoToast();
}

// ============================================
// DELETE CONFIRMATION MODAL
// ============================================

let pendingDeleteDish = null;
let pendingDeleteMealType = null;

function showDeleteConfirmation(dishName, mealType) {
    pendingDeleteDish = dishName;
    pendingDeleteMealType = mealType;

    const modal = document.getElementById('deleteConfirmModal');
    const text = document.getElementById('deleteConfirmText');

    if (modal && text) {
        text.textContent = `Are you sure you want to permanently delete "${dishName}"?`;
        modal.classList.add('active');
    }
}

export function initDeleteConfirmModal() {
    const modal = document.getElementById('deleteConfirmModal');
    const confirmBtn = document.getElementById('deleteConfirmBtn');
    const cancelBtn = document.getElementById('deleteCancelBtn');

    if (!modal || !confirmBtn || !cancelBtn) return;

    confirmBtn.addEventListener('click', () => {
        if (pendingDeleteDish && pendingDeleteMealType) {
            // Remove from state
            removeCustomDish(pendingDeleteMealType, pendingDeleteDish);

            // Remove from foodData
            const index = foodData[pendingDeleteMealType].findIndex(d => d.name === pendingDeleteDish);
            if (index !== -1) {
                foodData[pendingDeleteMealType].splice(index, 1);
            }

            // Refresh sidebar
            populateDesktopSidebar(pendingDeleteMealType);

            showToast(`🗑️ Deleted "${pendingDeleteDish}"`, 'success');
            triggerConfetti(); // Celebrate the cleanup!
        }

        modal.classList.remove('active');
        pendingDeleteDish = null;
        pendingDeleteMealType = null;
    });

    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        pendingDeleteDish = null;
        pendingDeleteMealType = null;
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            pendingDeleteDish = null;
            pendingDeleteMealType = null;
        }
    });
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
    document.querySelector('.bottom-sheet-title').textContent = `Add ${mealType === 'lunch' ? 'Lunch' : 'Dinner'} for ${dayName}`;

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

    // Add "Add New Dish" button if category is All or we just want it always accessible
    if (category === 'all') {
        const addBtn = document.createElement('div');
        addBtn.className = 'food-item add-new-dish-item';
        addBtn.innerHTML = `
            <span class="food-emoji" style="font-size: 32px; font-weight: bold;">+</span>
            <span class="food-name">Add New</span>
        `;
        addBtn.addEventListener('click', () => {
            closeBottomSheet();
            // Trigger the corresponding desktop button to open modal
            const btnId = mealType === 'lunch' ? 'addLunchDishBtn' : 'addDinnerDishBtn';
            const btn = document.getElementById(btnId);
            if (btn) btn.click();
        });

        // Add as first item
        bottomSheetContent.insertBefore(addBtn, bottomSheetContent.firstChild);
    }

    // Add click handlers for selection
    bottomSheetContent.querySelectorAll('.food-item:not(.add-new-dish-item)').forEach(item => {
        item.addEventListener('click', () => selectFoodItem(item));
    });
}

function selectFoodItem(foodItemEl) {
    if (!currentDayCard) return;

    const maxItems = parseInt(currentDayCard.dataset.maxItems) || 1;
    const currentItems = currentDayCard.querySelectorAll('.day-card-content .food-item').length;

    if (currentItems >= maxItems) {
        showToast(`Maximum ${maxItems} items allowed!`, 'error');
        return;
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
 * @param {boolean} isLocked - Whether the item is locked
 */
export function addFoodToCard(dayCard, name, emoji, category, shouldSave = false, isLocked = false) {
    const content = dayCard.querySelector('.day-card-content');
    const day = dayCard.dataset.day;
    const mealType = dayCard.dataset.meal;

    // Create food item
    const foodItem = document.createElement('div');
    foodItem.className = 'food-item' + (isLocked ? ' locked' : '');
    foodItem.dataset.name = name;
    foodItem.dataset.category = category;
    foodItem.dataset.emoji = emoji;
    foodItem.draggable = true; // Make draggable for reordering
    foodItem.innerHTML = `
        <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
        <button class="lock-btn" title="Lock item">${isLocked ? '🔒' : '🔓'}</button>
        <span class="food-emoji">${emoji}</span>
        <span class="food-name">${name}</span>
        <button class="remove-btn">×</button>
    `;

    // Add lock listener
    foodItem.querySelector('.lock-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const items = Array.from(content.querySelectorAll('.food-item'));
        const index = items.indexOf(foodItem);
        const newLockState = toggleLockItem(day, mealType, index);

        if (newLockState) {
            foodItem.classList.add('locked');
            e.target.textContent = '🔒';
            showToast('🔒 Item locked!', 'success');
        } else {
            foodItem.classList.remove('locked');
            e.target.textContent = '🔓';
            showToast('🔓 Item unlocked', 'info');
        }
    });

    // Add remove listener
    foodItem.querySelector('.remove-btn').addEventListener('click', (e) => removeFoodFromCard(e.target, e));

    // Add drag-to-reorder listeners
    foodItem.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('food-item')) {
            e.target.classList.add('dragging-reorder');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', ''); // Required for Firefox
        }
    });

    foodItem.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging-reorder');
        document.querySelectorAll('.food-item.drag-over-top, .food-item.drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
    });

    foodItem.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingItem = content.querySelector('.dragging-reorder');
        if (!draggingItem || draggingItem === foodItem) return;

        const rect = foodItem.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        foodItem.classList.remove('drag-over-top', 'drag-over-bottom');
        if (e.clientY < midY) {
            foodItem.classList.add('drag-over-top');
        } else {
            foodItem.classList.add('drag-over-bottom');
        }
    });

    foodItem.addEventListener('dragleave', () => {
        foodItem.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    foodItem.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggingItem = content.querySelector('.dragging-reorder');
        if (!draggingItem || draggingItem === foodItem) return;

        const items = Array.from(content.querySelectorAll('.food-item'));
        const fromIndex = items.indexOf(draggingItem);
        let toIndex = items.indexOf(foodItem);

        // Adjust based on drop position
        const rect = foodItem.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY > midY && fromIndex < toIndex) {
            // Dropping below, no adjustment needed
        } else if (e.clientY <= midY && fromIndex > toIndex) {
            // Dropping above, no adjustment needed
        } else if (e.clientY > midY) {
            toIndex++;
        }

        // Move in DOM
        if (fromIndex < toIndex) {
            content.insertBefore(draggingItem, foodItem.nextSibling);
        } else {
            content.insertBefore(draggingItem, foodItem);
        }

        // Update state
        reorderItems(day, mealType, fromIndex, toIndex > fromIndex ? toIndex - 1 : toIndex);

        foodItem.classList.remove('drag-over-top', 'drag-over-bottom');
        showToast('📋 Reordered!', 'success');
    });

    content.appendChild(foodItem);
    dayCard.classList.add('has-items');
    updateDayCardState(dayCard);

    if (shouldSave) {
        addItemToState(day, mealType, { name, emoji, category, locked: isLocked });
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

    // Check if item is locked
    if (isItemLocked(day, mealType, index)) {
        showToast('🔒 Unlock item first!', 'error');
        return;
    }

    // Store for undo before removing
    const itemName = foodItem.dataset.name;
    const itemEmoji = foodItem.dataset.emoji;
    const itemCategory = foodItem.dataset.category;

    foodItem.remove();
    updateDayCardState(dayCard);

    // Update state
    if (index !== -1) {
        removeItemFromState(day, mealType, index);
    }

    // Push to undo stack
    pushUndoAction({
        type: 'remove',
        day,
        mealType,
        itemName,
        itemEmoji,
        itemCategory,
        index
    });
}

/**
 * Clears all unlocked items from a day card without toast spam.
 * @param {HTMLElement} dayCard
 * @returns {number} count of items removed
 */
export function clearDayCard(dayCard) {
    const content = dayCard.querySelector('.day-card-content');
    const items = Array.from(content.querySelectorAll('.food-item'));
    const day = dayCard.dataset.day;
    const mealType = dayCard.dataset.meal;
    let removedCount = 0;

    // We accept that removing items from the array changes indices.
    // It is safest to remove from end to start to avoid index shift issues if we were manipulating the array directly,
    // but removeItemFromState handles splicing.
    // However, if we call removeItemFromState multiple times with original indices, it will be wrong.
    // Actually, removeItemFromState(day, mealType, index) splices the array.
    // So if we remove item 0, the next item becomes item 0.
    // So we should filter UNLOCKED items first, then remove them one by one?
    // OR: just construct the new state and generic "save" it.
    // But removeItemFromState is convenient.
    // Let's iterate backwards specifically for state consistency if we use removeItemFromState.

    for (let i = items.length - 1; i >= 0; i--) {
        const foodItem = items[i];

        // Check lock via state helper to be sure
        if (isItemLocked(day, mealType, i)) {
            continue;
        }

        // Remove from DOM
        foodItem.remove();

        // Remove from State
        removeItemFromState(day, mealType, i);

        removedCount++;
    }

    updateDayCardState(dayCard);

    if (removedCount > 0) {
        // Optional: One single toast or return count for caller to toast
        // showToast(`Cleared ${removedCount} items`, 'info'); 
    }

    return removedCount;
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

export function initDayCards() {
    document.querySelectorAll('.day-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't open if clicking on remove button
            if (e.target.classList.contains('remove-btn')) return;

            // Check if can add more items
            const maxItems = parseInt(card.dataset.maxItems) || 1;
            const currentItems = card.querySelectorAll('.day-card-content .food-item').length;

            if (currentItems >= maxItems) {
                showToast(`Maximum ${maxItems} items. Tap an item to remove.`, 'error');
                return;
            }

            openBottomSheet(card);
        });
    });
}

// ============================================
// DESKTOP DRAG AND DROP
// ============================================

let draggedItem = null;

export function initDesktopDragAndDrop() {
    // Only enable on larger screens
    if (window.innerWidth < 769) return;

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
        showToast(`Maximum ${maxItems} items allowed!`, 'error');
        return;
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
    document.querySelectorAll('.category-tabs').forEach(container => {
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
                addFoodToCard(card, item.name, item.emoji, item.category, false, item.locked || false);
            });
        }
    });

    // Render Dinner
    Object.keys(mealPlan.dinner).forEach(day => {
        const items = mealPlan.dinner[day];
        const card = document.querySelector(`.day-card[data-day="${day}"][data-meal="dinner"]`);
        if (card && items) {
            items.forEach(item => {
                addFoodToCard(card, item.name, item.emoji, item.category, false, item.locked || false);
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

export function populateDesktopSidebar(mealType) {
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
            // We need to check if a day card is selected or just default?
            // The original code used `currentDayCard`.
            // But `currentDayCard` is set when opening bottom sheet?
            // Or when clicking a day card?
            // If desktop drag/drop is used, `currentDayCard` might be null.
            // But `selectFoodItem` uses `currentDayCard`.
            // If clicking from sidebar, we need to know WHERE to add.
            // Usually desktop sidebar is for Drag and Drop.
            // Clicking might show toast "Drag to a day".

            // Wait, previous code had:
            /*
            if (currentDayCard && currentDayCard.dataset.meal === mealType) {
                selectFoodItem(item);
            } else {
                showToast('Please select a day card first', 'info');
            }
            */
            // I'll keep this logic.
            // But I need to ensure `handleDragStart` etc are available (they are local functions in ui.js).
            // NO, `handleDragStart` is at line 312. It is NOT exported. It is module scope?
            // Yes, `function handleDragStart` at top level.
        });

        item.addEventListener('click', () => {
            // I assume `currentDayCard` is module level variable.
            // Yes, line 74 `let currentDayCard = null;`.
            if (currentDayCard && currentDayCard.dataset.meal === mealType) {
                selectFoodItem(item);
            } else {
                showToast('Select a day first, or drag item', 'info');
            }
        });

        // Double-click to delete custom dish
        item.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const dishName = item.dataset.name;
            const isCustom = items.find(i => i.name === dishName)?.isCustom;

            if (!isCustom) {
                showToast('Only custom dishes can be deleted', 'info');
                return;
            }

            showDeleteConfirmation(dishName, mealType);
        });
    });
}

export function initAddDishModal() {
    const modal = document.getElementById('addDishModal');
    const closeX = document.getElementById('addDishCloseX');
    const cancelBtn = document.getElementById('addDishCancelBtn');
    const submitBtn = document.getElementById('addDishSubmitBtn');
    const nameInput = document.getElementById('dishName');
    const emojiSelect = document.getElementById('dishEmoji');
    const categorySelect = document.getElementById('dishCategory');
    const recipeTextarea = document.getElementById('dishRecipe');
    const mealBtns = document.querySelectorAll('.meal-type-btn');

    // Open triggers
    const openHandlers = (e) => {
        const btn = e.target.closest('.add-dish-btn');
        if (!btn) return;

        const meal = btn.dataset.meal;

        nameInput.value = '';
        emojiSelect.selectedIndex = 0;
        categorySelect.selectedIndex = 0;
        if (recipeTextarea) recipeTextarea.value = '';

        mealBtns.forEach(b => {
            if (b.dataset.meal === meal) b.classList.add('active');
            else b.classList.remove('active');
        });

        modal.classList.add('active');
        setTimeout(() => nameInput.focus(), 100);
    };

    const desktopLunchBtn = document.getElementById('addLunchDishBtn');
    const desktopDinnerBtn = document.getElementById('addDinnerDishBtn');
    if (desktopLunchBtn) desktopLunchBtn.addEventListener('click', openHandlers);
    if (desktopDinnerBtn) desktopDinnerBtn.addEventListener('click', openHandlers);

    const close = () => modal.classList.remove('active');
    if (closeX) closeX.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);

    mealBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            mealBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    submitBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) {
            showToast('Please enter a dish name', 'error');
            return;
        }

        const emoji = emojiSelect.value;
        const category = categorySelect.value;
        const recipe = recipeTextarea ? recipeTextarea.value.trim() : '';
        const activeMealBtn = document.querySelector('.meal-type-btn.active');
        const mealType = activeMealBtn ? activeMealBtn.dataset.meal : 'lunch';

        const success = addCustomDish(name, emoji, mealType, category);

        if (success) {
            foodData[mealType].push({ name, emoji, category, isCustom: true });
            populateDesktopSidebar(mealType);

            // Save recipe if provided
            if (recipe) {
                setRecipe(name, recipe);
            }

            showToast(`🎉 Added ${name} to ${mealType} menu!`, 'success');
            triggerConfetti();
            close();
        } else {
            showToast('Dish already exists!', 'error');
        }
    });

    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitBtn.click();
    });
}

// ============================================
// RECIPE MODAL FUNCTIONALITY
// ============================================

let currentRecipeDish = null;
let longPressTimer = null;
const LONG_PRESS_DURATION = 500; // ms

export function initRecipeModal() {
    const modal = document.getElementById('recipeModal');
    const titleEl = document.getElementById('recipeModalTitle');
    const displayEl = document.getElementById('recipeDisplay');
    const editGroupEl = document.getElementById('recipeEditGroup');
    const textareaEl = document.getElementById('recipeTextarea');
    const closeBtn = document.getElementById('recipeCloseX');
    const editBtn = document.getElementById('recipeEditBtn');
    const saveBtn = document.getElementById('recipeSaveBtn');
    const cancelBtn = document.getElementById('recipeCancelBtn');

    if (!modal) return;

    function openRecipeModal(dishName) {
        currentRecipeDish = dishName;
        titleEl.textContent = `📖 ${dishName}`;

        const recipe = getRecipe(dishName);
        if (recipe) {
            displayEl.innerHTML = `<p style="margin:0; white-space: pre-wrap;">${escapeHtml(recipe)}</p>`;
        } else {
            displayEl.innerHTML = '<p class="recipe-empty">No recipe added yet</p>';
        }

        // Reset to view mode
        displayEl.style.display = 'block';
        editGroupEl.style.display = 'none';
        editBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';

        modal.classList.add('active');
    }

    function closeRecipeModal() {
        modal.classList.remove('active');
        currentRecipeDish = null;
    }

    function enterEditMode() {
        const recipe = getRecipe(currentRecipeDish);
        textareaEl.value = recipe || '';

        displayEl.style.display = 'none';
        editGroupEl.style.display = 'block';
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';

        setTimeout(() => textareaEl.focus(), 100);
    }

    function saveRecipeChanges() {
        const newRecipe = textareaEl.value.trim();
        setRecipe(currentRecipeDish, newRecipe);

        // Update display
        if (newRecipe) {
            displayEl.innerHTML = `<p style="margin:0; white-space: pre-wrap;">${escapeHtml(newRecipe)}</p>`;
        } else {
            displayEl.innerHTML = '<p class="recipe-empty">No recipe added yet</p>';
        }

        // Back to view mode
        displayEl.style.display = 'block';
        editGroupEl.style.display = 'none';
        editBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';

        showToast('Recipe saved!', 'success');
    }

    function cancelEdit() {
        displayEl.style.display = 'block';
        editGroupEl.style.display = 'none';
        editBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Event listeners for modal buttons
    if (closeBtn) closeBtn.addEventListener('click', closeRecipeModal);
    if (editBtn) editBtn.addEventListener('click', enterEditMode);
    if (saveBtn) saveBtn.addEventListener('click', saveRecipeChanges);
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeRecipeModal();
    });

    // Long-press detection for food items in day cards
    function setupLongPress(element, dishName) {
        // Touch events (mobile)
        element.addEventListener('touchstart', (e) => {
            // Don't trigger on remove button
            if (e.target.classList.contains('remove-btn')) return;

            // Get dish name from the element's data attribute at event time
            const foodItem = e.target.closest('.food-item');
            const currentDishName = foodItem ? foodItem.dataset.name : dishName;

            longPressTimer = setTimeout(() => {
                e.preventDefault();
                openRecipeModal(currentDishName);
            }, LONG_PRESS_DURATION);
        }, { passive: false });

        element.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        });

        element.addEventListener('touchmove', () => {
            clearTimeout(longPressTimer);
        });

        // Right-click (desktop) - use capture phase and stop propagation
        element.addEventListener('contextmenu', (e) => {
            // Don't trigger on remove button
            if (e.target.classList.contains('remove-btn')) return;

            // Get dish name from the element's data attribute at event time
            const foodItem = e.target.closest('.food-item');
            const currentDishName = foodItem ? foodItem.dataset.name : dishName;

            e.preventDefault();
            e.stopPropagation();
            openRecipeModal(currentDishName);
            return false;
        }, true); // Use capture phase
    }

    // Use MutationObserver to attach long-press to dynamically added food items in day cards
    const dayCards = document.querySelectorAll('.day-card');
    dayCards.forEach(card => {
        const content = card.querySelector('.day-card-content');
        if (!content) return;

        // Observer for new food items
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList.contains('food-item')) {
                        const dishName = node.dataset.name;
                        if (dishName) {
                            setupLongPress(node, dishName);
                        }
                    }
                });
            });
        });

        observer.observe(content, { childList: true });

        // Also set up for existing items (loaded from saved state)
        content.querySelectorAll('.food-item').forEach(item => {
            const dishName = item.dataset.name;
            if (dishName) {
                setupLongPress(item, dishName);
            }
        });
    });

    // Also attach to sidebar food items (desktop "Available Items" section)
    const sidebarContainers = document.querySelectorAll('.food-items');
    sidebarContainers.forEach(container => {
        // Observer for sidebar items (they get repopulated)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList.contains('food-item')) {
                        const dishName = node.dataset.name;
                        if (dishName) {
                            setupLongPress(node, dishName);
                        }
                    }
                });
            });
        });
        observer.observe(container, { childList: true });

        // Existing items
        container.querySelectorAll('.food-item').forEach(item => {
            const dishName = item.dataset.name;
            if (dishName) {
                setupLongPress(item, dishName);
            }
        });
    });

    // Also attach to bottom sheet food items (mobile)
    const bottomSheetContent = document.getElementById('bottomSheetContent');
    if (bottomSheetContent) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList.contains('food-item') && !node.classList.contains('add-new-dish-item')) {
                        const dishName = node.dataset.name;
                        if (dishName) {
                            setupLongPress(node, dishName);
                        }
                    }
                });
            });
        });
        observer.observe(bottomSheetContent, { childList: true });
    }

    // Expose for external use
    window.openRecipeModal = openRecipeModal;
}
