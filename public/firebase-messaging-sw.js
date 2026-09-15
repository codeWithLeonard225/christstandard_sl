// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCTKz6HzMkfCFqjKacgCYGiTnY6u22Ktic",
  authDomain: "christstandard-sl.firebaseapp.com",
  projectId: "christstandard-sl",
  storageBucket: "christstandard-sl.firebasestorage.app",
  messagingSenderId: "857867450125",
  appId: "1:857867450125:web:9415a40e8ceed3cd5b6244"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});