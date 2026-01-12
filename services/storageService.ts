
/**
 * REFACTORED STORAGE SERVICE (BARREL)
 * This file re-exports everything from modular services to prevent breaking UI components.
 */

export * from "./firebase";
export * from "./authService";
export * from "./assetService";
export * from "./configService";
export * from "./workflowService";
export * from "./operationService";
export * from "./documentService";
export * from "../types";

import { db, getColName, snapToData } from "./firebase";
// Fixed firestore modular imports to ensure visibility in all environments
import { 
  collection, 
  doc, 
  getDocs, 
  limit, 
  onSnapshot, 
  orderBy, 
  query, 
  updateDoc, 
  where, 
  writeBatch 
} from "firebase/firestore";
import { AppNotification } from "../types";

// Notifications Listeners (Specific barrel logic for UI convenience)
export const listenToNotifications = (cb: (notifs: AppNotification[]) => void) => {
  // Relying on modular onSnapshot for real-time updates
  return onSnapshot(query(collection(db, getColName("notifications")), orderBy("timestamp", "desc"), limit(50)), (snap) => {
    cb(snapToData<AppNotification>(snap));
  });
};

export const markNotificationRead = async (id: string) => {
  await updateDoc(doc(db, getColName("notifications"), id), { read: true });
};

export const markAllNotificationsRead = async () => {
  const snap = await getDocs(query(collection(db, getColName("notifications")), where("read", "==", false)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
};

// DANGER ZONE (Legacy keep here for one-click cleanups)
export const resetDatabase = async () => {
  const collections = ["assets", "logs", "projects", "incidents", "requests", "invoices", "documents", "pendingHandovers", "notifications", "tasks"];
  const batch = writeBatch(db);
  for (const col of collections) {
    const snap = await getDocs(collection(db, getColName(col)));
    snap.docs.forEach((d) => batch.delete(d.ref));
  }
  await batch.commit();
};