import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { LayoutDashboard, List, PlusCircle, MonitorSmartphone, CalendarCheck, Settings as SettingsIcon, LogOut, Loader2, Lock, Shield, CheckCircle, XCircle, Users, Wrench, ShoppingBag, Receipt, Database, Menu, X, Moon, Sun } from 'lucide-react';
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
import Invoices from './components/Invoices';
import { Asset, AssetStatus, UserRole, Project } from './types';
import { saveAsset, deleteAsset, getStats, getOverdueItems, subscribeToAuth, loginUser, logoutUser, getCurrentUserProfile, checkEnvStatus, listenToAssets, listenToProjects, getSandboxStatus } from './services/storageService';

const Sidebar = ({ notificationCount, onLogout, isOpen, onClose, isDarkMode, toggleTheme }: { notificationCount: number, onLogout: () => void, isOpen: boolean, onClose: () => void, isDarkMode: boolean, toggleTheme: () => void }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const user = getCurrentUserProfile();
  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role === 'admin' || user?.role === 'technician';
  const isSandbox = getSandboxStatus();

  const linkClass = (path: string) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive(path) ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 dark:bg-blue-600 dark:text-white dark:shadow-blue-900/30' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
            className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
            onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`
        fixed top-0 left-0 h-screen w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 
        transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0
      `}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-2xl">
            <div className="bg-slate-900 dark:bg-blue-600 text-white p-1.5 rounded-lg">
                <MonitorSmartphone size={24} />
            </div>
            <span>EatX IT</span>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded-lg">
            <X size={24} />
          </button>
        </div>

        <div className="px-6 py-4">
            <div className="flex flex-col gap-2">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold flex items-center gap-1">
                    {isAdmin ? <Shield size={12} className="text-emerald-500" /> : <Shield size={12} />} 
                    <span className="capitalize">{user?.role?.replace('_', ' ') || 'Guest'}</span> Portal
                </p>
                {isSandbox && (
                    <div className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded-md w-fit flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                        <Database size={12} /> SANDBOX MODE
                    </div>
                )}
            </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          <Link to="/" className={linkClass('/')} onClick={onClose}><LayoutDashboard size={20} /> Dashboard</Link>
          <Link to="/assets" className={linkClass('/assets')} onClick={onClose}><List size={20} /> Asset Registry</Link>
          <Link to="/requests" className={linkClass('/requests')} onClick={onClose}><ShoppingBag size={20} /> Requests</Link>
          <Link to="/repairs" className={linkClass('/repairs')} onClick={onClose}><Wrench size={20} /> Repairs</Link>
          <Link to="/invoices" className={linkClass('/invoices')} onClick={onClose}><Receipt size={20} /> Invoices</Link>
          {canEdit && <Link to="/staff" className={linkClass('/staff')} onClick={onClose}><Users size={20} /> Staff & Audit</Link>}
          <Link to="/planner" className={linkClass('/planner')} onClick={onClose}>
             <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3"><CalendarCheck size={20} /> Planner</div>
              {notificationCount > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">{notificationCount}</span>}
             </div>
          </Link>
          <Link to="/settings" className={linkClass('/settings')} onClick={onClose}><SettingsIcon size={20} /> Settings</Link>
        </nav>
        
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between px-4">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Theme</span>
                <button 
                    onClick={toggleTheme} 
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>
           
           <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
               <div className="text-xs text-slate-400 font-medium mb-1">Signed in as</div>
               <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate" title={user?.email}>{user?.email}</div>
           </div>
           
           <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-xl transition-all font-medium">
               <LogOut size={20} /> Sign Out
           </button>
        </div>
      </div>
    </>
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
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                setError("Invalid email or password.");
            } else {
                setError("Login failed. Check your credentials.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-md w-full">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-slate-900 dark:bg-blue-600 p-4 rounded-2xl mb-4 shadow-lg shadow-slate-900/20 dark:shadow-blue-900/20">
                        <MonitorSmartphone size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">EatX Asset Manager</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Cloud Access • Role Protected</p>
                </div>

                {/* System Status Indicator */}
                <div className={`mb-6 p-3 rounded-lg text-xs font-mono border flex items-center gap-2 ${envStatus.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30' : 'bg-red-50 text-red-700 border-red-100'}`}>
                    {envStatus.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    <span>{envStatus.message}</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                        <input type="email" required className="w-full p-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500 outline-none transition-all" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                        <input type="password" required className="w-full p-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500 outline-none transition-all" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg flex items-center gap-2"><Lock size={14} /> {error}</div>}
                    
                    <button type="submit" disabled={loading || !envStatus.ok} className="w-full bg-slate-900 dark:bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-black dark:hover:bg-blue-700 transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin" /> : 'Login'}
                    </button>
                    
                    <div className="text-center text-xs text-slate-400 mt-4">
                        Authorized Personnel Only
                    </div>
                </form>
            </div>
        </div>
    );
};

const ProtectedRoute = ({ children, requiredRole }: { children?: React.ReactNode, requiredRole?: UserRole }) => {
    const user = getCurrentUserProfile();
    
    if (!user) {
        return <Navigate to="/" replace />;
    }

    if (requiredRole && user.role !== requiredRole && user.role !== 'admin' && user.role !== 'sandbox_user') {
         return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Access Denied. You do not have permission to view this page.</div>;
    }

    return <>{children}</>;
};

const App = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [user, setUser] = useState(getCurrentUserProfile());
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('eatx_theme') === 'dark');

  // Mobile Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('eatx_theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('eatx_theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((u) => {
        setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listeners for App-wide data (Assets & Notifications)
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    
    // Subscribe to Assets
    const unsubscribeAssets = listenToAssets((data) => {
        setAssets(data);
        setLoading(false);
    });

    // Subscribe to Projects (for Notification Count)
    const unsubscribeProjects = listenToProjects(async (data) => {
        setProjects(data);
        const overdue = await getOverdueItems(data);
        setNotificationCount(overdue.length);
    });

    return () => {
        unsubscribeAssets();
        unsubscribeProjects();
    };
  }, [user]);

  const handleSaveAsset = async (asset: Asset) => {
    await saveAsset(asset);
    // No need to manually refresh - listener handles it
    setView('list');
    setEditingAsset(null);
  };

  const handleDeleteAsset = async (id: string) => {
    try {
        await deleteAsset(id);
    } catch (error) {
        console.error("Delete failed", error);
    }
  };

  const handleDuplicate = (asset: Asset) => {
    const copy: Asset = {
        ...asset,
        id: 'ast-' + Math.random().toString(36).substr(2, 9),
        name: `${asset.name} (Copy)`,
        serialNumber: '', // Clear unique fields
        assignedEmployee: '',
        lastUpdated: ''
    };
    setEditingAsset(copy);
    setView('form');
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  if (!user) {
    return (
        <Router>
             <Routes>
                <Route path="/sign/:id" element={<SignHandover />} />
                <Route path="/report-issue" element={<PublicReportIssue />} />
                <Route path="/request-asset" element={<PublicAssetRequest />} />
                <Route path="*" element={<LoginScreen onLogin={() => {}} />} />
             </Routes>
        </Router>
    );
  }

  const canEdit = user.role === 'admin' || user.role === 'technician' || user.role === 'sandbox_user';

  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
        <Routes>
            <Route path="/sign/:id" element={<SignHandover />} />
            <Route path="/report-issue" element={<PublicReportIssue />} />
            <Route path="/request-asset" element={<PublicAssetRequest />} />
            
            <Route path="/*" element={
                <>
                {/* Mobile Header */}
                <div className="md:hidden fixed top-0 left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 z-30 flex items-center justify-between shadow-sm h-16">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                        <MonitorSmartphone size={24} />
                        <span>EatX IT</span>
                    </div>
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <Menu size={24} />
                    </button>
                </div>

                <Sidebar 
                    notificationCount={notificationCount} 
                    onLogout={() => logoutUser()} 
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    isDarkMode={isDarkMode}
                    toggleTheme={toggleTheme}
                />
                
                {/* Main Content Area - Added top padding for mobile header */}
                <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen pt-20 md:pt-8 transition-all scroll-smooth">
                    <Routes>
                        <Route path="/" element={<Dashboard stats={getStats(assets)} allAssets={assets} />} />
                        <Route path="/assets" element={
                            view === 'list' ? (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Asset Registry</h1>
                                        {canEdit && (
                                            <button 
                                                onClick={() => { setEditingAsset(null); setView('form'); }} 
                                                className="bg-slate-900 text-white dark:bg-blue-600 px-4 py-2 rounded-lg hover:bg-black dark:hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm transition-all text-sm md:text-base"
                                            >
                                                <PlusCircle size={20} /> <span className="hidden sm:inline">Add Asset</span><span className="sm:hidden">Add</span>
                                            </button>
                                        )}
                                    </div>
                                    {loading ? (
                                        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
                                    ) : (
                                        <AssetList 
                                            assets={assets} 
                                            onEdit={(a) => { setEditingAsset(a); setView('form'); }} 
                                            onDuplicate={handleDuplicate}
                                            onDelete={handleDeleteAsset} 
                                        />
                                    )}
                                </div>
                            ) : (
                                <AssetForm 
                                    initialData={editingAsset} 
                                    onSave={handleSaveAsset} 
                                    onCancel={() => { setView('list'); setEditingAsset(null); }} 
                                />
                            )
                        } />
                        <Route path="/requests" element={<AssetRequests />} />
                        <Route path="/repairs" element={<RepairTickets />} />
                        <Route path="/invoices" element={<Invoices />} />
                        <Route path="/planner" element={<Planner />} />
                        <Route path="/staff" element={
                            <ProtectedRoute requiredRole="technician">
                                <StaffView />
                            </ProtectedRoute>
                        } />
                        <Route path="/settings" element={
                            <Settings />
                        } />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
                </>
            } />
        </Routes>
      </div>
    </Router>
  );
};

export default App;