
export type AssetStatus = 'Active' | 'In Storage' | 'Under Repair' | 'Retired' | 'Lost/Stolen';
export const ASSET_STATUSES: AssetStatus[] = ['Active', 'In Storage', 'Under Repair', 'Retired', 'Lost/Stolen'];

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

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface DatabaseSettings {
  useFirebase: boolean;
  firebaseConfig?: FirebaseConfig;
}

export interface AssetStats {
  totalValue: number;
  totalAssets: number;
  activeAssets: number;
  repairAssets: number;
  byCategory: { name: string; value: number }[];
}

export type ProjectStatus = 'Planning' | 'In Progress' | 'Completed';
export type ProjectItemStatus = 'Pending' | 'Ordered' | 'Received';

export interface ProjectItem {
  id: string;
  name: string;
  category: string;
  estimatedCost: number;
  status: ProjectItemStatus;
  dueDate: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  status: ProjectStatus;
  items: ProjectItem[];
}