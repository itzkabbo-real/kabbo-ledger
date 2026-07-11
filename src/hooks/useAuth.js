import { useCallback, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { authEmailToPhone, phoneToAuthEmail } from '../lib/utils.js';
import { auth, db, FIREBASE_CONFIGURED, OWNER_EMAIL, OWNER_UID, SHOP_ID } from '../firebase.js';

function resolveRole(user, memberDoc) {
  if (!user) return null;
  const isHardcodedOwner =
    (OWNER_UID && user.uid === OWNER_UID) ||
    (OWNER_EMAIL && (user.email || '').toLowerCase() === OWNER_EMAIL.toLowerCase());
  if (isHardcodedOwner) return 'owner';
  if (memberDoc?.role) return memberDoc.role;
  return 'manager';
}

async function inviteRoleForEmail(email) {
  if (!email) return 'manager';
  const inviteRef = doc(db, 'shops', SHOP_ID, 'invites', email.toLowerCase());
  const snap = await getDoc(inviteRef);
  if (!snap.exists()) return 'manager';
  return snap.data().role === 'staff' ? 'staff' : 'manager';
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [memberReady, setMemberReady] = useState(false);
  const [memberError, setMemberError] = useState(null);
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

  const ensureMemberDoc = useCallback(async (currentUser, memberDoc) => {
    const memberRef = doc(db, 'shops', SHOP_ID, 'members', currentUser.uid);
    const isOwner = resolveRole(currentUser, null) === 'owner';

    if (memberDoc) {
      if (memberDoc.role === 'staff' && !isOwner) {
        const invitedRole = await inviteRoleForEmail(currentUser.email || '');
        if (invitedRole !== 'staff') {
          await setDoc(
            memberRef,
            { role: 'manager', upgradedFrom: 'staff', upgradedAt: serverTimestamp() },
            { merge: true }
          );
          return 'manager';
        }
        return 'staff';
      }
      return memberDoc.role || 'manager';
    }

    const invitedRole = await inviteRoleForEmail(currentUser.email || '');
    const roleToSet = isOwner ? 'owner' : invitedRole;

    await setDoc(memberRef, {
      uid: currentUser.uid,
      email: (currentUser.email || '').toLowerCase(),
      displayName: currentUser.displayName || currentUser.email || 'User',
      role: roleToSet,
      createdAt: serverTimestamp(),
    });
    return roleToSet;
  }, []);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setDisplayName('');
      setMemberReady(false);
      setMemberError(null);
      return undefined;
    }

    setMemberReady(false);
    setMemberError(null);

    const memberRef = doc(db, 'shops', SHOP_ID, 'members', user.uid);
    const unsub = onSnapshot(
      memberRef,
      async (snap) => {
        const memberDoc = snap.exists() ? snap.data() : null;
        try {
          if (!snap.exists()) {
            const createdRole = await ensureMemberDoc(user, null);
            setRole(createdRole);
          } else {
            const resolved = await ensureMemberDoc(user, memberDoc);
            setRole(resolveRole(user, { ...memberDoc, role: resolved }));
          }
          setMemberError(null);
          setMemberReady(true);
        } catch (err) {
          setMemberError({
            code: err.code || 'unknown',
            message: err.message || 'Could not join the shop',
          });
          setRole(resolveRole(user, memberDoc));
          setMemberReady(false);
        }
        setDisplayName(memberDoc?.displayName || user.displayName || user.email || 'User');
      },
      (err) => {
        setMemberError({
          code: err.code || 'unknown',
          message: err.message || 'Could not read shop membership',
        });
        setMemberReady(false);
      }
    );
    return unsub;
  }, [user, ensureMemberDoc]);

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
    memberReady,
    memberError,
    online,
    isConfigured: FIREBASE_CONFIGURED,
    loginWithGoogle,
    loginWithEmail,
    loginWithPhone,
    logout,
  };
}
