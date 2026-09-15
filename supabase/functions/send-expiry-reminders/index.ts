import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { JWT } from 'https://esm.sh/google-auth-library@9';

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type ExpiringItem = {
  id: string;
  user_id: string;
  name: string;
  expiry_date: string;
};

type Subscription = {
  user_id: string;
  token: string;
};

type UserPreferences = {
  user_id: string;
  settings: { expiryReminder?: string | number; notificationsEnabled?: boolean; expiringReminders?: boolean } | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const getAccessToken = async (serviceAccount: ServiceAccount) => {
  const jwt = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const result = await jwt.authorize();
  if (!result.access_token) throw new Error('Firebase did not return an access token.');
  return result.access_token;
};

const loadServiceAccount = () => {
  const encoded = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_BASE64');
  if (encoded) {
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)))) as ServiceAccount;
  }

  return JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || '{}') as ServiceAccount;
};

const sendToToken = async (
  projectId: string,
  accessToken: string,
  subscription: Subscription,
  item: ExpiringItem,
) => {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: subscription.token,
          notification: {
            title: `${item.name} expires soon`,
            body: `${item.name} expires on ${item.expiry_date}. Use it or freeze it!`,
          },
          data: { url: '/', itemId: item.id },
        },
      }),
    },
  );

  return { ok: response.ok, status: response.status };
};

Deno.serve(async (request) => {
  const expectedSecret = Deno.env.get('REMINDER_FUNCTION_SECRET');
  if (expectedSecret && request.headers.get('Authorization') !== `Bearer ${expectedSecret}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const notificationSlot = String(body.slot || 'morning');
    if (!['morning', 'afternoon', 'night'].includes(notificationSlot)) {
      return json({ error: 'Invalid notification slot.' }, 400);
    }
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured.');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const defaultReminderDays = Number(Deno.env.get('EXPIRY_REMINDER_DAYS') || '2');
    const today = new Date();
    const maxReminderDate = new Date(today);
    maxReminderDate.setUTCDate(maxReminderDate.getUTCDate() + Math.max(defaultReminderDays, 7));
    const todayString = today.toISOString().slice(0, 10);
    const maxReminderDateString = maxReminderDate.toISOString().slice(0, 10);

    const { data: items, error: itemError } = await supabase
      .from('kitchen_items')
      .select('id, user_id, name, expiry_date')
      .gte('expiry_date', todayString)
      .lte('expiry_date', maxReminderDateString);
    if (itemError) throw itemError;

    const candidateItems = (items || []) as ExpiringItem[];
    const userIds = [...new Set(candidateItems.map((item) => item.user_id))];
    const { data: preferenceRows, error: preferenceError } = userIds.length
      ? await supabase.from('user_preferences').select('user_id, settings').in('user_id', userIds)
      : { data: [], error: null };
    if (preferenceError) throw preferenceError;

    const { data: dismissalRows, error: dismissalError } = userIds.length
      ? await supabase.from('notification_dismissals').select('user_id').in('user_id', userIds).eq('dismissed_date', todayString)
      : { data: [], error: null };
    if (dismissalError && dismissalError.code !== '42P01') throw dismissalError;
    const dismissedUsers = new Set((dismissalRows || []).map((row) => row.user_id));

    const preferences = new Map(((preferenceRows || []) as UserPreferences[]).map((row) => [row.user_id, row.settings || {}]));
    const expiringItems = candidateItems.filter((item) => {
      if (dismissedUsers.has(item.user_id)) return false;
      const userSettings = preferences.get(item.user_id);
      if (userSettings?.notificationsEnabled === false || userSettings?.expiringReminders === false) return false;
      const reminderDays = Number(userSettings?.expiryReminder ?? defaultReminderDays);
      const reminderDate = new Date(item.expiry_date);
      reminderDate.setUTCDate(reminderDate.getUTCDate() - reminderDays);
      return reminderDate.toISOString().slice(0, 10) === todayString;
    });
    if (expiringItems.length === 0) return json({ sent: 0, date: todayString });

    const expiringUserIds = [...new Set(expiringItems.map((item) => item.user_id))];
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('user_id, token')
      .in('user_id', expiringUserIds);
    if (subscriptionError) throw subscriptionError;

    const accessToken = await getAccessToken(serviceAccount);
    let sent = 0;
    let skipped = 0;
    let removed = 0;

    for (const item of expiringItems) {
      const reminderDays = Number(preferences.get(item.user_id)?.expiryReminder ?? defaultReminderDays);
      const reminderDate = new Date(item.expiry_date);
      reminderDate.setUTCDate(reminderDate.getUTCDate() - reminderDays);
      const reminderDateString = reminderDate.toISOString().slice(0, 10);
      const { data: existingLog, error: logLookupError } = await supabase
        .from('push_notification_log')
        .select('id')
        .eq('user_id', item.user_id)
        .eq('kitchen_item_id', item.id)
        .eq('reminder_date', reminderDateString)
        .eq('notification_slot', notificationSlot)
        .maybeSingle();
      if (logLookupError) throw logLookupError;
      if (existingLog) {
        skipped++;
        continue;
      }

      const userSubscriptions = ((subscriptions || []) as Subscription[]).filter(
        (subscription) => subscription.user_id === item.user_id,
      );

      let itemSent = false;
      for (const subscription of userSubscriptions) {
        const result = await sendToToken(
          serviceAccount.project_id,
          accessToken,
          subscription,
          item,
        );
        if (result.ok) {
          sent++;
          itemSent = true;
        } else if (result.status === 400 || result.status === 404) {
          await supabase.from('push_subscriptions').delete().eq('token', subscription.token);
          removed++;
        }
      }

      if (itemSent) {
        const { error: logError } = await supabase.from('push_notification_log').insert({
          user_id: item.user_id,
          kitchen_item_id: item.id,
          reminder_date: reminderDateString,
          notification_slot: notificationSlot,
        });
        if (logError && logError.code !== '23505') throw logError;
      }
    }

    return json({ sent, skipped, removed, date: todayString });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
