import { addFoodItem, customDishes, foodData } from './state.js';

export function loadSampleData() {
    // LUNCH ITEMS
    addFoodItem('Rigatoni', '🍝', 'lunch', 'pasta');
    addFoodItem('Mushroom Fusilli', '🍄', 'lunch', 'pasta');
    addFoodItem('Cheese and Pepper pasta', '🧀', 'lunch', 'pasta');
    addFoodItem('Pistachio Pesto with chicken', '🍗', 'lunch', 'pasta');
    addFoodItem('Cheesy Rigatoni', '🧀', 'lunch', 'pasta');
    addFoodItem('Chicken Pasta and Broccoli', '🥦', 'lunch', 'pasta');
    addFoodItem('Chicken Rice', '🍗', 'lunch', 'rice');
    addFoodItem('Soy Chicken and Chye Sim', '🥬', 'lunch', 'rice');
    addFoodItem('Chicken and Mushroom Rice', '🍄', 'lunch', 'rice');
    addFoodItem('Crispy Noodle', '🍜', 'lunch', 'noodles');
    addFoodItem('Bee Hoon', '🍜', 'lunch', 'noodles');
    addFoodItem('Bee Hoon and Seaweed Chicken', '🌿', 'lunch', 'noodles');
    addFoodItem('Mee Sua Soup', '🍜', 'lunch', 'noodles');
    addFoodItem('Kway Teow Soup', '🍲', 'lunch', 'noodles');
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

export function loadCustomDishesToFoodData() {
    // Add custom lunch dishes
    if (customDishes.lunch) {
        customDishes.lunch.forEach(dish => {
            const exists = foodData.lunch.some(d => d.name === dish.name);
            if (!exists) {
                foodData.lunch.push({ ...dish });
            }
        });
    }

    // Add custom dinner dishes
    if (customDishes.dinner) {
        customDishes.dinner.forEach(dish => {
            const exists = foodData.dinner.some(d => d.name === dish.name);
            if (!exists) {
                foodData.dinner.push({ ...dish });
            }
        });
    }
}
