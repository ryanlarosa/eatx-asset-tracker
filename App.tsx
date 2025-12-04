
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, List, PlusCircle, MonitorSmartphone, CalendarCheck, Bell, Settings as SettingsIcon, LogOut, Loader2, Lock, AlertCircle } from 'lucide-react';
import Dashboard from './components/Dashboard';
import AssetList from './components/AssetList';
import AssetForm from './components/AssetForm';
import Planner from './components/Planner';
import Settings from './components/Settings';
import { Asset } from './types';
import { getAssets, saveAsset, deleteAsset, getStats, getOverdueItems, subscribeToAuth, loginUser, logoutUser, getDBSettings, resetConnectionSettings } from './services/storageService';

// Sidebar Navigation Component
const Sidebar = ({ notificationCount, onLogout }: { notificationCount: number, onLogout: () => void }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  // EatX Branding: Black active state, grey inactive
  const linkClass = (path: string) => `
    flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium
    ${isActive(path) 
      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}
  `;

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-20 hidden md:flex">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-2xl">
          <MonitorSmartphone size={28} className="text-slate-900" />
          <span>EatX IT</span>
        </div>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold">Asset Management</p>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link to="/" className={linkClass('/')}>
          <LayoutDashboard size={20} /> Dashboard
        </Link>
        <Link to="/assets" className={linkClass('/assets')}>
          <List size={20} /> Asset Registry
        </Link>
        <Link to="/planner" className={linkClass('/planner')}>
           <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <CalendarCheck size={20} /> Planner
            </div>
            {notificationCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{notificationCount}</span>
            )}
           </div>
        </Link>
        <Link to="/onboard" className={linkClass('/onboard')}>
          <PlusCircle size={20} /> Onboard Asset
        </Link>
        <Link to="/settings" className={linkClass('/settings')}>
          <SettingsIcon size={20} /> Settings
        </Link>
      </nav>
      <div className="p-4 border-t border-slate-100">
         <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all font-medium">
             <LogOut size={20} /> Sign Out
         </button>
      </div>
    </div>
  );
};

// Mobile Header
const MobileHeader = ({ notificationCount }: { notificationCount: number }) => (
  <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-30">
    <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
      <MonitorSmartphone size={24} />
      <span>EatX IT</span>
    </div>
    {/* Simple Mobile Menu Placeholder */}
    <div className="flex gap-4 text-slate-500 items-center">
      <Link to="/"><LayoutDashboard size={20} /></Link>
      <Link to="/assets"><List size={20} /></Link>
      <Link to="/planner" className="relative">
        <CalendarCheck size={20} />
        {notificationCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
      </Link>
      <Link to="/onboard"><PlusCircle size={20} /></Link>
      <Link to="/settings"><SettingsIcon size={20} /></Link>
    </div>
  </div>
);

// Login Component
const LoginScreen = ({ onLogin }: { onLogin: () => void }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await loginUser(email, password);
            // onLogin is handled by auth subscription, but we can trigger callback if needed
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-credential') {
                setError("Invalid email or password.");
            } else if (err.message && err.message.includes("Firebase not initialized")) {
                setError("Configuration error: Firebase not initialized.");
            } else {
                setError("Login failed. Check connection or config.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-slate-900 p-3 rounded-xl mb-4">
                        <MonitorSmartphone size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">EatX Asset Manager</h1>
                    <p className="text-slate-500 text-sm mt-1">Authorized Personnel Only</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input 
                            type="email" 
                            required
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                            placeholder="admin@eatx.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input 
                            type="password" 
                            required
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
                            <Lock size={14} /> {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-black transition-all flex justify-center items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : 'Secure Login'}
                    </button>
                </form>
                
                <div className="mt-6 text-center pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400 mb-2">
                        System locked? Use reset to return to Local Mode.
                    </p>
                     <button
                        type="button"
                        onClick={() => {
                            if (window.confirm("Connection broken? This will reset the database settings to Local Storage mode so you can fix the configuration.")) {
                                resetConnectionSettings();
                            }
                        }}
                        className="text-xs text-red-500 hover:text-red-700 underline flex items-center justify-center gap-1 mx-auto"
                    >
                        <AlertCircle size={12} /> Reset Connection Settings
                    </button>
                </div>
            </div>
        </div>
    );
};

const AppContent = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState(getStats([]));
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
     // Listen to auth state changes
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
    try {
      console.log("App: Requesting delete for", id);
      await deleteAsset(id);
      await new Promise(resolve => setTimeout(resolve, 50)); 
      await refreshData();
      console.log("App: Delete complete and UI refreshed");
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Failed to delete asset. Please check console for details.");
    }
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    window.location.hash = '#/onboard';
  };

  const handleCancelEdit = () => {
    setEditingAsset(null);
    window.location.hash = '#/assets';
  };

  const handleLogout = async () => {
      await logoutUser();
      // If local storage mode, this might do nothing visually, but for Firebase it clears session
      window.location.reload(); 
  };

  if (authLoading) {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
              <Loader2 className="animate-spin text-slate-900" size={48} />
          </div>
      );
  }

  if (!user) {
      return <LoginScreen onLogin={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <Sidebar notificationCount={notifications.length} onLogout={handleLogout} />
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <MobileHeader notificationCount={notifications.length} />
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          
          {/* Global Notification Banner */}
          {notifications.length > 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 animate-fade-in">
              <div className="p-2 bg-amber-100 rounded-full text-amber-600 mt-0.5">
                <Bell size={18} />
              </div>
              <div>
                <h3 className="text-amber-800 font-semibold text-sm">Action Required: {notifications.length} Purchase Items Due Soon</h3>
                <p className="text-amber-700 text-xs mt-1">
                  You have pending items for <span className="font-medium">{notifications[0].project}</span> and others. 
                  Check the <Link to="/planner" className="underline font-bold">Planner</Link>.
                </p>
              </div>
            </div>
          )}

          <Routes>
            <Route path="/" element={
              <div className="space-y-6 animate-fade-in">
                <header className="mb-8">
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Overview</h1>
                  <p className="text-slate-500 mt-1">Real-time insight into your EatX IT infrastructure.</p>
                </header>
                <Dashboard stats={stats} allAssets={assets} />
              </div>
            } />
            <Route path="/assets" element={
              <div className="space-y-6 animate-fade-in">
                <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Asset Registry</h1>
                    <p className="text-slate-500 mt-1">Manage POS, Production, and Backend equipment.</p>
                  </div>
                  <Link 
                    to="/onboard" 
                    onClick={() => setEditingAsset(null)}
                    className="bg-slate-900 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-black transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <PlusCircle size={18} /> Add New
                  </Link>
                </header>
                <AssetList assets={assets} onEdit={handleEdit} onDelete={handleDelete} onRefresh={refreshData} />
              </div>
            } />
            <Route path="/planner" element={
              <div className="animate-fade-in">
                 <Planner />
              </div>
            } />
            <Route path="/onboard" element={
              <div className="max-w-3xl mx-auto animate-fade-in">
                <header className="mb-8">
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
                    {editingAsset ? 'Manage Asset' : 'Onboard Asset'}
                  </h1>
                  <p className="text-slate-500 mt-1">
                    {editingAsset ? 'Update status, location, or details.' : 'Register new equipment into the system.'}
                  </p>
                </header>
                <AssetForm 
                  initialData={editingAsset} 
                  onSave={handleSave} 
                  onCancel={handleCancelEdit} 
                />
              </div>
            } />
            <Route path="/settings" element={
              <div className="animate-fade-in">
                <Settings />
              </div>
            } />
          </Routes>
        </main>
      </div>
      
      {/* Global CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
