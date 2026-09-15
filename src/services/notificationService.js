import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { supabase } from './supabaseClient';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean) && Boolean(vapidKey);

const getMessagingInstance = async () => {
  if (!hasFirebaseConfig || !(await isSupported())) return null;
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getMessaging(app);
};

export const isPushAvailable = () =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  hasFirebaseConfig;

export const enablePushNotifications = async (userId) => {
  if (!userId || !supabase) throw new Error('Push notifications require a signed-in account.');
  if (!isPushAvailable()) throw new Error('Push notifications are not configured for this browser.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messaging = await getMessagingInstance();
  if (!messaging) throw new Error('Firebase Messaging is not supported in this browser.');

  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error('Firebase did not return a browser token.');

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      token,
      platform: 'web',
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' },
  );

  if (error) throw error;
  return token;
};

export const listenForForegroundMessages = async (callback) => {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};

export const sendTestNotification = async (type) => {
  if (!supabase) throw new Error('Notifications require a configured Supabase account.');
  if (!['reminder', 'recommendation'].includes(type)) throw new Error('Unknown notification test.');
  const { data, error } = await supabase.functions.invoke('send-test-notification', {
    body: { type },
  });
  if (error) throw error;
  return data;
};