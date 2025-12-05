
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, List, PlusCircle, MonitorSmartphone, CalendarCheck, Settings as SettingsIcon, LogOut, Loader2, Lock, Shield, CheckCircle, XCircle, Users } from 'lucide-react';
import Dashboard from './components/Dashboard';
import AssetList from './components/AssetList';
import AssetForm from './components/AssetForm';
import Planner from './components/Planner';
import Settings from './components/Settings';
import StaffView from './components/StaffView';
import SignHandover from './components/SignHandover';
import { Asset, AssetStatus } from './types';
import { getAssets, saveAsset, deleteAsset, getStats, getOverdueItems, subscribeToAuth, loginUser, logoutUser, getCurrentUserProfile, checkEnvStatus } from './services/storageService';

const Sidebar = ({ notificationCount, onLogout }: { notificationCount: number, onLogout: () => void }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const user = getCurrentUserProfile();
  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role === 'admin' || user?.role === 'technician';

  const linkClass = (path: string) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive(path) ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`;

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-20 hidden md:flex">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-2xl">
          <MonitorSmartphone size={28} className="text-slate-900" />
          <span>EatX IT</span>
        </div>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold flex items-center gap-1">
            {isAdmin ? <Shield size={12} className="text-emerald-500" /> : <Shield size={12} />} 
            <span className="capitalize">{user?.role || 'Guest'}</span> Portal
        </p>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link to="/" className={linkClass('/')}><LayoutDashboard size={20} /> Dashboard</Link>
        <Link to="/assets" className={linkClass('/assets')}><List size={20} /> Asset Registry</Link>
        {canEdit && <Link to="/staff" className={linkClass('/staff')}><Users size={20} /> Staff & Audit</Link>}
        <Link to="/planner" className={linkClass('/planner')}>
           <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3"><CalendarCheck size={20} /> Planner</div>
            {notificationCount > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{notificationCount}</span>}
           </div>
        </Link>
        {isAdmin && <Link to="/settings" className={linkClass('/settings')}><SettingsIcon size={20} /> Settings</Link>}
      </nav>
      <div className="p-4 border-t border-slate-100">
         <div className="mb-4 px-4">
             <div className="text-xs text-slate-400 font-medium mb-1">Signed in as:</div>
             <div className="text-sm font-bold text-slate-700 truncate">{user?.email}</div>
         </div>
         <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all font-medium"><LogOut size={20} /> Sign Out</button>
      </div>
    </div>
  );
};

const LoginScreen = ({ onLogin }: { onLogin: () => void }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const envStatus = checkEnvStatus();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await loginUser(email, password);
        } catch (err: any) {
            setError("Login failed. Check credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-slate-900 p-3 rounded-xl mb-4"><MonitorSmartphone size={32} className="text-white" /></div>
                    <h1 className="text-2xl font-bold text-slate-900">EatX Asset Manager</h1>
                    <p className="text-slate-500 text-sm mt-1">Cloud Access • Role Protected</p>
                </div>

                {/* System Status Indicator */}
                <div className={`mb-6 p-3 rounded-lg text-xs font-mono border flex items-center gap-2 ${envStatus.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                    {envStatus.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    <span>{envStatus.message}</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input type="email" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900" value={email} onChange={e => setEmail(e.target.value)} /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Password</label><input type="password" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900" value={password} onChange={e => setPassword(e.target.value)} /></div>
                    {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2"><Lock size={14} /> {error}</div>}
                    <button type="submit" disabled={loading || !envStatus.ok} className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-black transition-all flex justify-center items-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" /> : 'Login'}</button>
                </form>
            </div>
        </div>
    );
};

const AppContent = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState(getStats([]));
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
     const unsubscribe = subscribeToAuth((u) => {
         setUser(u);
         setAuthLoading(false);
         if (u) refreshData();
     });
     return () => unsubscribe();
  }, []);

  const refreshData = async () => {
    try {
      const data = await getAssets();
      setAssets(data);
      setStats(getStats(data));
      setNotifications(await getOverdueItems());
    } catch (e) {
      console.error("Failed to load data", e);
    }
  };

  const handleSave = async (asset: Asset) => {
    await saveAsset(asset);
    await refreshData();
    window.location.hash = '#/assets'; 
    setEditingAsset(null);
  };

  const handleDelete = async (id: string) => {
    await deleteAsset(id);
    await refreshData();
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    window.location.hash = '#/onboard';
  };

  const handleDuplicate = (asset: Asset) => {
      const newId = 'ast-' + Math.random().toString(36).substr(2, 9);
      const copy: Asset = {
          ...asset,
          id: newId,
          name: `${asset.name} (Copy)`,
          serialNumber: '', 
          assignedEmployee: '', 
          status: 'Active' as AssetStatus, 
          lastUpdated: new Date().toISOString()
      };
      setEditingAsset(copy);
      window.location.hash = '#/onboard';
  };

  const handleLogout = async () => {
      await logoutUser();
  };

  // Auth Guard
  const isPublicRoute = location.pathname.startsWith('/sign/');
  
  if (authLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-slate-900" size={48} /></div>;
  if (!user && !isPublicRoute) return <LoginScreen onLogin={() => {}} />;

  // Public Layout (Signing)
  if (isPublicRoute) {
      return (
          <Routes>
              <Route path="/sign/:id" element={<SignHandover />} />
          </Routes>
      );
  }

  // Protected Layout
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <Sidebar notificationCount={notifications.length} onLogout={handleLogout} />
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<div className="space-y-6 animate-fade-in"><header className="mb-8"><h1 className="text-2xl md:text-3xl font-bold text-slate-800">Overview</h1></header><Dashboard stats={stats} allAssets={assets} /></div>} />
            <Route path="/assets" element={<div className="space-y-6 animate-fade-in"><header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl md:text-3xl font-bold text-slate-800">Asset Registry</h1></div>{user.role !== 'viewer' && <Link to="/onboard" onClick={() => setEditingAsset(null)} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-black transition-colors font-medium flex items-center justify-center gap-2"><PlusCircle size={18} /> Add New</Link>}</header><AssetList assets={assets} onEdit={handleEdit} onDuplicate={handleDuplicate} onDelete={handleDelete} onRefresh={refreshData} /></div>} />
            <Route path="/planner" element={<div className="animate-fade-in"><Planner /></div>} />
            <Route path="/staff" element={<div className="animate-fade-in"><StaffView /></div>} />
            <Route path="/onboard" element={<div className="max-w-3xl mx-auto animate-fade-in"><header className="mb-8"><h1 className="text-2xl md:text-3xl font-bold text-slate-800">{editingAsset ? 'Manage Asset' : 'Onboard Asset'}</h1></header><AssetForm initialData={editingAsset} onSave={handleSave} onCancel={() => { setEditingAsset(null); window.location.hash = '#/assets'; }} /></div>} />
            <Route path="/settings" element={user.role === 'admin' ? <div className="animate-fade-in"><Settings /></div> : <Navigate to="/" />} />
          </Routes>
        </main>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }`}</style>
    </div>
  );
};

const App = () => <Router><AppContent /></Router>;
export default App;
