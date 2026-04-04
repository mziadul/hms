// src/app/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBiM3kq2AFS2SbZNtZkRejfVeMV_fg-ow8",
  authDomain: "hostel-management-system-ce8ac.firebaseapp.com",
  databaseURL: "https://hostel-management-system-ce8ac-default-rtdb.firebaseio.com",
  projectId: "hostel-management-system-ce8ac",
  storageBucket: "hostel-management-system-ce8ac.firebasestorage.app",
  messagingSenderId: "338241814648",
  appId: "1:338241814648:web:6ac77c8014a7a869372d8d",
  measurementId: "G-3F93C5P394"
};

// Next.js SSR এর জন্য এই চেকটি দরকার
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Messaging এবং Analytics শুধু ব্রাউজারে (Client side) লোড হবে
const messaging = typeof window !== "undefined" ? getMessaging(app) : null;
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;

export { app, messaging, analytics };
