// Grocery List Generator
import { mealPlan, foodData } from './state.js';

// Category to ingredient mapping (simplified - in reality you'd want more detailed data)
const CATEGORY_INGREDIENTS = {
    rice: ['Rice', 'Cooking Oil'],
    noodles: ['Noodles', 'Soy Sauce'],
    pasta: ['Pasta', 'Olive Oil', 'Parmesan'],
    chicken: ['Chicken'],
    fish: ['Fish'],
    pork: ['Pork'],
    prawn: ['Prawns'],
    vegetables: ['Mixed Vegetables'],
    eggs: ['Eggs'],
    soup: ['Stock Cubes', 'Mixed Vegetables'],
    sweet: ['Sugar', 'Butter'],
    savory: ['Snacks Variety Pack'],
    healthy: ['Fresh Fruits', 'Yogurt'],
    other: ['Misc Ingredients']
};

// Generate grocery list from current meal plan
export function generateGroceryList() {
    const groceryMap = new Map();
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    mealTypes.forEach(mealType => {
        days.forEach(day => {
            const items = mealPlan[mealType]?.[day] || [];
            items.forEach(item => {
                // Add the item itself
                const key = item.name;
                if (groceryMap.has(key)) {
                    groceryMap.get(key).count++;
                } else {
                    groceryMap.set(key, {
                        name: item.name,
                        emoji: item.emoji,
                        category: item.category || 'other',
                        count: 1
                    });
                }
            });
        });
    });

    // Convert to array and sort by category
    const groceryList = Array.from(groceryMap.values());
    groceryList.sort((a, b) => a.category.localeCompare(b.category));

    return groceryList;
}

// Format grocery list as text
export function formatGroceryListText() {
    const groceryList = generateGroceryList();

    if (groceryList.length === 0) {
        return null;
    }

    let text = '🛒 GROCERY LIST\n';
    text += '═'.repeat(25) + '\n\n';

    // Group by category
    const grouped = {};
    groceryList.forEach(item => {
        const cat = item.category || 'other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });

    const categoryEmojis = {
        rice: '🍚', noodles: '🍜', pasta: '🍝', chicken: '🍗',
        fish: '🐟', pork: '🥩', prawn: '🦐', vegetables: '🥬',
        eggs: '🥚', soup: '🍲', sweet: '🍭', savory: '🧂',
        healthy: '🥗', other: '🍽️'
    };

    Object.entries(grouped).forEach(([category, items]) => {
        const emoji = categoryEmojis[category] || '🍽️';
        const catName = category.charAt(0).toUpperCase() + category.slice(1);
        text += `${emoji} ${catName}\n`;
        items.forEach(item => {
            const qty = item.count > 1 ? ` (x${item.count})` : '';
            text += `  □ ${item.emoji} ${item.name}${qty}\n`;
        });
        text += '\n';
    });

    text += '─'.repeat(25) + '\n';
    text += `📝 Total: ${groceryList.length} items`;

    return text;
}

// Show grocery list modal
export function showGroceryModal() {
    const text = formatGroceryListText();

    if (!text) {
        showGroceryToast('No items planned yet!', 'info');
        return;
    }

    // Create or get modal
    let modal = document.getElementById('groceryModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'groceryModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content grocery-modal-content">
                <div class="modal-header">
                    <h2>🛒 Grocery List</h2>
                    <button class="modal-close" onclick="closeGroceryModal()">×</button>
                </div>
                <div class="grocery-list-content"></div>
                <div class="grocery-actions">
                    <button class="btn-secondary" onclick="copyGroceryList()">📋 Copy</button>
                    <button class="btn-secondary" onclick="shareGroceryList()">🔗 Share</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Populate content
    const content = modal.querySelector('.grocery-list-content');
    content.innerHTML = `<pre>${text}</pre>`;

    modal.classList.add('active');
}

export function closeGroceryModal() {
    const modal = document.getElementById('groceryModal');
    if (modal) modal.classList.remove('active');
}

export function copyGroceryList() {
    const text = formatGroceryListText();
    if (text) {
        navigator.clipboard.writeText(text);
        showGroceryToast('📋 Copied to clipboard!', 'success');
    }
}

export function shareGroceryList() {
    const text = formatGroceryListText();
    if (text && navigator.share) {
        navigator.share({ text });
    } else if (text) {
        navigator.clipboard.writeText(text);
        showGroceryToast('📋 Copied to clipboard!', 'success');
    }
}

function showGroceryToast(message, type) {
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
