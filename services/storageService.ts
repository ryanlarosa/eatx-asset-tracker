import { initializeApp, deleteApp, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  User,
} from "firebase/auth";
import {
  Asset,
  AssetLog,
  AppConfig,
  UserProfile,
  UserRole,
  Project,
  AssetStats,
  HandoverDocument,
  PendingHandover,
  IncidentReport,
  AssetRequest,
  Invoice,
  ProjectItem,
} from "../types";

// --- CONFIGURATION ---
const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

// --- FALLBACK CONFIGURATION (Restored) ---
const fallbackConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN_HERE",
  projectId: "PASTE_YOUR_PROJECT_ID_HERE",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "PASTE_YOUR_APP_ID_HERE",
};

// Use Env if available, otherwise Fallback
const activeConfig = firebaseConfig.apiKey ? firebaseConfig : fallbackConfig;

// Initialize Firebase
let app: FirebaseApp;
try {
  app = initializeApp(activeConfig);
} catch (e: any) {
  // Handle hot-reload re-initialization
  if (e.code === "app/duplicate-app") {
    app = initializeApp(activeConfig, "Backup"); // Fallback strategy
  } else {
    throw e;
  }
}

const db = getFirestore(app);
const auth = getAuth(app);

// --- COLLECTION HELPERS ---

// Note: Using 'eatx_sandbox' key to match old code
const isSandbox = () => localStorage.getItem("eatx_sandbox") === "true";
const getColName = (name: string) => (isSandbox() ? `sandbox_${name}` : name);

// Defaults
const DEFAULT_CONFIG: AppConfig = {
  categories: [
    "POS Terminal",
    "Kitchen Display System",
    "Network & Wi-Fi",
    "Office IT (Laptops/Phones)",
    "Creative Media (Cameras/Audio)",
    "Camera & Security (CCTV)",
    "Printers & Scanners",
    "Furniture",
    "Other",
  ],
  locations: [
    "Head Office",
    "Downtown Branch",
    "JBR Branch",
    "Marina Storage",
    "Creative Studio",
  ],
  departments: ["IT", "Finance", "HR", "Operations", "FOH", "BOH", "Creative"],
};

let _cachedConfig: AppConfig | null = null;

// --- SYSTEM STATUS ---
export const checkEnvStatus = () => {
  let message = isSandbox() ? "Sandbox Mode Active" : "System Online";
  if (firebaseConfig.apiKey) return { ok: true, message: message + " (Env)" };
  if (activeConfig.apiKey && activeConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE")
    return { ok: true, message: message + " (Fallback)" };
  return { ok: false, message: "Configuration Missing" };
};

// --- AUTH ---

let currentUserProfile: UserProfile | null = null;
const authListeners: Function[] = [];

export const getCurrentUserProfile = () => currentUserProfile;

// Sync Auth State Listener
onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    try {
      const userDoc = await getDoc(
        doc(db, getColName("users"), firebaseUser.uid)
      );
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        currentUserProfile = { ...data, email: firebaseUser.email || "" };
      } else {
        // Auto-create profile if missing
        const isSuperAdmin =
          firebaseUser.email === "it@eatx.com" ||
          firebaseUser.email?.includes("admin");
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          role: isSuperAdmin ? "admin" : "viewer",
          displayName: firebaseUser.email?.split("@")[0],
        };
        await setDoc(
          doc(db, getColName("users"), firebaseUser.uid),
          newProfile
        );
        currentUserProfile = newProfile;
      }
    } catch (e) {
      console.error("Error fetching user profile", e);
      currentUserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        role: "viewer",
      };
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

export const loginUser = async (email: string, pass: string) => {
  await signInWithEmailAndPassword(auth, email, pass);
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const q = query(collection(db, getColName("users")));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as UserProfile);
};

export const adminCreateUser = async (
  email: string,
  pass: string,
  role: UserRole
) => {
  const secondaryApp = initializeApp(activeConfig, "SecondaryApp");
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const userCred = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      pass
    );
    const uid = userCred.user.uid;

    const newProfile: UserProfile = {
      uid,
      email: email.toLowerCase(),
      role,
      displayName: email.split("@")[0],
    };

    await setDoc(doc(db, getColName("users"), uid), newProfile);

    await signOut(secondaryAuth);
    return true;
  } catch (e) {
    throw e;
  } finally {
    await deleteApp(secondaryApp);
  }
};

export const updateUserRole = async (uid: string, role: UserRole) => {
  const userRef = doc(db, getColName("users"), uid);
  await setDoc(userRef, { role }, { merge: true });
};

// --- CONFIG ---

export const getAppConfig = async (): Promise<AppConfig> => {
  try {
    // Corrected: Uses 'appConfig' (camelCase) to match your existing data
    const docRef = doc(db, getColName("settings"), "appConfig");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as AppConfig;
      if (!data.departments) data.departments = DEFAULT_CONFIG.departments;
      _cachedConfig = data;
      return data;
    } else {
      await setDoc(docRef, DEFAULT_CONFIG);
      _cachedConfig = DEFAULT_CONFIG;
      return DEFAULT_CONFIG;
    }
  } catch (e) {
    console.warn("Config fetch failed, using default");
  }
  _cachedConfig = DEFAULT_CONFIG;
  return DEFAULT_CONFIG;
};

export const getCachedConfigSync = (): AppConfig => {
  return _cachedConfig || DEFAULT_CONFIG;
};

export const saveAppConfig = async (config: AppConfig) => {
  _cachedConfig = config;
  // Corrected: Uses 'appConfig'
  await setDoc(doc(db, getColName("settings"), "appConfig"), config);
};

// --- ASSETS ---

export const listenToAssets = (cb: (assets: Asset[]) => void) => {
  const q = query(collection(db, getColName("assets")));
  return onSnapshot(q, (snapshot) => {
    const assets: Asset[] = [];
    snapshot.forEach((d) => assets.push(d.data() as Asset));
    cb(assets);
  });
};

export const getAssets = async (): Promise<Asset[]> => {
  const snapshot = await getDocs(collection(db, getColName("assets")));
  return snapshot.docs.map((d) => d.data() as Asset);
};

export const saveAsset = async (asset: Asset) => {
  const docRef = doc(db, getColName("assets"), asset.id);
  const docSnap = await getDoc(docRef);
  const action = docSnap.exists() ? "Updated" : "Created";
  const isNew = !docSnap.exists();

  await setDoc(docRef, { ...asset, lastUpdated: new Date().toISOString() });
  await logAction(
    asset.id,
    action,
    isNew ? `Asset Onboarded: ${asset.name}` : `Asset Updated`
  );
};

export const deleteAsset = async (id: string) => {
  const docRef = doc(db, getColName("assets"), id);
  const snap = await getDoc(docRef);
  const assetName = snap.exists() ? (snap.data() as Asset).name : "Unknown";

  await deleteDoc(docRef);
  await logAction(id, "Retired", `Asset ${assetName} deleted from registry`);
};

export const importAssetsBulk = async (newAssets: Asset[]) => {
  const batch = writeBatch(db);
  newAssets.forEach((asset) => {
    const ref = doc(db, getColName("assets"), asset.id);
    batch.set(ref, asset);
  });
  await batch.commit();
  await logAction(
    "BULK",
    "Created",
    `Imported ${newAssets.length} assets via Excel`
  );
};

// --- LOGS ---

export const getAssetLogs = async (assetId: string): Promise<AssetLog[]> => {
  const q = query(
    collection(db, getColName("logs")),
    where("assetId", "==", assetId),
    orderBy("timestamp", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as AssetLog);
};

export const getRecentLogs = async (
  limitCount: number = 5
): Promise<AssetLog[]> => {
  const q = query(
    collection(db, getColName("logs")),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as AssetLog);
};

const logAction = async (
  assetId: string,
  action: AssetLog["action"],
  details: string,
  documentId?: string,
  ticketId?: string
) => {
  try {
    await addDoc(collection(db, getColName("logs")), {
      assetId,
      action,
      details,
      performedBy: currentUserProfile?.email || "System",
      timestamp: new Date().toISOString(),
      documentId: documentId || null,
      ticketId: ticketId || null,
    });
  } catch (e) {
    console.error("Failed to log action", e);
  }
};

// --- STATS ---

export const getStats = (assets: Asset[]): AssetStats => {
  const config = getCachedConfigSync();
  const categoryCounts = config.categories
    .map((cat) => ({
      name: cat,
      value: assets.filter((a) => a.category === cat).length,
    }))
    .filter((c) => c.value > 0);

  const knownCategories = new Set(config.categories);
  const otherCount = assets.filter(
    (a) => !knownCategories.has(a.category)
  ).length;
  if (otherCount > 0) categoryCounts.push({ name: "Other", value: otherCount });

  return {
    totalValue: assets.reduce((sum, a) => sum + (a.purchaseCost || 0), 0),
    totalAssets: assets.length,
    activeAssets: assets.filter((a) => a.status === "Active").length,
    repairAssets: assets.filter((a) => a.status === "Under Repair").length,
    byCategory: categoryCounts,
  };
};

// --- PROJECTS / PLANNER ---

export const listenToProjects = (cb: (projects: Project[]) => void) => {
  const q = query(collection(db, getColName("projects")));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data() as Project)));
};

export const saveProject = async (project: Project) => {
  await setDoc(doc(db, getColName("projects"), project.id), project);
};

export const deleteProject = async (id: string) => {
  await deleteDoc(doc(db, getColName("projects"), id));
};

export const getOverdueItems = async (
  projects: Project[]
): Promise<ProjectItem[]> => {
  const today = new Date().toISOString().split("T")[0];
  const overdue: ProjectItem[] = [];
  projects.forEach((p) => {
    if (p.status !== "Completed") {
      p.items.forEach((i) => {
        if (i.status !== "Received" && i.dueDate && i.dueDate < today) {
          overdue.push(i);
        }
      });
    }
  });
  return overdue;
};

// --- INCIDENTS ---

export const listenToIncidents = (
  cb: (incidents: IncidentReport[]) => void
) => {
  const q = query(collection(db, getColName("incidents")));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => d.data() as IncidentReport))
  );
};

export const createIncidentReport = async (
  data: Omit<IncidentReport, "id" | "ticketNumber" | "status" | "createdAt">
) => {
  const id = "inc-" + Date.now();
  const ticketNumber = `TKT-${new Date().getFullYear()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const report: IncidentReport = {
    ...data,
    id,
    ticketNumber,
    status: "New",
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, getColName("incidents"), id), report);

  if (data.assetId) {
    await updateDoc(doc(db, getColName("assets"), data.assetId), {
      status: "Under Repair",
      lastUpdated: new Date().toISOString(),
    });
    await logAction(
      data.assetId,
      "Ticket",
      `Ticket ${ticketNumber} created: ${data.description}`,
      undefined,
      report.id
    );
  }
};

export const updateIncidentReport = async (
  id: string,
  updates: Partial<IncidentReport>,
  autoFixAsset: boolean = false
) => {
  const ref = doc(db, getColName("incidents"), id);
  await updateDoc(ref, updates);

  const snap = await getDoc(ref);
  const incident = snap.data() as IncidentReport;

  if (incident.assetId) {
    if (
      updates.status === "Open" ||
      updates.status === "In Progress" ||
      updates.status === "Waiting for Parts"
    ) {
      await updateDoc(doc(db, getColName("assets"), incident.assetId), {
        status: "Under Repair",
      });
    } else if (updates.status === "Resolved" && autoFixAsset) {
      await updateDoc(doc(db, getColName("assets"), incident.assetId), {
        status: "Active",
      });
    }
    await logAction(
      incident.assetId,
      "Ticket",
      `Ticket ${incident.ticketNumber} updated to ${
        updates.status || incident.status
      }`
    );
  }
};

export const processAssetReplacement = async (
  ticketId: string,
  oldAssetId: string,
  newAssetId: string,
  notes: string
) => {
  const incidentRef = doc(db, getColName("incidents"), ticketId);
  const incidentSnap = await getDoc(incidentRef);
  const incident = incidentSnap.data() as IncidentReport;

  // 1. Retire old
  await updateDoc(doc(db, getColName("assets"), oldAssetId), {
    status: "Retired",
    assignedEmployee: "",
    lastUpdated: new Date().toISOString(),
  });
  await logAction(
    oldAssetId,
    "Retired",
    `Replaced by ${newAssetId}. Notes: ${notes}`,
    undefined,
    ticketId
  );

  // 2. Assign new
  await updateDoc(doc(db, getColName("assets"), newAssetId), {
    status: "Active",
    location: incident.location,
    lastUpdated: new Date().toISOString(),
  });
  await logAction(
    newAssetId,
    "Replaced",
    `Replacement for ${oldAssetId}. Ticket ${incident.ticketNumber}`,
    undefined,
    ticketId
  );

  // 3. Close Ticket
  await updateDoc(incidentRef, {
    status: "Resolved",
    resolvedAt: new Date().toISOString(),
    resolutionNotes: `Asset Replaced. New Asset ID: ${newAssetId}. ${notes}`,
  });
};

// --- REQUESTS ---

export const listenToRequests = (cb: (reqs: AssetRequest[]) => void) => {
  const q = query(collection(db, getColName("requests")));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => d.data() as AssetRequest))
  );
};

export const createAssetRequest = async (
  data: Omit<AssetRequest, "id" | "requestNumber" | "status" | "createdAt">
) => {
  const id = "req-" + Date.now() + Math.random().toString(36).substr(2, 5);
  const requestNumber = `REQ-${new Date().getFullYear()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const req: AssetRequest = {
    ...data,
    id,
    requestNumber,
    status: "New",
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, getColName("requests"), id), req);
};

export const updateAssetRequest = async (
  id: string,
  updates: Partial<AssetRequest>
) => {
  await updateDoc(doc(db, getColName("requests"), id), updates);
};

export const fulfillAssetRequest = async (
  id: string,
  assetId: string,
  notes: string
) => {
  const reqRef = doc(db, getColName("requests"), id);
  const reqSnap = await getDoc(reqRef);
  const req = reqSnap.data() as AssetRequest;

  await updateDoc(doc(db, getColName("assets"), assetId), {
    status: "Active",
    assignedEmployee: req.requesterName,
    department: req.department,
    lastUpdated: new Date().toISOString(),
  });
  await logAction(
    assetId,
    "Assigned",
    `Fulfilled Request ${req.requestNumber}`
  );

  await updateDoc(reqRef, {
    status: "Deployed",
    resolvedAt: new Date().toISOString(),
    linkedAssetId: assetId,
    resolutionNotes: notes,
  });
};

// --- INVOICES ---

export const listenToInvoices = (cb: (inv: Invoice[]) => void) => {
  const q = query(collection(db, getColName("invoices")));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data() as Invoice)));
};

export const saveInvoice = async (invoice: Invoice) => {
  await setDoc(doc(db, getColName("invoices"), invoice.id), invoice);
};

export const deleteInvoice = async (id: string) => {
  await deleteDoc(doc(db, getColName("invoices"), id));
};

// --- HANDOVERS ---

// Corrected: Uses 'documents' collection to match your existing data
export const getHandoverDocuments = async (): Promise<HandoverDocument[]> => {
  const snap = await getDocs(collection(db, getColName("documents")));
  return snap.docs.map((d) => d.data() as HandoverDocument);
};

// Corrected: Uses 'documents' collection
export const saveHandoverDocument = async (docData: HandoverDocument) => {
  await setDoc(doc(db, getColName("documents"), docData.id), docData);
};

// Corrected: Uses 'pendingHandovers' (camelCase)
export const createPendingHandover = async (
  employeeName: string,
  assets: Asset[]
): Promise<string> => {
  const id = "ph-" + Date.now();
  const data: PendingHandover = {
    id,
    employeeName,
    assetIds: assets.map((a) => a.id),
    assetsSnapshot: assets.map((a) => ({
      id: a.id,
      name: a.name,
      serialNumber: a.serialNumber,
    })),
    createdAt: new Date().toISOString(),
    createdBy: currentUserProfile?.email || "System",
    status: "Pending",
  };
  await setDoc(doc(db, getColName("pendingHandovers"), id), data);
  return id;
};

// Corrected: Uses 'pendingHandovers' (camelCase)
export const getPendingHandover = async (
  id: string
): Promise<PendingHandover | undefined> => {
  const snap = await getDoc(doc(db, getColName("pendingHandovers"), id));
  return snap.exists() ? (snap.data() as PendingHandover) : undefined;
};

export const completePendingHandover = async (
  id: string,
  signature: string
) => {
  const ref = doc(db, getColName("pendingHandovers"), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Not found");
  const pending = snap.data() as PendingHandover;

  if (pending.status !== "Pending") throw new Error("Already completed");

  // 1. Create Doc
  const docData: HandoverDocument = {
    id: "doc-" + Date.now(),
    employeeName: pending.employeeName,
    assets: pending.assetsSnapshot,
    signatureBase64: signature,
    date: new Date().toISOString(),
    type: "Handover",
  };
  await saveHandoverDocument(docData);

  // 2. Assign
  await bulkAssignAssets(pending.assetIds, pending.employeeName);

  // 3. Update Status
  await updateDoc(ref, { status: "Completed" });
};

// --- BULK OPERATIONS ---

export const bulkAssignAssets = async (
  assetIds: string[],
  employeeName: string
) => {
  const batch = writeBatch(db);
  assetIds.forEach((id) => {
    const ref = doc(db, getColName("assets"), id);
    batch.update(ref, {
      assignedEmployee: employeeName,
      status: "Active",
      lastUpdated: new Date().toISOString(),
    });
  });
  await batch.commit();

  for (const id of assetIds) {
    await logAction(id, "Assigned", `Assigned to ${employeeName}`);
  }
};

export const bulkReturnAssets = async (assetIds: string[], docId?: string) => {
  const batch = writeBatch(db);
  assetIds.forEach((id) => {
    const ref = doc(db, getColName("assets"), id);
    batch.update(ref, {
      assignedEmployee: "",
      status: "In Storage",
      lastUpdated: new Date().toISOString(),
    });
  });
  await batch.commit();

  for (const id of assetIds) {
    await logAction(id, "Returned", `Returned to storage`, docId);
  }
};

export const bulkTransferAssets = async (
  assetIds: string[],
  targetName: string,
  docId?: string
) => {
  const batch = writeBatch(db);
  assetIds.forEach((id) => {
    const ref = doc(db, getColName("assets"), id);
    batch.update(ref, {
      assignedEmployee: targetName,
      lastUpdated: new Date().toISOString(),
    });
  });
  await batch.commit();

  for (const id of assetIds) {
    await logAction(id, "Transferred", `Transferred to ${targetName}`, docId);
  }
};

// --- SYSTEM ADMIN ---

export const getSandboxStatus = () => isSandbox();

// Note: Using 'eatx_sandbox' key to match old code
export const setSandboxMode = (enabled: boolean) => {
  localStorage.setItem("eatx_sandbox", enabled ? "true" : "false");
  window.location.reload();
};

export const resetDatabase = async () => {
  // Client-side batch delete simulation for known collections
  // Note: Updated names used here
  const collections = [
    "assets",
    "logs",
    "projects",
    "incidents",
    "requests",
    "invoices",
    "documents",
    "pendingHandovers",
  ];
  const prefix = isSandbox() ? "sandbox_" : "";

  for (const colName of collections) {
    const fullColName = prefix + colName;
    const q = query(collection(db, fullColName));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  window.location.reload();
};

export const renameMasterDataItem = async (
  type: "category" | "location" | "department",
  oldValue: string,
  newValue: string
) => {
  const config = await getAppConfig();
  let updatedConfig = { ...config };

  if (type === "category") {
    updatedConfig.categories = config.categories.map((c) =>
      c === oldValue ? newValue : c
    );
  } else if (type === "location") {
    updatedConfig.locations = config.locations.map((l) =>
      l === oldValue ? newValue : l
    );
  } else if (type === "department") {
    updatedConfig.departments = (config.departments || []).map((d) =>
      d === oldValue ? newValue : d
    );
  }

  await saveAppConfig(updatedConfig);

  // Update Assets (Batching required)
  const assetsRef = collection(db, getColName("assets"));
  const q = query(assetsRef, where(type, "==", oldValue));
  const snapshot = await getDocs(q);

  const batch = writeBatch(db);
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { [type]: newValue });
  });
  await batch.commit();
};
