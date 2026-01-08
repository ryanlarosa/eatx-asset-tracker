import { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";

// Fix: Separated value and type imports for Firestore to resolve "no exported member" errors during build/compilation
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
  writeBatch,
} from "firebase/firestore";
import type {
  Firestore,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";

// Fix: Separated value and type imports for Firebase Auth
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import type { Auth } from "firebase/auth";

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
  AppNotification,
  EmailConfig,
  Task,
} from "../types";
import emailjs from "@emailjs/browser";

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

const fallbackConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_API_KEY_HER",
  projectId: "PASTE_YOUR_API_KEY_HER",
  storageBucket: "PASTE_YOUR_API_KEY_HER",
  messagingSenderId: "PASTE_YOUR_API_KEY_HER",
  appId: "PASTE_YOUR_API_KEY_HER",
  measurementId: "PASTE_YOUR_API_KEY_HER",
};

const activeConfig = firebaseConfig.apiKey ? firebaseConfig : fallbackConfig;

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(activeConfig);
} else {
  app = getApp();
}

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);

// --- HELPERS ---

const snapToData = <T>(snapshot: QuerySnapshot<DocumentData>): T[] => {
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as unknown as T));
};

const sanitizeData = (data: any) => {
  const clean: any = {};
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined && data[key] !== null) {
      clean[key] = data[key];
    }
  });
  return clean;
};

let currentUserProfile: UserProfile | null = null;

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

const isSandbox = getSandboxStatus;

const getColName = (name: string) => (isSandbox() ? `sandbox_${name}` : name);

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

export const checkEnvStatus = () => {
  let message = isSandbox() ? "Sandbox Mode Active" : "System Online";
  if (firebaseConfig.apiKey) return { ok: true, message: message + " (Env)" };
  if (activeConfig.apiKey && activeConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE")
    return { ok: true, message: message + " (Fallback)" };
  return { ok: false, message: "Configuration Missing" };
};

// --- AUTH ---

const authListeners: Function[] = [];

export const getCurrentUserProfile = () => currentUserProfile;

onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    try {
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        currentUserProfile = { ...data, email: firebaseUser.email || "" };

        const currentSandboxState =
          localStorage.getItem("eatx_sandbox") === "true";

        // AUTO-SWITCH BASED ON ROLE
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
        const isSuperAdmin =
          firebaseUser.email === "it@eatx.com" ||
          firebaseUser.email?.includes("admin");
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          role: isSuperAdmin ? "admin" : "viewer",
          displayName: firebaseUser.email?.split("@")[0],
        };
        await setDoc(doc(db, "users", firebaseUser.uid), newProfile);
        currentUserProfile = newProfile;
      }
    } catch (e) {
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

export const loginUser = async (email: string, pass: string) =>
  signInWithEmailAndPassword(auth, email, pass);
export const logoutUser = async () => signOut(auth);

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const snap = await getDocs(query(collection(db, "users")));
  return snapToData<UserProfile>(snap);
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

// --- CONFIG & EMAIL ---

export const getAppConfig = async (): Promise<AppConfig> => {
  try {
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

export const getCachedConfigSync = (): AppConfig =>
  _cachedConfig || DEFAULT_CONFIG;

export const saveAppConfig = async (config: AppConfig) => {
  _cachedConfig = config;
  await setDoc(doc(db, getColName("settings"), "appConfig"), config);
};

export const getEmailConfig = async (): Promise<EmailConfig | null> => {
  try {
    const snap = await getDoc(doc(db, "settings", "emailConfig"));
    return snap.exists() ? (snap.data() as EmailConfig) : null;
  } catch (e) {
    return null;
  }
};

export const saveEmailConfig = async (config: EmailConfig) => {
  await setDoc(doc(db, "settings", "emailConfig"), config);
};

export const sendSystemEmail = async (
  subject: string,
  message: string,
  link: string = "",
  specificRecipient?: string,
  useConfirmationTemplate: boolean = false
) => {
  try {
    const config = await getEmailConfig();
    if (!config || !config.enabled || !config.serviceId) {
      console.log("Email skipped: Integration not configured or disabled.");
      return;
    }

    // Determine which template to use
    const activeTemplate =
      useConfirmationTemplate && config.confirmationTemplateId
        ? config.confirmationTemplateId
        : config.templateId;

    const templateParams = {
      to_email: specificRecipient || config.targetEmail,
      title: subject,
      message: message,
      link: link,
      date: new Date().toLocaleString(),
    };

    console.log(
      `Attempting to send email to ${templateParams.to_email} using template ${activeTemplate}...`
    );
    const response = await emailjs.send(
      config.serviceId,
      activeTemplate,
      templateParams,
      config.publicKey
    );
    console.log(
      "Email successfully dispatched:",
      response.status,
      response.text
    );
  } catch (e) {
    console.warn("Non-blocking automated email failed to send:", e);
  }
};

// --- ASSETS ---

export const getAssets = async (): Promise<Asset[]> => {
  const snap = await getDocs(
    query(collection(db, getColName("assets")), orderBy("lastUpdated", "desc"))
  );
  return snapToData<Asset>(snap);
};

export const listenToAssets = (cb: (assets: Asset[]) => void) => {
  return onSnapshot(
    query(collection(db, getColName("assets")), orderBy("lastUpdated", "desc")),
    (snap) => {
      cb(snapToData<Asset>(snap));
    }
  );
};

export const saveAsset = async (asset: Asset) => {
  const isNew = !asset.id;
  const assetId = asset.id || `ast-${Math.random().toString(36).substr(2, 9)}`;
  const finalAsset = {
    ...asset,
    id: assetId,
    lastUpdated: new Date().toISOString(),
  };
  await setDoc(
    doc(db, getColName("assets"), assetId),
    sanitizeData(finalAsset)
  );

  try {
    await addDoc(collection(db, getColName("logs")), {
      assetId,
      action: isNew ? "Created" : "Updated",
      details: isNew
        ? `Asset ${asset.name} onboarded.`
        : `Asset ${asset.name} updated manually.`,
      performedBy: currentUserProfile?.email || "System",
      timestamp: new Date().toISOString(),
    });
  } catch (e) {}
};

export const deleteAsset = async (id: string) => {
  await deleteDoc(doc(db, getColName("assets"), id));
};

export const importAssetsBulk = async (assets: Asset[]) => {
  const batch = writeBatch(db);
  assets.forEach((a) => {
    const ref = doc(db, getColName("assets"), a.id);
    batch.set(ref, sanitizeData(a));
  });
  await batch.commit();
};

export const getAssetLogs = async (assetId: string): Promise<AssetLog[]> => {
  const q = query(
    collection(db, getColName("logs")),
    where("assetId", "==", assetId),
    orderBy("timestamp", "desc")
  );
  const snap = await getDocs(q);
  return snapToData<AssetLog>(snap);
};

export const bulkAssignAssets = async (
  assetIds: string[],
  employeeName: string,
  docId: string
) => {
  const batch = writeBatch(db);
  const timestamp = new Date().toISOString();
  assetIds.forEach((id) => {
    const ref = doc(db, getColName("assets"), id);
    batch.update(ref, {
      assignedEmployee: employeeName,
      status: "Active",
      lastUpdated: timestamp,
    });

    const logRef = doc(collection(db, getColName("logs")));
    batch.set(logRef, {
      assetId: id,
      action: "Assigned",
      details: `Asset assigned to ${employeeName}. Handover Doc: ${docId}`,
      performedBy: currentUserProfile?.email || "System",
      timestamp,
      documentId: docId,
    });
  });
  await batch.commit();
};

export const bulkReturnAssets = async (assetIds: string[], docId: string) => {
  const batch = writeBatch(db);
  const timestamp = new Date().toISOString();
  assetIds.forEach((id) => {
    const ref = doc(db, getColName("assets"), id);
    batch.update(ref, {
      assignedEmployee: "",
      status: "In Storage",
      lastUpdated: timestamp,
    });

    const logRef = doc(collection(db, getColName("logs")));
    batch.set(logRef, {
      assetId: id,
      action: "Returned",
      details: `Asset returned to storage. Return Doc: ${docId}`,
      performedBy: currentUserProfile?.email || "System",
      timestamp,
      documentId: docId,
    });
  });
  await batch.commit();
};

export const bulkTransferAssets = async (
  assetIds: string[],
  targetName: string,
  docId: string
) => {
  const batch = writeBatch(db);
  const timestamp = new Date().toISOString();
  assetIds.forEach((id) => {
    const ref = doc(db, getColName("assets"), id);
    batch.update(ref, {
      assignedEmployee: targetName,
      lastUpdated: timestamp,
    });

    const logRef = doc(collection(db, getColName("logs")));
    batch.set(logRef, {
      assetId: id,
      action: "Transferred",
      details: `Asset transferred to ${targetName}. Transfer Doc: ${docId}`,
      performedBy: currentUserProfile?.email || "System",
      timestamp,
      documentId: docId,
    });
  });
  await batch.commit();
};

// --- PROJECTS ---

export const listenToProjects = (cb: (projects: Project[]) => void) => {
  return onSnapshot(
    query(collection(db, getColName("projects")), orderBy("targetDate", "asc")),
    (snap) => {
      cb(snapToData<Project>(snap));
    }
  );
};

export const saveProject = async (project: Project) => {
  await setDoc(
    doc(db, getColName("projects"), project.id),
    sanitizeData(project)
  );
};

export const deleteProject = async (id: string) => {
  await deleteDoc(doc(db, getColName("projects"), id));
};

export const getOverdueItems = async (
  projects: Project[]
): Promise<ProjectItem[]> => {
  const overdue: ProjectItem[] = [];
  const now = new Date();
  projects.forEach((p) => {
    p.items.forEach((i) => {
      if (i.status !== "Received" && i.dueDate && new Date(i.dueDate) < now) {
        overdue.push(i);
      }
    });
  });
  return overdue;
};

// --- DASHBOARD ---

export const getStats = (assets: Asset[]): AssetStats => {
  const stats: AssetStats = {
    totalValue: 0,
    totalAssets: assets.length,
    activeAssets: 0,
    repairAssets: 0,
    byCategory: [],
  };

  const catMap = new Map<string, number>();

  assets.forEach((a) => {
    const cost = a.purchaseCost || 0;
    stats.totalValue += cost;
    if (a.status === "Active") stats.activeAssets++;
    if (a.status === "Under Repair") stats.repairAssets++;

    catMap.set(a.category, (catMap.get(a.category) || 0) + cost);
  });

  stats.byCategory = Array.from(catMap.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  return stats;
};

// --- NOTIFICATIONS ---

export const listenToNotifications = (
  cb: (notifs: AppNotification[]) => void
) => {
  return onSnapshot(
    query(
      collection(db, getColName("notifications")),
      orderBy("timestamp", "desc"),
      limit(50)
    ),
    (snap) => {
      cb(snapToData<AppNotification>(snap));
    }
  );
};

export const markNotificationRead = async (id: string) => {
  await updateDoc(doc(db, getColName("notifications"), id), { read: true });
};

export const markAllNotificationsRead = async () => {
  const snap = await getDocs(
    query(
      collection(db, getColName("notifications")),
      where("read", "==", false)
    )
  );
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
};

// --- REQUESTS ---

export const listenToRequests = (cb: (reqs: AssetRequest[]) => void) => {
  return onSnapshot(
    query(collection(db, getColName("requests")), orderBy("createdAt", "desc")),
    (snap) => {
      cb(snapToData<AssetRequest>(snap));
    }
  );
};

export const createAssetRequest = async (req: Partial<AssetRequest>) => {
  const requestNumber = `REQ-${new Date().getFullYear()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
  const newReq = {
    ...req,
    requestNumber,
    status: "New",
    createdAt: new Date().toISOString(),
  };

  // PRIMARY ACTION: Must succeed
  await addDoc(collection(db, getColName("requests")), sanitizeData(newReq));

  // SECONDARY ACTIONS: Non-blocking but awaited to ensure completion
  try {
    // 1. Dashboard Notification
    await createNotification(
      "info",
      "IT Hub: New Request",
      `${req.requesterName} requested a ${req.category} for ${req.department}.`,
      "/requests"
    );

    // 2. Alert to IT Manager (Alert Template)
    await sendSystemEmail(
      "IT Hub: New Asset Request",
      `${req.requesterName} has submitted a new request for ${req.category}. Reference: ${requestNumber}`,
      window.location.origin + "/#/requests"
    );

    // 3. Confirmation to Staff (Confirmation Template)
    if (req.requesterEmail) {
      await sendSystemEmail(
        "Request Received: EatX IT Hub",
        `Hello ${req.requesterName}, your request for a ${req.category} has been received. Your tracking reference is: ${requestNumber}`,
        window.location.origin + "/#/track",
        req.requesterEmail,
        true // Use the confirmation template override
      );
    }
  } catch (e) {
    console.warn("Secondary request notifications failed:", e);
  }
};

export const updateAssetRequest = async (
  id: string,
  updates: Partial<AssetRequest>
) => {
  await updateDoc(doc(db, getColName("requests"), id), sanitizeData(updates));
};

export const fulfillAssetRequest = async (
  requestId: string,
  assetId: string,
  notes: string,
  employeeName: string
) => {
  const batch = writeBatch(db);
  const timestamp = new Date().toISOString();

  batch.update(doc(db, getColName("requests"), requestId), {
    status: "Deployed",
    linkedAssetId: assetId,
    resolutionNotes: notes,
    resolvedAt: timestamp,
  });

  batch.update(doc(db, getColName("assets"), assetId), {
    status: "Active",
    assignedEmployee: employeeName,
    lastUpdated: timestamp,
  });

  const logRef = doc(collection(db, getColName("logs")));
  batch.set(logRef, {
    assetId,
    action: "Assigned",
    details: `Assigned to ${employeeName} via IT Hub Request fulfillment.`,
    performedBy: currentUserProfile?.email || "System",
    timestamp,
  });

  await batch.commit();
};

// --- INCIDENTS ---

export const listenToIncidents = (cb: (tickets: IncidentReport[]) => void) => {
  return onSnapshot(
    query(
      collection(db, getColName("incidents")),
      orderBy("createdAt", "desc")
    ),
    (snap) => {
      cb(snapToData<IncidentReport>(snap));
    }
  );
};

export const createIncidentReport = async (report: Partial<IncidentReport>) => {
  const ticketNumber = `TKT-${new Date().getFullYear()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
  const newReport = {
    ...report,
    ticketNumber,
    status: "New",
    createdAt: new Date().toISOString(),
  };

  // PRIMARY ACTION
  await addDoc(
    collection(db, getColName("incidents")),
    sanitizeData(newReport)
  );

  // SECONDARY ACTIONS: Await to ensure they fire, but keep inside try-catch
  try {
    // 1. Dashboard Notification
    await createNotification(
      "warning",
      "IT Hub: New Incident",
      `${report.reportedBy} reported an issue at ${report.location}.`,
      "/repairs"
    );

    // 2. Alert to IT Manager
    await sendSystemEmail(
      "IT Hub: New Incident Report",
      `${report.reportedBy} reported: ${report.description}. Reference: ${ticketNumber}`,
      window.location.origin + "/#/repairs"
    );

    // 3. Confirmation to Staff
    if (report.reporterEmail) {
      await sendSystemEmail(
        "Incident Reported: EatX IT Hub",
        `Hello ${report.reportedBy}, your issue at ${report.location} has been registered. Your tracking reference is: ${ticketNumber}`,
        window.location.origin + "/#/track",
        report.reporterEmail,
        true // Use the confirmation template override
      );
    }
  } catch (e) {
    console.warn("Secondary incident notifications failed:", e);
  }
};

export const updateIncidentReport = async (
  id: string,
  updates: Partial<IncidentReport>,
  updateAssetStatus: boolean = false
) => {
  await updateDoc(doc(db, getColName("incidents"), id), sanitizeData(updates));

  if (updateAssetStatus && updates.status === "Resolved") {
    const snap = await getDoc(doc(db, getColName("incidents"), id));
    const data = snap.data() as IncidentReport;
    if (data.assetId) {
      await updateDoc(doc(db, getColName("assets"), data.assetId), {
        status: "Active",
        lastUpdated: new Date().toISOString(),
      });
    }
  }
};

export const processAssetReplacement = async (
  ticketId: string,
  oldAssetId: string,
  newAssetId: string,
  notes: string
) => {
  const batch = writeBatch(db);
  const timestamp = new Date().toISOString();

  batch.update(doc(db, getColName("assets"), oldAssetId), {
    status: "Retired",
    lastUpdated: timestamp,
    assignedEmployee: "",
  });

  const ticketSnap = await getDoc(doc(db, getColName("incidents"), ticketId));
  const ticketData = ticketSnap.data() as IncidentReport;

  batch.update(doc(db, getColName("assets"), newAssetId), {
    status: "Active",
    location: ticketData.location,
    assignedEmployee: ticketData.reportedBy || "",
    lastUpdated: timestamp,
  });

  batch.update(doc(db, getColName("incidents"), ticketId), {
    status: "Resolved",
    resolvedAt: timestamp,
    resolutionNotes: `Replaced with Asset ID: ${newAssetId}. ${notes}`,
  });

  const log1 = doc(collection(db, getColName("logs")));
  batch.set(log1, {
    assetId: oldAssetId,
    action: "Retired",
    details: "Retired due to replacement in ticket " + ticketData.ticketNumber,
    performedBy: currentUserProfile?.email || "System",
    timestamp,
  });

  const log2 = doc(collection(db, getColName("logs")));
  batch.set(log2, {
    assetId: newAssetId,
    action: "Replaced",
    details:
      "Replacement for " + oldAssetId + " in ticket " + ticketData.ticketNumber,
    performedBy: currentUserProfile?.email || "System",
    timestamp,
  });

  await batch.commit();
};

// --- INVOICES ---

export const listenToInvoices = (cb: (invoices: Invoice[]) => void) => {
  return onSnapshot(
    query(collection(db, getColName("invoices")), orderBy("date", "desc")),
    (snap) => {
      cb(snapToData<Invoice>(snap));
    }
  );
};

export const saveInvoice = async (invoice: Invoice) => {
  await setDoc(
    doc(db, getColName("invoices"), invoice.id),
    sanitizeData(invoice)
  );
};

export const deleteInvoice = async (id: string) => {
  await deleteDoc(doc(db, getColName("invoices"), id));
};

// --- HANDOVER & SIGNING ---

export const getHandoverDocuments = async (): Promise<HandoverDocument[]> => {
  const snap = await getDocs(
    query(collection(db, getColName("documents")), orderBy("date", "desc"))
  );
  return snapToData<HandoverDocument>(snap);
};

export const saveHandoverDocument = async (docData: HandoverDocument) => {
  await setDoc(
    doc(db, getColName("documents"), docData.id),
    sanitizeData(docData)
  );
};

export const listenToPendingHandovers = (
  cb: (pending: PendingHandover[]) => void
) => {
  return onSnapshot(
    query(
      collection(db, getColName("pendingHandovers")),
      where("status", "==", "Pending")
    ),
    (snap) => {
      cb(snapToData<PendingHandover>(snap));
    }
  );
};

export const createPendingHandover = async (
  employeeName: string,
  assets: Asset[],
  type: "Handover" | "Return" | "Transfer",
  targetName?: string
) => {
  const id = `pending-${Math.random().toString(36).substr(2, 9)}`;
  const pending = {
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
    type,
    targetName,
  };
  await setDoc(
    doc(db, getColName("pendingHandovers"), id),
    sanitizeData(pending)
  );
  return id;
};

export const getPendingHandover = async (
  id: string
): Promise<PendingHandover | null> => {
  const snap = await getDoc(doc(db, getColName("pendingHandovers"), id));
  return snap.exists() ? (snap.data() as PendingHandover) : null;
};

export const deletePendingHandover = async (id: string) => {
  await deleteDoc(doc(db, getColName("pendingHandovers"), id));
};

export const completePendingHandover = async (
  id: string,
  signature: string
) => {
  const snap = await getDoc(doc(db, getColName("pendingHandovers"), id));
  if (!snap.exists()) throw new Error("Link not found");
  const data = snap.data() as PendingHandover;

  const docId = `doc-${Math.random().toString(36).substr(2, 9)}`;
  const handoverType = data.type || "Handover";

  const handoverDoc: HandoverDocument = {
    id: docId,
    employeeName: data.employeeName,
    assets: data.assetsSnapshot,
    signatureBase64: signature,
    date: new Date().toISOString(),
    type: handoverType,
    status: handoverType === "Return" ? "Pending" : "Completed",
  };
  await saveHandoverDocument(handoverDoc);

  if (handoverType === "Handover") {
    await bulkAssignAssets(data.assetIds, data.employeeName, docId);
  } else if (handoverType === "Transfer" && data.targetName) {
    await bulkTransferAssets(data.assetIds, data.targetName, docId);
  }

  await updateDoc(doc(db, getColName("pendingHandovers"), id), {
    status: "Completed",
  });

  const msg =
    handoverType === "Return"
      ? `${data.employeeName} has provided their return signature. IT Hub verification required.`
      : `${data.employeeName} has digitally signed for ${data.assetsSnapshot.length} assets. IT Hub Updated.`;

  try {
    await createNotification(
      handoverType === "Return" ? "info" : "success",
      "IT Hub: Signature Received",
      msg,
      "/staff"
    );
  } catch (e) {}
};

// --- PUBLIC TRACKING ---

export interface PublicStatusResult {
  id: string;
  type: "Request" | "Ticket";
  status: string;
  subject: string;
  details: string;
  created: string;
  updated?: string;
  notes?: string;
}

export const getPublicItemStatus = async (
  refId: string
): Promise<PublicStatusResult | null> => {
  const ticketSnap = await getDocs(
    query(
      collection(db, getColName("incidents")),
      where("ticketNumber", "==", refId)
    )
  );
  if (!ticketSnap.empty) {
    const d = ticketSnap.docs[0].data() as IncidentReport;
    return {
      id: d.ticketNumber,
      type: "Ticket",
      status: d.status,
      subject: d.assetName,
      details: d.description,
      created: d.createdAt,
      updated: d.resolvedAt,
      notes: d.resolutionNotes,
    };
  }

  const reqSnap = await getDocs(
    query(
      collection(db, getColName("requests")),
      where("requestNumber", "==", refId)
    )
  );
  if (!reqSnap.empty) {
    const d = reqSnap.docs[0].data() as AssetRequest;
    return {
      id: d.requestNumber,
      type: "Request",
      status: d.status,
      subject: d.category,
      details: d.reason,
      created: d.createdAt,
      updated: d.resolvedAt,
      notes: d.resolutionNotes,
    };
  }

  return null;
};

// --- DANGER ZONE ---

export const resetDatabase = async () => {
  const collections = [
    "assets",
    "logs",
    "projects",
    "incidents",
    "requests",
    "invoices",
    "documents",
    "pendingHandovers",
    "notifications",
    "tasks",
  ];
  const batch = writeBatch(db);

  for (const colName of collections) {
    const snap = await getDocs(collection(db, getColName(colName)));
    snap.docs.forEach((d) => batch.delete(d.ref));
  }

  await batch.commit();
};

export const renameMasterDataItem = async (
  type: "category" | "location" | "department",
  oldVal: string,
  newVal: string
) => {
  const assetsSnap = await getDocs(
    query(collection(db, getColName("assets")), where(type, "==", oldVal))
  );
  const batch = writeBatch(db);
  assetsSnap.docs.forEach((d) => {
    batch.update(d.ref, {
      [type]: newVal,
      lastUpdated: new Date().toISOString(),
    });
  });

  const config = await getAppConfig();
  if (type === "category")
    config.categories = config.categories.map((c) =>
      c === oldVal ? newVal : c
    );
  if (type === "location")
    config.locations = config.locations.map((l) => (l === oldVal ? newVal : l));
  if (type === "department")
    config.departments = (config.departments || []).map((d) =>
      d === oldVal ? newVal : d
    );

  batch.set(doc(db, getColName("settings"), "appConfig"), config);
  await batch.commit();
};

// --- TASKS ---

export const listenToTasks = (cb: (tasks: Task[]) => void) => {
  return onSnapshot(
    query(collection(db, getColName("tasks")), orderBy("createdAt", "desc")),
    (snap) => {
      cb(snapToData<Task>(snap));
    }
  );
};

export const saveTask = async (task: Task) => {
  await setDoc(doc(db, getColName("tasks"), task.id), sanitizeData(task));
};

export const deleteTask = async (id: string) => {
  await deleteDoc(doc(db, getColName("tasks"), id));
};
