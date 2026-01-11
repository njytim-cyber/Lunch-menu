import { loadSampleData } from './data.js';
import {
    initDayCards,
    initDesktopDragAndDrop,
    initCategoryTabs,
    initSwipeGestures,
    initTabs,
    renderSavedState,
    addFoodToCard,
    removeFoodFromCard,
    getActiveMealType
} from './ui.js';
import { shareNative } from './share.js';
import { addFoodItem } from './state.js';

import { autoSuggest } from './suggest.js';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load static food data
    loadSampleData();

    // 2. Initialize UI components
    initDayCards();
    initDesktopDragAndDrop();
    initCategoryTabs(); // Desktop tabs
    initSwipeGestures();
    initTabs();
    initLogModalListeners();

    // 3. Restore user's saved meal plan
    renderSavedState();
});

// Re-init drag on resize
window.addEventListener('resize', () => {
    initDesktopDragAndDrop();
});

// Global Handlers
import { getActiveMealType as getActiveMealTypeUI, showToast, renderSavedState as renderSavedStateUI } from './ui.js';
import { getNextWeekRange, saveLog, getLogs, deleteLog } from './log.js';
import { mealPlan, setMealPlan } from './state.js';

window.handleGlobalSuggest = function () {
    const mealType = getActiveMealType();
    autoSuggest(mealType);
}

window.handleGlobalShare = function () {
    const mealType = getActiveMealType();
    shareNative(mealType);
}

window.handleGlobalLog = function () {
    const modal = document.getElementById('logModal');
    const overlay = document.getElementById('logModalOverlay');
    const dateInput = document.getElementById('logStartDate');

    modal.classList.add('active');
    overlay.classList.add('active');

    // Set default date to next Monday
    const range = getNextWeekRange();
    dateInput.valueAsDate = range.startObj;
    updateDatePreview();

    renderHistoryList();
}

window.confirmSaveLog = function () {
    const dateInput = document.getElementById('logStartDate');
    if (!dateInput.value) {
        showToast('Please select a start date', 'error');
        return;
    }

    const startDate = new Date(dateInput.value);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const logEntry = {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        plan: JSON.parse(JSON.stringify(mealPlan)), // Deep copy
        timestamp: Date.now()
    };

    if (saveLog(logEntry)) {
        showToast('Menu saved to log! 📅', 'success');
        closeLogModal();
    } else {
        showToast('Failed to save log', 'error');
    }
}

function closeLogModal() {
    document.getElementById('logModal').classList.remove('active');
    document.getElementById('logModalOverlay').classList.remove('active');
}

function updateDatePreview() {
    const dateInput = document.getElementById('logStartDate');
    const preview = document.getElementById('logDatePreview');

    if (dateInput.value) {
        const start = new Date(dateInput.value);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        preview.textContent = `Menu for: ${formatDate(start)} - ${formatDate(end)}`;
    } else {
        preview.textContent = '';
    }
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function renderHistoryList() {
    const list = document.getElementById('logHistoryList');
    const logs = getLogs();

    if (logs.length === 0) {
        list.innerHTML = '<p class="empty-logs">No saved logs yet.</p>';
        return;
    }

    list.innerHTML = logs.map((log, index) => `
        <div class="log-item">
            <div class="log-info">
                <strong>${log.startDate} - ${log.endDate}</strong>
                <span>Saved: ${new Date(log.timestamp).toLocaleDateString()}</span>
            </div>
            <div class="log-actions">
                <button class="log-action-btn load-btn" onclick="loadLog(${index})">Load</button>
                <button class="log-action-btn delete-log-btn" onclick="removeLog(${index})">Delete</button>
            </div>
        </div>
    `).join('');
}

window.loadLog = function (index) {
    if (!confirm('Load this menu? This will overwrite your current plan.')) return;

    const logs = getLogs();
    const log = logs[index];

    setMealPlan(log.plan);
    renderSavedStateUI(); // Use the aliased renderSavedState from ui.js
    closeLogModal();
    showToast('Menu loaded from history!', 'success');
}

window.removeLog = function (index) {
    if (!confirm('Delete this log?')) return;

    deleteLog(index);
    renderHistoryList();
    showToast('Log deleted', 'success');
}

function initLogModalListeners() {
    // Close buttons
    document.getElementById('closeLogModal').addEventListener('click', closeLogModal);
    document.getElementById('logModalOverlay').addEventListener('click', closeLogModal);

    // Tab switching
    const tabs = document.querySelectorAll('.modal-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.modal-view').forEach(v => v.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`view-${tab.dataset.view}`).classList.add('active');
        });
    });

    // Date input change
    document.getElementById('logStartDate').addEventListener('change', updateDatePreview);
}

// Export functions globally so HTML onclick handlers can find them
// (Since module scripts have their own scope)
window.addFoodItem = addFoodItem;
window.shareNative = shareNative;
window.removeFoodFromCard = removeFoodFromCard;
window.addFoodToCard = addFoodToCard;
window.autoSuggest = autoSuggest;
