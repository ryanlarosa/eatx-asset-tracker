
export type AssetStatus = 'Active' | 'In Storage' | 'Under Repair' | 'Retired' | 'Lost/Stolen';
export const ASSET_STATUSES: AssetStatus[] = ['Active', 'In Storage', 'Under Repair', 'Retired', 'Lost/Stolen'];

export type UserRole = 'admin' | 'technician' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
}

export interface AssetLog {
  id: string;
  assetId: string;
  action: 'Created' | 'Updated' | 'Assigned' | 'Returned' | 'Transferred' | 'Audit';
  details: string;
  performedBy: string;
  timestamp: string;
}

export interface HandoverDocument {
  id: string;
  employeeName: string;
  assets: { id: string; name: string; serialNumber: string }[];
  signatureBase64: string;
  date: string;
  type: 'Handover' | 'Return';
}

export interface PendingHandover {
  id: string;
  employeeName: string;
  assetIds: string[];
  assetsSnapshot: { id: string; name: string; serialNumber: string }[];
  createdAt: string;
  createdBy: string;
  status: 'Pending' | 'Completed';
}

export interface Asset {
  id: string;
  name: string;
  description: string;
  category: string;
  status: AssetStatus;
  location: string;
  assignedEmployee?: string;
  serialNumber: string;
  purchaseDate: string;
  purchaseCost: number;
  lastUpdated: string;
}

export interface AppConfig {
  categories: string[];
  locations: string[];
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
  category: string;
  estimatedCost: number;
  status: 'Pending' | 'Ordered' | 'Received';
  dueDate: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  status: 'Planning' | 'In Progress' | 'Completed';
  items: ProjectItem[];
}
