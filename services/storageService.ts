
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

import { db, getColName, snapToData, handleFirestoreError, OperationType } from "./firebase";
// Fix: Grouped modular imports from firebase/firestore on a single block to improve symbol visibility in the build environment
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
  const path = getColName("notifications");
  return onSnapshot(query(collection(db, path), orderBy("timestamp", "desc"), limit(50)), (snap) => {
    cb(snapToData<AppNotification>(snap));
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const markNotificationRead = async (id: string) => {
  const path = getColName("notifications");
  try {
    await updateDoc(doc(db, path, id), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const markAllNotificationsRead = async () => {
  const path = getColName("notifications");
  try {
    const snap = await getDocs(query(collection(db, path), where("read", "==", false)));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// DANGER ZONE (Legacy keep here for one-click cleanups)
export const resetDatabase = async () => {
  const collections = ["assets", "logs", "projects", "incidents", "requests", "invoices", "documents", "pendingHandovers", "notifications", "tasks"];
  const batch = writeBatch(db);
  try {
    for (const col of collections) {
      const snap = await getDocs(collection(db, getColName(col)));
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, "multiple_collections");
  }
};
