import { showToast } from './ui.js';

export function generateMealPlanText(mealType) {
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

export function shareMealPlan(mealType) {
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

export function shareNative(mealType) {
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
