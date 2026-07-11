import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, firebaseReady, SHOP_ID } from "../lib/firebase";

const OWNER_UID = "Etx7842cBTNxw2D92fUOIGOnMI52";
const OWNER_EMAIL = "aryanshaykat331@gmail.com";

export function useAuth() {
  const [state, setState] = useState({
    user: null,
    role: null,
    loading: firebaseReady,
    error: "",
  });

  useEffect(() => {
    if (!firebaseReady) return undefined;
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, role: null, loading: false, error: "" });
        return;
      }

      try {
        const isOwner = user.uid === OWNER_UID || user.email?.toLowerCase() === OWNER_EMAIL;
        const member = await getDoc(doc(db, "shops", SHOP_ID, "members", user.uid));
        const data = member.data();
        const role = isOwner ? "owner" : data?.active === false ? null : data?.role;
        if (!role) {
          setState({
            user,
            role: null,
            loading: false,
            error: "This account is not an active shop member. Ask the owner for access.",
          });
          return;
        }
        setState({ user, role, loading: false, error: "" });
      } catch (error) {
        setState({ user, role: null, loading: false, error: error.message });
      }
    });
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const register = (email, password) => createUserWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return { ...state, login, register, logout };
}
