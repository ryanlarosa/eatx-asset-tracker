
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { Loader2, PlusCircle } from 'lucide-react';
import Dashboard from './components/Dashboard';
import AssetList from './components/AssetList';
import AssetForm from './components/AssetForm';
import Planner from './components/Planner';
import Settings from './components/Settings';
import StaffView from './components/StaffView';
import SignHandover from './components/SignHandover';
import RepairTickets from './components/RepairTickets';
import AssetRequests from './components/AssetRequests';
import PublicReportIssue from './components/PublicReportIssue';
import PublicAssetRequest from './components/PublicAssetRequest';
import PublicStatusTracker from './components/PublicStatusTracker';
import Invoices from './components/Invoices';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import LoginScreen from './components/LoginScreen';
import { Asset, UserRole, Project, AppNotification } from './types';
import { saveAsset, deleteAsset, getStats, getOverdueItems, subscribeToAuth, logoutUser, getCurrentUserProfile, listenToAssets, listenToProjects, listenToNotifications } from './services/storageService';

const ProtectedRoute = ({ children, requiredRole }: { children?: React.ReactNode, requiredRole?: UserRole }) => {
    const user = getCurrentUserProfile();
    if (!user) return <Navigate to="/" replace />;
    if (requiredRole && user.role !== requiredRole && user.role !== 'admin' && user.role !== 'sandbox_user') {
         return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Access Denied. You do not have permission to view this page.</div>;
    }
    return <>{children}</>;
};

const AssetRegistryWrapper = ({ assets, view, setView, editingAsset, setEditingAsset, handleSaveAsset, handleDuplicate, handleDeleteAsset, loading, canEdit }: any) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const deepLinkId = searchParams.get('id');

    useEffect(() => {
        if (deepLinkId && assets.length > 0 && !editingAsset) {
            const asset = assets.find((a: Asset) => a.id === deepLinkId);
            if (asset) { setEditingAsset(asset); setView('form'); }
        }
    }, [deepLinkId, assets]);

    return view === 'list' ? (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Asset Registry</h1>
                {canEdit && (
                    <button onClick={() => { setEditingAsset(null); setView('form'); }} className="bg-slate-900 text-white dark:bg-blue-600 px-4 py-2 rounded-lg hover:bg-black dark:hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm transition-all text-sm md:text-base">
                        <PlusCircle size={20} /> <span className="hidden sm:inline">Add Asset</span><span className="sm:hidden">Add</span>
                    </button>
                )}
            </div>
            {loading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-slate-400" size={32} /></div> : 
                <AssetList assets={assets} onEdit={(a) => { setEditingAsset(a); setView('form'); }} onDuplicate={handleDuplicate} onDelete={handleDeleteAsset} />
            }
        </div>
    ) : (
        <AssetForm initialData={editingAsset} onSave={handleSaveAsset} onCancel={() => { setView('list'); setEditingAsset(null); setSearchParams({}); }} />
    );
};

const App = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [user, setUser] = useState(getCurrentUserProfile());
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('eatx_theme') === 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (isDarkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('eatx_theme', 'dark'); } 
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('eatx_theme', 'light'); }
  }, [isDarkMode]);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubAssets = listenToAssets((data) => { setAssets(data); setLoading(false); });
    const unsubProjects = listenToProjects(async (data) => { setProjects(data); setNotificationCount((await getOverdueItems(data)).length); });
    const unsubNotifs = listenToNotifications((data) => setNotifications(data));
    return () => { unsubAssets(); unsubProjects(); unsubNotifs(); };
  }, [user]);

  const handleSaveAsset = async (asset: Asset) => { await saveAsset(asset); setView('list'); setEditingAsset(null); };
  const handleDeleteAsset = async (id: string) => { try { await deleteAsset(id); } catch (e) { console.error(e); } };
  
  const handleDuplicate = (asset: Asset) => {
    setEditingAsset({ ...asset, id: 'ast-' + Math.random().toString(36).substr(2, 9), name: `${asset.name} (Copy)`, serialNumber: '', assignedEmployee: '', lastUpdated: '' });
    setView('form');
  };

  if (!user) {
    return (
        <Router>
             <Routes>
                <Route path="/sign/:id" element={<SignHandover />} />
                <Route path="/report-issue" element={<PublicReportIssue />} />
                <Route path="/request-asset" element={<PublicAssetRequest />} />
                <Route path="/track" element={<PublicStatusTracker />} />
                <Route path="*" element={<LoginScreen />} />
             </Routes>
        </Router>
    );
  }

  const canEdit = user.role === 'admin' || user.role === 'technician' || user.role === 'sandbox_user';

  return (
    <Router>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 overflow-hidden">
        <Routes>
            <Route path="/sign/:id" element={<SignHandover />} />
            <Route path="/report-issue" element={<PublicReportIssue />} />
            <Route path="/request-asset" element={<PublicAssetRequest />} />
            <Route path="/track" element={<PublicStatusTracker />} />
            <Route path="/*" element={
                <>
                <Sidebar notificationCount={notificationCount} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
                <div className="flex-1 flex flex-col min-w-0 md:ml-64 transition-all duration-300 ease-in-out h-full">
                    <TopBar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isDarkMode={isDarkMode} toggleTheme={() => setIsDarkMode(!isDarkMode)} user={user} notifications={notifications} onLogout={logoutUser} />
                    <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth custom-scrollbar">
                        <div className="max-w-7xl mx-auto pb-10">
                            <Routes>
                                <Route path="/" element={<Dashboard stats={getStats(assets)} allAssets={assets} />} />
                                <Route path="/assets" element={<AssetRegistryWrapper assets={assets} view={view} setView={setView} editingAsset={editingAsset} setEditingAsset={setEditingAsset} handleSaveAsset={handleSaveAsset} handleDuplicate={handleDuplicate} handleDeleteAsset={handleDeleteAsset} loading={loading} canEdit={canEdit} />} />
                                <Route path="/requests" element={<AssetRequests />} />
                                <Route path="/repairs" element={<RepairTickets />} />
                                <Route path="/invoices" element={<Invoices />} />
                                <Route path="/planner" element={<Planner />} />
                                <Route path="/staff" element={<ProtectedRoute requiredRole="technician"><StaffView /></ProtectedRoute>} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </div>
                    </main>
                </div>
                </>
            } />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
