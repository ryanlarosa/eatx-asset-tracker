export type AssetStatus =
  | "Active"
  | "In Storage"
  | "Under Repair"
  | "Retired"
  | "Lost/Stolen";
export const ASSET_STATUSES: AssetStatus[] = [
  "Active",
  "In Storage",
  "Under Repair",
  "Retired",
  "Lost/Stolen",
];

export type UserRole = "admin" | "technician" | "viewer" | "sandbox_user";

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
}

export interface EmailConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  targetEmail: string; // The IT Manager email that receives alerts
  enabled: boolean;
}

export interface AppNotification {
  id: string;
  type: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

export interface AssetLog {
  id: string;
  assetId: string;
  action:
    | "Created"
    | "Updated"
    | "Assigned"
    | "Returned"
    | "Transferred"
    | "Audit"
    | "Ticket"
    | "Replaced"
    | "Retired";
  details: string;
  performedBy: string;
  timestamp: string;
  documentId?: string; // Link to the signed PDF/Image
  ticketId?: string;
}

export interface HandoverDocument {
  id: string;
  employeeName: string;
  assets: { id: string; name: string; serialNumber: string }[];
  signatureBase64: string;
  itSignatureBase64?: string;
  date: string;
  type: "Handover" | "Return" | "Transfer";
  status?: "Pending" | "Completed"; // Track multi-step signing progress
}

export interface PendingHandover {
  id: string;
  employeeName: string;
  assetIds: string[];
  assetsSnapshot: { id: string; name: string; serialNumber: string }[];
  createdAt: string;
  createdBy: string;
  status: "Pending" | "Completed";
  type: "Handover" | "Return" | "Transfer";
  targetName?: string;
}

export interface IncidentReport {
  id: string;
  ticketNumber: string;
  assetId?: string;
  assetName: string; // Fallback if asset is generic or not in system
  deviceType?: string; // e.g. Laptop, iPad
  reportedSerial?: string; // Optional user input
  imageBase64?: string; // Evidence photo
  location: string;
  reportedBy: string; // Staff name
  reporterEmail?: string; // Email for updates
  description: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status:
    | "New"
    | "Open"
    | "In Progress"
    | "Waiting for Parts"
    | "Resolved"
    | "Rejected";
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

export interface AssetRequest {
  id: string;
  requestNumber: string;
  requesterName: string;
  requesterEmail?: string; // Email for updates
  department: string;
  category: string; // What they want (e.g. Laptop)
  urgency: "Low" | "Medium" | "High";
  reason: string;
  status:
    | "New"
    | "Acknowledged"
    | "Pending Finance"
    | "Approved"
    | "Deployed"
    | "Rejected";
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  linkedAssetId?: string; // If fulfilled with specific asset
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendor: string;
  date: string;
  amount: number;
  fileBase64?: string;
  fileName?: string;
  linkedAssetIds: string[];
  createdAt: string;
}

export interface Asset {
  id: string;
  name: string;
  description: string;
  category: string;
  status: AssetStatus;
  location: string;
  department?: string;
  assignedEmployee?: string;
  serialNumber: string;
  supplier?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  lastUpdated: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: "Pending" | "In Progress" | "Completed";
  priority: "Low" | "Medium" | "High";
  assignedTo?: string; // Name of IT staff
  dueDate?: string;
  createdAt: string;
  createdBy: string;
  checklist?: { id: string; text: string; done: boolean }[];
}

export interface AppConfig {
  categories: string[];
  locations: string[];
  departments: string[];
}

export interface AssetStats {
  totalValue: number;
  totalAssets: number;
  activeAssets: number;
  repairAssets: number;
  byCategory: { name: string; value: number }[];
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  estimatedCost: number;
  quantity?: number;
  status: "Pending" | "Ordered" | "Received";
  dueDate: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  status: "Planning" | "In Progress" | "Completed";
  items: ProjectItem[];
}
