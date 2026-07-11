import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const FIREBASE_CONFIGURED = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

export const SHOP_ID = import.meta.env.VITE_SHOP_ID || 'kabbo_mobile_kushtia';
export const OWNER_UID = import.meta.env.VITE_OWNER_UID || '';
export const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL || '').toLowerCase();

let app;
let auth;
let db;

if (FIREBASE_CONFIGURED) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);

  // persistentLocalCache + persistentMultipleTabManager is what makes the app
  // "offline-first" for real: writes queue in IndexedDB when offline and Firestore
  // replays them automatically once the connection returns. This replaces the old
  // localStorage-only design, which is the root cause manager input never reached
  // the owner's feed - each device only had its own private browser storage with
  // no server to sync through.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
}

export { app, auth, db };
