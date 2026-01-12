
// Fixed firestore modular imports to ensure visibility of all required functions
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db, getColName, snapToData, sanitizeData, createNotification } from "./firebase";
import { sendSystemEmail } from "./configService";
import { getCurrentUserProfile } from "./authService";
import { AssetRequest, IncidentReport, PublicStatusResult } from "../types";

// --- REQUESTS ---

export const listenToRequests = (cb: (reqs: AssetRequest[]) => void) => {
  return onSnapshot(query(collection(db, getColName("requests")), orderBy("createdAt", "desc")), (snap) => {
    cb(snapToData<AssetRequest>(snap));
  });
};

export const createAssetRequest = async (req: Partial<AssetRequest>) => {
  const requestNumber = `REQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const newReq = { ...req, requestNumber, status: "New", createdAt: new Date().toISOString() };
  await addDoc(collection(db, getColName("requests")), sanitizeData(newReq));

  try {
    await createNotification("info", "IT Hub: New Request", `${req.requesterName} requested ${req.category}.`, "/requests");
    await sendSystemEmail("IT Hub: New Asset Request", `${req.requesterName} requested ${req.category}. Ref: ${requestNumber}`, window.location.origin + "/#/requests");
    if (req.requesterEmail) {
      await sendSystemEmail("Request Received: EatX IT Hub", `Hi ${req.requesterName}, your request for ${req.category} is logged. Ref: ${requestNumber}`, window.location.origin + "/#/track", req.requesterEmail, true);
    }
  } catch (e) {}
};

export const updateAssetRequest = async (id: string, updates: Partial<AssetRequest>) => {
  await updateDoc(doc(db, getColName("requests"), id), sanitizeData(updates));
};

export const fulfillAssetRequest = async (requestId: string, assetId: string, notes: string, employeeName: string) => {
  const batch = writeBatch(db);
  const ts = new Date().toISOString();
  batch.update(doc(db, getColName("requests"), requestId), { status: "Deployed", linkedAssetId: assetId, resolutionNotes: notes, resolvedAt: ts });
  batch.update(doc(db, getColName("assets"), assetId), { status: "Active", assignedEmployee: employeeName, lastUpdated: ts });
  batch.set(doc(collection(db, getColName("logs"))), { assetId, action: "Assigned", details: `Fulfillment: ${requestId}`, performedBy: getCurrentUserProfile()?.email || "System", timestamp: ts });
  await batch.commit();
};

// --- INCIDENTS ---

export const listenToIncidents = (cb: (tickets: IncidentReport[]) => void) => {
  return onSnapshot(query(collection(db, getColName("incidents")), orderBy("createdAt", "desc")), (snap) => {
    cb(snapToData<IncidentReport>(snap));
  });
};

export const createIncidentReport = async (report: Partial<IncidentReport>) => {
  const ticketNumber = `TKT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const newReport = { ...report, ticketNumber, status: "New", createdAt: new Date().toISOString() };
  await addDoc(collection(db, getColName("incidents")), sanitizeData(newReport));

  try {
    await createNotification("warning", "IT Hub: New Incident", `${report.reportedBy} reported issue at ${report.location}.`, "/repairs");
    await sendSystemEmail("IT Hub: New Incident Report", `${report.reportedBy} reported: ${report.description}. Ref: ${ticketNumber}`, window.location.origin + "/#/repairs");
    if (report.reporterEmail) {
      await sendSystemEmail("Incident Reported: EatX IT Hub", `Hi ${report.reportedBy}, your issue at ${report.location} is logged. Ref: ${ticketNumber}`, window.location.origin + "/#/track", report.reporterEmail, true);
    }
  } catch (e) {}
};

export const updateIncidentReport = async (id: string, updates: Partial<IncidentReport>, updateAssetStatus: boolean = false) => {
  await updateDoc(doc(db, getColName("incidents"), id), sanitizeData(updates));
  if (updateAssetStatus && updates.status === "Resolved") {
    const snap = await getDoc(doc(db, getColName("incidents"), id));
    const data = snap.data() as IncidentReport;
    if (data.assetId) {
      await updateDoc(doc(db, getColName("assets"), data.assetId), { status: "Active", lastUpdated: new Date().toISOString() });
    }
  }
};

export const processAssetReplacement = async (ticketId: string, oldAssetId: string, newAssetId: string, notes: string) => {
  const batch = writeBatch(db);
  const ts = new Date().toISOString();
  const ticketSnap = await getDoc(doc(db, getColName("incidents"), ticketId));
  const tData = ticketSnap.data() as IncidentReport;

  batch.update(doc(db, getColName("assets"), oldAssetId), { status: "Retired", lastUpdated: ts, assignedEmployee: "" });
  batch.update(doc(db, getColName("assets"), newAssetId), { status: "Active", location: tData.location, assignedEmployee: tData.reportedBy || "", lastUpdated: ts });
  batch.update(doc(db, getColName("incidents"), ticketId), { status: "Resolved", resolvedAt: ts, resolutionNotes: `Replaced with ${newAssetId}. ${notes}` });
  
  const perf = getCurrentUserProfile()?.email || "System";
  batch.set(doc(collection(db, getColName("logs"))), { assetId: oldAssetId, action: "Retired", details: `Replaced in ${tData.ticketNumber}`, performedBy: perf, timestamp: ts });
  batch.set(doc(collection(db, getColName("logs"))), { assetId: newAssetId, action: "Replaced", details: `Replacement in ${tData.ticketNumber}`, performedBy: perf, timestamp: ts });
  await batch.commit();
};

export const getPublicItemStatus = async (refId: string): Promise<PublicStatusResult | null> => {
  const tSnap = await getDocs(query(collection(db, getColName("incidents")), where("ticketNumber", "==", refId)));
  if (!tSnap.empty) {
    const d = tSnap.docs[0].data() as IncidentReport;
    return { id: d.ticketNumber, type: "Ticket", status: d.status, subject: d.assetName, details: d.description, created: d.createdAt, updated: d.resolvedAt, notes: d.resolutionNotes };
  }
  const rSnap = await getDocs(query(collection(db, getColName("requests")), where("requestNumber", "==", refId)));
  if (!rSnap.empty) {
    const d = rSnap.docs[0].data() as AssetRequest;
    return { id: d.requestNumber, type: "Request", status: d.status, subject: d.category, details: d.reason, created: d.createdAt, updated: d.resolvedAt, notes: d.resolutionNotes };
  }
  return null;
};