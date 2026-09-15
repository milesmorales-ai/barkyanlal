const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const providerKeys = [
  Deno.env.get('OPENROUTER_KEY_4'),
  Deno.env.get('OPENROUTER_KEY_3'),
  Deno.env.get('OPENROUTER_KEY_1'),
  Deno.env.get('OPENROUTER_KEY_2'),
].filter(Boolean) as string[];

const translateWithGoogle = async (recipeText: string) => {
  const apiKey = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');
  if (!apiKey) return null;

  const recipe = JSON.parse(recipeText);
  const fields = ['name', 'mainIngredient', 'whyRecommend', 'instructions', 'equipment', 'cookingTime'];
  const strings: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) strings.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
  };
  fields.forEach((field) => collect(recipe[field]));
  recipe.ingredients?.forEach((ingredient: unknown) => {
    if (typeof ingredient === 'string') strings.push(ingredient);
    else if (ingredient && typeof ingredient === 'object' && 'name' in ingredient) strings.push(String(ingredient.name));
  });

  if (!strings.length) return recipe;
  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: strings, target: 'my', format: 'text' }),
  });
  if (!response.ok) throw new Error(`Google Translate ${response.status}`);
  const data = await response.json();
  const translations = data?.data?.translations?.map((item: { translatedText?: string }) => item.translatedText);
  if (!Array.isArray(translations) || translations.length !== strings.length) throw new Error('Google Translate returned incomplete data.');
  let index = 0;
  const replace = (value: unknown): unknown => {
    if (typeof value === 'string' && value.trim()) return translations[index++];
    if (Array.isArray(value)) return value.map(replace);
    return value;
  };
  fields.forEach((field) => {
    if (recipe[field] !== undefined) recipe[field] = replace(recipe[field]);
  });
  if (Array.isArray(recipe.ingredients)) {
    recipe.ingredients = recipe.ingredients.map((ingredient: unknown) => {
      if (typeof ingredient === 'string') return replace(ingredient);
      if (ingredient && typeof ingredient === 'object' && 'name' in ingredient) return { ...ingredient, name: replace((ingredient as { name: unknown }).name) };
      return ingredient;
    });
  }
  return recipe;
};

const parseJson = (content: string) => {
  const cleaned = content.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
  const start = Math.min(...[cleaned.indexOf('['), cleaned.indexOf('{')].filter((index) => index >= 0));
  if (!Number.isFinite(start)) throw new Error('AI returned no JSON.');
  const candidate = cleaned.slice(start).replace(/,\s*([}\]])$/, '$1');
  const parsed = JSON.parse(candidate);
  if (Array.isArray(parsed)) return parsed;
  return parsed.recipes || parsed.results || parsed.data || parsed.items || parsed;
};

const callProvider = async (url: string, apiKey: string, model: string, prompt: string, mode: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), mode === 'chat' ? 15000 : 60000);
  try {
    const response = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: mode === 'chat' ? 500 : mode === 'recipes' ? 2500 : 8000,
        messages: [
          {
            role: 'system',
            content: mode === 'chat'
              ? 'You are a careful cooking assistant. Answer in 2 or 3 short sentences. Do not invent certainty; mention safety concerns when relevant.'
              : 'Return compact valid JSON only. Generate exactly 3 recipes. Keep each recipe concise. Every ingredient used in instructions must appear in ingredients.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status}`);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response.');
    return mode === 'chat' ? content.trim() : parseJson(content);
  } finally {
    clearTimeout(timeout);
  }
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'POST required.' }, 405);

  try {
    const { prompt, mode = 'recipes', text, language = 'mm' } = await request.json();
    if (mode === 'translate') {
      if (!text) return json({ error: 'Text required.' }, 400);
      const translationPrompt = `Translate this Burmese food name to English and choose exactly one category from vegetable, fruit, meat, dairy, bread, packaged. Return JSON only: {"name":"...","category":"..."}. Food name: ${text}`;
      let translationError = 'No provider configured.';
      for (const key of providerKeys) {
        try {
          const translation = await callProvider('https://openrouter.ai/api/v1', key, 'openrouter/free', translationPrompt, 'recipes');
          const result = Array.isArray(translation) ? translation[0] : translation;
          return json({ translation: result });
        } catch (error) {
          translationError = error instanceof Error ? error.message : String(error);
        }
      }
      return json({ error: `Translation unavailable: ${translationError}` }, 503);
    }
    if (mode === 'translate-recipe') {
      if (!text) return json({ error: 'Recipe text required.' }, 400);
      if (language === 'mm' && Deno.env.get('GOOGLE_TRANSLATE_API_KEY')) {
        try {
          return json({ recipe: await translateWithGoogle(text), provider: 'google-translate' });
        } catch (error) {
          console.warn('Google recipe translation failed; trying OpenRouter.', error);
        }
      }
      const translationPrompt = `Translate this recipe into natural, accurate Burmese for a Myanmar home cook. Preserve the exact JSON structure, keys, numbers, quantities, IDs, categories, and boolean values. Translate only human-readable recipe name, ingredient names, mainIngredient, whyRecommend, instructions, equipment, and cookingTime. Do not transliterate English when a common Burmese food word exists. Return valid JSON only. Target language: ${language}. Recipe: ${text}`;
      let translationError = 'No provider configured.';
      for (const key of providerKeys) {
        try {
          const translation = await callProvider('https://openrouter.ai/api/v1', key, 'openrouter/free', translationPrompt, 'recipes');
          return json({ recipe: Array.isArray(translation) ? translation[0] : translation });
        } catch (error) {
          translationError = error instanceof Error ? error.message : String(error);
        }
      }
      return json({ error: `Translation unavailable: ${translationError}` }, 503);
    }
    if (!prompt || !['recipes', 'chat'].includes(mode)) return json({ error: 'Invalid request.' }, 400);

    let lastError = 'No provider configured.';
    for (const [index, key] of providerKeys.entries()) {
      try {
        const result = await callProvider('https://openrouter.ai/api/v1', key, 'openrouter/free', prompt, mode);
        return mode === 'chat' ? json({ answer: result, provider: `openrouter-${index + 1}` }) : json({ recipes: result, provider: `openrouter-${index + 1}` });
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    const grokKey = Deno.env.get('GROK_API_KEY');
    if (grokKey) {
      try {
        const result = await callProvider('https://api.x.ai/v1', grokKey, 'grok-3-mini', prompt, mode);
        return mode === 'chat' ? json({ answer: result, provider: 'grok' }) : json({ recipes: result, provider: 'grok' });
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return json({ error: `AI unavailable: ${lastError}` }, 503);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error.' }, 500);
  }
});
