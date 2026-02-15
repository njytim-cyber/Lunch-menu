import { showToast } from './ui.js';

function generateMealPlanForType(mealType) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const page = document.getElementById(`${mealType}-page`);

    let mealPlanText = '';
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

    return { text: mealPlanText, hasItems: hasAnyItems };
}

export function generateMealPlanText() {
    // Generate breakfast, lunch, dinner and snacks
    const breakfastPlan = generateMealPlanForType('breakfast');
    const lunchPlan = generateMealPlanForType('lunch');
    const dinnerPlan = generateMealPlanForType('dinner');
    const snacksPlan = generateMealPlanForType('snacks');

    if (!breakfastPlan.hasItems && !lunchPlan.hasItems && !dinnerPlan.hasItems && !snacksPlan.hasItems) {
        return null;
    }

    let fullText = '📅 Weekly Meal Plan\n';
    fullText += '═'.repeat(30) + '\n\n';

    // Add Breakfast section
    fullText += '🌅 BREAKFAST\n';
    fullText += '─'.repeat(20) + '\n';
    fullText += breakfastPlan.text;

    // Add Lunch section
    fullText += '☀️ LUNCH\n';
    fullText += '─'.repeat(20) + '\n';
    fullText += lunchPlan.text;

    // Add Dinner section
    fullText += '🌙 DINNER\n';
    fullText += '─'.repeat(20) + '\n';
    fullText += dinnerPlan.text;

    // Add Snacks section
    fullText += '🍿 SNACKS\n';
    fullText += '─'.repeat(20) + '\n';
    fullText += snacksPlan.text;

    fullText += '═'.repeat(30) + '\n';
    fullText += '🍽️ Made with Weekly Meal Planner';

    return fullText;
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
            title: 'Weekly Meal Plan',
            text: text,
        })
            .then(() => console.log('Successful share'))
            .catch((error) => console.log('Error sharing', error));
    } else {
        // Fallback for browsers that don't support share API
        shareMealPlan();
        showToast('Opened copy fallback (Share API not supported)', 'info');
    }
}
