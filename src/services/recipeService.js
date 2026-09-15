// src/services/recipeService.js

import Papa from 'papaparse';
import { supabase } from './supabaseClient';
import { getCanonicalIngredientName, getIngredientNameEN } from '../data/ingredients';

// ============================================================
// CONFIG
// ============================================================

const API_KEYS = [
  import.meta.env.VITE_OPENROUTER_KEY_4,
  import.meta.env.VITE_OPENROUTER_KEY_3,
  import.meta.env.VITE_OPENROUTER_KEY_1,
  import.meta.env.VITE_OPENROUTER_KEY_2,
].filter(Boolean);

const AI_CONFIG = {
  baseURL: 'https://openrouter.ai/api/v1',
  model: 'openrouter/free',
};

let currentKeyIndex = 0;
const keyCooldown = {};


// ============================================================
// PANTRY ITEMS
// ============================================================
//
// These are things the AI may assume are commonly available.
// IMPORTANT:
// We DO NOT remove these from the recipe ingredient list.
//
// They are still shown to the user when the recipe requires them.
// ============================================================

const PANTRY_STAPLES = [
  'salt',
  'black pepper',
  'white pepper',
  'pepper',
  'water',
  'cooking oil',
  'vegetable oil',
  'canola oil',
  'olive oil',
  'sesame oil',
  'butter',
  'garlic',
  'onion',
  'sugar',
  'soy sauce',
  'vinegar',
];

// ============================================================
// NORMALIZATION
// ============================================================

const normalizeIngredient = value => {
  if (!value) return '';

  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[()[\],.:]/g, ' ')
    .replace(/\s+/g, ' ');
};

const singularize = word => {
  if (!word) return '';

  if (word.endsWith('ies')) {
    return `${word.slice(0, -3)}y`;
  }

  if (word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }

  return word;
};

const tokenize = value => {
  return normalizeIngredient(value)
    .split(/\s+/)
    .map(singularize)
    .filter(Boolean);
};

// ============================================================
// INGREDIENT MATCHING
// ============================================================

const ingredientsMatch = (inventoryName, recipeName) => {
  const inventory = tokenize(getCanonicalIngredientName(inventoryName));
  const recipe = tokenize(getCanonicalIngredientName(recipeName));

  if (!inventory.length || !recipe.length) {
    return false;
  }

  const inventoryText = inventory.join(' ');
  const recipeText = recipe.join(' ');

  // Exact normalized match
  if (inventoryText === recipeText) {
    return true;
  }

  // One contains the other
  if (
    inventoryText.includes(recipeText) ||
    recipeText.includes(inventoryText)
  ) {
    return true;
  }

  // Token overlap
  const recipeSet = new Set(recipe);

  const overlap = inventory.filter(token =>
    recipeSet.has(token)
  );

  return overlap.length >= Math.min(
    2,
    Math.max(1, recipe.length)
  );
};

// ============================================================
// INVENTORY MATCH
// ============================================================

const findInventoryItem = (ingredientName, items) => {
  if (!ingredientName || !Array.isArray(items)) {
    return null;
  }

  return (
    items.find(item =>
      ingredientsMatch(item?.normalizedName || item?.name || '', ingredientName)
    ) || null
  );
};

// ============================================================
// BUILD INVENTORY

const callCompatibleAI = async ({ url, apiKey, model, prompt, provider, timeout = 25000, responseText = false }) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.75,
        max_tokens: 4500,
        messages: [
          {
            role: 'system',
            content: 'Return only valid JSON. Generate exactly 3 genuinely different recipes. Every ingredient in instructions must appear in the ingredients array.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`${provider} API error: ${response.status}`);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || data?.message?.content;
    if (!content) throw new Error(`${provider} returned an empty response`);
    return responseText ? String(content).trim() : cleanJSON(content);
  } finally {
    clearTimeout(timeoutId);
  }
};

async function callAIWithFallback(prompt) {
  if (!supabase) throw new Error('Recipe AI is not configured.');
  const { data, error } = await supabase.functions.invoke('generate-recipes', {
    body: { prompt, mode: 'recipes' },
  });
  if (error) throw error;
  return data?.recipes || data;
}

export async function askCookingAssistant(question, recipe, inventory) {
  if (!supabase) throw new Error('Cooking assistant is not configured.');

  const inventoryNames = (inventory || []).map((item) => item.name).join(', ') || 'none';
  const prompt = `You are a fast cooking helper. Answer in 2 or 3 short sentences.
Recipe: ${recipe?.name || 'current recipe'}
Ingredients: ${(recipe?.ingredients || []).map((ingredient) => typeof ingredient === 'string' ? ingredient : ingredient.name).join(', ')}
Kitchen inventory: ${inventoryNames}
Question: ${question}`;

  const { data, error } = await supabase.functions.invoke('generate-recipes', {
    body: { prompt, mode: 'chat' },
  });
  if (error) throw error;
  return data?.answer || data?.text || 'The cooking assistant returned no answer.';
}
// ============================================================

const buildInventoryList = items => {
  return items
    .map((item, index) => {
      const name = item?.name || 'Unknown ingredient';

      let result = `${index + 1}. ${name}`;

      if (item?.quantity !== undefined && item?.quantity !== '') {
        result += ` | quantity: ${item.quantity}`;
      }

      if (item?.unit) {
        result += ` ${item.unit}`;
      }

      if (item?.expiryDate) {
        const expiry = new Date(item.expiryDate);
        const today = new Date();

        const daysLeft = Math.ceil(
          (expiry - today) / 86400000
        );

        result += ` | expires in approximately ${daysLeft} day(s)`;
      }

      if (item?.location) {
        result += ` | location: ${item.location}`;
      }

      return result;
    })
    .join('\n');
};

// ============================================================
// KEY ROTATION
// ============================================================

const getNextKey = () => {
  if (!API_KEYS.length) {
    return null;
  }

  const totalKeys = API_KEYS.length;

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const key = API_KEYS[currentKeyIndex];

    const cooldownUntil = keyCooldown[key];

    if (!cooldownUntil || Date.now() >= cooldownUntil) {
      return key;
    }

    currentKeyIndex =
      (currentKeyIndex + 1) % totalKeys;
  }

  return null;
};

const markKeyRateLimited = key => {
  if (!key) return;

  keyCooldown[key] =
    Date.now() + COOLDOWN_TIME;

  console.log(
    `⚠️ Key ${key.slice(0, 12)}... rate limited`
  );
};

const moveToNextKey = () => {
  if (!API_KEYS.length) return;

  currentKeyIndex =
    (currentKeyIndex + 1) % API_KEYS.length;
};

// ============================================================
// OPENROUTER
// ============================================================

async function callOpenRouterAI(prompt, timeout = 15000) {
  if (!API_KEYS.length) {
    throw new Error(
      'No OpenRouter API keys configured.'
    );
  }

  const attemptedKeys = new Set();

  while (attemptedKeys.size < API_KEYS.length) {
    const key = getNextKey();

    if (!key) {
      throw new Error(
        'All AI services are busy. Please try again later.'
      );
    }

    if (attemptedKeys.has(key)) {
      moveToNextKey();
      continue;
    }

    attemptedKeys.add(key);

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      console.log(
        `🔑 Trying OpenRouter key ${currentKeyIndex + 1}/${API_KEYS.length}`
      );

      const response = await fetch(
        `${AI_CONFIG.baseURL}/chat/completions`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Food Reminder',
          },

          body: JSON.stringify({
            model: AI_CONFIG.model,

            messages: [
              {
                role: 'system',

                content: `
You are a professional home-cooking assistant.

Your job is to create realistic recipes from a household's actual food inventory.

CRITICAL:
- Return ONLY valid JSON.
- Never return markdown.
- Never return explanations outside JSON.
- Every ingredient used in the instructions MUST appear in the ingredients array.
- Never hide ingredients inside the instructions.
- Never claim an ingredient is available unless it exists in the supplied inventory.
- Never silently invent an inventory ingredient.
- Common pantry ingredients may be used, but they must STILL appear in the ingredients array.
- Recipes must be genuinely different from each other.
                `.trim(),
              },

              {
                role: 'user',
                content: prompt,
              },
            ],

            temperature: 0.75,

            max_tokens: 3200,

            response_format: {
              type: 'json_object',
            },
          }),

          signal: controller.signal,
        }
      );

      if (response.status === 429) {
        clearTimeout(timeoutId);
        markKeyRateLimited(key);
        moveToNextKey();
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();

        console.error(
          'OpenRouter error:',
          response.status,
          errorText
        );

        throw new Error(
          `API error: ${response.status}`
        );
      }

      const data = await response.json();

      const content =
        data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Empty AI response');
      }

      console.log(
        `✅ AI response received (${content.length} chars)`
      );

      return cleanJSON(content);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error?.name === 'AbortError') {
        console.warn('⏰ AI request timed out');
      }

      console.warn(
        `OpenRouter key ${currentKeyIndex + 1} failed; trying the next key.`,
        error
      );
      moveToNextKey();
      continue;
    }
  }

  throw new Error(
    'All AI services are currently unavailable.'
  );
}

// ============================================================
// JSON CLEANER
// ============================================================

function cleanJSON(content) {
  if (!content) {
    throw new Error(
      'AI returned an empty response.'
    );
  }

  let text = String(content).trim();

  text = text
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();

  // Remove accidental text before JSON and accept either an array or a
  // wrapper object such as { "recipes": [...] }.
  const arrayStart = text.indexOf('[');
  const objectStart = text.indexOf('{');
  const starts = [arrayStart, objectStart].filter(index => index >= 0);
  const jsonStart = starts.length > 0 ? Math.min(...starts) : -1;

  if (jsonStart === -1) {
    throw new Error('AI did not return JSON recipe data.');
  }

  text = text.slice(jsonStart);

  // Find the end of the first balanced JSON value.
  let depth = 0;
  let inString = false;
  let escaped = false;
  let endIndex = -1;
  const openingCharacter = text[0];
  const closingCharacter = openingCharacter === '{' ? '}' : ']';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '[' || char === '{') {
      depth++;
    }

    if (char === ']' || char === '}') {
      depth--;

      if (depth === 0 && char === closingCharacter) {
        endIndex = i + 1;
        break;
      }
    }
  }

  if (endIndex === -1) {
    throw new Error(
      'AI returned incomplete JSON.'
    );
  }

  const jsonText = text.slice(0, endIndex);

  try {
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) return parsed;

    const recipes = parsed.recipes || parsed.results || parsed.data || parsed.items;
    if (Array.isArray(recipes)) return recipes;

    throw new Error('AI returned an unsupported recipe object.');
  } catch (error) {
    console.error(
      '❌ JSON parsing failed:',
      jsonText
    );

    throw new Error(
      'AI returned invalid recipe data.'
    );
  }
}

// ============================================================
// NORMALIZE AI INGREDIENT
// ============================================================

const normalizeRecipeIngredient = (
  ingredient,
  items
) => {
  let result = {
    name: '',
    quantity: '',
    unit: '',
    available: false,
    source: 'missing',
  };

  // AI returned string
  if (typeof ingredient === 'string') {
    result.name = ingredient.trim();
  }

  // AI returned object
  else if (
    ingredient &&
    typeof ingredient === 'object'
  ) {
    result = {
      ...result,
      ...ingredient,
    };

    result.name =
      String(
        ingredient.name ||
        ingredient.ingredient ||
        ''
      ).trim();
  }

  if (!result.name) {
    return null;
  }

  const inventoryItem = findInventoryItem(
    result.name,
    items
  );

  if (inventoryItem) {
    result.available = true;
    result.source = 'inventory';

    // If AI didn't provide a quantity,
    // use the user's inventory quantity.
    if (
      !result.quantity &&
      inventoryItem.quantity !== undefined
    ) {
      result.quantity = inventoryItem.quantity;
    }

    if (
      !result.unit &&
      inventoryItem.unit
    ) {
      result.unit = inventoryItem.unit;
    }
  }

  return result;
};

// ============================================================
// NORMALIZE RECIPE
// ============================================================

const normalizeRecipe = (recipe, items) => {
  if (!recipe || typeof recipe !== 'object') {
    return null;
  }

  const ingredients = Array.isArray(
    recipe.ingredients
  )
    ? recipe.ingredients
        .map(ingredient =>
          normalizeRecipeIngredient(
            ingredient,
            items
          )
        )
        .filter(Boolean)
    : [];

  const uniqueIngredients = [];

  for (const ingredient of ingredients) {
    const duplicate = uniqueIngredients.some(
      existing =>
        normalizeIngredient(existing.name) ===
        normalizeIngredient(ingredient.name)
    );

    if (!duplicate) {
      uniqueIngredients.push(ingredient);
    }
  }

  const availableCount =
    uniqueIngredients.filter(
      ingredient =>
        ingredient.available
    ).length;

  const totalCount =
    uniqueIngredients.length;

  return {
    ...recipe,

    name:
      String(
        recipe.name ||
        recipe.title ||
        'Untitled Recipe'
      ).trim(),

    mainIngredient:
      String(
        recipe.mainIngredient ||
        uniqueIngredients[0]?.name ||
        'Various'
      ).trim(),

    ingredients:
      uniqueIngredients,

    instructions:
      String(
        recipe.instructions ||
        '1. Prep the ingredients and set a pan over medium heat.\n2. Cook the main ingredient until it starts to brown and release flavor.\n3. Add the remaining ingredients and season as needed.\n4. Stir or simmer until everything is cooked through and the flavors combine.\n5. Taste and adjust seasoning before serving.'
      ).trim(),

    cookingTime:
      String(
        recipe.cookingTime ||
        '30 min'
      ).trim(),

    type:
      recipe.type || 'main',

    availableCount,

    totalCount,
  };
};

// ============================================================
// VALIDATE RECIPE
// ============================================================

const validateRecipe = recipe => {
  if (!recipe) {
    return false;
  }

  if (!recipe.name) {
    return false;
  }

  if (
    !Array.isArray(recipe.ingredients) ||
    recipe.ingredients.length === 0
  ) {
    return false;
  }

  if (!recipe.instructions) {
    return false;
  }

  // A recipe with only one ingredient is usually
  // not useful for this application.
  //
  // Allow single ingredient only if the AI explicitly
  // identifies it as a very simple dish.
  if (recipe.ingredients.length < 2) {
    return false;
  }

  // Main ingredient MUST actually exist
  // in the ingredient list.
  const mainExists =
    recipe.ingredients.some(
      ingredient =>
        ingredientsMatch(
          ingredient.name,
          recipe.mainIngredient
        )
    );

  if (!mainExists) {
    return false;
  }

  return true;
};

// ============================================================
// RECIPE DUPLICATE DETECTION
// ============================================================

const getIngredientSignature = recipe => {
  return recipe.ingredients
    .map(i =>
      normalizeIngredient(i.name)
    )
    .sort()
    .join('|');
};

const recipesAreTooSimilar = (a, b) => {
  const aIngredients =
    new Set(
      a.ingredients.map(i =>
        normalizeIngredient(i.name)
      )
    );

  const bIngredients =
    new Set(
      b.ingredients.map(i =>
        normalizeIngredient(i.name)
      )
    );

  const intersection =
    [...aIngredients].filter(x =>
      bIngredients.has(x)
    ).length;

  const smaller =
    Math.min(
      aIngredients.size,
      bIngredients.size
    );

  if (!smaller) return false;

  const overlap =
    intersection / smaller;

  return overlap >= 0.8;
};

// ============================================================
// MAKE RECIPES DIFFERENT
// ============================================================

const diversifyRecipes = recipes => {
  const result = [];

  for (const recipe of recipes) {
    const tooSimilar = result.some(
      existing =>
        recipesAreTooSimilar(
          existing,
          recipe
        )
    );

    if (!tooSimilar) {
      result.push(recipe);
    }
  }

  return result;
};

export const ensureRecipeCount = (recipes = [], fallbackRecipes = []) => {
  if (!Array.isArray(recipes)) return [];

  const uniqueRecipes = [];
  const seen = new Set();

  for (const recipe of [...recipes, ...(fallbackRecipes || [])]) {
    if (!recipe || typeof recipe !== 'object') continue;

    const signature = normalizeIngredient(
      String(recipe.name || recipe.title || '')
    );

    const ingredientSignature = Array.isArray(recipe.ingredients)
      ? recipe.ingredients
          .map(item => normalizeIngredient(String(item?.name || item || '')))
          .filter(Boolean)
          .sort()
          .join('|')
      : '';

    const key = signature || ingredientSignature;
    if (!key || seen.has(key)) continue;

    seen.add(key);
    uniqueRecipes.push(recipe);

    if (uniqueRecipes.length >= 3) break;
  }

  return uniqueRecipes.slice(0, 3);
};

// ============================================================
// COMMON PROMPT
// ============================================================

const buildRecipePrompt = (
  inventoryList,
  preferences = {},
  mode = 'recipes'
) => {
  const preferenceText =
    Object.entries(preferences)
      .filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== ''
      )
      .map(
        ([key, value]) =>
          `${key}: ${value}`
      )
      .join('\n') ||
    'No special preferences';

  const preferenceOnly = mode === 'preference-only recommendations';

  if (preferenceOnly) {
    return `
You are a professional culinary recommender.

Create exactly 3 real, recognizable recipes based ONLY on the user's selected preferences below.
This is the Find My Dish feature. Do not use, inspect, infer, or mention pantry inventory.

USER'S SELECTED PREFERENCES:
${preferenceText}

STRICT RULES:
- Follow the selected cuisine exactly. If cuisine is Thai, every recipe must be genuinely Thai or a clearly recognized Thai dish. Never substitute Mexican, Italian, or another cuisine.
- Follow the selected meal type, dietary preference, spice level, cooking time, and serving size exactly when provided.
- Use authentic, well-known dish names and realistic ingredients for the selected cuisine.
- Do not claim that ingredients are available in the user's pantry.
- Return exactly 3 complete recipes, not ideas or ingredient combinations.
- Return only valid JSON in the same recipe schema used by the app.
`;
  }

  return `
You are creating recipes for a food-inventory reminder application used by busy households.

The goal is NOT simply to name dishes containing one ingredient.

The goal is to create REALISTIC COMPLETE MEALS using the user's actual inventory.

============================================================
USER INVENTORY
============================================================

${inventoryList}

============================================================
USER PREFERENCES
============================================================

${preferenceText}

============================================================
MOST IMPORTANT RULE: INGREDIENT ACCURACY
============================================================

Every ingredient that appears in ANY cooking instruction MUST appear in the "ingredients" array.

For example, if your instructions say:

"Beat two eggs with butter and add tomatoes."

Then the ingredients array MUST contain:

- eggs
- butter
- tomatoes

You are NOT allowed to mention an ingredient only inside instructions.

The ingredients array is the source of truth for the frontend.

============================================================
INVENTORY RULES
============================================================

1. Only mark an ingredient as available if it exists in USER INVENTORY.

2. If an ingredient is not in USER INVENTORY but is commonly used,
   you may use it as a pantry ingredient.

3. Pantry ingredients are NOT automatically available unless they
   appear in USER INVENTORY.

4. Every ingredient MUST have:
   - name
   - quantity
   - unit
   - available
   - source

5. "source" must be exactly one of:
   - "inventory"
   - "pantry"
   - "missing"

6. If the ingredient exists in inventory:
   available = true
   source = "inventory"

7. If it is a normal cooking staple such as salt, oil, pepper,
   water, butter, garlic, onion or soy sauce:
   available = false unless it exists in USER INVENTORY.
   source = "pantry"

8. If it is a non-staple ingredient that is not available:
   available = false
   source = "missing"

============================================================
DO NOT CHEAT WITH THE MAIN INGREDIENT
============================================================

BAD:

Inventory:
- Chicken Wings
- Tomatoes
- Eggs
- Lettuce

Recipe:
"Crispy Chicken Wings"

ingredients:
["Chicken Wings"]

This is BAD.

GOOD:

"Chicken Tomato Egg Skillet"

ingredients:
[
  chicken wings,
  tomatoes,
  eggs,
  butter,
  salt,
  pepper
]

The recipe should actually combine multiple ingredients.

============================================================
USE MULTIPLE INVENTORY ITEMS
============================================================

Whenever possible, use 2-4 meaningful ingredients from inventory.

Do NOT make every recipe about the first item in the inventory.

If the inventory contains:

Chicken Wings
Eggs
Tomatoes
Lettuce
Rice

Possible recipes could be:

1. Chicken Tomato Egg Rice Bowl
2. Tomato Egg Fried Rice with Chicken
3. Crispy Chicken Lettuce Rice Bowl

These are more useful than:

1. Chicken Wings
2. Chicken Wings with Tomato
3. Chicken Wings with Egg

============================================================
QUANTITY RULE
============================================================

The quantity must be realistic.

Example:

Chicken Wings:
quantity: "6"
unit: "pieces"

Eggs:
quantity: "2"
unit: "pieces"

Tomatoes:
quantity: "2"
unit: "medium"

Butter:
quantity: "1"
unit: "tbsp"

Do not write quantities like:

"some"
"a little"
"as needed"

unless the ingredient genuinely cannot have a useful measurement.

============================================================
EXPIRY PRIORITY
============================================================

Ingredients that expire soon should receive priority.

If an ingredient has an expiry date of 1-2 days,
try to use it before ingredients that expire later.

============================================================
RECIPE VARIETY
============================================================

Generate genuinely different dishes.

Vary:

- cooking method
- texture
- meal format
- cuisine
- ingredient combinations
- preparation style

Avoid generating three versions of the same dish.

Do not repeat the same main ingredient in all recipes
unless the inventory contains very few meaningful ingredients.

============================================================
PRACTICAL HOUSEHOLD COOKING
============================================================

Recipes should:

- be realistic
- use normal household equipment
- have believable cooking times
- be understandable
- avoid unnecessary complicated techniques
- work for a busy household
- include detailed, step-by-step cooking instructions with 4 to 7 numbered steps
- be complete meals, not vague ideas or one-ingredient suggestions

============================================================
DETAILED, NON-LOOPING INSTRUCTIONS
============================================================

Each recipe must have a clear cooking method with realistic steps such as:

1. Prep the ingredients and heat the pan.
2. Cook the main ingredient until it browns or sets.
3. Add aromatics or vegetables and stir for flavor.
4. Add sauce, stock, or seasoning and simmer until combined.
5. Fold in remaining ingredients and cook until tender.
6. Taste and adjust seasoning before serving.

Instructions MUST agree exactly with the ingredients array.

Before returning each recipe, mentally check:

"Did I mention an ingredient in instructions that is missing
from ingredients[]?"

If YES, add it to ingredients[].

Also check:

"Did I put an ingredient in ingredients[] that the instructions
never use?"

If YES, either use it or remove it.

Avoid repeating the same dish with different names or the same ingredient mix in all 3 recipes.
Each recipe should feel genuinely different in style, texture, or cooking method.
Do not generate three variations of one idea. Use different meal formats when possible.

============================================================
OUTPUT
============================================================

Generate exactly 3 recipes.

Return ONLY this JSON:

[
  {
    "name": "Recipe Name",
    "mainIngredient": "Main ingredient",
    "ingredients": [
      {
        "name": "Chicken Wings",
        "quantity": "6",
        "unit": "pieces",
        "available": true,
        "source": "inventory"
      },
      {
        "name": "Eggs",
        "quantity": "2",
        "unit": "pieces",
        "available": true,
        "source": "inventory"
      },
      {
        "name": "Butter",
        "quantity": "1",
        "unit": "tbsp",
        "available": false,
        "source": "pantry"
      }
    ],
    "instructions": "1. Heat the pan over medium heat and melt the butter.\\n2. Season the chicken wings and cook until lightly browned.\\n3. Add the eggs and stir until just set.\\n4. Fold in the vegetables or rice if included and cook until warm.\\n5. Taste, adjust seasoning, and serve immediately.",
    "cookingTime": "25 min",
    "whyRecommend": "Uses chicken wings and eggs already in your kitchen.",
    "type": "main"
  }
]

============================================================
FINAL QUALITY CHECK
============================================================

Before returning JSON:

✓ Exactly 3 recipes
✓ Every recipe has at least 2 ingredients
✓ Every ingredient used in instructions is listed
✓ No hidden ingredients
✓ Available status matches inventory
✓ Quantities are realistic
✓ Recipes are genuinely different
✓ Recipes use multiple inventory items when possible
✓ Expiring food is prioritized
✓ No fake inventory items
✓ Valid JSON only

Mode: ${mode}
`;
};

// ============================================================
// GENERATE RECIPES
// ============================================================

const burmesePattern = /[\u1000-\u109f]/;

const knownBurmeseFoods = {
  'ကြက်သား': { name: 'chicken', category: 'meat' },
  'kyat thar': { name: 'chicken', category: 'meat' },
  'ဝက်သား': { name: 'pork', category: 'meat' },
  'အမဲသား': { name: 'beef', category: 'meat' },
  'ငါး': { name: 'fish', category: 'meat' },
  'ပုစွန်': { name: 'shrimp', category: 'meat' },
  'ကြက်ဥ': { name: 'egg', category: 'dairy' },
  'ထမင်း': { name: 'rice', category: 'packaged' },
  'အာလူး': { name: 'potato', category: 'vegetable' },
  'ခရမ်းချဉ်သီး': { name: 'tomato', category: 'vegetable' },
};

export async function translateFoodName(name, fallbackCategory = 'vegetable') {
  const text = String(name || '').trim();
  if (knownBurmeseFoods[text]) return knownBurmeseFoods[text];
  if (!text || !burmesePattern.test(text)) return { name: text, category: fallbackCategory };

  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('generate-recipes', {
        body: { mode: 'translate', text },
      });
      if (!error && data?.translation) {
        return {
          name: String(data.translation.name || text),
          category: String(data.translation.category || fallbackCategory),
        };
      }
    } catch (error) {
      console.warn('Food translation unavailable:', error);
    }
  }

  return { name: text, category: fallbackCategory };
}

export async function translateGeneratedRecipe(recipe, targetLanguage = 'mm') {
  if (!supabase || !recipe || targetLanguage !== 'mm') return recipe;
  try {
    const { data, error } = await supabase.functions.invoke('generate-recipes', {
      body: { mode: 'translate-recipe', language: targetLanguage, text: JSON.stringify(recipe) },
    });
    if (!error && data?.recipe && typeof data.recipe === 'object') {
      return {
        ...recipe,
        ...data.recipe,
        ingredients: Array.isArray(recipe.ingredients) && Array.isArray(data.recipe.ingredients)
          ? data.recipe.ingredients.map((ingredient, index) => ({
            ...ingredient,
            originalName: recipe.ingredients[index]?.name || ingredient.originalName,
          }))
          : recipe.ingredients,
      };
    }
  } catch (error) {
    console.warn('Recipe translation unavailable:', error);
  }
  return recipe;
}

const translateBurmeseItems = async (items) => {
  const translated = [];

  for (const item of items) {
    const name = String(item?.normalizedName || item?.name || '').trim();
    const mappedName = getIngredientNameEN(name);
    const result = mappedName !== name
      ? { name: mappedName, category: item.category }
      : await translateFoodName(name, item.category);
    translated.push({ ...item, name: result.name || name, normalizedName: result.name || name });
  }

  return translated;
};

export async function generateRecipes(items) {
  console.log(
    '📦 generateRecipes called with:',
    items
  );

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new Error(
      'No items to generate recipes'
    );
  }

  const translatedItems = await translateBurmeseItems(items);
  const inventoryList =
    buildInventoryList(translatedItems);

  const basePrompt = buildRecipePrompt(
    inventoryList,
    {},
    'inventory recipes'
  );

  const strictPrompt = `${basePrompt}\n\nIMPORTANT: Return exactly 3 distinctly different recipes. No duplicates, no near-duplicates, and no repeated meal formats. If the first answer repeats ideas, replace the weaker ones with new dishes using different ingredients and cooking methods.`;

  const normalizeBatch = async (promptText) => {
    const rawRecipes = await callAIWithFallback(promptText);

    if (!Array.isArray(rawRecipes)) {
      throw new Error(
        'AI did not return recipes'
      );
    }

    const normalized =
      rawRecipes
        .map(recipe =>
          normalizeRecipe(
            recipe,
            translatedItems
          )
        )
        .filter(Boolean)
        .filter(validateRecipe);

    const diversified = await Promise.all(
      diversifyRecipes(normalized).map(translateGeneratedRecipe)
    );

    return diversified;
  };

  try {
    const firstBatch = await normalizeBatch(basePrompt);
    const secondBatch = firstBatch.length >= 3 ? [] : await normalizeBatch(strictPrompt);
    const combined = ensureRecipeCount([...firstBatch, ...secondBatch]);

    if (combined.length === 0) {
      throw new Error(
        'AI returned no usable recipes'
      );
    }

    console.log(
      `✅ ${combined.length} usable recipes`
    );

    return combined.slice(0, 3);
  } catch (error) {
    console.error(
      '❌ AI recipe generation failed:',
      error
    );

    throw error;
  }
}

// ============================================================
// GENERATE RECOMMENDATIONS
// ============================================================

export async function generateRecommendations(
  preferences = {}
) {
  console.log(
    '📦 generateRecommendations called with:',
    preferences
  );

  const inventoryList = 'Not used for Find My Dish. Build the recommendation from the user preferences only.';

  const prompt = buildRecipePrompt(
    inventoryList,
    preferences,
    'preference-only recommendations'
  );

  try {
    const rawRecipes =
      await callAIWithFallback(prompt);

    if (!Array.isArray(rawRecipes)) {
      throw new Error(
        'AI did not return recipes'
      );
    }

    const normalized =
      rawRecipes
        .map(recipe => normalizeRecipe(recipe, []))
        .filter(Boolean)
        .filter(validateRecipe);

    const diversified = await Promise.all(
      diversifyRecipes(normalized).map(translateGeneratedRecipe)
    );

    if (diversified.length === 0) {
      throw new Error(
        'AI returned no usable recommendations'
      );
    }

    return diversified;
  } catch (error) {
    console.error(
      '❌ AI recommendations failed:',
      error
    );

    throw error;
  }
}

// ============================================================
// OTHER FUNCTIONS
// ============================================================

export const searchRecipes = async () => {
  throw new Error(
    'AI recipe search is currently unavailable.'
  );
};

export const getRandomRecipes = async () => {
  throw new Error(
    'AI random recipes are currently unavailable.'
  );
};

export const getRecipeSuggestions = async (
  ingredientList
) => {
  if (
    !Array.isArray(ingredientList) ||
    ingredientList.length === 0
  ) {
    throw new Error(
      'No ingredients provided'
    );
  }

  const items =
    ingredientList.map(name => ({
      name,
    }));

  return generateRecipes(items);
};

export const loadRecipesFromCSV =
  async () => {
    console.warn(
      '⚠️ CSV loading is deprecated.'
    );

    return [];
  };

export async function testAIConnection() {
  try {
    const result =
      await callAIWithFallback(
        `
Return exactly:

[
  {
    "name": "Connection Test",
    "mainIngredient": "Test",
    "ingredients": [
      {
        "name": "Test",
        "quantity": "1",
        "unit": "item",
        "available": true,
        "source": "inventory"
      },
      {
        "name": "Salt",
        "quantity": "1",
        "unit": "pinch",
        "available": false,
        "source": "pantry"
      }
    ],
    "instructions": "1. Test.",
    "cookingTime": "1 min",
    "type": "main"
  }
]
        `,
        10000
      );

    return {
      success: true,
      response: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export const getLocalRecipesDirect =
  () => {
    console.warn(
      '⚠️ Local recipes are deprecated.'
    );

    return [];
  };