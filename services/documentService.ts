
// Fix: Cleaned up modular imports from firebase/firestore and grouped them for better resolution
import { 
  collection, 
  deleteDoc, 
  doc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  orderBy, 
  query, 
  setDoc, 
  updateDoc, 
  where, 
  writeBatch 
} from "firebase/firestore";
import { db, getColName, snapToData, sanitizeData, createNotification, handleFirestoreError, OperationType } from "./firebase";
import { getCurrentUserProfile } from "./authService";
import { bulkAssignAssetsInternal, bulkTransferAssetsInternal, bulkReturnAssetsInternal } from "./assetService";
import { Asset, HandoverDocument, PendingHandover } from "../types";

export const getHandoverDocuments = async (): Promise<HandoverDocument[]> => {
  const path = getColName("documents");
  try {
    const snap = await getDocs(query(collection(db, path), orderBy("date", "desc")));
    return snapToData<HandoverDocument>(snap);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export const saveHandoverDocument = async (docData: HandoverDocument) => {
  const path = getColName("documents");
  try {
    await setDoc(doc(db, path, docData.id), sanitizeData(docData));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const listenToPendingHandovers = (cb: (pending: PendingHandover[]) => void) => {
  const path = getColName("pendingHandovers");
  return onSnapshot(query(collection(db, path), where("status", "==", "Pending")), (snap) => {
    cb(snapToData<PendingHandover>(snap));
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const createPendingHandover = async (employeeName: string, assets: Asset[], type: "Handover" | "Return" | "Transfer", targetName?: string) => {
  const id = `pending-${Math.random().toString(36).substr(2, 9)}`;
  const pending = { id, employeeName, assetIds: assets.map((a) => a.id), assetsSnapshot: assets.map((a) => ({ id: a.id, name: a.name, serialNumber: a.serialNumber })), createdAt: new Date().toISOString(), createdBy: getCurrentUserProfile()?.email || "System", status: "Pending", type, targetName };
  const path = getColName("pendingHandovers");
  try {
    await setDoc(doc(db, path, id), sanitizeData(pending));
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return "";
  }
};

export const getPendingHandover = async (id: string) => {
  const path = getColName("pendingHandovers");
  try {
    const snap = await getDoc(doc(db, path, id));
    return snap.exists() ? (snap.data() as PendingHandover) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const deletePendingHandover = async (id: string) => {
  const path = getColName("pendingHandovers");
  try {
    await deleteDoc(doc(db, path, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const completePendingHandover = async (id: string, signature: string) => {
  const path = getColName("pendingHandovers");
  let snap;
  try {
    snap = await getDoc(doc(db, path, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return;
  }
  if (!snap.exists()) throw new Error("This signing link is no longer valid or has been revoked.");
  
  const data = snap.data() as PendingHandover;
  const docId = `doc-${Math.random().toString(36).substr(2, 9)}`;
  const assetIds = data.assetIds || (data.assetsSnapshot ? data.assetsSnapshot.map(a => a.id) : []);

  // Per user request: Once they sign, it's done. Status is immediately 'Completed'.
  const handoverDoc: HandoverDocument = { 
    id: docId, 
    employeeName: data.employeeName, 
    assets: data.assetsSnapshot, 
    signatureBase64: signature, 
    date: new Date().toISOString(), 
    type: data.type, 
    status: "Completed" 
  };
  
  // 1. Critical Updates: Save document and mark pending as completed
  const criticalBatch = writeBatch(db);
  criticalBatch.set(doc(db, getColName("documents"), docId), sanitizeData(handoverDoc));
  criticalBatch.update(doc(db, getColName("pendingHandovers"), id), { status: "Completed" });
  
  try {
    await criticalBatch.commit();
  } catch (criticalErr: any) {
    console.error("Critical batch failed:", criticalErr);
    throw new Error(`Critical Error: ${criticalErr.message || "Could not save signature."}`);
  }
  
  // 2. Secondary Updates: Asset Registry (Might fail due to permissions for public users)
  if (assetIds.length > 0) {
    const registryBatch = writeBatch(db);
    if (data.type === "Handover") {
      bulkAssignAssetsInternal(registryBatch, assetIds, data.employeeName, docId, "Staff Signed");
    } else if (data.type === "Transfer" && data.targetName) {
      bulkTransferAssetsInternal(registryBatch, assetIds, data.targetName, docId, "Staff Signed");
    } else if (data.type === "Return") {
      bulkReturnAssetsInternal(registryBatch, assetIds, docId, "Staff Signed");
    }
    
    try {
      await registryBatch.commit();
    } catch (registryErr: any) {
      console.warn("Registry update failed (likely permissions):", registryErr);
      // We don't throw here because the signature is already saved.
      // But we should notify the admin that the registry needs manual sync.
      await createNotification("warning", "Registry Sync Failed", `Signature received from ${data.employeeName}, but asset registry could not be updated automatically. Manual update required.`, "/staff");
    }
  }
  
  await createNotification("success", "Signature Received", `${data.employeeName} signed for ${data.assetsSnapshot.length} items. Transaction finalized.`, "/staff");
};
