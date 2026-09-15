import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { JWT } from 'https://esm.sh/google-auth-library@9';

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
type NotificationType = 'reminder' | 'recommendation';

type Subscription = { token: string };
type ReminderItem = { name: string; expiry_date: string | null };
type Recommendation = { name: string; message: string };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const loadServiceAccount = () => {
  const encoded = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_BASE64');
  if (encoded) {
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)))) as ServiceAccount;
  }
  return JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || '{}') as ServiceAccount;
};

const getAccessToken = async (account: ServiceAccount) => {
  const jwt = new JWT({
    email: account.client_email,
    key: account.private_key,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const result = await jwt.authorize();
  if (!result.access_token) throw new Error('Firebase did not return an access token.');
  return result.access_token;
};

const generateRecommendation = async (inventory: string[]): Promise<Recommendation> => {
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
        { role: 'system', content: 'Return JSON only with keys name and message. Recommend one practical recipe using the pantry in one short message.' },
        { role: 'user', content: `Recommend one recipe using this real pantry: ${inventory.join(', ')}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`AI error: ${response.status}`);
  const content = String((await response.json())?.choices?.[0]?.message?.content || '').trim();
  const cleaned = content.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
  const objectStart = cleaned.indexOf('{');
  const objectEnd = cleaned.lastIndexOf('}');
  if (objectStart < 0 || objectEnd <= objectStart) throw new Error('AI returned invalid recommendation data.');
  const parsed = JSON.parse(cleaned.slice(objectStart, objectEnd + 1));
  return {
    name: String(parsed.name || 'A recipe for your pantry'),
    message: String(parsed.message || 'A new recipe is ready to explore.'),
  };
};

const sendToToken = async (
  projectId: string,
  accessToken: string,
  token: string,
  type: NotificationType,
  reminderItem?: ReminderItem,
  recommendation?: Recommendation,
) => {
  const isReminder = type === 'reminder';
  const reminderBody = reminderItem?.expiry_date
    ? `${reminderItem.name} expires on ${reminderItem.expiry_date}. Use it or freeze it!`
    : 'This is an immediate kitchen reminder from your account.';
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title: isReminder ? `${reminderItem?.name || 'Kitchen'} reminder` : recommendation?.name || 'Recipe recommendation',
          body: isReminder
            ? reminderBody
            : recommendation?.message || 'A new recipe is ready to explore.',
        },
        data: { url: '/recipes', type: `test-${type}` },
      },
    }),
  });
  return { ok: response.ok, status: response.status };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'POST required.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign-in required.' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Sign-in required.' }, 401);

    const { type } = await request.json();
    if (!['reminder', 'recommendation'].includes(type)) return json({ error: 'Invalid notification test.' }, 400);

    const account = loadServiceAccount();
    if (!account.project_id || !account.client_email || !account.private_key) {
      throw new Error('Firebase service account is not configured.');
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: subscriptions, error: subscriptionError } = await adminClient
      .from('push_subscriptions')
      .select('token')
      .eq('user_id', user.id);
    if (subscriptionError) throw subscriptionError;
    if (!subscriptions?.length) return json({ error: 'No browser notification device is registered.' }, 400);

    let reminderItems: ReminderItem[] = [];
    let recommendation: Recommendation | undefined;
    if (type === 'reminder') {
      const { data: preference } = await adminClient
        .from('user_preferences')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle();
      const reminderDays = Math.max(0, Number(preference?.settings?.expiryReminder ?? 2));
      const today = new Date();
      const cutoff = new Date(today);
      cutoff.setUTCDate(cutoff.getUTCDate() + reminderDays);
      const todayString = today.toISOString().slice(0, 10);
      const cutoffString = cutoff.toISOString().slice(0, 10);

      const { data: items, error: itemError } = await adminClient
        .from('kitchen_items')
        .select('name, expiry_date')
        .eq('user_id', user.id)
        .not('expiry_date', 'is', null)
        .order('expiry_date', { ascending: true })
        .limit(30);
      if (itemError) throw itemError;
      const allItems = (items || []) as ReminderItem[];
      reminderItems = allItems.filter((item) => (
        String(item.expiry_date) >= todayString && String(item.expiry_date) <= cutoffString
      ));
      if (reminderItems.length === 0 && allItems[0]) reminderItems = [allItems[0]];
    } else {
      const { data: items, error: itemError } = await adminClient
        .from('kitchen_items')
        .select('name')
        .eq('user_id', user.id)
        .limit(30);
      if (itemError) throw itemError;
      if (!items?.length) return json({ error: 'No pantry items are available for a recommendation.' }, 400);
      recommendation = await generateRecommendation(items.map((item) => item.name));
    }

    const accessToken = await getAccessToken(account);
    let sent = 0;
    const itemsToSend = type === 'reminder' ? reminderItems : [undefined];
    for (const reminderItem of itemsToSend) {
      for (const subscription of subscriptions as Subscription[]) {
        const result = await sendToToken(
          account.project_id,
          accessToken,
          subscription.token,
          type as NotificationType,
          reminderItem,
          recommendation,
        );
        if (result.ok) sent++;
        if (result.status === 400 || result.status === 404) {
          await adminClient.from('push_subscriptions').delete().eq('token', subscription.token);
        }
      }
    }

    return json({
      sent,
      devices: subscriptions.length,
      reminders: reminderItems.map((item) => item.name),
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Could not send notification test.' }, 500);
  }
});
