// Tab Navigation
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
    });
});

// Drag and Drop Functionality
let draggedItem = null;
let sourceContainer = null;

// Initialize drag and drop for all food items
function initDragAndDrop() {
    const foodItems = document.querySelectorAll('.food-item');
    const dayBoxes = document.querySelectorAll('.day-box');
    const foodContainers = document.querySelectorAll('.food-items');

    // Setup draggable food items
    foodItems.forEach(item => {
        item.setAttribute('draggable', true);

        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });

    // Setup drop zones (day boxes)
    dayBoxes.forEach(box => {
        box.addEventListener('dragover', handleDragOver);
        box.addEventListener('dragenter', handleDragEnter);
        box.addEventListener('dragleave', handleDragLeave);
        box.addEventListener('drop', handleDrop);
    });

    // Setup food containers as drop zones for returning items
    foodContainers.forEach(container => {
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('dragenter', handleDragEnter);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('drop', handleDropToContainer);
    });
}

function handleDragStart(e) {
    draggedItem = this;
    sourceContainer = this.parentElement;
    this.classList.add('dragging');

    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);

    // Add slight delay for visual feedback
    setTimeout(() => {
        this.style.opacity = '0.4';
    }, 0);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    this.style.opacity = '1';

    // Remove drag-over class from all drop zones
    document.querySelectorAll('.day-box, .food-items').forEach(zone => {
        zone.classList.remove('drag-over');
    });

    draggedItem = null;
    sourceContainer = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    // Only remove class if we're leaving the element, not entering a child
    if (!this.contains(e.relatedTarget)) {
        this.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (draggedItem) {
        // Check if this day box has a max items limit
        const maxItems = parseInt(this.dataset.maxItems) || 1;
        const currentItems = this.querySelectorAll('.food-item').length;

        // Check if we can add more items
        if (currentItems >= maxItems) {
            showToast(`Maximum ${maxItems} items allowed per day!`, 'error');
            return;
        }

        // Clone the dragged item
        const clone = draggedItem.cloneNode(true);

        // Add remove button for items in day boxes
        addRemoveButton(clone);

        // Setup drag events for cloned item
        clone.setAttribute('draggable', true);
        clone.addEventListener('dragstart', handleDragStart);
        clone.addEventListener('dragend', handleDragEnd);

        // If dropping from food container to day box
        if (sourceContainer.classList.contains('food-items')) {
            // Add to day box
            this.appendChild(clone);
            this.classList.add('has-item');
        } else {
            // Moving between day boxes
            draggedItem.remove();
            this.appendChild(clone);
            this.classList.add('has-item');

            // Check if source is empty
            updateDayBoxState(sourceContainer);
        }
    }
}

function handleDropToContainer(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (draggedItem && sourceContainer.classList.contains('day-box')) {
        // Remove from day box
        draggedItem.remove();
        updateDayBoxState(sourceContainer);
    }
}

function addRemoveButton(item) {
    // Remove existing remove button if any
    const existingBtn = item.querySelector('.remove-btn');
    if (existingBtn) existingBtn.remove();

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '×';
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dayBox = item.parentElement;
        item.remove();
        updateDayBoxState(dayBox);
    });
    item.appendChild(removeBtn);
}

function updateDayBoxState(dayBox) {
    if (dayBox.classList.contains('day-box')) {
        const hasItems = dayBox.querySelectorAll('.food-item').length > 0;
        if (hasItems) {
            dayBox.classList.add('has-item');
        } else {
            dayBox.classList.remove('has-item');
        }
    }
}

// Function to add food items (can be called to add items dynamically)
function addFoodItem(name, imageOrEmoji, mealType = 'lunch', category = 'all') {
    const container = document.getElementById(`${mealType}-food-items`);

    // Remove empty state if present
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const foodItem = document.createElement('div');
    foodItem.className = 'food-item';
    foodItem.setAttribute('draggable', true);
    foodItem.setAttribute('data-category', category);

    // Check if it's an emoji or image URL
    if (imageOrEmoji.startsWith('http') || imageOrEmoji.startsWith('/') || imageOrEmoji.startsWith('./')) {
        foodItem.innerHTML = `
            <img src="${imageOrEmoji}" alt="${name}">
            <span class="food-name">${name}</span>
        `;
    } else {
        foodItem.innerHTML = `
            <span class="food-emoji">${imageOrEmoji}</span>
            <span class="food-name">${name}</span>
        `;
    }

    // Add drag events
    foodItem.addEventListener('dragstart', handleDragStart);
    foodItem.addEventListener('dragend', handleDragEnd);

    container.appendChild(foodItem);
}

// Add all food items from the spreadsheet
function addSampleItems() {
    // ===== LUNCH ITEMS =====
    addFoodItem('Rigatoni', '🍝', 'lunch', 'pasta');
    addFoodItem('Cheesy Rigatoni', '🧀', 'lunch', 'pasta');
    addFoodItem('Chicken Pasta and Broccoli', '🥦', 'lunch', 'pasta');
    addFoodItem('Porridge and Spring Roll', '🥣', 'lunch', 'porridge');
    addFoodItem('Porridge and Seaweed Chicken', '🍲', 'lunch', 'porridge');
    addFoodItem('Chicken Rice', '🍗', 'lunch', 'rice');
    addFoodItem('Soy Chicken and Chye Sim', '🥬', 'lunch', 'rice');
    addFoodItem('Chicken and Mushroom Rice', '🍄', 'lunch', 'rice');
    addFoodItem('Crispy Noodle', '🍜', 'lunch', 'noodles');
    addFoodItem('Bee Hoon', '🍜', 'lunch', 'noodles');
    addFoodItem('Bee Hoon and Seaweed Chicken', '🌿', 'lunch', 'noodles');
    addFoodItem('Mee Sua Soup', '🍜', 'lunch', 'noodles');
    addFoodItem('Kway Teow Soup', '🍲', 'lunch', 'noodles');

    // ===== DINNER ITEMS =====
    // Carbohydrates
    addFoodItem('Rice', '🍚', 'dinner', 'carbs');

    // Vegetables
    addFoodItem('Kai Lan', '🥬', 'dinner', 'vegetables');
    addFoodItem('Baby Spinach', '🥬', 'dinner', 'vegetables');
    addFoodItem('Red Spinach', '🥬', 'dinner', 'vegetables');
    addFoodItem('Kang Kong', '🥬', 'dinner', 'vegetables');
    addFoodItem('Cabbage', '🥬', 'dinner', 'vegetables');
    addFoodItem('WaWa Vegetable', '🥬', 'dinner', 'vegetables');
    addFoodItem('Broccoli', '🥦', 'dinner', 'vegetables');
    addFoodItem('Baby Kailan', '🥬', 'dinner', 'vegetables');
    addFoodItem('Kailan', '🥬', 'dinner', 'vegetables');

    // Fish
    addFoodItem('Sliced Fish with Ginger', '🐟', 'dinner', 'fish');
    addFoodItem('Claypot Sliced Fish with Eggplant', '🍆', 'dinner', 'fish');
    addFoodItem('Fried Seabass', '🐟', 'dinner', 'fish');
    addFoodItem('Fried Salmon', '🍣', 'dinner', 'fish');
    addFoodItem('Steam Fish Pomfret', '🐟', 'dinner', 'fish');
    addFoodItem('Steam Fish White Pomfret', '🐟', 'dinner', 'fish');
    addFoodItem('Fish and Fish Soup', '🍲', 'dinner', 'fish');
    addFoodItem('Steam Fish (Ginger/Spring Onion)', '🐟', 'dinner', 'fish');

    // Eggs
    addFoodItem('Egg with Onion', '🥚', 'dinner', 'eggs');
    addFoodItem('Egg with Carrot', '🥕', 'dinner', 'eggs');
    addFoodItem('Egg with Tomato', '🍅', 'dinner', 'eggs');
    addFoodItem('Claypot Tofu', '🧈', 'dinner', 'eggs');
    addFoodItem('Corn Soup', '🌽', 'dinner', 'eggs');

    // Chicken
    addFoodItem('Steamed Chicken with Mushrooms', '🍄', 'dinner', 'chicken');
    addFoodItem('Chicken with Salted Bean Paste', '🍗', 'dinner', 'chicken');
    addFoodItem('Curry Chicken', '🍛', 'dinner', 'chicken');
    addFoodItem('Fried Chicken Wing', '🍗', 'dinner', 'chicken');

    // Pork
    addFoodItem('Steamed Minced Pork', '🥩', 'dinner', 'pork');
    addFoodItem('Sliced Pork with Parsley', '🥩', 'dinner', 'pork');
    addFoodItem('Sliced Pork with Sichuan Veg', '🌶️', 'dinner', 'pork');
    addFoodItem('Pork with Egg and Tau Pok', '🥚', 'dinner', 'pork');
    addFoodItem('Japanese Pork Cutlet', '🍖', 'dinner', 'pork');
    addFoodItem('Pork Rib Soup', '🍲', 'dinner', 'pork');

    // Prawn
    addFoodItem('Crispy Prawn Ball', '🦐', 'dinner', 'prawn');
    addFoodItem('Prawn with Glass Noodle', '🦐', 'dinner', 'prawn');

    // Pasta
    addFoodItem('Cheesy Rigatoni', '🧀', 'dinner', 'carbs');
}

// Category Tab Filtering
function initCategoryTabs() {
    const categoryTabContainers = document.querySelectorAll('.category-tabs');

    categoryTabContainers.forEach(container => {
        const mealType = container.dataset.meal;
        const tabs = container.querySelectorAll('.category-tab');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Filter items
                const category = tab.dataset.category;
                filterFoodItems(mealType, category);
            });
        });
    });
}

function filterFoodItems(mealType, category) {
    const container = document.getElementById(`${mealType}-food-items`);
    const items = container.querySelectorAll('.food-item');

    items.forEach(item => {
        if (category === 'all' || item.dataset.category === category) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initDragAndDrop();
    addSampleItems();
    initCategoryTabs();
});

// Export function for external use
window.addFoodItem = addFoodItem;

// Toast Notification
function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// Share Meal Plan
function shareMealPlan(mealType) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const pageId = `${mealType}-page`;
    const page = document.getElementById(pageId);
    const dayBoxes = page.querySelectorAll('.day-box');

    let mealPlanText = `📅 Weekly ${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Menu\n`;
    mealPlanText += '═'.repeat(30) + '\n\n';

    let hasAnyItems = false;

    dayBoxes.forEach((box, index) => {
        const items = box.querySelectorAll('.food-item');
        const dayName = days[index];

        if (items.length > 0) {
            hasAnyItems = true;
            mealPlanText += `${dayName}:\n`;
            items.forEach(item => {
                const emoji = item.querySelector('.food-emoji')?.textContent || '🍽️';
                const name = item.querySelector('.food-name')?.textContent || 'Unknown';
                mealPlanText += `  ${emoji} ${name}\n`;
            });
            mealPlanText += '\n';
        } else {
            mealPlanText += `${dayName}: (not planned)\n\n`;
        }
    });

    if (!hasAnyItems) {
        showToast('No meals planned yet! Add some items first.', 'error');
        return;
    }

    mealPlanText += '═'.repeat(30) + '\n';
    mealPlanText += '🍽️ Made with Weekly Meal Planner';

    // Try native share API first, fallback to clipboard
    if (navigator.share) {
        navigator.share({
            title: `Weekly ${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Menu`,
            text: mealPlanText
        }).then(() => {
            showToast('Shared successfully! 🎉', 'success');
        }).catch((err) => {
            // User cancelled or error - try clipboard
            copyToClipboard(mealPlanText);
        });
    } else {
        copyToClipboard(mealPlanText);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Meal plan copied to clipboard! 📋', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Meal plan copied to clipboard! 📋', 'success');
    });
}

// Share to Google Chat
function shareToGoogleChat(mealType) {
    const mealPlanText = generateMealPlanText(mealType);

    if (!mealPlanText) {
        showToast('No meals planned yet! Add some items first.', 'error');
        return;
    }

    // Google Chat doesn't have a direct share URL like some other apps
    // The best approach is to copy to clipboard and open Google Chat
    // Or we can use a Google Chat webhook if configured

    // Copy to clipboard first
    navigator.clipboard.writeText(mealPlanText).then(() => {
        // Open Google Chat in a new tab
        window.open('https://chat.google.com/', '_blank');
        showToast('Meal plan copied! Paste it in Google Chat 💬', 'success');
    }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = mealPlanText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        window.open('https://chat.google.com/', '_blank');
        showToast('Meal plan copied! Paste it in Google Chat 💬', 'success');
    });
}

// Helper function to generate meal plan text
function generateMealPlanText(mealType) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const pageId = `${mealType}-page`;
    const page = document.getElementById(pageId);
    const dayBoxes = page.querySelectorAll('.day-box');

    let mealPlanText = `📅 Weekly ${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Menu\n`;
    mealPlanText += '═'.repeat(30) + '\n\n';

    let hasAnyItems = false;

    dayBoxes.forEach((box, index) => {
        const items = box.querySelectorAll('.food-item');
        const dayName = days[index];

        if (items.length > 0) {
            hasAnyItems = true;
            mealPlanText += `${dayName}:\n`;
            items.forEach(item => {
                const emoji = item.querySelector('.food-emoji')?.textContent || '🍽️';
                const name = item.querySelector('.food-name')?.textContent || 'Unknown';
                mealPlanText += `  ${emoji} ${name}\n`;
            });
            mealPlanText += '\n';
        } else {
            mealPlanText += `${dayName}: (not planned)\n\n`;
        }
    });

    if (!hasAnyItems) {
        return null;
    }

    mealPlanText += '═'.repeat(30) + '\n';
    mealPlanText += '🍽️ Made with Weekly Meal Planner';

    return mealPlanText;
}

// Export share functions
window.shareMealPlan = shareMealPlan;
window.shareToGoogleChat = shareToGoogleChat;

