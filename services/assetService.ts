
// Fix: Cleaned up modular imports from firebase/firestore to resolve symbol visibility issues
import { 
  addDoc, 
  collection, 
  deleteDoc, 
  doc, 
  getDocs, 
  onSnapshot, 
  orderBy, 
  query, 
  setDoc, 
  where, 
  writeBatch 
} from "firebase/firestore";
import { db, getColName, snapToData, sanitizeData } from "./firebase";
import { getCurrentUserProfile } from "./authService";
import { Asset, AssetLog, AssetStats } from "../types";

export const getAssets = async (): Promise<Asset[]> => {
  const snap = await getDocs(query(collection(db, getColName("assets")), orderBy("lastUpdated", "desc")));
  return snapToData<Asset>(snap);
};

export const listenToAssets = (cb: (assets: Asset[]) => void) => {
  return onSnapshot(query(collection(db, getColName("assets")), orderBy("lastUpdated", "desc")), (snap) => {
    cb(snapToData<Asset>(snap));
  });
};

export const saveAsset = async (asset: Asset) => {
  const isNew = !asset.id;
  const assetId = asset.id || `ast-${Math.random().toString(36).substr(2, 9)}`;
  const finalAsset = { ...asset, id: assetId, lastUpdated: new Date().toISOString() };
  await setDoc(doc(db, getColName("assets"), assetId), sanitizeData(finalAsset));

  try {
    await addDoc(collection(db, getColName("logs")), {
      assetId,
      action: isNew ? "Created" : "Updated",
      details: isNew ? `Asset ${asset.name} onboarded.` : `Asset ${asset.name} updated manually.`,
      performedBy: getCurrentUserProfile()?.email || "System",
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
  const q = query(collection(db, getColName("logs")), where("assetId", "==", assetId), orderBy("timestamp", "desc"));
  const snap = await getDocs(q);
  return snapToData<AssetLog>(snap);
};

export const getStats = (assets: Asset[]): AssetStats => {
  const stats: AssetStats = { totalValue: 0, totalAssets: assets.length, activeAssets: 0, repairAssets: 0, byCategory: [] };
  const catMap = new Map<string, number>();
  assets.forEach((a) => {
    const cost = a.purchaseCost || 0;
    stats.totalValue += cost;
    if (a.status === "Active") stats.activeAssets++;
    if (a.status === "Under Repair") stats.repairAssets++;
    catMap.set(a.category, (catMap.get(a.category) || 0) + cost);
  });
  stats.byCategory = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));
  return stats;
};

// Internal helpers for transactions
export const bulkAssignAssetsInternal = (batch: any, assetIds: string[], employeeName: string, docId: string, performer: string) => {
  if (!Array.isArray(assetIds)) return;
  const timestamp = new Date().toISOString();
  assetIds.forEach((id) => {
    if (!id) return;
    batch.update(doc(db, getColName("assets"), id), { assignedEmployee: employeeName, status: "Active", lastUpdated: timestamp });
    batch.set(doc(collection(db, getColName("logs"))), { assetId: id, action: "Assigned", details: `Assigned to ${employeeName}. Doc: ${docId}`, performedBy: performer, timestamp, documentId: docId });
  });
};

export const bulkReturnAssetsInternal = (batch: any, assetIds: string[], docId: string, performer: string) => {
  if (!Array.isArray(assetIds)) return;
  const timestamp = new Date().toISOString();
  assetIds.forEach((id) => {
    if (!id) return;
    batch.update(doc(db, getColName("assets"), id), { assignedEmployee: "", status: "In Storage", lastUpdated: timestamp });
    batch.set(doc(collection(db, getColName("logs"))), { assetId: id, action: "Returned", details: `Returned to storage. Doc: ${docId}`, performedBy: performer, timestamp, documentId: docId });
  });
};

export const bulkTransferAssetsInternal = (batch: any, assetIds: string[], targetName: string, docId: string, performer: string) => {
  if (!Array.isArray(assetIds)) return;
  const timestamp = new Date().toISOString();
  assetIds.forEach((id) => {
    if (!id) return;
    batch.update(doc(db, getColName("assets"), id), { assignedEmployee: targetName, lastUpdated: timestamp });
    batch.set(doc(collection(db, getColName("logs"))), { assetId: id, action: "Transferred", details: `Transferred to ${targetName}. Doc: ${docId}`, performedBy: performer, timestamp, documentId: docId });
  });
};

export const bulkAssignAssets = async (assetIds: string[], employeeName: string, docId: string) => {
  const batch = writeBatch(db);
  bulkAssignAssetsInternal(batch, assetIds, employeeName, docId, getCurrentUserProfile()?.email || "System");
  await batch.commit();
};

export const bulkReturnAssets = async (assetIds: string[], docId: string) => {
  const batch = writeBatch(db);
  bulkReturnAssetsInternal(batch, assetIds, docId, getCurrentUserProfile()?.email || "System");
  await batch.commit();
};

export const bulkTransferAssets = async (assetIds: string[], targetName: string, docId: string) => {
  const batch = writeBatch(db);
  bulkTransferAssetsInternal(batch, assetIds, targetName, docId, getCurrentUserProfile()?.email || "System");
  await batch.commit();
};
