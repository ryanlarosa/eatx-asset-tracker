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
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

// --- ENV Configuration ---
const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

// --- FALLBACK CONFIGURATION (FOR TESTING) ---
// Replace these values with your actual Firebase config keys if .env is not available
const fallbackConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN_HERE",
  projectId: "PASTE_YOUR_PROJECT_ID_HERE",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "PASTE_YOUR_APP_ID_HERE",
};
// Determine which config to use: Env vars take precedence, then fallback
const activeConfig = firebaseConfig.apiKey ? firebaseConfig : fallbackConfig;

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

let db: firebase.firestore.Firestore | undefined;
let auth: firebase.auth.Auth | undefined;
let currentUserProfile: UserProfile | null = null;
let cachedConfig: AppConfig = DEFAULT_CONFIG;

export const checkEnvStatus = () => {
  if (firebaseConfig.apiKey) {
    return {
      ok: true,
      message: "System Online (Env)",
    };
  }
  if (
    activeConfig.apiKey &&
    activeConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE"
  ) {
    return {
      ok: true,
      message: "System Online (Fallback)",
    };
  }
  return {
    ok: false,
    message: "Configuration Missing (Check .env or Fallback)",
  };
};

try {
  // Check if we have a valid config to use (either from env or fallback that isn't the placeholder)
  if (
    activeConfig.apiKey &&
    activeConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE"
  ) {
    if (!firebase.apps.length) {
      firebase.initializeApp(activeConfig);
    }
    db = firebase.firestore();
    auth = firebase.auth();
    console.log("Firebase initialized successfully");
  } else {
    console.warn(
      "Firebase Config missing. Application running in offline mode."
    );
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

// --- REAL-TIME LISTENERS ---

export const listenToAssets = (callback: (assets: Asset[]) => void) => {
  if (!db) return () => {};
  return db.collection("assets").onSnapshot((snapshot) => {
    const assets: Asset[] = [];
    snapshot.forEach((doc) => assets.push(doc.data() as Asset));
    callback(assets);
  });
};

export const listenToIncidents = (
  callback: (incidents: IncidentReport[]) => void
) => {
  if (!db) return () => {};
  return db.collection("incidents").onSnapshot((snapshot) => {
    const incidents: IncidentReport[] = [];
    snapshot.forEach((doc) => incidents.push(doc.data() as IncidentReport));
    callback(
      incidents.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
  });
};

export const listenToRequests = (
  callback: (requests: AssetRequest[]) => void
) => {
  if (!db) return () => {};
  return db.collection("requests").onSnapshot((snapshot) => {
    const requests: AssetRequest[] = [];
    snapshot.forEach((doc) => requests.push(doc.data() as AssetRequest));
    callback(
      requests.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
  });
};

export const listenToInvoices = (callback: (invoices: Invoice[]) => void) => {
  if (!db) return () => {};
  return db.collection("invoices").onSnapshot((snapshot) => {
    const invoices: Invoice[] = [];
    snapshot.forEach((doc) => invoices.push(doc.data() as Invoice));
    callback(
      invoices.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    );
  });
};

export const listenToProjects = (callback: (projects: Project[]) => void) => {
  if (!db) return () => {};
  return db.collection("projects").onSnapshot((snapshot) => {
    const projects: Project[] = [];
    snapshot.forEach((doc) => projects.push(doc.data() as Project));
    callback(projects);
  });
};

// --- DANGER ZONE: RESET DATABASE ---
export const resetDatabase = async () => {
  if (!db) return;
  const collectionsToReset = [
    "assets",
    "logs",
    "incidents",
    "requests",
    "invoices",
    "documents",
    "pendingHandovers",
    "projects",
  ];

  for (const colName of collectionsToReset) {
    const snapshot = await db.collection(colName).get();

    if (snapshot.empty) continue;

    const batch = db.batch();
    let count = 0;

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });

    await batch.commit();
    console.log(`Reset: Cleared ${count} documents from ${colName}`);
  }
};

// --- Auth ---

export const loginUser = async (email: string, pass: string) => {
  if (!auth) throw new Error("Firebase not initialized.");
  return await auth.signInWithEmailAndPassword(email, pass);
};

export const adminCreateUser = async (
  email: string,
  pass: string,
  role: UserRole
) => {
  if (!auth || !db) throw new Error("System offline");

  // Use activeConfig here to ensure the secondary app uses the correct keys
  const secondaryApp = firebase.initializeApp(activeConfig, "SecondaryApp");
  const secondaryAuth = secondaryApp.auth();

  try {
    const userCred = await secondaryAuth.createUserWithEmailAndPassword(
      email,
      pass
    );
    const uid = userCred.user!.uid;

    const newProfile: UserProfile = {
      uid,
      email: email.toLowerCase(),
      role,
      displayName: email.split("@")[0],
    };
    await db.collection("users").doc(uid).set(newProfile);
    await secondaryAuth.signOut();
    return true;
  } catch (error) {
    throw error;
  } finally {
    await secondaryApp.delete();
  }
};

export const logoutUser = async () => {
  if (!auth) return;
  currentUserProfile = null;
  return await auth.signOut();
};

export const getCurrentUserProfile = () => currentUserProfile;

export const subscribeToAuth = (
  callback: (user: UserProfile | null) => void
) => {
  if (!auth || !db) {
    callback(null);
    return () => {};
  }
  return auth.onAuthStateChanged(async (firebaseUser) => {
    if (!firebaseUser) {
      currentUserProfile = null;
      callback(null);
      return;
    }
    try {
      const userRef = db!.collection("users").doc(firebaseUser.uid);
      const userSnap = await userRef.get();
      const userEmail = firebaseUser.email?.toLowerCase() || "";
      const isSuperAdmin =
        userEmail === "it@eatx.com" || userEmail.includes("admin");

      if (userSnap.exists) {
        const data = userSnap.data() as UserProfile;
        if (isSuperAdmin && data.role !== "admin") {
          await userRef.update({ role: "admin" });
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
        await userRef.set(newProfile);
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
  const snapshot = await db.collection("users").get();
  const users: UserProfile[] = [];
  snapshot.forEach((doc) => users.push(doc.data() as UserProfile));
  return users;
};

export const updateUserRole = async (
  uid: string,
  newRole: UserRole
): Promise<void> => {
  if (!db) return;
  await db.collection("users").doc(uid).update({ role: newRole });
};

// --- Config ---
export const getCachedConfigSync = (): AppConfig => cachedConfig;

export const getAppConfig = async (): Promise<AppConfig> => {
  if (!db) return DEFAULT_CONFIG;
  try {
    const snapshot = await db.collection("settings").get();
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
      await db.collection("settings").doc("appConfig").set(DEFAULT_CONFIG);
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
  await db.collection("settings").doc("appConfig").set(config);
};

export const renameMasterDataItem = async (
  type: "category" | "location" | "department",
  oldName: string,
  newName: string
) => {
  if (!db) return;
  const config = await getAppConfig();

  // 1. Update Config
  if (type === "category") {
    const idx = config.categories.indexOf(oldName);
    if (idx !== -1) config.categories[idx] = newName;
  } else if (type === "location") {
    const idx = config.locations.indexOf(oldName);
    if (idx !== -1) config.locations[idx] = newName;
  } else if (type === "department") {
    const idx = (config.departments || []).indexOf(oldName);
    if (idx !== -1 && config.departments) config.departments[idx] = newName;
  }
  await saveAppConfig(config);

  // 2. Batch Update Linked Assets
  const fieldName =
    type === "category"
      ? "category"
      : type === "location"
      ? "location"
      : "department";

  try {
    const snapshot = await db
      .collection("assets")
      .where(fieldName, "==", oldName)
      .get();

    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          [fieldName]: newName,
          lastUpdated: new Date().toISOString(),
        });
      });
      await batch.commit();
    }
  } catch (e) {
    console.error("Error batch updating assets during rename:", e);
    throw e;
  }
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

  const log: any = {
    id: "log-" + Math.random().toString(36).substr(2, 9),
    assetId,
    action,
    details,
    performedBy: currentUserProfile?.email || "System",
    timestamp: new Date().toISOString(),
  };

  if (documentId !== undefined) log.documentId = documentId;
  if (ticketId !== undefined) log.ticketId = ticketId;

  await db.collection("logs").doc(log.id).set(log);
};

export const getAssetLogs = async (assetId: string): Promise<AssetLog[]> => {
  if (!db) return [];
  try {
    const snapshot = await db
      .collection("logs")
      .where("assetId", "==", assetId)
      .get();
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
  const snapshot = await db.collection("incidents").get();
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

  const cleanData = removeUndefined(data);

  const report: IncidentReport = {
    id,
    ticketNumber,
    ...cleanData,
    status: "New",
    createdAt: new Date().toISOString(),
  };

  await db.collection("incidents").doc(id).set(report);
  return id;
};

export const updateIncidentReport = async (
  id: string,
  updates: Partial<IncidentReport>,
  resolveAsset?: boolean
) => {
  if (!db) return;
  const reportRef = db.collection("incidents").doc(id);

  const snap = await reportRef.get();
  const currentData = snap.data() as IncidentReport;
  const cleanUpdates = removeUndefined(updates);

  await reportRef.update(cleanUpdates);

  if (
    currentData.status === "New" &&
    updates.status === "Open" &&
    currentData.assetId
  ) {
    await db.collection("assets").doc(currentData.assetId).update({
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

  if (resolveAsset && updates.status === "Resolved" && currentData.assetId) {
    await db.collection("assets").doc(currentData.assetId).update({
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

export const processAssetReplacement = async (
  ticketId: string,
  oldAssetId: string,
  newAssetId: string,
  notes: string
) => {
  if (!db) return;

  const oldAssetRef = db.collection("assets").doc(oldAssetId);
  const newAssetRef = db.collection("assets").doc(newAssetId);
  const oldAssetSnap = await oldAssetRef.get();
  const newAssetSnap = await newAssetRef.get();

  if (!oldAssetSnap.exists || !newAssetSnap.exists)
    throw new Error("Assets not found");
  const oldAssetData = oldAssetSnap.data() as Asset;
  const newAssetData = newAssetSnap.data() as Asset;

  await oldAssetRef.update({
    status: "Retired",
    assignedEmployee: "",
    lastUpdated: new Date().toISOString(),
  });
  await addAssetLog(
    oldAssetId,
    "Retired",
    `Retired via Ticket. Replaced by ${newAssetData.name} (${newAssetData.serialNumber})`,
    undefined,
    ticketId
  );

  await newAssetRef.update({
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

  await db
    .collection("incidents")
    .doc(ticketId)
    .update({
      status: "Resolved",
      resolvedAt: new Date().toISOString(),
      resolutionNotes: `${notes} (Replaced with ${newAssetData.name})`,
    });
};

// --- Asset Requests ---
export const getAssetRequests = async (): Promise<AssetRequest[]> => {
  if (!db) return [];
  const snapshot = await db.collection("requests").get();
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
  await db.collection("requests").doc(id).set(request);
  return id;
};

export const updateAssetRequest = async (
  id: string,
  updates: Partial<AssetRequest>
) => {
  if (!db) return;
  const cleanUpdates = removeUndefined(updates);
  await db.collection("requests").doc(id).update(cleanUpdates);
};

export const fulfillAssetRequest = async (
  requestId: string,
  assetId: string,
  notes: string
) => {
  if (!db) return;
  const requestRef = db.collection("requests").doc(requestId);
  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) return;
  const requestData = requestSnap.data() as AssetRequest;

  await db.collection("assets").doc(assetId).update({
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

  await requestRef.update({
    status: "Fulfilled",
    linkedAssetId: assetId,
    resolvedAt: new Date().toISOString(),
    resolutionNotes: notes,
  });
};

// --- Invoices ---
export const getInvoices = async (): Promise<Invoice[]> => {
  if (!db) return [];
  const snapshot = await db.collection("invoices").get();
  const invoices: Invoice[] = [];
  snapshot.forEach((doc) => invoices.push(doc.data() as Invoice));
  return invoices.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
};

export const saveInvoice = async (invoice: Invoice): Promise<void> => {
  if (!db) return;
  const cleanInvoice = removeUndefined(invoice);
  await db.collection("invoices").doc(invoice.id).set(cleanInvoice);

  if (invoice.linkedAssetIds && invoice.linkedAssetIds.length > 0) {
    const perItemCost =
      invoice.amount && invoice.linkedAssetIds.length > 0
        ? Number((invoice.amount / invoice.linkedAssetIds.length).toFixed(2))
        : undefined;

    await Promise.all(
      invoice.linkedAssetIds.map(async (assetId) => {
        const updates: any = {
          purchaseDate: invoice.date,
          supplier: invoice.vendor,
          lastUpdated: new Date().toISOString(),
        };

        if (perItemCost !== undefined && perItemCost > 0) {
          updates.purchaseCost = perItemCost;
        }

        await db!.collection("assets").doc(assetId).update(updates);

        await addAssetLog(
          assetId,
          "Updated",
          `Linked to Invoice #${invoice.invoiceNumber}. Supplier: ${
            invoice.vendor
          }, Date: ${invoice.date}${
            perItemCost ? `, Cost: ${perItemCost}` : ""
          }`
        );
      })
    );
  }
};

export const deleteInvoice = async (id: string): Promise<void> => {
  if (!db) return;
  await db.collection("invoices").doc(id).delete();
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
  await db.collection("pendingHandovers").doc(id).set(pending);
  return id;
};

export const getPendingHandover = async (
  id: string
): Promise<PendingHandover | null> => {
  if (!db) return null;
  const snap = await db.collection("pendingHandovers").doc(id).get();
  return snap.exists ? (snap.data() as PendingHandover) : null;
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
  await db.collection("documents").doc(docData.id).set(docData);

  await Promise.all(
    pending.assetIds.map(async (id) => {
      await db!.collection("assets").doc(id).update({
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

  await db
    .collection("pendingHandovers")
    .doc(pendingId)
    .update({ status: "Completed" });
};

// --- Handover Documents ---
export const saveHandoverDocument = async (
  docData: HandoverDocument
): Promise<void> => {
  if (!db) return;
  await db.collection("documents").doc(docData.id).set(docData);
};

export const getHandoverDocuments = async (
  employeeName?: string
): Promise<HandoverDocument[]> => {
  if (!db) return [];
  try {
    let q: firebase.firestore.Query = db.collection("documents");
    if (employeeName) {
      q = q.where("employeeName", "==", employeeName);
    } else {
      q = q.orderBy("date", "desc");
    }

    const snapshot = await q.get();
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
    const snapshot = await db.collection("assets").get();
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
  const cleanAsset = removeUndefined(asset);

  await db
    .collection("assets")
    .doc(asset.id)
    .set({
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
  await db.collection("assets").doc(id).delete();
};

export const importAssetsBulk = async (newAssets: Asset[]): Promise<void> => {
  if (!db) return;
  await Promise.all(
    newAssets.map(async (a) => {
      const cleanAsset = removeUndefined(a);
      await db!.collection("assets").doc(a.id).set(cleanAsset);
      await addAssetLog(a.id, "Created", "Imported via Bulk Import");
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
      await db!.collection("assets").doc(id).update({
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
      await db!.collection("assets").doc(id).update({
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
      await db!.collection("assets").doc(id).update({
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
  const snapshot = await db.collection("projects").get();
  const projects: Project[] = [];
  snapshot.forEach((doc) => projects.push(doc.data() as Project));
  return projects;
};

export const saveProject = async (project: Project): Promise<void> => {
  if (!db) return;
  const cleanProject = removeUndefined(project);
  await db.collection("projects").doc(project.id).set(cleanProject);
};

export const deleteProject = async (id: string): Promise<void> => {
  if (!db) return;
  await db.collection("projects").doc(id).delete();
};

export const getOverdueItems = async (
  projects: Project[]
): Promise<{ project: string; item: ProjectItem }[]> => {
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
