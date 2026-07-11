import { useCallback, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  authEmailToPhone,
  phoneToAuthEmail,
} from '../lib/utils.js';
import { auth, db, FIREBASE_CONFIGURED, OWNER_EMAIL, OWNER_UID, SHOP_ID } from '../firebase.js';

function resolveRole(user, memberDoc) {
  if (!user) return null;
  const isHardcodedOwner =
    (OWNER_UID && user.uid === OWNER_UID) ||
    (OWNER_EMAIL && (user.email || '').toLowerCase() === OWNER_EMAIL);
  if (isHardcodedOwner) return 'owner';
  if (memberDoc?.role) return memberDoc.role;
  return 'staff';
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (!FIREBASE_CONFIGURED) {
      setAuthLoading(false);
      return undefined;
    }
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setDisplayName('');
      return undefined;
    }
    // Member doc lives at shops/{shopId}/members/{uid}. This is what makes a
    // manager's role and identity visible to everyone else watching the same
    // shop live, instead of each browser inventing its own local "who am I".
    const memberRef = doc(db, 'shops', SHOP_ID, 'members', user.uid);
    const unsub = onSnapshot(memberRef, (snap) => {
      const memberDoc = snap.exists() ? snap.data() : null;
      setRole(resolveRole(user, memberDoc));
      setDisplayName(memberDoc?.displayName || user.displayName || user.email || 'User');

      // Self-provision a member doc on first login so the owner can see and manage
      // staff from Settings. This never grants owner/manager - default is staff,
      // and Firestore rules block anyone from writing role != staff on their own doc.
      if (!snap.exists()) {
        setDoc(memberRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email || 'User',
          role: resolveRole(user, null) === 'owner' ? 'owner' : 'staff',
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    });
    return unsub;
  }, [user]);

  const loginWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }, []);

  const loginWithEmail = useCallback(async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const loginWithPhone = useCallback(async (phone, password) => {
    const email = phoneToAuthEmail(phone);
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const phone = user ? authEmailToPhone(user.email || '') : '';

  return {
    user,
    role,
    displayName,
    phone,
    authLoading,
    online,
    isConfigured: FIREBASE_CONFIGURED,
    loginWithGoogle,
    loginWithEmail,
    loginWithPhone,
    logout,
  };
}
