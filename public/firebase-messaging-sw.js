importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// These values are public Firebase web-app configuration, not secrets.
firebase.initializeApp({
  apiKey: 'AIzaSyCXaj6OXBJb30Na5Z05GMyVm7GXuTRbV6c',
  authDomain: 'kitcken-noti.firebaseapp.com',
  projectId: 'kitcken-noti',
  storageBucket: 'kitcken-noti.firebasestorage.app',
  messagingSenderId: '500909026976',
  appId: '1:500909026976:web:6f7ae51abccac520ada3c5',
});

const messaging = firebase.messaging();

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'TEST_NOTIFICATION') {
    setTimeout(() => {
      self.registration.showNotification(data.title || 'Kitchen test alert', {
        body: data.body || 'This is a test reminder from your kitchen app.',
        icon: '/favicon.svg',
        tag: 'debug-test-notification',
      });
    }, 30000);
  }
});

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Kitchen reminder';
  const options = {
    body: payload.notification?.body || 'You have a new kitchen notification.',
    icon: '/favicon.svg',
    data: payload.data || {},
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || '/'));
});