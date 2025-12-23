// Fix: Refactored to use Firebase v8 namespaced API as the environment doesn't support v9 modular exports
import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/auth";
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
  authDomain: "PASTE_YOUR_API_KEY_HERE",
  projectId: "PASTE_YOUR_API_KEY_HERE",
  storageBucket: "PASTE_YOUR_API_KEY_HERE",
  messagingSenderId: "PASTE_YOUR_API_KEY_HERE",
  appId: "PASTE_YOUR_API_KEY_HERE",
  measurementId: "PASTE_YOUR_API_KEY_HERE",
};
const activeConfig = firebaseConfig.apiKey ? firebaseConfig : fallbackConfig;

let app: firebase.app.App;
if (!firebase.apps.length) {
  app = firebase.initializeApp(activeConfig);
} else {
  app = firebase.app();
}

const db = app.firestore();
const auth = app.auth();

// --- HELPERS ---

const snapToData = <T>(
  snapshot:
    | firebase.firestore.QuerySnapshot
    | firebase.firestore.DocumentSnapshot
): T[] => {
  if ("docs" in snapshot) {
    return snapshot.docs.map((d) => d.data() as T);
  }
  return [];
};

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

auth.onAuthStateChanged(async (firebaseUser) => {
  if (firebaseUser) {
    try {
      const userDoc = await db.collection("users").doc(firebaseUser.uid).get();
      if (userDoc.exists) {
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
        await db.collection("users").doc(firebaseUser.uid).set(newProfile);
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
  auth.signInWithEmailAndPassword(email, pass);
export const logoutUser = async () => auth.signOut();

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const snap = await db.collection("users").get();
  return snap.docs.map((d) => d.data() as UserProfile);
};

export const adminCreateUser = async (
  email: string,
  pass: string,
  role: UserRole
) => {
  const secondaryApp = firebase.initializeApp(activeConfig, "SecondaryApp");
  try {
    const userCred = await secondaryApp
      .auth()
      .createUserWithEmailAndPassword(email, pass);
    const uid = userCred.user?.uid;
    if (!uid) throw new Error("UID not generated");
    const newProfile: UserProfile = {
      uid,
      email: email.toLowerCase(),
      role,
      displayName: email.split("@")[0],
    };
    await db.collection("users").doc(uid).set(newProfile);
    await secondaryApp.auth().signOut();
    return true;
  } finally {
    await secondaryApp.delete();
  }
};

export const updateUserRole = async (uid: string, role: UserRole) => {
  await db.collection("users").doc(uid).set({ role }, { merge: true });
};

// --- CONFIG & EMAIL ---

export const getAppConfig = async (): Promise<AppConfig> => {
  try {
    const docRef = db.collection(getColName("settings")).doc("appConfig");
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data() as AppConfig;
      if (!data.departments) data.departments = DEFAULT_CONFIG.departments;
      _cachedConfig = data;
      return data;
    } else {
      await docRef.set(DEFAULT_CONFIG);
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
  await db.collection(getColName("settings")).doc("appConfig").set(config);
};

export const getEmailConfig = async (): Promise<EmailConfig | null> => {
  try {
    const snap = await db.collection("settings").doc("emailConfig").get();
    return snap.exists ? (snap.data() as EmailConfig) : null;
  } catch (e) {
    return null;
  }
};

export const saveEmailConfig = async (config: EmailConfig) => {
  await db.collection("settings").doc("emailConfig").set(config);
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
  return db
    .collection(getColName("notifications"))
    .orderBy("timestamp", "desc")
    .limit(20)
    .onSnapshot((snapshot) => {
      cb(snapshot.docs.map((d) => d.data() as AppNotification));
    });
};

export const createNotification = async (
  type: AppNotification["type"],
  title: string,
  message: string,
  link?: string
) => {
  try {
    const id = "notif-" + Date.now() + Math.random().toString(36).substr(2, 5);
    await db.collection(getColName("notifications")).doc(id).set({
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
  await db
    .collection(getColName("notifications"))
    .doc(id)
    .update({ read: true });
};

export const markAllNotificationsRead = async () => {
  const snap = await db
    .collection(getColName("notifications"))
    .where("read", "==", false)
    .get();
  const batch = db.batch();
  snap.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
};

// --- TASKS ---

export const listenToTasks = (cb: (tasks: Task[]) => void) => {
  return db
    .collection(getColName("tasks"))
    .orderBy("createdAt", "desc")
    .onSnapshot((s) => cb(s.docs.map((d) => d.data() as Task)));
};

export const saveTask = async (task: Task) =>
  db.collection(getColName("tasks")).doc(task.id).set(sanitizeData(task));

export const deleteTask = async (id: string) =>
  db.collection(getColName("tasks")).doc(id).delete();

// --- ASSETS ---

export const listenToAssets = (cb: (assets: Asset[]) => void) => {
  return db
    .collection(getColName("assets"))
    .onSnapshot((s) => cb(s.docs.map((d) => d.data() as Asset)));
};

export const getAssets = async (): Promise<Asset[]> => {
  const snap = await db.collection(getColName("assets")).get();
  return snap.docs.map((d) => d.data() as Asset);
};

export const saveAsset = async (asset: Asset) => {
  const docRef = db.collection(getColName("assets")).doc(asset.id);
  const docSnap = await docRef.get();
  const isNew = !docSnap.exists;
  const oldData = isNew ? null : (docSnap.data() as Asset);

  const dataToSave = sanitizeData({
    ...asset,
    lastUpdated: new Date().toISOString(),
  });

  await docRef.set(dataToSave);

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
  const docRef = db.collection(getColName("assets")).doc(id);
  const snap = await docRef.get();
  const assetName = snap.exists ? (snap.data() as Asset).name : "Unknown";
  await docRef.delete();
  await logAction(id, "Retired", `Asset ${assetName} deleted from registry`);
};

export const importAssetsBulk = async (newAssets: Asset[]) => {
  const batch = db.batch();
  newAssets.forEach((asset) => {
    const dataToSave = sanitizeData(asset);
    batch.set(db.collection(getColName("assets")).doc(asset.id), dataToSave);
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
  const snap = await db
    .collection(getColName("logs"))
    .where("assetId", "==", assetId)
    .orderBy("timestamp", "desc")
    .get();
  return snap.docs.map((d) => d.data() as AssetLog);
};

const logAction = async (
  assetId: string,
  action: AssetLog["action"],
  details: string,
  documentId?: string,
  ticketId?: string
) => {
  try {
    await db.collection(getColName("logs")).add({
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
  return db
    .collection(getColName("projects"))
    .onSnapshot((s) => cb(s.docs.map((d) => d.data() as Project)));
};

export const saveProject = async (project: Project) => {
  const dataToSave = sanitizeData(project);
  return db.collection(getColName("projects")).doc(project.id).set(dataToSave);
};

export const deleteProject = async (id: string) =>
  db.collection(getColName("projects")).doc(id).delete();

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
  return db
    .collection(getColName("incidents"))
    .onSnapshot((s) => cb(s.docs.map((d) => d.data() as IncidentReport)));
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

  await db
    .collection(getColName("incidents"))
    .doc(id)
    .set(sanitizeData(report));

  if (data.assetId) {
    await db.collection(getColName("assets")).doc(data.assetId).update({
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
  const ref = db.collection(getColName("incidents")).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const incident = snap.data() as IncidentReport;

  await ref.update(sanitizeData(updates));

  if (incident.assetId) {
    if (
      ["Open", "In Progress", "Waiting for Parts"].includes(
        updates.status || ""
      )
    ) {
      await db
        .collection(getColName("assets"))
        .doc(incident.assetId)
        .update({ status: "Under Repair" });
    } else if (updates.status === "Resolved" && autoFixAsset) {
      await db
        .collection(getColName("assets"))
        .doc(incident.assetId)
        .update({ status: "Active" });
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
  const incidentRef = db.collection(getColName("incidents")).doc(ticketId);
  const incidentSnap = await incidentRef.get();
  const incident = incidentSnap.data() as IncidentReport;

  const batch = db.batch();
  batch.update(db.collection(getColName("assets")).doc(oldAssetId), {
    status: "Retired",
    assignedEmployee: "",
    lastUpdated: new Date().toISOString(),
  });
  batch.update(db.collection(getColName("assets")).doc(newAssetId), {
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
  return db
    .collection(getColName("requests"))
    .onSnapshot((s) => cb(s.docs.map((d) => d.data() as AssetRequest)));
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
  await db.collection(getColName("requests")).doc(id).set(sanitizeData(req));

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
  const ref = db.collection(getColName("requests")).doc(id);
  await ref.update(sanitizeData(updates));

  const snap = await ref.get();
  const req = snap.data() as AssetRequest;
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
  const reqRef = db.collection(getColName("requests")).doc(id);
  const snap = await reqRef.get();
  const req = snap.data() as AssetRequest;

  await db.collection(getColName("assets")).doc(assetId).update({
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

  await reqRef.update({
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

  const incSnap = await db
    .collection(getColName("incidents"))
    .where("ticketNumber", "==", cleanId)
    .get();
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

  const reqSnap = await db
    .collection(getColName("requests"))
    .where("requestNumber", "==", cleanId)
    .get();
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
  return db
    .collection(getColName("invoices"))
    .onSnapshot((s) => cb(s.docs.map((d) => d.data() as Invoice)));
};
export const saveInvoice = async (invoice: Invoice) =>
  db
    .collection(getColName("invoices"))
    .doc(invoice.id)
    .set(sanitizeData(invoice));
export const deleteInvoice = async (id: string) =>
  db.collection(getColName("invoices")).doc(id).delete();

export const getHandoverDocuments = async (): Promise<HandoverDocument[]> => {
  const snap = await db.collection(getColName("documents")).get();
  return snap.docs.map((d) => d.data() as HandoverDocument);
};
export const saveHandoverDocument = async (docData: HandoverDocument) =>
  db
    .collection(getColName("documents"))
    .doc(docData.id)
    .set(sanitizeData(docData));

export const createPendingHandover = async (
  employeeName: string,
  assets: Asset[],
  type: "Handover" | "Return" | "Transfer" = "Handover",
  targetName?: string
): Promise<string> => {
  const id = "ph-" + Date.now();
  await db
    .collection(getColName("pendingHandovers"))
    .doc(id)
    .set(
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
  return db
    .collection(getColName("pendingHandovers"))
    .where("status", "==", "Pending")
    .onSnapshot((s) => cb(s.docs.map((d) => d.data() as PendingHandover)));
};

export const deletePendingHandover = async (id: string) =>
  db.collection(getColName("pendingHandovers")).doc(id).delete();

export const getPendingHandover = async (
  id: string
): Promise<PendingHandover | undefined> => {
  const snap = await db
    .collection(getColName("pendingHandovers"))
    .doc(id)
    .get();
  return snap.exists ? (snap.data() as PendingHandover) : undefined;
};

export const completePendingHandover = async (
  id: string,
  signature: string
) => {
  const ref = db.collection(getColName("pendingHandovers")).doc(id);
  const snap = await ref.get();
  const pending = snap.data() as PendingHandover;
  if (pending.status !== "Pending") throw new Error("Already completed");

  const docId = "doc-" + Date.now();
  const handoverType = pending.type || "Handover";

  // Process according to type
  if (handoverType === "Return") {
    // Returns still require IT verification (Pending)
    await saveHandoverDocument({
      id: docId,
      employeeName: pending.employeeName,
      assets: pending.assetsSnapshot,
      signatureBase64: signature,
      date: new Date().toISOString(),
      type: handoverType,
      status: "Pending",
    });
  } else {
    // Handovers and Transfers are processed immediately (Completed)
    await saveHandoverDocument({
      id: docId,
      employeeName: pending.employeeName,
      assets: pending.assetsSnapshot,
      signatureBase64: signature,
      date: new Date().toISOString(),
      type: handoverType,
      status: "Completed",
    });

    if (handoverType === "Transfer" && pending.targetName) {
      await bulkTransferAssets(pending.assetIds, pending.targetName, docId);
    } else {
      await bulkAssignAssets(pending.assetIds, pending.employeeName, docId);
    }
  }

  await ref.update({ status: "Completed" });

  const msg =
    handoverType === "Return"
      ? `${pending.employeeName} has provided their return signature. IT Manager verification required.`
      : `${pending.employeeName} has digitally signed for ${pending.assetsSnapshot.length} assets. Request finalized.`;

  await createNotification(
    handoverType === "Return" ? "info" : "success",
    "Signature Received",
    msg,
    "/staff"
  );
  await sendSystemEmail(
    "Signature Received",
    msg,
    `${window.location.origin}/#/staff`
  );
};

// --- BULK OPS ---

const performBulkOp = async (
  assetIds: string[],
  updateObj: object,
  logActionFn: (id: string) => Promise<void>
) => {
  const batch = db.batch();
  assetIds.forEach((id) =>
    batch.update(db.collection(getColName("assets")).doc(id), updateObj)
  );
  await batch.commit();
  for (const id of assetIds) await logActionFn(id);
};

export const bulkAssignAssets = async (
  assetIds: string[],
  employeeName: string,
  docId?: string
) => {
  await performBulkOp(
    assetIds,
    {
      assignedEmployee: employeeName,
      status: "Active",
      lastUpdated: new Date().toISOString(),
    },
    (id) => logAction(id, "Assigned", `Assigned to ${employeeName}`, docId)
  );
};

export const bulkReturnAssets = async (assetIds: string[], docId?: string) => {
  await performBulkOp(
    assetIds,
    {
      assignedEmployee: "",
      status: "In Storage",
      lastUpdated: new Date().toISOString(),
    },
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
    { assignedEmployee: targetName, lastUpdated: new Date().toISOString() },
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
    const snap = await db.collection(prefix + colName).get();
    const batch = db.batch();
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

  const snapshot = await db
    .collection(getColName("assets"))
    .where(type, "==", oldValue)
    .get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.update(doc.ref, { [type]: newValue }));
  await batch.commit();
};
