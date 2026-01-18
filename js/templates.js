
import { mealPlan, foodData } from './state.js';
import { addFoodToCard, clearDayCard } from './ui.js'; // Fixed: import from ui.js to avoid circular dependency with app.js

const TEMPLATE_KEY = 'saved_templates_v2'; // Updated key for new format with names
let builderState = {
    lunch: {}, // day -> [items]
    dinner: {} // we will likely just use one 'active' mode
};

// Mobile tap-to-select state
let selectedDay = null;
// ============================================
// MODAL MANAGEMENT
// ============================================

export function openTemplatesModal() {
    const modal = document.getElementById('templatesModal');
    if (modal) {
        modal.classList.add('active');
        checkSavedTemplate();
    }
}

export function closeTemplatesModal() {
    const modal = document.getElementById('templatesModal');
    if (modal) {
        modal.classList.remove('active');
        // Reset View
        setTimeout(() => {
            document.getElementById('templatesInitialView').style.display = 'block';
            document.getElementById('templatesBuilderView').style.display = 'none';
        }, 300);
    }
}

function checkSavedTemplate() {
    const saved = localStorage.getItem(TEMPLATE_KEY);
    const container = document.querySelector('#templatesInitialView .empty-state p');
    const loadBtn = document.getElementById('loadTemplateBtn');

    if (saved) {
        const savedObj = JSON.parse(saved);
        const templateName = savedObj.name || 'Template';
        if (container) container.textContent = `📂 "${templateName}"`;
        if (loadBtn) {
            loadBtn.style.display = 'flex';
            loadBtn.querySelector('span').textContent = `📥 Load "${templateName}"`;
        }
    } else {
        if (container) container.textContent = "No templates YET";
        if (loadBtn) loadBtn.style.display = 'none';
    }
}

// ============================================
// BUILDER LOGIC
// ============================================

export function startCreatingTemplate() {
    document.getElementById('templatesInitialView').style.display = 'none';
    const builderView = document.getElementById('templatesBuilderView');
    builderView.style.display = 'block';

    initBuilder();
}

function initBuilder() {
    renderBuilderGrid();
    renderBuilderFoodItems('all');

    // Init Builder Categories
    document.querySelectorAll('.category-tabs[data-context="builder"] .category-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.category-tabs[data-context="builder"] .category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderBuilderFoodItems(tab.dataset.category);
        };
    });
}

function renderBuilderGrid() {
    const grid = document.getElementById('builderGrid');
    grid.innerHTML = '';
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    days.forEach(day => {
        const card = document.createElement('div');
        card.className = 'day-card builder-card';
        card.dataset.day = day;

        // Header
        const header = document.createElement('div');
        header.className = 'day-card-header';
        header.textContent = day.substring(0, 3); // Mon, Tue...
        card.appendChild(header);

        // Content
        const content = document.createElement('div');
        content.className = 'day-card-content';
        content.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        };
        content.ondrop = (e) => handleBuilderDrop(e, day);

        card.appendChild(content);
        grid.appendChild(card);

        // Mobile tap-to-select: click card to select it
        card.onclick = (e) => {
            // Don't select if clicking on an item (to remove it)
            if (e.target.closest('.mini-card-item')) return;

            // Toggle selection
            if (selectedDay === day) {
                selectedDay = null;
                card.classList.remove('selected');
            } else {
                // Deselect previous
                document.querySelectorAll('.builder-card.selected').forEach(c => c.classList.remove('selected'));
                selectedDay = day;
                card.classList.add('selected');
            }
        };
    });
}

function renderBuilderFoodItems(category) {
    const container = document.getElementById('builderFoodItems');
    container.innerHTML = '';

    // Get ALL items (lunch + dinner) or just current mode?
    // User implies a unified builder. Let's combine unique items.
    const allItems = [...foodData.lunch, ...foodData.dinner];
    const uniqueItems = Array.from(new Set(allItems.map(i => i.name)))
        .map(name => allItems.find(i => i.name === name));

    uniqueItems.forEach(item => {
        if (category !== 'all' && item.category !== category) return;

        const el = document.createElement('div');
        el.className = 'food-item mini';
        el.draggable = true;
        el.innerHTML = `<span class="food-emoji">${item.emoji}</span><span class="food-name">${item.name}</span>`;

        // Drag for desktop
        el.ondragstart = (e) => {
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', JSON.stringify(item));
        };

        // Click for mobile tap-to-add
        el.onclick = () => {
            if (selectedDay) {
                addItemToSelectedDay(item);
            }
        };

        container.appendChild(el);
    });
}

// Helper to add item to currently selected day
function addItemToSelectedDay(item) {
    if (!selectedDay) return;

    const card = document.querySelector(`.builder-card[data-day="${selectedDay}"]`);
    if (!card) return;

    const content = card.querySelector('.day-card-content');

    const foodEl = document.createElement('div');
    foodEl.className = 'food-item mini-card-item';
    foodEl.innerHTML = `
        <span class="food-emoji">${item.emoji}</span>
        <button class="mini-remove-btn" title="Remove">×</button>
    `;
    foodEl.title = item.name;
    foodEl.dataset.category = item.category || 'other';

    // Click X button to remove
    const removeBtn = foodEl.querySelector('.mini-remove-btn');
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        foodEl.remove();
    };

    content.appendChild(foodEl);
}

function handleBuilderDrop(e, day) {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;

    let item;
    try {
        item = JSON.parse(data);
    } catch (err) {
        console.error('Failed to parse drag data', err);
        return;
    }

    // Find the day-card-content element reliably - either from currentTarget or by finding it
    const content = e.currentTarget || e.target.closest('.day-card-content');

    if (!content) {
        console.error('Could not find drop target for day:', day);
        return;
    }

    const foodEl = document.createElement('div');
    foodEl.className = 'food-item mini-card-item';
    foodEl.innerHTML = `
        <span class="food-emoji">${item.emoji}</span>
        <button class="mini-remove-btn" title="Remove">×</button>
    `;
    foodEl.title = item.name;
    foodEl.dataset.category = item.category || 'other';

    // Click X button to remove
    const removeBtn = foodEl.querySelector('.mini-remove-btn');
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        foodEl.remove();
    };

    content.appendChild(foodEl);
}

// ============================================
// SAVE & LOAD
// ============================================

export function saveNewTemplate() {
    // 1. Get template name
    const nameInput = document.getElementById('templateNameInput');
    const templateName = nameInput?.value.trim() || 'My Template';

    // 2. Gather data from DOM
    const templateData = {};
    const grid = document.getElementById('builderGrid');

    grid.querySelectorAll('.builder-card').forEach(card => {
        const day = card.dataset.day;
        const items = [];
        card.querySelectorAll('.mini-card-item').forEach(el => {
            const name = el.title;
            const emoji = el.querySelector('.food-emoji').textContent;
            const category = el.dataset.category || 'other';
            items.push({ name, emoji, category });
        });
        if (items.length > 0) templateData[day] = items;
    });

    // 3. Save as object with name
    const saveObj = {
        name: templateName,
        data: templateData,
        savedAt: Date.now()
    };
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(saveObj));

    // 4. Confetti Implementation
    fireConfetti();

    // 5. Reset selection state
    selectedDay = null;

    // 6. Close & Reset
    setTimeout(() => {
        closeTemplatesModal();
        // Reset name input
        if (nameInput) nameInput.value = '';
        // Show Load Button
        const loadBtn = document.getElementById('loadTemplateBtn');
        if (loadBtn) loadBtn.style.display = 'flex';
        // Notify
        // We could use a global toast function if available
        // alert("Template Saved!"); 
    }, 1500);
}

export function loadSavedTemplate() {
    const saved = localStorage.getItem(TEMPLATE_KEY);
    if (!saved) return;

    const savedObj = JSON.parse(saved);

    // Handle both old format (direct data) and new format ({ name, data })
    const templateData = savedObj.data || savedObj;
    const templateName = savedObj.name || 'Template';

    // Determine target meal mode based on active toggle button
    const activeBtn = document.querySelector('.toggle-btn.active');
    const targetMeal = activeBtn ? activeBtn.dataset.tab : 'lunch';
    const targetClass = targetMeal === 'dinner' ? 'dinner-card' : 'lunch-card';

    let loadedCount = 0;

    Object.keys(templateData).forEach(day => {
        const items = templateData[day];
        const card = document.querySelector(`.day-card.${targetClass}[data-day="${day}"]`);

        if (card) {
            // 1. Clear existing UNLOCKED items
            clearDayCard(card);

            // 2. Check Limits
            const maxItems = parseInt(card.dataset.maxItems) || 1;

            // 3. Add items from template up to limit
            items.forEach(item => {
                const currentCount = card.querySelectorAll('.day-card-content .food-item').length;
                if (currentCount < maxItems) {
                    addFoodToCard(card, item.name, item.emoji, item.category || 'other', true, false);
                    loadedCount++;
                }
            });
        }
    });

    // Close the modal first
    closeTemplatesModal();

    // Feedback with template name
    if (loadedCount > 0) {
        alert(`"${templateName}" loaded successfully! 🍽️`);
    } else {
        alert(`"${templateName}" loaded (some items skipped due to limits/locks).`);
    }
}


// Confetti Helper
function fireConfetti() {
    const count = 200;
    const defaults = {
        origin: { y: 0.7 }
    };

    function fire(particleRatio, opts) {
        // Simple manual confetti CSS injection or logic?
        // Since we don't have canvas confetti lib, we create div particles.
        createParticles();
    }
    createParticles();
}

function createParticles() {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];
    for (let i = 0; i < 50; i++) {
        const p = document.createElement('div');
        p.style.position = 'fixed';
        p.style.left = '50%';
        p.style.top = '50%';
        p.style.width = '10px';
        p.style.height = '10px';
        p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        p.style.zIndex = '9999';
        p.animate([
            { transform: 'translate(0,0)' },
            { transform: `translate(${Math.random() * 400 - 200}px, ${Math.random() * 400 - 200}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
        ], {
            duration: 1000 + Math.random() * 1000,
            easing: 'cubic-bezier(0, .9, .57, 1)',
            delay: Math.random() * 200
        }).onfinish = () => p.remove();
        document.body.appendChild(p);
    }
}
