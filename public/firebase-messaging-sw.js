// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBiM3kq2AFS2SbZNtZkRejfVeMV_fg-ow8",
  authDomain: "hostel-management-system-ce8ac.firebaseapp.com",
  projectId: "hostel-management-system-ce8ac",
  storageBucket: "hostel-management-system-ce8ac.firebasestorage.app",
  messagingSenderId: "338241814648",
  appId: "1:338241814648:web:6ac77c8014a7a869372d8d"
});

const messaging = firebase.messaging();

// ব্যাকগ্রাউন্ডে নোটিফিকেশন রিসিভ করার কোড
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received: ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/notification-icon.png' // আপনার কোনো আইকন থাকলে public ফোল্ডারে রেখে এখানে পাথ দিতে পারেন
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
