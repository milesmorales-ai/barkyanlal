import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { JWT } from 'https://esm.sh/google-auth-library@9';

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
type Subscription = { user_id: string; token: string };

type Settings = {
  notificationsEnabled?: boolean;
  recipeRecommendations?: boolean;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const loadServiceAccount = () => {
  const encoded = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_BASE64');
  if (encoded) return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)))) as ServiceAccount;
  return JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || '{}') as ServiceAccount;
};

const getAccessToken = async (account: ServiceAccount) => {
  const jwt = new JWT({ email: account.client_email, key: account.private_key, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
  const result = await jwt.authorize();
  if (!result.access_token) throw new Error('Firebase did not return an access token.');
  return result.access_token;
};

const generateRecommendation = async (inventory: string[]) => {
  const key = Deno.env.get('OPENROUTER_KEY_1');
  if (!key) throw new Error('OPENROUTER_KEY_1 is not configured.');
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'openrouter/free',
      temperature: 0.7,
      max_tokens: 300,
      messages: [
        { role: 'system', content: 'Return JSON only with keys name and message. Recommend one practical recipe in one short message.' },
        { role: 'user', content: `Recommend one recipe using this pantry: ${inventory.join(', ')}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`AI error: ${response.status}`);
  const content = String((await response.json())?.choices?.[0]?.message?.content || '').trim();
  const cleaned = content.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      name: String(parsed.name || 'A recipe for your pantry'),
      message: String(parsed.message || 'A new AI recipe is ready to explore.'),
    };
  } catch {
    const objectStart = cleaned.indexOf('{');
    const objectEnd = cleaned.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        const parsed = JSON.parse(cleaned.slice(objectStart, objectEnd + 1));
        return {
          name: String(parsed.name || 'A recipe for your pantry'),
          message: String(parsed.message || 'A new AI recipe is ready to explore.'),
        };
      } catch {
        // Fall through to a plain-text notification.
      }
    }

    return {
      name: 'AI recipe recommendation',
      message: cleaned.replace(/^Here's a (?:tasty|great)\s*/i, '').slice(0, 240) || 'A new recipe is ready to explore.',
    };
  }
};

const sendToToken = async (projectId: string, accessToken: string, token: string, recommendation: { name: string; message: string }) => {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: {
      token,
      notification: { title: recommendation.name, body: recommendation.message },
      data: { url: '/recipes', type: 'recipe-recommendation' },
    } }),
  });
  return { ok: response.ok, status: response.status };
};

Deno.serve(async (request) => {
  const expectedSecret = Deno.env.get('REMINDER_FUNCTION_SECRET');
  if (expectedSecret && request.headers.get('Authorization') !== `Bearer ${expectedSecret}`) return json({ error: 'Unauthorized' }, 401);

  try {
    const account = loadServiceAccount();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: preferenceRows, error: preferenceError } = await supabase.from('user_preferences').select('user_id, settings');
    if (preferenceError) throw preferenceError;
    const enabledUsers = (preferenceRows || []).filter((row) => {
      const settings = (row.settings || {}) as Settings;
      return settings.notificationsEnabled !== false && settings.recipeRecommendations !== false;
    });
    let sent = 0;

    for (const row of enabledUsers) {
      const { data: items, error: itemError } = await supabase.from('kitchen_items').select('name').eq('user_id', row.user_id).limit(30);
      if (itemError) throw itemError;
      if (!items?.length) continue;
      const recommendation = await generateRecommendation(items.map((item) => item.name));
      const { data: subscriptions, error: subscriptionError } = await supabase.from('push_subscriptions').select('token').eq('user_id', row.user_id);
      if (subscriptionError) throw subscriptionError;
      const accessToken = await getAccessToken(account);
      for (const subscription of (subscriptions || []) as Subscription[]) {
        const result = await sendToToken(account.project_id, accessToken, subscription.token, recommendation);
        if (result.ok) sent++;
        if (result.status === 400 || result.status === 404) await supabase.from('push_subscriptions').delete().eq('token', subscription.token);
      }
    }

    return json({ sent });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error.' }, 500);
  }
});
