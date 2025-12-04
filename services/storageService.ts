import { Asset, Project, ProjectItem, AppConfig, DatabaseSettings, FirebaseConfig } from '../types';
import { initializeApp, FirebaseApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, Firestore, initializeFirestore } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User, Auth } from 'firebase/auth';

const ASSET_KEY = 'eatx_assets_db';
const PROJECT_KEY = 'eatx_projects_db';
const CONFIG_KEY = 'eatx_config_db';
const DB_SETTINGS_KEY = 'eatx_db_settings';

// Default Config (Seeds)
const DEFAULT_CONFIG: AppConfig = {
  categories: [
    'POS Terminal',
    'Kitchen Display System',
    'Network & Wi-Fi',
    'Office IT (Laptops/Phones)',
    'Creative Media (Cameras/Audio)',
    'Camera & Security (CCTV)',
    'Printers & Scanners',
    'Furniture',
    'Other'
  ],
  locations: [
    'Head Office',
    'Downtown Branch',
    'JBR Branch',
    'Marina Storage',
    'Creative Studio'
  ]
};

// Seed Assets
const SEED_ASSETS: Asset[] = [
  {
    id: 'ast-001',
    name: 'Epson TM-T88V Receipt Printer',
    description: 'Thermal receipt printer for Main Bar',
    category: 'Printers & Scanners',
    status: 'Active',
    location: 'Downtown Branch',
    serialNumber: 'EP-8839201',
    purchaseDate: '2023-01-15',
    purchaseCost: 1100.00,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'ast-006',
    name: 'MacBook Air M2',
    description: 'Corporate laptop for HR Manager',
    category: 'Office IT (Laptops/Phones)',
    status: 'Active',
    location: 'Head Office',
    assignedEmployee: 'Sarah Jenkins',
    serialNumber: 'FVFG32J1',
    purchaseDate: '2023-09-01',
    purchaseCost: 4599.00,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'ast-009',
    name: 'Sony Alpha a7 IV',
    description: 'Main photography camera for Creative Team',
    category: 'Creative Media (Cameras/Audio)',
    status: 'Active',
    location: 'Creative Studio',
    assignedEmployee: 'Jessica Lee',
    serialNumber: 'SNY-22910',
    purchaseDate: '2023-11-01',
    purchaseCost: 9800.00,
    lastUpdated: new Date().toISOString()
  }
];

// Firebase Instance Cache
let firebaseApp: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let cachedConfig: AppConfig = DEFAULT_CONFIG;

// --- Database Connection Management ---

export const getDBSettings = (): DatabaseSettings => {
  const data = localStorage.getItem(DB_SETTINGS_KEY);
  if (!data) return { useFirebase: false };
  try {
    return JSON.parse(data);
  } catch (e) {
    return { useFirebase: false };
  }
};

export const saveDBSettings = (settings: DatabaseSettings) => {
  localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(settings));
  // Force reload to re-init
  window.location.reload();
};

export const resetConnectionSettings = () => {
    localStorage.removeItem(DB_SETTINGS_KEY);
    window.location.reload();
};

const initDB = () => {
  const settings = getDBSettings();
  if (settings.useFirebase && settings.firebaseConfig) {
    // Robust validation before attempting init
    if (!settings.firebaseConfig.apiKey) {
        console.error("Firebase config missing API Key. Auto-reverting to Local Storage mode.");
        localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify({ useFirebase: false }));
        return;
    }

    try {
      console.log("Attempting Firebase Init...");
      // Check if apps are already initialized to avoid duplicate init
      const apps = getApps();
      if (apps.length > 0) {
          firebaseApp = apps[0];
          console.log("Used existing Firebase App instance.");
      } else {
          firebaseApp = initializeApp(settings.firebaseConfig);
          console.log("Created new Firebase App instance.");
      }
      
      // Use standard getFirestore. The Import Map fix (switching to gstatic) ensures registration works.
      db = getFirestore(firebaseApp);
      console.log("Firestore initialized.");
      
      auth = getAuth(firebaseApp);
      console.log("Auth initialized.");
      
    } catch (e) {
      console.error("Failed to init firebase:", e);
      // Fallback: If init fails (e.g. invalid project ID), disable firebase for this session
      db = null;
      auth = null;
      
      // Auto-revert if critical failure to prevent lockout
      if (confirm("Failed to connect to Firebase (Init Error). Revert to Local Storage mode to access the app?")) {
        localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify({ useFirebase: false }));
        window.location.reload();
      }
    }
  }
};

// Initialize immediately
initDB();

// --- Auth Functions ---

export const loginUser = async (email: string, pass: string) => {
    if (!auth) throw new Error("Firebase not initialized. Check configuration.");
    return await signInWithEmailAndPassword(auth, email, pass);
};

export const logoutUser = async () => {
    if (!auth) return;
    return await signOut(auth);
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
    // Re-check settings here in case initDB reverted them
    const settings = getDBSettings();
    
    // If auth is null (init failed or local mode), handle gracefully
    if (!auth) {
        if (!settings.useFirebase) {
             // Local mode: Auto-login as admin
            callback({ email: 'local@admin.com' } as User); 
        } else {
            // Firebase mode wanted, but auth failed to load (e.g. network error or bad config that passed check)
            // Send null to trigger Login Screen which has the Reset button
            callback(null);
        }
        return () => {};
    }
    return onAuthStateChanged(auth, callback);
};

// --- Helper for Config Cache (Sync for Gemini, Async for UI) ---
export const getCachedConfigSync = (): AppConfig => {
    return cachedConfig;
}

// --- App Config Functions ---

export const getAppConfig = async (): Promise<AppConfig> => {
  const settings = getDBSettings();
  
  if (settings.useFirebase && db) {
     try {
       const snapshot = await getDocs(collection(db, 'settings')); 
       // Firestore simple fetch approach for single doc in collection
       let config: AppConfig | null = null;
       snapshot.forEach(doc => {
           if(doc.id === 'appConfig') config = doc.data() as AppConfig;
       });
       
       if (config) {
           cachedConfig = config;
           return config;
       } else {
           // Create default if not exists
           await setDoc(doc(db, 'settings', 'appConfig'), DEFAULT_CONFIG);
           cachedConfig = DEFAULT_CONFIG;
           return DEFAULT_CONFIG;
       }
     } catch (e) {
       console.error("Firebase config fetch error", e);
       return DEFAULT_CONFIG;
     }
  } else {
    // Local Storage
    const data = localStorage.getItem(CONFIG_KEY);
    if (!data) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(DEFAULT_CONFIG));
      cachedConfig = DEFAULT_CONFIG;
      return DEFAULT_CONFIG;
    }
    const parsed = JSON.parse(data);
    cachedConfig = parsed;
    return parsed;
  }
};

export const saveAppConfig = async (config: AppConfig): Promise<void> => {
  cachedConfig = config;
  const settings = getDBSettings();

  if (settings.useFirebase && db) {
    await setDoc(doc(db, 'settings', 'appConfig'), config);
  } else {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }
};

export const resetDatabase = async () => {
    // Danger: This only clears local for safety. Wiping Firebase requires more checks.
    const settings = getDBSettings();
    if(settings.useFirebase) {
        alert("Cannot wipe Firebase Cloud DB from this button for safety. Please delete collection manually in console.");
        return;
    }
    localStorage.removeItem(ASSET_KEY);
    localStorage.removeItem(PROJECT_KEY);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(DEFAULT_CONFIG));
    window.location.reload();
};

// --- Asset Functions ---

export const getAssets = async (): Promise<Asset[]> => {
  const settings = getDBSettings();
  
  if (settings.useFirebase && db) {
    try {
        const snapshot = await getDocs(collection(db, 'assets'));
        const assets: Asset[] = [];
        snapshot.forEach(doc => assets.push(doc.data() as Asset));
        return assets;
    } catch (e) {
        console.error("Error fetching assets from firebase", e);
        return [];
    }
  } else {
    const data = localStorage.getItem(ASSET_KEY);
    if (!data) {
      localStorage.setItem(ASSET_KEY, JSON.stringify(SEED_ASSETS));
      return SEED_ASSETS;
    }
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error("Failed to parse assets from local storage", e);
        return [];
    }
  }
};

export const saveAsset = async (asset: Asset): Promise<void> => {
  const settings = getDBSettings();

  if (settings.useFirebase && db) {
      await setDoc(doc(db, 'assets', asset.id), {
          ...asset,
          lastUpdated: new Date().toISOString()
      });
  } else {
    const assets = await getAssets();
    const existingIndex = assets.findIndex(a => a.id === asset.id);
    let newAssets;
    if (existingIndex >= 0) {
      newAssets = [...assets];
      newAssets[existingIndex] = { ...asset, lastUpdated: new Date().toISOString() };
    } else {
      newAssets = [asset, ...assets];
    }
    localStorage.setItem(ASSET_KEY, JSON.stringify(newAssets));
  }
};

export const deleteAsset = async (id: string): Promise<void> => {
  console.log("StorageService: Deleting asset", id);
  const settings = getDBSettings();
  if (settings.useFirebase && db) {
      await deleteDoc(doc(db, 'assets', id));
  } else {
    // Force sync fetch for local storage manipulation to ensure consistency
    const data = localStorage.getItem(ASSET_KEY);
    const assets = data ? JSON.parse(data) : [];
    const newAssets = assets.filter((a: Asset) => a.id !== id);
    localStorage.setItem(ASSET_KEY, JSON.stringify(newAssets));
  }
  console.log("StorageService: Asset deleted");
};

export const importAssetsFromCSV = async (newAssets: Asset[]): Promise<void> => {
    const settings = getDBSettings();
    if (settings.useFirebase && db) {
        // Batch write would be better but doing parallel for simplicity
        await Promise.all(newAssets.map(a => setDoc(doc(db!, 'assets', a.id), a)));
    } else {
        const current = await getAssets();
        const combined = [...newAssets, ...current];
        localStorage.setItem(ASSET_KEY, JSON.stringify(combined));
    }
};

export const getStats = (assets: Asset[]) => {
  const config = getCachedConfigSync(); // Use sync cache for stats to avoid unnecessary async complexity in pure math
  
  const categoryCounts = config.categories.map(cat => ({
    name: cat,
    value: assets.filter(a => a.category === cat).length
  })).filter(c => c.value > 0);

  const knownCategories = new Set(config.categories);
  const otherCount = assets.filter(a => !knownCategories.has(a.category)).length;
  if (otherCount > 0) {
    categoryCounts.push({ name: 'Other', value: otherCount });
  }

  return {
    totalValue: assets.reduce((sum, a) => sum + (a.purchaseCost || 0), 0),
    totalAssets: assets.length,
    activeAssets: assets.filter(a => a.status === 'Active').length,
    repairAssets: assets.filter(a => a.status === 'Under Repair').length,
    byCategory: categoryCounts
  };
};

// --- Project Functions ---

export const getProjects = async (): Promise<Project[]> => {
  const settings = getDBSettings();

  if (settings.useFirebase && db) {
      try {
        const snapshot = await getDocs(collection(db, 'projects'));
        const projects: Project[] = [];
        snapshot.forEach(doc => projects.push(doc.data() as Project));
        return projects;
      } catch (e) {
          return [];
      }
  } else {
    const data = localStorage.getItem(PROJECT_KEY);
    if (!data) return [];
    return JSON.parse(data);
  }
};

export const saveProject = async (project: Project): Promise<void> => {
  const settings = getDBSettings();

  if (settings.useFirebase && db) {
      await setDoc(doc(db, 'projects', project.id), project);
  } else {
    // Fetch directly from LS to avoid stale closures in a quick sequence
    const data = localStorage.getItem(PROJECT_KEY);
    const projects: Project[] = data ? JSON.parse(data) : [];
    
    const existingIndex = projects.findIndex(p => p.id === project.id);
    let newProjects;
    if (existingIndex >= 0) {
      newProjects = [...projects];
      newProjects[existingIndex] = project;
    } else {
      newProjects = [project, ...projects];
    }
    localStorage.setItem(PROJECT_KEY, JSON.stringify(newProjects));
  }
};

export const deleteProject = async (id: string): Promise<void> => {
  const settings = getDBSettings();
  if (settings.useFirebase && db) {
      await deleteDoc(doc(db, 'projects', id));
  } else {
    const data = localStorage.getItem(PROJECT_KEY);
    const projects = data ? JSON.parse(data) : [];
    const newProjects = projects.filter((p: Project) => p.id !== id);
    localStorage.setItem(PROJECT_KEY, JSON.stringify(newProjects));
  }
};

// --- Notification Helpers ---
export const getOverdueItems = async (): Promise<{project: string, item: ProjectItem}[]> => {
  const projects = await getProjects();
  const today = new Date();
  const notifications: {project: string, item: ProjectItem}[] = [];

  projects.forEach(p => {
    if (p.status !== 'Completed') {
      p.items.forEach(i => {
        if (i.status !== 'Received') {
          const dueDate = new Date(i.dueDate);
          const diffTime = dueDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 7) {
            notifications.push({
              project: p.name,
              item: i
            });
          }
        }
      });
    }
  });
  return notifications;
};