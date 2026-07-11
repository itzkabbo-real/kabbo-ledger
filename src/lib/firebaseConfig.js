// Public Firebase web config (safe to ship in client).
// Do not put service-account private keys here.

export const SHOP_ID = "kabbo_mobile_kushtia";

export const OWNER_UID = "Etx7842cBTNxw2D92fUOIGOnMI52";
export const OWNER_EMAIL = "aryanshaykat331@gmail.com";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyB3ZdfEjO1IgpjL8AJqNjHJ4cpOpuQkCXo",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "kabbo-mobile-shop-app.firebaseapp.com",
  databaseURL:
    env.VITE_FIREBASE_DATABASE_URL ||
    "https://kabbo-mobile-shop-app-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "kabbo-mobile-shop-app",
  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET || "kabbo-mobile-shop-app.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "739154030844",
  appId: env.VITE_FIREBASE_APP_ID || "1:739154030844:web:5cdb9337a81fb95044a779",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-E7W9XBZPCZ",
};

export const HAS_FIREBASE = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
