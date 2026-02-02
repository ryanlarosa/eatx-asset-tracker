
// Fix: Simplified modular imports from firebase/firestore to resolve module resolution errors
import { collection, doc, getDoc, getDocs, query, setDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { db, auth, snapToData, secondaryConfig } from "./firebase";
import { UserProfile, UserRole } from "../types";

let currentUserProfile: UserProfile | null = null;
const authListeners: Function[] = [];

export const getCurrentUserProfile = () => currentUserProfile;

onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    try {
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        currentUserProfile = { ...data, email: firebaseUser.email || "" };
        
        const currentSandboxState = localStorage.getItem("eatx_sandbox") === "true";
        if (currentUserProfile.role === "sandbox_user") {
          if (!currentSandboxState) {
            localStorage.setItem("eatx_sandbox", "true");
            window.location.reload();
            return;
          }
        } else {
          if (currentSandboxState) {
            localStorage.setItem("eatx_sandbox", "false");
            window.location.reload();
            return;
          }
        }
      } else {
        const isSuperAdmin = firebaseUser.email === "it@eatx.com" || firebaseUser.email?.includes("admin");
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          role: isSuperAdmin ? "admin" : "viewer",
          displayName: firebaseUser.email?.split('@')[0],
        };
        await setDoc(doc(db, "users", firebaseUser.uid), newProfile);
        currentUserProfile = newProfile;
      }
    } catch (e) {
      currentUserProfile = { uid: firebaseUser.uid, email: firebaseUser.email || "", role: "viewer" };
    }
  } else {
    currentUserProfile = null;
  }
  authListeners.forEach((cb) => cb(currentUserProfile));
});

export const subscribeToAuth = (cb: (user: UserProfile | null) => void) => {
  authListeners.push(cb);
  cb(currentUserProfile);
  return () => {
    const idx = authListeners.indexOf(cb);
    if (idx > -1) authListeners.splice(idx, 1);
  };
};

export const loginUser = async (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const logoutUser = async () => signOut(auth);

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const snap = await getDocs(query(collection(db, "users")));
  return snapToData<UserProfile>(snap);
};

export const adminCreateUser = async (email: string, pass: string, role: UserRole) => {
  const secondaryApp = initializeApp(secondaryConfig, "SecondaryApp");
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    const uid = userCred.user.uid;
    const newProfile: UserProfile = {
      uid,
      email: email.toLowerCase(),
      role,
      displayName: email.split('@')[0],
    };
    await setDoc(doc(db, "users", uid), newProfile);
    await signOut(secondaryAuth);
    return true;
  } finally {
    await deleteApp(secondaryApp);
  }
};

export const updateUserRole = async (uid: string, role: UserRole) => {
  await setDoc(doc(db, "users", uid), { role }, { merge: true });
};
