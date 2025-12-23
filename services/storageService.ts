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
  writeBatch,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
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
  apiKey: "AIzaSyAK1PFmG5-uawZ2-QkCExJAIj3ovr5Gc8k",
  authDomain: "assettrack-626da.firebaseapp.com",
  projectId: "assettrack-626da",
  storageBucket: "assettrack-626da.firebasestorage.app",
  messagingSenderId: "833915106836",
  appId: "1:833915106836:web:24f97e6161f3d5ef5f9901",
  measurementId: "G-T7N92CG779",
};

const activeConfig = firebaseConfig.apiKey ? firebaseConfig : fallbackConfig;

let app: FirebaseApp;
try {
  app = initializeApp(activeConfig);
} catch (e: any) {
  if (e.code === "app/duplicate-app") {
    app = initializeApp(activeConfig, "Backup");
  } else {
    throw e;
  }
}

const db = getFirestore(app);
const auth = getAuth(app);

// --- HELPERS ---

// Generic mapper to reduce repetition
const snapToData = <T>(snapshot: QuerySnapshot<DocumentData>): T[] => {
  return snapshot.docs.map((d) => d.data() as T);
};

// Firestore does not accept 'undefined', so we must strip it.
const sanitizeData = (data: any) => {
  const clean: any = {};
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined) {
      clean[key] = data[key];
    }
  });
  return clean;
};

let currentUserProfile: UserProfile | null = null;

const isSandbox = () => {
  if (currentUserProfile?.role === "sandbox_user") return true;
  if (localStorage.getItem("eatx_sandbox") === "true") return true;
  if (typeof window !== "undefined") {
    if (window.location.hash.includes("env=sandbox")) return true;
    if (window.location.search.includes("env=sandbox")) return true;
  }
  return false;
};

const getColName = (name: string) => (isSandbox() ? `sandbox_${name}` : name);

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

export const loginUser = async (email: string, pass: string) =>
  signInWithEmailAndPassword(auth, email, pass);
export const logoutUser = async () => signOut(auth);

export const getAllUsers = async (): Promise<UserProfile[]> => {
  return snapToData<UserProfile>(await getDocs(query(collection(db, "users"))));
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
  specificRecipient?: string
) => {
  const config = await getEmailConfig();
  if (!config || !config.enabled || !config.serviceId) return;

  const templateParams = {
    to_email: specificRecipient || config.targetEmail,
    title: subject,
    message: message,
    link: link,
    date: new Date().toLocaleDateString(),
  };

  try {
    await emailjs.send(
      config.serviceId,
      config.templateId,
      templateParams,
      config.publicKey
    );
  } catch (e) {
    console.error("EmailJS Error:", e);
  }
};

// --- NOTIFICATIONS ---

export const listenToNotifications = (
  cb: (notifications: AppNotification[]) => void
) => {
  const q = query(
    collection(db, getColName("notifications")),
    orderBy("timestamp", "desc"),
    limit(20)
  );
  return onSnapshot(q, (snapshot) => cb(snapToData<AppNotification>(snapshot)));
};

export const createNotification = async (
  type: AppNotification["type"],
  title: string,
  message: string,
  link?: string
) => {
  try {
    const id = "notif-" + Date.now() + Math.random().toString(36).substr(2, 5);
    await setDoc(doc(db, getColName("notifications"), id), {
      id,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      link,
    });
  } catch (e) {
    console.error("Failed to create notification", e);
  }
};

export const markNotificationRead = async (id: string) => {
  await updateDoc(doc(db, getColName("notifications"), id), { read: true });
};

export const markAllNotificationsRead = async () => {
  const q = query(
    collection(db, getColName("notifications")),
    where("read", "==", false)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
};

// --- TASKS ---

export const listenToTasks = (cb: (tasks: Task[]) => void) => {
  return onSnapshot(
    query(collection(db, getColName("tasks")), orderBy("createdAt", "desc")),
    (s) => cb(snapToData<Task>(s))
  );
};

export const saveTask = async (task: Task) =>
  setDoc(doc(db, getColName("tasks"), task.id), sanitizeData(task));

export const deleteTask = async (id: string) =>
  deleteDoc(doc(db, getColName("tasks"), id));

// --- ASSETS ---

export const listenToAssets = (cb: (assets: Asset[]) => void) => {
  return onSnapshot(query(collection(db, getColName("assets"))), (s) =>
    cb(snapToData<Asset>(s))
  );
};

export const getAssets = async (): Promise<Asset[]> => {
  return snapToData<Asset>(await getDocs(collection(db, getColName("assets"))));
};

export const saveAsset = async (asset: Asset) => {
  const docRef = doc(db, getColName("assets"), asset.id);
  const docSnap = await getDoc(docRef);
  const isNew = !docSnap.exists();
  const oldData = isNew ? null : (docSnap.data() as Asset);

  // Sanitize data before saving to remove any undefined fields
  const dataToSave = sanitizeData({
    ...asset,
    lastUpdated: new Date().toISOString(),
  });

  await setDoc(docRef, dataToSave);

  if (isNew) {
    await logAction(asset.id, "Created", `Asset Onboarded: ${asset.name}`);
  } else if (oldData) {
    if (asset.assignedEmployee !== oldData.assignedEmployee) {
      if (asset.assignedEmployee && !oldData.assignedEmployee)
        await logAction(
          asset.id,
          "Assigned",
          `Assigned to ${asset.assignedEmployee}`
        );
      else if (!asset.assignedEmployee && oldData.assignedEmployee)
        await logAction(
          asset.id,
          "Returned",
          `Returned from ${oldData.assignedEmployee}`
        );
      else if (asset.assignedEmployee && oldData.assignedEmployee)
        await logAction(
          asset.id,
          "Transferred",
          `Transferred from ${oldData.assignedEmployee} to ${asset.assignedEmployee}`
        );
    } else if (asset.location !== oldData.location)
      await logAction(
        asset.id,
        "Transferred",
        `Moved from ${oldData.location} to ${asset.location}`
      );

    if (asset.status !== oldData.status) {
      if (asset.status === "Retired")
        await logAction(asset.id, "Retired", `Asset Retired`);
      else if (asset.status === "Lost/Stolen")
        await logAction(asset.id, "Updated", `Marked as Lost/Stolen`);
    }
  }
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
    const dataToSave = sanitizeData(asset);
    batch.set(doc(db, getColName("assets"), asset.id), dataToSave);
  });
  await batch.commit();
  await logAction(
    "BULK",
    "Created",
    `Imported ${newAssets.length} assets via Excel`
  );
  await createNotification(
    "success",
    "Bulk Import Successful",
    `Imported ${newAssets.length} assets into the registry.`
  );
};

// --- LOGS ---

export const getAssetLogs = async (assetId: string): Promise<AssetLog[]> => {
  const q = query(
    collection(db, getColName("logs")),
    where("assetId", "==", assetId),
    orderBy("timestamp", "desc")
  );
  return snapToData<AssetLog>(await getDocs(q));
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

// --- PROJECTS ---

export const listenToProjects = (cb: (projects: Project[]) => void) => {
  return onSnapshot(query(collection(db, getColName("projects"))), (s) =>
    cb(snapToData<Project>(s))
  );
};

export const saveProject = async (project: Project) => {
  const dataToSave = sanitizeData(project);
  return setDoc(doc(db, getColName("projects"), project.id), dataToSave);
};

export const deleteProject = async (id: string) =>
  deleteDoc(doc(db, getColName("projects"), id));

export const getOverdueItems = async (
  projects: Project[]
): Promise<ProjectItem[]> => {
  const today = new Date().toISOString().split("T")[0];
  const overdue: ProjectItem[] = [];
  projects.forEach((p) => {
    if (p.status !== "Completed") {
      p.items.forEach((i) => {
        if (i.status !== "Received" && i.dueDate && i.dueDate < today)
          overdue.push(i);
      });
    }
  });
  return overdue;
};

// --- INCIDENTS ---

export const listenToIncidents = (
  cb: (incidents: IncidentReport[]) => void
) => {
  return onSnapshot(query(collection(db, getColName("incidents"))), (s) =>
    cb(snapToData<IncidentReport>(s))
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

  await setDoc(doc(db, getColName("incidents"), id), sanitizeData(report));

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

  const msg = `${data.priority} priority issue reported at ${data.location}: ${data.description}`;
  await createNotification(
    "error",
    `New Ticket ${ticketNumber}`,
    msg,
    "/repairs"
  );
  await sendSystemEmail(
    `New Ticket: ${ticketNumber}`,
    msg,
    `${window.location.origin}/#/repairs`
  );
};

export const updateIncidentReport = async (
  id: string,
  updates: Partial<IncidentReport>,
  autoFixAsset: boolean = false
) => {
  const ref = doc(db, getColName("incidents"), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const incident = snap.data() as IncidentReport;

  await updateDoc(ref, sanitizeData(updates));

  if (incident.assetId) {
    if (
      ["Open", "In Progress", "Waiting for Parts"].includes(
        updates.status || ""
      )
    ) {
      await updateDoc(doc(db, getColName("assets"), incident.assetId), {
        status: "Under Repair",
      });
    } else if (updates.status === "Resolved" && autoFixAsset) {
      await updateDoc(doc(db, getColName("assets"), incident.assetId), {
        status: "Active",
      });
    }
    if (updates.status)
      await logAction(
        incident.assetId,
        "Ticket",
        `Ticket ${incident.ticketNumber} updated to ${updates.status}`
      );
  }

  if (
    updates.status &&
    incident.reporterEmail &&
    updates.status !== incident.status
  ) {
    const msg = `Your ticket for "${incident.assetName}" has been updated to: ${
      updates.status
    }.\n\nResolution Notes: ${updates.resolutionNotes || "N/A"}`;
    await sendSystemEmail(
      `Update on Ticket ${incident.ticketNumber}`,
      msg,
      "",
      incident.reporterEmail
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
  const incident = (await getDoc(incidentRef)).data() as IncidentReport;

  // Retire old, Assign new, Close Ticket
  const batch = writeBatch(db);
  batch.update(doc(db, getColName("assets"), oldAssetId), {
    status: "Retired",
    assignedEmployee: "",
    lastUpdated: new Date().toISOString(),
  });
  batch.update(doc(db, getColName("assets"), newAssetId), {
    status: "Active",
    location: incident.location,
    lastUpdated: new Date().toISOString(),
  });
  batch.update(incidentRef, {
    status: "Resolved",
    resolvedAt: new Date().toISOString(),
    resolutionNotes: `Asset Replaced. New Asset ID: ${newAssetId}. ${notes}`,
  });
  await batch.commit();

  await logAction(
    oldAssetId,
    "Retired",
    `Replaced by ${newAssetId}. Notes: ${notes}`,
    undefined,
    ticketId
  );
  await logAction(
    newAssetId,
    "Replaced",
    `Replacement for ${oldAssetId}. Ticket ${incident.ticketNumber}`,
    undefined,
    ticketId
  );

  await createNotification(
    "info",
    "Asset Replaced",
    `Ticket ${incident.ticketNumber} resolved via replacement.`,
    "/repairs"
  );
  if (incident.reporterEmail)
    await sendSystemEmail(
      `Ticket ${incident.ticketNumber} Resolved`,
      `Your issue has been resolved. The device was replaced.`,
      "",
      incident.reporterEmail
    );
};

// --- REQUESTS ---

export const listenToRequests = (cb: (reqs: AssetRequest[]) => void) => {
  return onSnapshot(query(collection(db, getColName("requests"))), (s) =>
    cb(snapToData<AssetRequest>(s))
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
  await setDoc(doc(db, getColName("requests"), id), sanitizeData(req));

  const msg = `${data.requesterName} requested ${data.category}. Urgency: ${data.urgency}`;
  await createNotification("info", "New Asset Request", msg, "/requests");
  await sendSystemEmail(
    `New Asset Request: ${requestNumber}`,
    msg,
    `${window.location.origin}/#/requests`
  );
  if (data.requesterEmail)
    await sendSystemEmail(
      `Request Received: ${requestNumber}`,
      `We have received your request for ${data.category}.`,
      "",
      data.requesterEmail
    );
};

export const updateAssetRequest = async (
  id: string,
  updates: Partial<AssetRequest>
) => {
  const ref = doc(db, getColName("requests"), id);
  await updateDoc(ref, sanitizeData(updates));

  const req = (await getDoc(ref)).data() as AssetRequest;
  if (updates.status && req.requesterEmail && updates.status !== req.status) {
    await sendSystemEmail(
      `Request Update: ${req.requestNumber}`,
      `Your request for ${req.category} is now: ${updates.status}.\n\nNotes: ${
        updates.resolutionNotes || "N/A"
      }`,
      "",
      req.requesterEmail
    );
  }
};

export const fulfillAssetRequest = async (
  id: string,
  assetId: string,
  notes: string,
  assignedTo: string
) => {
  const reqRef = doc(db, getColName("requests"), id);
  const req = (await getDoc(reqRef)).data() as AssetRequest;

  await updateDoc(doc(db, getColName("assets"), assetId), {
    status: "Active",
    assignedEmployee: assignedTo,
    department: req.department,
    lastUpdated: new Date().toISOString(),
  });
  await logAction(
    assetId,
    "Assigned",
    `Fulfilled Request ${req.requestNumber} for ${assignedTo}`
  );

  await updateDoc(reqRef, {
    status: "Deployed",
    resolvedAt: new Date().toISOString(),
    linkedAssetId: assetId,
    resolutionNotes: notes,
  });

  if (req.requesterEmail)
    await sendSystemEmail(
      `Request Fulfilled: ${req.requestNumber}`,
      `Good news! Your request for ${req.category} has been fulfilled and the asset has been deployed to ${assignedTo}.`,
      "",
      req.requesterEmail
    );
};

// --- PUBLIC TRACKING ---

export interface PublicStatusResult {
  type: "Ticket" | "Request";
  id: string;
  status: string;
  created: string;
  subject: string;
  details: string;
  notes?: string;
  updated?: string;
}

export const getPublicItemStatus = async (
  refId: string
): Promise<PublicStatusResult | null> => {
  const cleanId = refId.trim().toUpperCase();

  const incSnap = await getDocs(
    query(
      collection(db, getColName("incidents")),
      where("ticketNumber", "==", cleanId)
    )
  );
  if (!incSnap.empty) {
    const data = incSnap.docs[0].data() as IncidentReport;
    return {
      type: "Ticket",
      id: data.ticketNumber,
      status: data.status,
      created: data.createdAt,
      subject: data.assetName,
      details: data.description,
      notes: data.resolutionNotes,
      updated: data.resolvedAt,
    };
  }

  const reqSnap = await getDocs(
    query(
      collection(db, getColName("requests")),
      where("requestNumber", "==", cleanId)
    )
  );
  if (!reqSnap.empty) {
    const data = reqSnap.docs[0].data() as AssetRequest;
    return {
      type: "Request",
      id: data.requestNumber,
      status: data.status,
      created: data.createdAt,
      subject: data.category,
      details: data.reason,
      notes: data.resolutionNotes,
      updated: data.resolvedAt,
    };
  }
  return null;
};

// --- INVOICES & HANDOVERS ---

export const listenToInvoices = (cb: (inv: Invoice[]) => void) => {
  return onSnapshot(query(collection(db, getColName("invoices"))), (s) =>
    cb(snapToData<Invoice>(s))
  );
};
export const saveInvoice = async (invoice: Invoice) =>
  setDoc(doc(db, getColName("invoices"), invoice.id), sanitizeData(invoice));
export const deleteInvoice = async (id: string) =>
  deleteDoc(doc(db, getColName("invoices"), id));

export const getHandoverDocuments = async (): Promise<HandoverDocument[]> =>
  snapToData<HandoverDocument>(
    await getDocs(collection(db, getColName("documents")))
  );
export const saveHandoverDocument = async (docData: HandoverDocument) =>
  setDoc(doc(db, getColName("documents"), docData.id), sanitizeData(docData));

export const createPendingHandover = async (
  employeeName: string,
  assets: Asset[],
  type: "Handover" | "Return" | "Transfer" = "Handover",
  targetName?: string
): Promise<string> => {
  const id = "ph-" + Date.now();
  await setDoc(
    doc(db, getColName("pendingHandovers"), id),
    sanitizeData({
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
    } as PendingHandover)
  );
  return id;
};

export const listenToPendingHandovers = (
  cb: (pending: PendingHandover[]) => void
) => {
  return onSnapshot(
    query(
      collection(db, getColName("pendingHandovers")),
      where("status", "==", "Pending")
    ),
    (s) => cb(snapToData<PendingHandover>(s))
  );
};

export const deletePendingHandover = async (id: string) =>
  deleteDoc(doc(db, getColName("pendingHandovers"), id));

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
  const pending = (await getDoc(ref)).data() as PendingHandover;
  if (pending.status !== "Pending") throw new Error("Already completed");

  await saveHandoverDocument({
    id: "doc-" + Date.now(),
    employeeName: pending.employeeName,
    assets: pending.assetsSnapshot,
    signatureBase64: signature,
    date: new Date().toISOString(),
    type: pending.type || "Handover",
  });

  if (pending.type === "Return") {
    await bulkReturnAssets(pending.assetIds);
  } else if (pending.type === "Transfer" && pending.targetName) {
    await bulkTransferAssets(pending.assetIds, pending.targetName);
  } else {
    await bulkAssignAssets(pending.assetIds, pending.employeeName);
  }

  await updateDoc(ref, { status: "Completed" });

  const msg = `${pending.employeeName} has digitally signed for ${pending.assetsSnapshot.length} assets (${pending.type}).`;
  await createNotification("success", "Handover Signed", msg, "/staff");
  await sendSystemEmail(
    "Handover Signed",
    msg,
    `${window.location.origin}/#/staff`
  );
};

// --- BULK OPS ---

const performBulkOp = async (
  assetIds: string[],
  updateFn: (id: string) => object,
  logActionFn: (id: string) => Promise<void>
) => {
  const batch = writeBatch(db);
  assetIds.forEach((id) =>
    batch.update(doc(db, getColName("assets"), id), updateFn(id))
  );
  await batch.commit();
  for (const id of assetIds) await logActionFn(id);
};

export const bulkAssignAssets = async (
  assetIds: string[],
  employeeName: string
) => {
  await performBulkOp(
    assetIds,
    () => ({
      assignedEmployee: employeeName,
      status: "Active",
      lastUpdated: new Date().toISOString(),
    }),
    (id) => logAction(id, "Assigned", `Assigned to ${employeeName}`)
  );
};

export const bulkReturnAssets = async (assetIds: string[], docId?: string) => {
  await performBulkOp(
    assetIds,
    () => ({
      assignedEmployee: "",
      status: "In Storage",
      lastUpdated: new Date().toISOString(),
    }),
    (id) => logAction(id, "Returned", `Returned to storage`, docId)
  );
};

export const bulkTransferAssets = async (
  assetIds: string[],
  targetName: string,
  docId?: string
) => {
  await performBulkOp(
    assetIds,
    () => ({
      assignedEmployee: targetName,
      lastUpdated: new Date().toISOString(),
    }),
    (id) => logAction(id, "Transferred", `Transferred to ${targetName}`, docId)
  );
};

// --- SYSTEM ADMIN ---

export const getSandboxStatus = () => isSandbox();
export const setSandboxMode = (enabled: boolean) => {
  localStorage.setItem("eatx_sandbox", enabled ? "true" : "false");
  window.location.reload();
};

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
  const prefix = isSandbox() ? "sandbox_" : "";

  for (const colName of collections) {
    const snap = await getDocs(query(collection(db, prefix + colName)));
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
  if (type === "category")
    config.categories = config.categories.map((c) =>
      c === oldValue ? newValue : c
    );
  else if (type === "location")
    config.locations = config.locations.map((l) =>
      l === oldValue ? newValue : l
    );
  else if (type === "department")
    config.departments = (config.departments || []).map((d) =>
      d === oldValue ? newValue : d
    );

  await saveAppConfig(config);

  const snapshot = await getDocs(
    query(collection(db, getColName("assets")), where(type, "==", oldValue))
  );
  const batch = writeBatch(db);
  snapshot.docs.forEach((doc) => batch.update(doc.ref, { [type]: newValue }));
  await batch.commit();
};
