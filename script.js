// ============================================
// TAB NAVIGATION
// ============================================

const tabBtns = document.querySelectorAll('.tab-btn');
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

// ============================================
// FOOD DATA STORAGE
// ============================================

const foodData = {
    lunch: [],
    dinner: []
};

// ============================================
// BOTTOM SHEET FUNCTIONALITY
// ============================================

let currentDayCard = null;
const bottomSheet = document.getElementById('bottomSheet');
const bottomSheetOverlay = document.getElementById('bottomSheetOverlay');
const bottomSheetContent = document.getElementById('bottomSheetContent');
const bottomSheetTabs = document.getElementById('bottomSheetTabs');
const closeBtn = document.getElementById('closeBottomSheet');

function openBottomSheet(dayCard) {
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

function closeBottomSheet() {
    bottomSheet.classList.remove('active');
    bottomSheetOverlay.classList.remove('active');
    document.body.style.overflow = '';
    currentDayCard = null;
}

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
        showToast(`Maximum ${maxItems} items allowed!`, 'error');
        return;
    }

    const name = foodItemEl.dataset.name;
    const emoji = foodItemEl.dataset.emoji;
    const category = foodItemEl.dataset.category;

    addFoodToCard(currentDayCard, name, emoji, category);
    closeBottomSheet();
    showToast(`Added ${name}!`, 'success');
}

function addFoodToCard(dayCard, name, emoji, category) {
    const content = dayCard.querySelector('.day-card-content');

    // Create food item
    const foodItem = document.createElement('div');
    foodItem.className = 'food-item';
    foodItem.dataset.name = name;
    foodItem.dataset.category = category;
    foodItem.innerHTML = `
        <span class="food-emoji">${emoji}</span>
        <span class="food-name">${name}</span>
        <button class="remove-btn" onclick="removeFoodFromCard(this, event)">×</button>
    `;

    content.appendChild(foodItem);
    dayCard.classList.add('has-items');
    updateDayCardState(dayCard);
}

function removeFoodFromCard(btn, event) {
    event.stopPropagation();
    const foodItem = btn.parentElement;
    const dayCard = foodItem.closest('.day-card');
    foodItem.remove();
    updateDayCardState(dayCard);
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

// Close bottom sheet handlers
closeBtn.addEventListener('click', closeBottomSheet);
bottomSheetOverlay.addEventListener('click', closeBottomSheet);

// ============================================
// DAY CARD CLICK HANDLERS
// ============================================

function initDayCards() {
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
// DESKTOP DRAG AND DROP (for larger screens)
// ============================================

let draggedItem = null;
let sourceContainer = null;

function initDesktopDragAndDrop() {
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
    sourceContainer = this.parentElement;
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

    addFoodToCard(dayCard, name, emoji, category);
    showToast(`Added ${name}!`, 'success');
}

// ============================================
// ADD FOOD ITEMS TO DATA
// ============================================

function addFoodItem(name, emoji, mealType = 'lunch', category = 'all') {
    foodData[mealType].push({ name, emoji, category });

    // Also add to desktop container if it exists
    const container = document.getElementById(`${mealType}-food-items`);
    if (container) {
        const foodItem = document.createElement('div');
        foodItem.className = 'food-item';
        foodItem.setAttribute('data-name', name);
        foodItem.setAttribute('data-emoji', emoji);
        foodItem.setAttribute('data-category', category);
        foodItem.innerHTML = `
            <span class="food-emoji">${emoji}</span>
            <span class="food-name">${name}</span>
        `;

        // Desktop drag support
        if (window.innerWidth >= 769) {
            foodItem.setAttribute('draggable', true);
            foodItem.addEventListener('dragstart', handleDragStart);
            foodItem.addEventListener('dragend', handleDragEnd);
        }

        container.appendChild(foodItem);
    }
}

// ============================================
// SAMPLE DATA
// ============================================

function addSampleItems() {
    // LUNCH ITEMS
    addFoodItem('Rigatoni', '🍝', 'lunch', 'pasta');
    addFoodItem('Cheesy Rigatoni', '🧀', 'lunch', 'pasta');
    addFoodItem('Chicken Pasta and Broccoli', '🥦', 'lunch', 'pasta');
    addFoodItem('Chicken Rice', '🍗', 'lunch', 'rice');
    addFoodItem('Soy Chicken and Chye Sim', '🥬', 'lunch', 'rice');
    addFoodItem('Chicken and Mushroom Rice', '🍄', 'lunch', 'rice');
    addFoodItem('Crispy Noodle', '🍜', 'lunch', 'noodles');
    addFoodItem('Bee Hoon', '🍜', 'lunch', 'noodles');
    addFoodItem('Bee Hoon and Seaweed Chicken', '🌿', 'lunch', 'noodles');
    addFoodItem('Mee Sua Soup', '🍜', 'lunch', 'soup');
    addFoodItem('Kway Teow Soup', '🍲', 'lunch', 'soup');
    addFoodItem('Porridge', '🥣', 'lunch', 'rice');
    addFoodItem('Fish Ball Noodle', '🍜', 'lunch', 'noodles');
    addFoodItem('Fried Rice', '🍚', 'lunch', 'rice');

    // DINNER ITEMS
    addFoodItem('Rice', '🍚', 'dinner', 'rice');
    addFoodItem('Kai Lan', '🥬', 'dinner', 'vegetables');
    addFoodItem('Baby Spinach', '🥬', 'dinner', 'vegetables');
    addFoodItem('Red Spinach', '🥬', 'dinner', 'vegetables');
    addFoodItem('Kang Kong', '🥬', 'dinner', 'vegetables');
    addFoodItem('Cabbage', '🥬', 'dinner', 'vegetables');
    addFoodItem('WaWa Vegetable', '🥬', 'dinner', 'vegetables');
    addFoodItem('Broccoli', '🥦', 'dinner', 'vegetables');
    addFoodItem('Baby Kailan', '🥬', 'dinner', 'vegetables');
    addFoodItem('Kailan', '🥬', 'dinner', 'vegetables');
    addFoodItem('Sliced Fish with Ginger', '🐟', 'dinner', 'fish');
    addFoodItem('Claypot Sliced Fish with Eggplant', '🍆', 'dinner', 'fish');
    addFoodItem('Fried Seabass', '🐟', 'dinner', 'fish');
    addFoodItem('Fried Salmon', '🍣', 'dinner', 'fish');
    addFoodItem('Steam Fish Pomfret', '🐟', 'dinner', 'fish');
    addFoodItem('Steam Fish White Pomfret', '🐟', 'dinner', 'fish');
    addFoodItem('Fish and Fish Soup', '🍲', 'dinner', 'fish');
    addFoodItem('Steam Fish (Ginger/Spring Onion)', '🐟', 'dinner', 'fish');
    addFoodItem('Egg with Onion', '🥚', 'dinner', 'eggs');
    addFoodItem('Egg with Carrot', '🥕', 'dinner', 'eggs');
    addFoodItem('Egg with Tomato', '🍅', 'dinner', 'eggs');
    addFoodItem('Claypot Tofu', '🧈', 'dinner', 'eggs');
    addFoodItem('Corn Soup', '🌽', 'dinner', 'eggs');
    addFoodItem('Steamed Chicken with Mushrooms', '🍄', 'dinner', 'chicken');
    addFoodItem('Chicken with Salted Bean Paste', '🍗', 'dinner', 'chicken');
    addFoodItem('Curry Chicken', '🍛', 'dinner', 'chicken');
    addFoodItem('Fried Chicken Wing', '🍗', 'dinner', 'chicken');
    addFoodItem('Steamed Minced Pork', '🥩', 'dinner', 'pork');
    addFoodItem('Sliced Pork with Parsley', '🥩', 'dinner', 'pork');
    addFoodItem('Sliced Pork with Sichuan Veg', '🌶️', 'dinner', 'pork');
    addFoodItem('Pork with Egg and Tau Pok', '🥚', 'dinner', 'pork');
    addFoodItem('Japanese Pork Cutlet', '🍖', 'dinner', 'pork');
    addFoodItem('Pork Rib Soup', '🍲', 'dinner', 'pork');
    addFoodItem('Crispy Prawn Ball', '🦐', 'dinner', 'prawn');
    addFoodItem('Prawn with Glass Noodle', '🦐', 'dinner', 'prawn');
    addFoodItem('Cheesy Rigatoni', '🧀', 'dinner', 'pasta');
}

// ============================================
// CATEGORY TAB FILTERING (Desktop)
// ============================================

function initCategoryTabs() {
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
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'info') {
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
// SHARE FUNCTIONALITY
// ============================================

function generateMealPlanText(mealType) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const page = document.getElementById(`${mealType}-page`);

    let mealPlanText = `📅 Weekly ${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Menu\n`;
    mealPlanText += '═'.repeat(30) + '\n\n';

    let hasAnyItems = false;

    days.forEach((day, index) => {
        const card = page.querySelector(`.day-card[data-day="${day}"]`);
        const items = card.querySelectorAll('.day-card-content .food-item');

        if (items.length > 0) {
            hasAnyItems = true;
            mealPlanText += `${dayNames[index]}:\n`;
            items.forEach(item => {
                const emoji = item.querySelector('.food-emoji')?.textContent || '🍽️';
                const name = item.querySelector('.food-name')?.textContent || 'Unknown';
                mealPlanText += `  ${emoji} ${name}\n`;
            });
            mealPlanText += '\n';
        } else {
            mealPlanText += `${dayNames[index]}: (not planned)\n\n`;
        }
    });

    if (!hasAnyItems) return null;

    mealPlanText += '═'.repeat(30) + '\n';
    mealPlanText += '🍽️ Made with Weekly Meal Planner';

    return mealPlanText;
}

function shareMealPlan(mealType) {
    const text = generateMealPlanText(mealType);
    if (!text) {
        showToast('No meals planned yet!', 'error');
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        showToast('Meal plan copied! 📋', 'success');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

function shareNative(mealType) {
    const text = generateMealPlanText(mealType);
    if (!text) {
        showToast('No meals planned yet!', 'error');
        return;
    }

    if (navigator.share) {
        navigator.share({
            title: `Weekly ${mealType} Menu`,
            text: text,
        })
            .then(() => console.log('Successful share'))
            .catch((error) => console.log('Error sharing', error));
    } else {
        // Fallback for browsers that don't support share API
        shareMealPlan(mealType);
        showToast('Opened copy fallback (Share API not supported)', 'info');
    }
}

// ============================================
// SWIPE GESTURES
// ============================================

function initSwipeGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    const threshold = 50; // Minimum distance for swipe

    document.addEventListener('touchstart', (e) => {
        // Ignore if touching an interactive element (except the day cards wrapper)
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

    // Check if horizontal swipe dominates vertical scroll
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > threshold) {
        if (diffX > 0) {
            // Swipe Left -> Go to Dinner
            switchTab('dinner');
        } else {
            // Swipe Right -> Go to Lunch
            switchTab('lunch');
        }
    }
}

function switchTab(tabName) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (btn && !btn.classList.contains('active')) {
        btn.click();
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    addSampleItems();
    initDayCards();
    initDesktopDragAndDrop();
    initCategoryTabs();
    initSwipeGestures();
});

// Re-init drag on resize
window.addEventListener('resize', () => {
    initDesktopDragAndDrop();
});

// Export functions
window.addFoodItem = addFoodItem;
window.shareMealPlan = shareMealPlan;
window.shareNative = shareNative;
window.removeFoodFromCard = removeFoodFromCard;
