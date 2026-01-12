
import { initializeApp, getApps, getApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
// Separated function imports from type imports to resolve module resolution issues in mixed environments
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch
} from "firebase/firestore";
// Correctly importing interfaces and classes as types only
import type {
  Firestore,
  QuerySnapshot,
  DocumentData
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";

const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const fallbackConfig = {
  apiKey: "AIzaSyAK1PFmG5-uawZ2-QkCExJAIj3ovr5Gc8k",
  authDomain: "assettrack-626da.firebaseapp.com",
  projectId: "assettrack-626da",
  storageBucket: "assettrack-626da.firebasestorage.app",
  messagingSenderId: "833915106836",
  appId: "1:833915106836:web:24f97e6161f3d5ef5f9901",
  measurementId: "G-T7N92CG779"
};

const activeConfig = firebaseConfig.apiKey ? firebaseConfig : fallbackConfig;

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(activeConfig);
} else {
  app = getApp();
}

// Ensure database and auth are initialized with correctly imported functions
export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
export const firebaseApp: FirebaseApp = app;
export const secondaryConfig = activeConfig;

// --- INTERNAL HELPERS ---

export const snapToData = <T>(snapshot: QuerySnapshot<DocumentData>): T[] => {
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as unknown as T));
};

export const sanitizeData = (data: any) => {
  const clean: any = {};
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined && data[key] !== null) {
      clean[key] = data[key];
    }
  });
  return clean;
};

export const getSandboxStatus = () => {
  if (localStorage.getItem("eatx_sandbox") === "true") return true;
  if (typeof window !== "undefined") {
    if (window.location.hash.includes("env=sandbox")) return true;
    if (window.location.search.includes("env=sandbox")) return true;
  }
  return false;
};

export const setSandboxMode = (enabled: boolean) => {
  localStorage.setItem("eatx_sandbox", enabled ? "true" : "false");
  window.location.reload();
};

export const getColName = (name: string) => (getSandboxStatus() ? `sandbox_${name}` : name);

export const createNotification = async (
  type: "info" | "warning" | "success" | "error",
  title: string,
  message: string,
  link: string = ""
) => {
  try {
    await addDoc(collection(db, getColName("notifications")), {
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      link,
    });
  } catch (e) {
    console.warn("Silent failure creating dashboard notification:", e);
  }
};

export const checkEnvStatus = () => {
  const isSandbox = getSandboxStatus();
  let message = isSandbox ? "Sandbox Mode Active" : "System Online";
  const hasKey = !!activeConfig.apiKey;
  return {
    ok: hasKey,
    message: hasKey ? message : "Configuration Missing"
  };
};