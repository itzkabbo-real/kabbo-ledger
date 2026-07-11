import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { auth, db, HAS_FIREBASE } from "../lib/firebase.js";
import {
  OWNER_EMAIL,
  OWNER_UID,
  SHOP_ID,
} from "../lib/firebaseConfig.js";

export function isHardcodedOwner(user) {
  if (!user) return false;
  return (
    user.uid === OWNER_UID ||
    String(user.email || "")
      .toLowerCase()
      .trim() === OWNER_EMAIL
  );
}

async function ensureOwnerRole(user) {
  if (!isHardcodedOwner(user)) return null;
  const payload = {
    email: OWNER_EMAIL,
    displayName: "Itz Kabbo",
    name: "Itz Kabbo",
    role: "owner",
    shopId: SHOP_ID,
    uid: OWNER_UID,
    updatedAt: new Date().toISOString(),
  };
  try {
    await Promise.all([
      setDoc(doc(db, "users", OWNER_UID), payload, { merge: true }),
      setDoc(doc(db, "shops", SHOP_ID, "members", OWNER_UID), payload, {
        merge: true,
      }),
      setDoc(doc(db, "shops", SHOP_ID, "users", OWNER_UID), payload, {
        merge: true,
      }),
    ]);
  } catch (err) {
    console.warn("ensureOwnerRole write failed:", err?.code || err);
  }
  localStorage.setItem("kabbo_user_role", "owner");
  localStorage.setItem("kabbo_user_email", OWNER_EMAIL);
  localStorage.setItem("kabbo_user_uid", OWNER_UID);
  return "owner";
}

/**
 * Resolve shop role.
 * FIX: new shop workers become "manager" (can write live ledger),
 * not "staff" (read-only). Only the hardcoded owner is forced to owner.
 * Existing member docs keep their stored role.
 */
export async function resolveShopRole(user) {
  if (!db) return "manager";
  if (isHardcodedOwner(user)) {
    ensureOwnerRole(user).catch(() => {});
    return "owner";
  }

  const memberRef = doc(db, "shops", SHOP_ID, "members", user.uid);
  const existing = await getDoc(memberRef);
  if (existing.exists()) {
    const role = existing.data().role || "manager";
    // Migrate legacy default staff → manager so floor managers can sync writes
    if (role === "staff") {
      try {
        await setDoc(
          memberRef,
          {
            role: "manager",
            upgradedFrom: "staff",
            upgradedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        return "manager";
      } catch {
        return role;
      }
    }
    return role;
  }

  // Non-hardcoded users may only self-create as manager (rules enforce this).
  // Hardcoded owner is handled above via ensureOwnerRole.
  const role = "manager";
  await setDoc(memberRef, {
    email: user.email || "",
    displayName: user.displayName || user.email || "User",
    role,
    shopId: SHOP_ID,
    uid: user.uid,
    createdAt: new Date().toISOString(),
  });
  return role;
}

export async function setMemberRole(uid, role) {
  if (!db) return;
  await setDoc(
    doc(db, "shops", SHOP_ID, "members", uid),
    { role, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

export async function listMembers() {
  if (!db) return [];
  const snap = await getDocs(collection(db, "shops", SHOP_ID, "members"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(HAS_FIREBASE);

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return undefined;
    }
    return onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (next) {
        try {
          setRole(await resolveShopRole(next));
        } catch (err) {
          console.warn("role resolve failed:", err?.code || err);
          // Do not fake writable manager — UI stays read-only until membership works.
          setRole(isHardcodedOwner(next) ? "owner" : "staff");
        }
      } else {
        setRole(null);
      }
      setAuthLoading(false);
    });
  }, []);

  async function login(email, password) {
    if (!auth) throw new Error("Firebase not configured");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const nextRole = await resolveShopRole(cred.user);
    setRole(isHardcodedOwner(cred.user) ? "owner" : nextRole);
    return cred.user;
  }

  async function register(email, password, displayName) {
    if (!auth) throw new Error("Firebase not configured");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
    const nextRole = await resolveShopRole(cred.user);
    setRole(isHardcodedOwner(cred.user) ? "owner" : nextRole);
    return cred.user;
  }

  async function logout() {
    if (auth) await signOut(auth);
    setUser(null);
    setRole(null);
  }

  return {
    user,
    role,
    setRole,
    authLoading,
    login,
    register,
    logout,
    hasFirebase: HAS_FIREBASE,
  };
}
