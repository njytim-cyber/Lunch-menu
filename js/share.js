import { showToast } from './ui.js';

/**
 * Get the date for a given day of the week in the current week
 * @param {number} dayIndex - 0 = Monday, 6 = Sunday
 * @returns {Date}
 */
function getDateForDay(dayIndex) {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    // Convert to Monday-based (0 = Monday, 6 = Sunday)
    const mondayBased = currentDay === 0 ? 6 : currentDay - 1;
    const diff = dayIndex - mondayBased;
    const date = new Date(today);
    date.setDate(today.getDate() + diff);
    return date;
}

/**
 * Format date as dd mmm yy (e.g., "11 Jan 26")
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${day} ${month} ${year}`;
}

export function generateMealPlanText() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const lunchPage = document.getElementById('lunch-page');
    const dinnerPage = document.getElementById('dinner-page');

    // Calculate date range (Monday to Sunday of current week)
    const mondayDate = getDateForDay(0);
    const sundayDate = getDateForDay(6);
    const dateRange = `${formatDate(mondayDate)} - ${formatDate(sundayDate)}`;

    let mealPlanText = `📅 Weekly Menus\n`;
    mealPlanText += `${dateRange}\n`;
    mealPlanText += '═'.repeat(30) + '\n\n';

    let hasAnyItems = false;

    days.forEach((day, index) => {
        const lunchCard = lunchPage.querySelector(`.day-card[data-day="${day}"]`);
        const dinnerCard = dinnerPage.querySelector(`.day-card[data-day="${day}"]`);

        const lunchItems = lunchCard.querySelectorAll('.day-card-content .food-item');
        const dinnerItems = dinnerCard.querySelectorAll('.day-card-content .food-item');

        // Get date for this day
        const dayDate = getDateForDay(index);
        const formattedDate = formatDate(dayDate);

        // Day header with date
        mealPlanText += `📆 ${dayNames[index]} (${formattedDate})\n`;

        // Lunch section
        mealPlanText += `  ☀️ Lunch: `;
        if (lunchItems.length > 0) {
            hasAnyItems = true;
            const lunchItemTexts = [];
            lunchItems.forEach(item => {
                const emoji = item.querySelector('.food-emoji')?.textContent || '🍽️';
                const name = item.querySelector('.food-name')?.textContent || 'Unknown';
                lunchItemTexts.push(`${emoji} ${name}`);
            });
            mealPlanText += lunchItemTexts.join(', ') + '\n';
        } else {
            mealPlanText += '(not planned)\n';
        }

        // Dinner section
        mealPlanText += `  🌙 Dinner: `;
        if (dinnerItems.length > 0) {
            hasAnyItems = true;
            const dinnerItemTexts = [];
            dinnerItems.forEach(item => {
                const emoji = item.querySelector('.food-emoji')?.textContent || '🍽️';
                const name = item.querySelector('.food-name')?.textContent || 'Unknown';
                dinnerItemTexts.push(`${emoji} ${name}`);
            });
            mealPlanText += dinnerItemTexts.join(', ') + '\n';
        } else {
            mealPlanText += '(not planned)\n';
        }

        mealPlanText += '\n';
    });

    if (!hasAnyItems) return null;

    mealPlanText += '═'.repeat(30) + '\n';
    mealPlanText += '🍽️ Made with Weekly Meal Planner';

    return mealPlanText;
}

export function shareMealPlan() {
    const text = generateMealPlanText();
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

export function shareNative() {
    const text = generateMealPlanText();
    if (!text) {
        showToast('No meals planned yet!', 'error');
        return;
    }

    if (navigator.share) {
        navigator.share({
            title: 'Weekly Menus',
            text: text,
        })
            .then(() => console.log('Successful share'))
            .catch((error) => console.log('Error sharing', error));
    } else {
        // Fallback for browsers that don't support share API
        shareMealPlan();
        showToast('Meal plan copied to clipboard! 📋', 'info');
    }
}
