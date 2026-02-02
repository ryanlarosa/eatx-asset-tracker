// Fixed firestore modular imports to resolve naming and visibility issues in the build environment
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
  writeBatch,
} from "firebase/firestore";
import {
  db,
  getColName,
  snapToData,
  sanitizeData,
  createNotification,
} from "./firebase";
import { getCurrentUserProfile } from "./authService";
import {
  bulkAssignAssetsInternal,
  bulkTransferAssetsInternal,
} from "./assetService";
import { Asset, HandoverDocument, PendingHandover } from "../types";

export const getHandoverDocuments = async (): Promise<HandoverDocument[]> => {
  const snap = await getDocs(
    query(collection(db, getColName("documents")), orderBy("date", "desc")),
  );
  return snapToData<HandoverDocument>(snap);
};

export const saveHandoverDocument = async (docData: HandoverDocument) => {
  await setDoc(
    doc(db, getColName("documents"), docData.id),
    sanitizeData(docData),
  );
};

export const listenToPendingHandovers = (
  cb: (pending: PendingHandover[]) => void,
) => {
  return onSnapshot(
    query(
      collection(db, getColName("pendingHandovers")),
      where("status", "==", "Pending"),
    ),
    (snap) => {
      cb(snapToData<PendingHandover>(snap));
    },
  );
};

export const createPendingHandover = async (
  employeeName: string,
  assets: Asset[],
  type: "Handover" | "Return" | "Transfer",
  targetName?: string,
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
    createdBy: getCurrentUserProfile()?.email || "System",
    status: "Pending",
    type,
    targetName,
  };
  await setDoc(
    doc(db, getColName("pendingHandovers"), id),
    sanitizeData(pending),
  );
  return id;
};

export const getPendingHandover = async (id: string) => {
  const snap = await getDoc(doc(db, getColName("pendingHandovers"), id));
  return snap.exists() ? (snap.data() as PendingHandover) : null;
};

export const deletePendingHandover = async (id: string) =>
  deleteDoc(doc(db, getColName("pendingHandovers"), id));

export const completePendingHandover = async (
  id: string,
  signature: string,
) => {
  const snap = await getDoc(doc(db, getColName("pendingHandovers"), id));
  if (!snap.exists())
    throw new Error(
      "This signing link is no longer valid or has been revoked.",
    );

  const data = snap.data() as PendingHandover;
  const docId = `doc-${Math.random().toString(36).substr(2, 9)}`;
  const assetIds =
    data.assetIds ||
    (data.assetsSnapshot ? data.assetsSnapshot.map((a) => a.id) : []);

  // Check if current user is IT staff
  const user = getCurrentUserProfile();
  const hasInventoryPrivileges =
    user?.role === "admin" ||
    user?.role === "technician" ||
    user?.role === "sandbox_user";

  // Strategy: Try the full transaction. If it fails (likely permissions), fallback to just the signature doc.
  const handoverDoc: HandoverDocument = {
    id: docId,
    employeeName: data.employeeName,
    assets: data.assetsSnapshot,
    signatureBase64: signature,
    date: new Date().toISOString(),
    type: data.type,
    // If not authenticated IT staff, mark as Pending for IT to finalize later
    status:
      data.type === "Return" || !hasInventoryPrivileges
        ? "Pending"
        : "Completed",
  };

  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, getColName("documents"), docId),
      sanitizeData(handoverDoc),
    );
    batch.update(doc(db, getColName("pendingHandovers"), id), {
      status: "Completed",
    });

    // Only attempt inventory update if user has privileges
    if (hasInventoryPrivileges && assetIds.length > 0) {
      if (data.type === "Handover") {
        bulkAssignAssetsInternal(
          batch,
          assetIds,
          data.employeeName,
          docId,
          "User Signed",
        );
      } else if (data.type === "Transfer" && data.targetName) {
        bulkTransferAssetsInternal(
          batch,
          assetIds,
          data.targetName,
          docId,
          "User Signed",
        );
      }
    }

    await batch.commit();
  } catch (error: any) {
    // FALLBACK: If batch fails due to permissions on 'assets' or 'logs'
    if (error.code === "permission-denied") {
      console.warn(
        "Inventory update blocked by rules. Falling back to signature storage only.",
      );
      // Try to save just the document and mark the link as completed
      // This ensures the employee sees success, while IT Manager finishes the registry update later
      await setDoc(doc(db, getColName("documents"), docId), {
        ...sanitizeData(handoverDoc),
        status: "Pending",
      });
      await updateDoc(doc(db, getColName("pendingHandovers"), id), {
        status: "Completed",
      });
    } else {
      throw error;
    }
  }

  await createNotification(
    "success",
    "Signature Received",
    `${data.employeeName} signed for ${data.assetsSnapshot.length} items.`,
    "/staff",
  );
};
