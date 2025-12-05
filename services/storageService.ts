
import { Asset, Project, ProjectItem, AppConfig, AssetStats, UserProfile, UserRole, AssetLog, HandoverDocument, PendingHandover } from '../types';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, getDoc, Firestore, query, where, orderBy, addDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, Auth } from 'firebase/auth';

// --- ENV Configuration ---
const env = (import.meta as any).env || {};

const fallbackConfig = {
  apiKey: "AIzaSyAK1PFmG5-uawZ2-QkCExJAIj3ovr5Gc8k",
  authDomain: "assettrack-626da.firebaseapp.com",
  projectId: "assettrack-626da",
  storageBucket: "assettrack-626da.firebasestorage.app",
  messagingSenderId: "833915106836",
  appId: "1:833915106836:web:24f97e6161f3d5ef5f9901",
  measurementId: "G-T7N92CG779"
};

const firebaseConfig = env.VITE_FIREBASE_API_KEY ? {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
} : fallbackConfig;

const DEFAULT_CONFIG: AppConfig = {
  categories: [
    'POS Terminal', 'Kitchen Display System', 'Network & Wi-Fi',
    'Office IT (Laptops/Phones)', 'Creative Media (Cameras/Audio)',
    'Camera & Security (CCTV)', 'Printers & Scanners', 'Furniture', 'Other'
  ],
  locations: [
    'Head Office', 'Downtown Branch', 'JBR Branch', 'Marina Storage', 'Creative Studio'
  ]
};

let db: Firestore | undefined;
let auth: Auth | undefined;
let currentUserProfile: UserProfile | null = null;
let cachedConfig: AppConfig = DEFAULT_CONFIG;

export const checkEnvStatus = () => {
    if (firebaseConfig.apiKey) {
        return { 
            ok: true, 
            message: env.VITE_FIREBASE_API_KEY ? "System Online (Secure ENV)" : "System Online (Fallback Mode)" 
        };
    }
    return { ok: false, message: "Configuration Failed" };
};

try {
    if (firebaseConfig.apiKey) {
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        db = getFirestore(app);
        auth = getAuth(app);
        console.log(`Firebase initialized successfully via ${env.VITE_FIREBASE_API_KEY ? 'ENV' : 'Fallback Config'}`);
    } else {
        console.warn("Firebase Config missing.");
    }
} catch (e) {
    console.error("Firebase Init Error:", e);
}

// --- Auth ---

export const loginUser = async (email: string, pass: string) => {
    if (!auth) throw new Error("Firebase not initialized.");
    return await signInWithEmailAndPassword(auth, email, pass);
};

export const logoutUser = async () => {
    if (!auth) return;
    currentUserProfile = null;
    return await signOut(auth);
};

export const getCurrentUserProfile = () => currentUserProfile;

export const subscribeToAuth = (callback: (user: UserProfile | null) => void) => {
    if (!auth || !db) {
        callback(null);
        return () => {};
    }
    return onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
            currentUserProfile = null;
            callback(null);
            return;
        }
        try {
            const userRef = doc(db!, 'users', firebaseUser.uid);
            const userSnap = await getDoc(userRef);
            const userEmail = firebaseUser.email?.toLowerCase() || '';
            const isSuperAdmin = userEmail === 'it@eatx.com' || userEmail.includes('admin');

            if (userSnap.exists()) {
                const data = userSnap.data() as UserProfile;
                if (isSuperAdmin && data.role !== 'admin') {
                    await updateDoc(userRef, { role: 'admin' });
                    data.role = 'admin';
                } else if (!data.role) {
                    await updateDoc(userRef, { role: 'viewer' });
                    data.role = 'viewer';
                }
                currentUserProfile = data;
            } else {
                const newProfile: UserProfile = {
                    uid: firebaseUser.uid,
                    email: userEmail,
                    role: isSuperAdmin ? 'admin' : 'viewer',
                    displayName: userEmail.split('@')[0]
                };
                await setDoc(userRef, newProfile);
                currentUserProfile = newProfile;
            }
            callback(currentUserProfile);
        } catch (e) {
            callback(null);
        }
    });
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
    if (!db) return [];
    const snapshot = await getDocs(collection(db, 'users'));
    const users: UserProfile[] = [];
    snapshot.forEach(doc => users.push(doc.data() as UserProfile));
    return users;
};

export const updateUserRole = async (uid: string, newRole: UserRole): Promise<void> => {
    if (!db) return;
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { role: newRole });
};

// --- Config ---
export const getCachedConfigSync = (): AppConfig => cachedConfig;

export const getAppConfig = async (): Promise<AppConfig> => {
     if (!db) return DEFAULT_CONFIG;
     try {
       const snapshot = await getDocs(collection(db, 'settings')); 
       let config: AppConfig | null = null;
       snapshot.forEach(doc => {
           if(doc.id === 'appConfig') config = doc.data() as AppConfig;
       });
       if (config) {
           cachedConfig = config;
           return config;
       } else {
           await setDoc(doc(db, 'settings', 'appConfig'), DEFAULT_CONFIG);
           cachedConfig = DEFAULT_CONFIG;
           return DEFAULT_CONFIG;
       }
     } catch (e) {
       return DEFAULT_CONFIG;
     }
};

export const saveAppConfig = async (config: AppConfig): Promise<void> => {
  if (!db) return;
  cachedConfig = config;
  await setDoc(doc(db, 'settings', 'appConfig'), config);
};

// --- Logs ---
export const addAssetLog = async (assetId: string, action: AssetLog['action'], details: string) => {
    if (!db) return;
    const log: AssetLog = {
        id: 'log-' + Math.random().toString(36).substr(2, 9),
        assetId,
        action,
        details,
        performedBy: currentUserProfile?.email || 'System',
        timestamp: new Date().toISOString()
    };
    await setDoc(doc(db, 'logs', log.id), log);
};

export const getAssetLogs = async (assetId: string): Promise<AssetLog[]> => {
    if (!db) return [];
    try {
        const q = query(collection(db, 'logs'), where('assetId', '==', assetId));
        const snapshot = await getDocs(q);
        const logs: AssetLog[] = [];
        snapshot.forEach(doc => logs.push(doc.data() as AssetLog));
        return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (e) {
        console.error("Error fetching logs", e);
        return [];
    }
};

// --- Pending Handovers (Remote Signing) ---
export const createPendingHandover = async (employeeName: string, assets: Asset[]): Promise<string> => {
    if (!db) throw new Error("DB offline");
    const id = 'ph-' + Math.random().toString(36).substr(2, 9);
    const pending: PendingHandover = {
        id,
        employeeName,
        assetIds: assets.map(a => a.id),
        assetsSnapshot: assets.map(a => ({ id: a.id, name: a.name, serialNumber: a.serialNumber })),
        createdAt: new Date().toISOString(),
        createdBy: currentUserProfile?.email || 'Unknown',
        status: 'Pending'
    };
    await setDoc(doc(db, 'pendingHandovers', id), pending);
    return id;
};

export const getPendingHandover = async (id: string): Promise<PendingHandover | null> => {
    if (!db) return null;
    const ref = doc(db, 'pendingHandovers', id);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() as PendingHandover : null;
};

export const completePendingHandover = async (pendingId: string, signatureBase64: string): Promise<void> => {
    if (!db) return;
    const pending = await getPendingHandover(pendingId);
    if (!pending || pending.status !== 'Pending') throw new Error("Invalid or expired link");

    // 1. Save Document
    const docData: HandoverDocument = {
        id: 'doc-' + Math.random().toString(36).substr(2, 9),
        employeeName: pending.employeeName,
        assets: pending.assetsSnapshot,
        signatureBase64,
        date: new Date().toISOString(),
        type: 'Handover'
    };
    await setDoc(doc(db, 'documents', docData.id), docData);

    // 2. Assign Assets
    await Promise.all(pending.assetIds.map(async (id) => {
        const assetRef = doc(db!, 'assets', id);
        await updateDoc(assetRef, { 
            assignedEmployee: pending.employeeName, 
            status: 'Active',
            lastUpdated: new Date().toISOString()
        });
        await addAssetLog(id, 'Assigned', `Assigned to ${pending.employeeName} (Remote Sign)`);
    }));

    // 3. Update Pending Status
    await updateDoc(doc(db, 'pendingHandovers', pendingId), { status: 'Completed' });
};

// --- Handover Documents ---
export const saveHandoverDocument = async (docData: HandoverDocument): Promise<void> => {
    if (!db) return;
    await setDoc(doc(db, 'documents', docData.id), docData);
};

export const getHandoverDocuments = async (employeeName?: string): Promise<HandoverDocument[]> => {
    if (!db) return [];
    try {
        const q = employeeName 
            ? query(collection(db, 'documents'), where('employeeName', '==', employeeName))
            : query(collection(db, 'documents'), orderBy('date', 'desc'));
        
        const snapshot = await getDocs(q);
        const docs: HandoverDocument[] = [];
        snapshot.forEach(doc => docs.push(doc.data() as HandoverDocument));
        return docs;
    } catch (e) {
        return [];
    }
};

// --- Assets ---

export const getAssets = async (): Promise<Asset[]> => {
    if (!db) return [];
    try {
        const snapshot = await getDocs(collection(db, 'assets'));
        const assets: Asset[] = [];
        snapshot.forEach(doc => assets.push(doc.data() as Asset));
        return assets;
    } catch (e) {
        return [];
    }
};

export const saveAsset = async (asset: Asset): Promise<void> => {
    if (!db) return;
    const isNew = !asset.lastUpdated;
    await setDoc(doc(db, 'assets', asset.id), {
        ...asset,
        lastUpdated: new Date().toISOString()
    });
    
    if (isNew) {
        await addAssetLog(asset.id, 'Created', `Asset created: ${asset.name}`);
    } else {
        await addAssetLog(asset.id, 'Updated', `Asset details updated`);
    }
};

export const deleteAsset = async (id: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, 'assets', id));
};

export const importAssetsFromCSV = async (newAssets: Asset[]): Promise<void> => {
    if (!db) return;
    await Promise.all(newAssets.map(async a => {
        await setDoc(doc(db, 'assets', a.id), a);
        await addAssetLog(a.id, 'Created', 'Imported via CSV');
    }));
};

// --- Bulk Asset Operations (Staff) ---

export const bulkAssignAssets = async (assetIds: string[], employeeName: string) => {
    if (!db) return;
    await Promise.all(assetIds.map(async (id) => {
        const assetRef = doc(db!, 'assets', id);
        await updateDoc(assetRef, { 
            assignedEmployee: employeeName, 
            status: 'Active',
            lastUpdated: new Date().toISOString()
        });
        await addAssetLog(id, 'Assigned', `Assigned to ${employeeName}`);
    }));
};

export const bulkReturnAssets = async (assetIds: string[]) => {
    if (!db) return;
    await Promise.all(assetIds.map(async (id) => {
        const assetRef = doc(db!, 'assets', id);
        await updateDoc(assetRef, { 
            assignedEmployee: '', 
            status: 'In Storage',
            location: 'Head Office', // Default return location
            lastUpdated: new Date().toISOString()
        });
        await addAssetLog(id, 'Returned', `Returned to Storage (Head Office)`);
    }));
};

export const bulkTransferAssets = async (assetIds: string[], newEmployee: string) => {
    if (!db) return;
    await Promise.all(assetIds.map(async (id) => {
        const assetRef = doc(db!, 'assets', id);
        await updateDoc(assetRef, { 
            assignedEmployee: newEmployee,
            lastUpdated: new Date().toISOString()
        });
        await addAssetLog(id, 'Transferred', `Transferred to ${newEmployee}`);
    }));
};


export const getStats = (assets: Asset[]): AssetStats => {
  const config = getCachedConfigSync();
  const categoryCounts = config.categories.map(cat => ({
    name: cat,
    value: assets.filter(a => a.category === cat).length
  })).filter(c => c.value > 0);

  const knownCategories = new Set(config.categories);
  const otherCount = assets.filter(a => !knownCategories.has(a.category)).length;
  if (otherCount > 0) categoryCounts.push({ name: 'Other', value: otherCount });

  return {
    totalValue: assets.reduce((sum, a) => sum + (a.purchaseCost || 0), 0),
    totalAssets: assets.length,
    activeAssets: assets.filter(a => a.status === 'Active').length,
    repairAssets: assets.filter(a => a.status === 'Under Repair').length,
    byCategory: categoryCounts
  };
};

// --- Projects ---
export const getProjects = async (): Promise<Project[]> => {
    if (!db) return [];
    const snapshot = await getDocs(collection(db, 'projects'));
    const projects: Project[] = [];
    snapshot.forEach(doc => projects.push(doc.data() as Project));
    return projects;
};

export const saveProject = async (project: Project): Promise<void> => {
    if (!db) return;
    await setDoc(doc(db, 'projects', project.id), project);
};

export const deleteProject = async (id: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, 'projects', id));
};

export const getOverdueItems = async (): Promise<{project: string, item: ProjectItem}[]> => {
  if (!db) return [];
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
          if (diffDays <= 7) notifications.push({ project: p.name, item: i });
        }
      });
    }
  });
  return notifications;
};
