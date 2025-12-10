import {
  Asset,
  Project,
  ProjectItem,
  AppConfig,
  AssetStats,
  UserProfile,
  UserRole,
  AssetLog,
  HandoverDocument,
  PendingHandover,
  IncidentReport,
  AssetRequest,
  Invoice,
} from "../types";
import { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  getDoc,
  Firestore,
  query,
  where,
  orderBy,
  addDoc,
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  Auth,
  createUserWithEmailAndPassword,
} from "firebase/auth";

// --- ENV Configuration ---
const env = (import.meta as any).env || {};

const fallbackConfig = {
  apiKey: "AIzaSyAK1PFmG5-uawZ2-QkCExJAIj3ovr5Gc8k",
  authDomain: "assettrack-626da.firebaseapp.com",
  projectId: "assettrack-626da",
  storageBucket: "assettrack-626da.firebasestorage.app",
  messagingSenderId: "833915106836",
  appId: "1:833915106836:web:24f97e6161f3d5ef5f9901",
  measurementId: "G-T7N92CG779",
};

const firebaseConfig = env.VITE_FIREBASE_API_KEY
  ? {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
      measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
    }
  : fallbackConfig;

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

let db: Firestore | undefined;
let auth: Auth | undefined;
let currentUserProfile: UserProfile | null = null;
let cachedConfig: AppConfig = DEFAULT_CONFIG;

export const checkEnvStatus = () => {
  if (firebaseConfig.apiKey) {
    return {
      ok: true,
      message: env.VITE_FIREBASE_API_KEY
        ? "System Online (Secure ENV)"
        : "System Online (Fallback Mode)",
    };
  }
  return { ok: false, message: "Configuration Failed" };
};

try {
  if (firebaseConfig.apiKey) {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    console.log(
      `Firebase initialized successfully via ${
        env.VITE_FIREBASE_API_KEY ? "ENV" : "Fallback Config"
      }`
    );
  } else {
    console.warn("Firebase Config missing.");
  }
} catch (e) {
  console.error("Firebase Init Error:", e);
}

// --- Helper to remove undefined fields ---
const removeUndefined = (obj: any) => {
  const newObj: any = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) newObj[key] = obj[key];
  });
  return newObj;
};

// --- Auth ---

export const loginUser = async (email: string, pass: string) => {
  if (!auth) throw new Error("Firebase not initialized.");
  return await signInWithEmailAndPassword(auth, email, pass);
};

export const adminCreateUser = async (
  email: string,
  pass: string,
  role: UserRole
) => {
  if (!auth || !db) throw new Error("System offline");

  const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
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
    await setDoc(doc(db, "users", uid), newProfile);
    await signOut(secondaryAuth);
    return true;
  } catch (error) {
    throw error;
  } finally {
    await deleteApp(secondaryApp);
  }
};

export const logoutUser = async () => {
  if (!auth) return;
  currentUserProfile = null;
  return await signOut(auth);
};

export const getCurrentUserProfile = () => currentUserProfile;

export const subscribeToAuth = (
  callback: (user: UserProfile | null) => void
) => {
  if (!auth || !db) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      currentUserProfile = null;
      callback(null);
      return;
    }
    try {
      const userRef = doc(db!, "users", firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      const userEmail = firebaseUser.email?.toLowerCase() || "";
      const isSuperAdmin =
        userEmail === "it@eatx.com" || userEmail.includes("admin");

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        if (isSuperAdmin && data.role !== "admin") {
          await updateDoc(userRef, { role: "admin" });
          data.role = "admin";
        }
        currentUserProfile = data;
      } else {
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: userEmail,
          role: isSuperAdmin ? "admin" : "viewer",
          displayName: userEmail.split("@")[0],
        };
        await setDoc(userRef, newProfile);
        currentUserProfile = newProfile;
      }
      callback(currentUserProfile);
    } catch (e) {
      callback(null);
    }
  });
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, "users"));
  const users: UserProfile[] = [];
  snapshot.forEach((doc) => users.push(doc.data() as UserProfile));
  return users;
};

export const updateUserRole = async (
  uid: string,
  newRole: UserRole
): Promise<void> => {
  if (!db) return;
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { role: newRole });
};

// --- Config ---
export const getCachedConfigSync = (): AppConfig => cachedConfig;

export const getAppConfig = async (): Promise<AppConfig> => {
  if (!db) return DEFAULT_CONFIG;
  try {
    const snapshot = await getDocs(collection(db, "settings"));
    let config: AppConfig | null = null;
    snapshot.forEach((doc) => {
      if (doc.id === "appConfig") config = doc.data() as AppConfig;
    });
    if (config) {
      if (!(config as any).departments)
        (config as any).departments = DEFAULT_CONFIG.departments;
      cachedConfig = config;
      return config;
    } else {
      await setDoc(doc(db, "settings", "appConfig"), DEFAULT_CONFIG);
      cachedConfig = DEFAULT_CONFIG;
      return DEFAULT_CONFIG;
    }
  } catch (e) {
    return DEFAULT_CONFIG;
  }
};

export const saveAppConfig = async (config: AppConfig): Promise<void> => {
  if (!db) return;
  cachedConfig = config;
  await setDoc(doc(db, "settings", "appConfig"), config);
};

// --- Logs ---
export const addAssetLog = async (
  assetId: string,
  action: AssetLog["action"],
  details: string,
  documentId?: string,
  ticketId?: string
) => {
  if (!db) return;

  // Construct log object carefully to avoid undefined fields which setDoc rejects
  const log: any = {
    id: "log-" + Math.random().toString(36).substr(2, 9),
    assetId,
    action,
    details,
    performedBy: currentUserProfile?.email || "System",
    timestamp: new Date().toISOString(),
  };

  // Only add optional fields if they are defined
  if (documentId !== undefined) log.documentId = documentId;
  if (ticketId !== undefined) log.ticketId = ticketId;

  await setDoc(doc(db, "logs", log.id), log);
};

export const getAssetLogs = async (assetId: string): Promise<AssetLog[]> => {
  if (!db) return [];
  try {
    const q = query(collection(db, "logs"), where("assetId", "==", assetId));
    const snapshot = await getDocs(q);
    const logs: AssetLog[] = [];
    snapshot.forEach((doc) => logs.push(doc.data() as AssetLog));
    return logs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (e) {
    return [];
  }
};

// --- Incident Reports (Repair Tickets) ---

export const getIncidentReports = async (): Promise<IncidentReport[]> => {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, "incidents"));
  const incidents: IncidentReport[] = [];
  snapshot.forEach((doc) => incidents.push(doc.data() as IncidentReport));
  return incidents.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

// Public Access: No Auth Required
export const createIncidentReport = async (
  data: Omit<IncidentReport, "id" | "ticketNumber" | "createdAt" | "status">
) => {
  if (!db) return;
  const ticketNumber = "TKT-" + Math.floor(1000 + Math.random() * 9000);
  const id = "inc-" + Math.random().toString(36).substr(2, 9);

  // Clean data to remove undefined fields
  const cleanData = removeUndefined(data);

  const report: IncidentReport = {
    id,
    ticketNumber,
    ...cleanData,
    status: "New", // Default status for public reports
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, "incidents", id), report);
  return id;
};

// Internal Access: Updating Status
export const updateIncidentReport = async (
  id: string,
  updates: Partial<IncidentReport>,
  resolveAsset?: boolean
) => {
  if (!db) return;
  const reportRef = doc(db, "incidents", id);

  // Check previous status to trigger logic if changing from New -> Open
  const snap = await getDoc(reportRef);
  const currentData = snap.data() as IncidentReport;

  // Clean updates to remove undefined fields
  const cleanUpdates = removeUndefined(updates);

  await updateDoc(reportRef, cleanUpdates);

  // If approving a New ticket, set Asset to Under Repair
  if (
    currentData.status === "New" &&
    updates.status === "Open" &&
    currentData.assetId
  ) {
    const assetRef = doc(db, "assets", currentData.assetId);
    await updateDoc(assetRef, {
      status: "Under Repair",
      lastUpdated: new Date().toISOString(),
    });
    await addAssetLog(
      currentData.assetId,
      "Ticket",
      `Ticket ${currentData.ticketNumber} Approved & Opened. Priority: ${currentData.priority}`,
      undefined,
      id
    );
  }

  // If resolving and asset exists, optionally set asset back to Active
  if (resolveAsset && updates.status === "Resolved" && currentData.assetId) {
    const assetRef = doc(db, "assets", currentData.assetId);
    await updateDoc(assetRef, {
      status: "Active",
      lastUpdated: new Date().toISOString(),
    });
    await addAssetLog(
      currentData.assetId,
      "Ticket",
      `Ticket ${currentData.ticketNumber} Resolved. Asset set to Active.`,
      undefined,
      id
    );
  }
};

// --- Asset Replacement Workflow ---
export const processAssetReplacement = async (
  ticketId: string,
  oldAssetId: string,
  newAssetId: string,
  notes: string
) => {
  if (!db) return;

  // 1. Fetch details
  const oldAssetRef = doc(db, "assets", oldAssetId);
  const newAssetRef = doc(db, "assets", newAssetId);
  const oldAssetSnap = await getDoc(oldAssetRef);
  const newAssetSnap = await getDoc(newAssetRef);

  if (!oldAssetSnap.exists() || !newAssetSnap.exists())
    throw new Error("Assets not found");
  const oldAssetData = oldAssetSnap.data() as Asset;
  const newAssetData = newAssetSnap.data() as Asset;

  // 2. Retire Old Asset
  await updateDoc(oldAssetRef, {
    status: "Retired",
    assignedEmployee: "", // Clear assignment
    lastUpdated: new Date().toISOString(),
  });
  await addAssetLog(
    oldAssetId,
    "Retired",
    `Retired via Ticket. Replaced by ${newAssetData.name} (${newAssetData.serialNumber})`,
    undefined,
    ticketId
  );

  // 3. Activate New Asset (Inherit Location/Dept/Assignment)
  await updateDoc(newAssetRef, {
    status: "Active",
    location: oldAssetData.location,
    department: oldAssetData.department || "",
    assignedEmployee: oldAssetData.assignedEmployee || "",
    lastUpdated: new Date().toISOString(),
  });
  await addAssetLog(
    newAssetId,
    "Replaced",
    `Deployed as replacement for ${oldAssetData.name} (${oldAssetData.serialNumber})`,
    undefined,
    ticketId
  );

  // 4. Resolve Ticket
  const ticketRef = doc(db, "incidents", ticketId);
  await updateDoc(ticketRef, {
    status: "Resolved",
    resolvedAt: new Date().toISOString(),
    resolutionNotes: `${notes} (Replaced with ${newAssetData.name})`,
  });
};

// --- Asset Requests ---
export const getAssetRequests = async (): Promise<AssetRequest[]> => {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, "requests"));
  const requests: AssetRequest[] = [];
  snapshot.forEach((doc) => requests.push(doc.data() as AssetRequest));
  return requests.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const createAssetRequest = async (
  data: Omit<AssetRequest, "id" | "requestNumber" | "createdAt" | "status">
) => {
  if (!db) return;
  const requestNumber = "REQ-" + Math.floor(1000 + Math.random() * 9000);
  const id = "req-" + Math.random().toString(36).substr(2, 9);

  const cleanData = removeUndefined(data);

  const request: AssetRequest = {
    id,
    requestNumber,
    ...cleanData,
    status: "New",
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, "requests", id), request);
  return id;
};

export const updateAssetRequest = async (
  id: string,
  updates: Partial<AssetRequest>
) => {
  if (!db) return;
  const ref = doc(db, "requests", id);
  const cleanUpdates = removeUndefined(updates);
  await updateDoc(ref, cleanUpdates);
};

export const fulfillAssetRequest = async (
  requestId: string,
  assetId: string,
  notes: string
) => {
  if (!db) return;
  const requestRef = doc(db, "requests", requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) return;
  const requestData = requestSnap.data() as AssetRequest;

  const assetRef = doc(db, "assets", assetId);

  // Assign asset to requester
  await updateDoc(assetRef, {
    assignedEmployee: requestData.requesterName,
    status: "Active",
    department: requestData.department,
    lastUpdated: new Date().toISOString(),
  });
  await addAssetLog(
    assetId,
    "Assigned",
    `Assigned via Request ${requestData.requestNumber} to ${requestData.requesterName}`
  );

  // Update Request
  await updateDoc(requestRef, {
    status: "Fulfilled",
    linkedAssetId: assetId,
    resolvedAt: new Date().toISOString(),
    resolutionNotes: notes,
  });
};

// --- Invoices ---
export const getInvoices = async (): Promise<Invoice[]> => {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, "invoices"));
  const invoices: Invoice[] = [];
  snapshot.forEach((doc) => invoices.push(doc.data() as Invoice));
  return invoices.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
};

export const saveInvoice = async (invoice: Invoice): Promise<void> => {
  if (!db) return;
  const cleanInvoice = removeUndefined(invoice);
  await setDoc(doc(db, "invoices", invoice.id), cleanInvoice);
};

export const deleteInvoice = async (id: string): Promise<void> => {
  if (!db) return;
  await deleteDoc(doc(db, "invoices", id));
};

// --- Pending Handovers ---
export const createPendingHandover = async (
  employeeName: string,
  assets: Asset[]
): Promise<string> => {
  if (!db) throw new Error("DB offline");
  const id = "ph-" + Math.random().toString(36).substr(2, 9);
  const pending: PendingHandover = {
    id,
    employeeName,
    assetIds: assets.map((a) => a.id),
    assetsSnapshot: assets.map((a) => ({
      id: a.id,
      name: a.name,
      serialNumber: a.serialNumber,
    })),
    createdAt: new Date().toISOString(),
    createdBy: currentUserProfile?.email || "Unknown",
    status: "Pending",
  };
  await setDoc(doc(db, "pendingHandovers", id), pending);
  return id;
};

export const getPendingHandover = async (
  id: string
): Promise<PendingHandover | null> => {
  if (!db) return null;
  const ref = doc(db, "pendingHandovers", id);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as PendingHandover) : null;
};

export const completePendingHandover = async (
  pendingId: string,
  signatureBase64: string
): Promise<void> => {
  if (!db) return;
  const pending = await getPendingHandover(pendingId);
  if (!pending || pending.status !== "Pending")
    throw new Error("Invalid or expired link");

  const docData: HandoverDocument = {
    id: "doc-" + Math.random().toString(36).substr(2, 9),
    employeeName: pending.employeeName,
    assets: pending.assetsSnapshot,
    signatureBase64,
    date: new Date().toISOString(),
    type: "Handover",
  };
  await setDoc(doc(db, "documents", docData.id), docData);

  await Promise.all(
    pending.assetIds.map(async (id) => {
      const assetRef = doc(db!, "assets", id);
      await updateDoc(assetRef, {
        assignedEmployee: pending.employeeName,
        status: "Active",
        lastUpdated: new Date().toISOString(),
      });
      await addAssetLog(
        id,
        "Assigned",
        `Assigned to ${pending.employeeName} (Remote Sign)`,
        docData.id
      );
    })
  );

  await updateDoc(doc(db, "pendingHandovers", pendingId), {
    status: "Completed",
  });
};

// --- Handover Documents ---
export const saveHandoverDocument = async (
  docData: HandoverDocument
): Promise<void> => {
  if (!db) return;
  await setDoc(doc(db, "documents", docData.id), docData);
};

export const getHandoverDocuments = async (
  employeeName?: string
): Promise<HandoverDocument[]> => {
  if (!db) return [];
  try {
    const q = employeeName
      ? query(
          collection(db, "documents"),
          where("employeeName", "==", employeeName)
        )
      : query(collection(db, "documents"), orderBy("date", "desc"));

    const snapshot = await getDocs(q);
    const docs: HandoverDocument[] = [];
    snapshot.forEach((doc) => docs.push(doc.data() as HandoverDocument));
    return docs;
  } catch (e) {
    return [];
  }
};

// --- Assets ---

export const getAssets = async (): Promise<Asset[]> => {
  if (!db) return [];
  try {
    const snapshot = await getDocs(collection(db, "assets"));
    const assets: Asset[] = [];
    snapshot.forEach((doc) => assets.push(doc.data() as Asset));
    return assets;
  } catch (e) {
    return [];
  }
};

export const saveAsset = async (asset: Asset): Promise<void> => {
  if (!db) return;
  const isNew = !asset.lastUpdated;
  // Ensure no undefined values in asset object
  const cleanAsset = removeUndefined(asset);

  await setDoc(doc(db, "assets", asset.id), {
    ...cleanAsset,
    lastUpdated: new Date().toISOString(),
  });

  if (isNew) {
    await addAssetLog(asset.id, "Created", `Asset created: ${asset.name}`);
  } else {
    await addAssetLog(asset.id, "Updated", `Asset details updated`);
  }
};

export const deleteAsset = async (id: string): Promise<void> => {
  if (!db) return;
  await deleteDoc(doc(db, "assets", id));
};

export const importAssetsFromCSV = async (
  newAssets: Asset[]
): Promise<void> => {
  if (!db) return;
  await Promise.all(
    newAssets.map(async (a) => {
      const cleanAsset = removeUndefined(a);
      await setDoc(doc(db, "assets", a.id), cleanAsset);
      await addAssetLog(a.id, "Created", "Imported via CSV");
    })
  );
};

// --- Bulk Asset Operations (Staff) ---

export const bulkAssignAssets = async (
  assetIds: string[],
  employeeName: string
) => {
  if (!db) return;
  await Promise.all(
    assetIds.map(async (id) => {
      const assetRef = doc(db!, "assets", id);
      await updateDoc(assetRef, {
        assignedEmployee: employeeName,
        status: "Active",
        lastUpdated: new Date().toISOString(),
      });
      await addAssetLog(id, "Assigned", `Assigned to ${employeeName}`);
    })
  );
};

export const bulkReturnAssets = async (
  assetIds: string[],
  documentId?: string
) => {
  if (!db) return;
  await Promise.all(
    assetIds.map(async (id) => {
      const assetRef = doc(db!, "assets", id);
      await updateDoc(assetRef, {
        assignedEmployee: "",
        status: "In Storage",
        location: "Head Office", // Default return location
        department: "IT",
        lastUpdated: new Date().toISOString(),
      });
      await addAssetLog(
        id,
        "Returned",
        `Returned to Storage (Head Office)`,
        documentId
      );
    })
  );
};

export const bulkTransferAssets = async (
  assetIds: string[],
  newEmployee: string,
  documentId?: string
) => {
  if (!db) return;
  await Promise.all(
    assetIds.map(async (id) => {
      const assetRef = doc(db!, "assets", id);
      await updateDoc(assetRef, {
        assignedEmployee: newEmployee,
        lastUpdated: new Date().toISOString(),
      });
      await addAssetLog(
        id,
        "Transferred",
        `Transferred to ${newEmployee}`,
        documentId
      );
    })
  );
};

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

export const getProjects = async (): Promise<Project[]> => {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, "projects"));
  const projects: Project[] = [];
  snapshot.forEach((doc) => projects.push(doc.data() as Project));
  return projects;
};

export const saveProject = async (project: Project): Promise<void> => {
  if (!db) return;
  const cleanProject = removeUndefined(project);
  await setDoc(doc(db, "projects", project.id), cleanProject);
};

export const deleteProject = async (id: string): Promise<void> => {
  if (!db) return;
  await deleteDoc(doc(db, "projects", id));
};

export const getOverdueItems = async (): Promise<
  { project: string; item: ProjectItem }[]
> => {
  if (!db) return [];
  const projects = await getProjects();
  const today = new Date();
  const notifications: { project: string; item: ProjectItem }[] = [];
  projects.forEach((p) => {
    if (p.status !== "Completed") {
      p.items.forEach((i) => {
        if (i.status !== "Received") {
          const dueDate = new Date(i.dueDate);
          const diffTime = dueDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays <= 7) notifications.push({ project: p.name, item: i });
        }
      });
    }
  });
  return notifications;
};
