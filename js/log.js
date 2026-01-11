const LOG_STORAGE_KEY = 'mealPlanLogs_v1';

export function getLogs() {
    try {
        const stored = localStorage.getItem(LOG_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Failed to load logs', e);
        return [];
    }
}

export function saveLog(logEntry) {
    const logs = getLogs();
    logs.unshift(logEntry); // Add to top
    try {
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
        return true;
    } catch (e) {
        console.error('Failed to save log', e);
        return false;
    }
}

export function deleteLog(index) {
    const logs = getLogs();
    if (index >= 0 && index < logs.length) {
        logs.splice(index, 1);
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
        return true;
    }
    return false;
}

export function getNextWeekRange() {
    const today = new Date();
    // Calculate next Monday
    // If today is Monday(1), next Monday is +7.
    // If today is Sunday(0), next Monday is +1.
    const day = today.getDay();
    const diffToNextMonday = day === 0 ? 1 : (8 - day); // If Sunday (0), +1. If Mon(1), +7.

    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + diffToNextMonday);

    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);

    return {
        start: formatDate(nextMonday),
        end: formatDate(nextSunday),
        startObj: nextMonday,
        endObj: nextSunday
    };
}

function formatDate(date) {
    // Format: "Mon, Jan 12"
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
