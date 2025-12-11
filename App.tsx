import React, { useState, useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  List,
  PlusCircle,
  MonitorSmartphone,
  CalendarCheck,
  Settings as SettingsIcon,
  LogOut,
  Loader2,
  Lock,
  Shield,
  CheckCircle,
  XCircle,
  Users,
  Wrench,
  ShoppingBag,
  Receipt,
} from "lucide-react";
import Dashboard from "./components/Dashboard";
import AssetList from "./components/AssetList";
import AssetForm from "./components/AssetForm";
import Planner from "./components/Planner";
import Settings from "./components/Settings";
import StaffView from "./components/StaffView";
import SignHandover from "./components/SignHandover";
import RepairTickets from "./components/RepairTickets";
import AssetRequests from "./components/AssetRequests";
import PublicReportIssue from "./components/PublicReportIssue";
import PublicAssetRequest from "./components/PublicAssetRequest";
import Invoices from "./components/Invoices";
import { Asset, AssetStatus, UserRole, Project } from "./types";
import {
  saveAsset,
  deleteAsset,
  getStats,
  getOverdueItems,
  subscribeToAuth,
  loginUser,
  logoutUser,
  getCurrentUserProfile,
  checkEnvStatus,
  listenToAssets,
  listenToProjects,
} from "./services/storageService";

const Sidebar = ({
  notificationCount,
  onLogout,
}: {
  notificationCount: number;
  onLogout: () => void;
}) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const user = getCurrentUserProfile();
  const isAdmin = user?.role === "admin";
  const canEdit = user?.role === "admin" || user?.role === "technician";

  const linkClass = (path: string) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
      isActive(path)
        ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-20 hidden md:flex">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-2xl">
          <MonitorSmartphone size={28} className="text-slate-900" />
          <span>EatX IT</span>
        </div>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold flex items-center gap-1">
          {isAdmin ? (
            <Shield size={12} className="text-emerald-500" />
          ) : (
            <Shield size={12} />
          )}
          <span className="capitalize">{user?.role || "Guest"}</span> Portal
        </p>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link to="/" className={linkClass("/")}>
          <LayoutDashboard size={20} /> Dashboard
        </Link>
        <Link to="/assets" className={linkClass("/assets")}>
          <List size={20} /> Asset Registry
        </Link>
        <Link to="/requests" className={linkClass("/requests")}>
          <ShoppingBag size={20} /> Requests
        </Link>
        <Link to="/repairs" className={linkClass("/repairs")}>
          <Wrench size={20} /> Repairs
        </Link>
        <Link to="/invoices" className={linkClass("/invoices")}>
          <Receipt size={20} /> Invoices
        </Link>
        {canEdit && (
          <Link to="/staff" className={linkClass("/staff")}>
            <Users size={20} /> Staff & Audit
          </Link>
        )}
        <Link to="/planner" className={linkClass("/planner")}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <CalendarCheck size={20} /> Planner
            </div>
            {notificationCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {notificationCount}
              </span>
            )}
          </div>
        </Link>
        {isAdmin && (
          <Link to="/settings" className={linkClass("/settings")}>
            <SettingsIcon size={20} /> Settings
          </Link>
        )}
      </nav>
      <div className="p-4 border-t border-slate-100">
        <div className="mb-4 px-4">
          <div className="text-xs text-slate-400 font-medium mb-1">
            Signed in as:
          </div>
          <div className="text-sm font-bold text-slate-700 truncate">
            {user?.email}
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all font-medium"
        >
          <LogOut size={20} /> Sign Out
        </button>
      </div>
    </div>
  );
};

const LoginScreen = ({ onLogin }: { onLogin: () => void }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const envStatus = checkEnvStatus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await loginUser(email, password);
    } catch (err: any) {
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Invalid email or password.");
      } else {
        setError("Login failed. Check your credentials.");
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
          <h1 className="text-2xl font-bold text-slate-900">
            EatX Asset Manager
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Cloud Access • Role Protected
          </p>
        </div>

        {/* System Status Indicator */}
        <div
          className={`mb-6 p-3 rounded-lg text-xs font-mono border flex items-center gap-2 ${
            envStatus.ok
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-red-50 text-red-700 border-red-100"
          }`}
        >
          {envStatus.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
          <span>{envStatus.message}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
              <Lock size={14} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !envStatus.ok}
            className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-black transition-all flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Login"}
          </button>

          <div className="text-center text-xs text-slate-400 mt-4">
            Authorized Personnel Only
          </div>
        </form>
      </div>
    </div>
  );
};

const ProtectedRoute = ({
  children,
  requiredRole,
}: {
  children?: React.ReactNode;
  requiredRole?: UserRole;
}) => {
  const user = getCurrentUserProfile();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && user.role !== requiredRole && user.role !== "admin") {
    return (
      <div className="p-8 text-center text-slate-500">
        Access Denied. You do not have permission to view this page.
      </div>
    );
  }

  return <>{children}</>;
};

const App = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);
  const [view, setView] = useState<"list" | "form">("list");
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [user, setUser] = useState(getCurrentUserProfile());

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
    setView("list");
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
      id: "ast-" + Math.random().toString(36).substr(2, 9),
      name: `${asset.name} (Copy)`,
      serialNumber: "", // Clear unique fields
      assignedEmployee: "",
      lastUpdated: "",
    };
    setEditingAsset(copy);
    setView("form");
  };

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

  const canEdit = user.role === "admin" || user.role === "technician";

  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Routes>
          <Route path="/sign/:id" element={<SignHandover />} />
          <Route path="/report-issue" element={<PublicReportIssue />} />
          <Route path="/request-asset" element={<PublicAssetRequest />} />

          <Route
            path="/*"
            element={
              <>
                <Sidebar
                  notificationCount={notificationCount}
                  onLogout={() => logoutUser()}
                />
                <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen">
                  <Routes>
                    <Route
                      path="/"
                      element={
                        <Dashboard
                          stats={getStats(assets)}
                          allAssets={assets}
                        />
                      }
                    />
                    <Route
                      path="/assets"
                      element={
                        view === "list" ? (
                          <div className="space-y-6">
                            <div className="flex justify-between items-center">
                              <h1 className="text-2xl font-bold text-slate-800">
                                Asset Registry
                              </h1>
                              {canEdit && (
                                <button
                                  onClick={() => {
                                    setEditingAsset(null);
                                    setView("form");
                                  }}
                                  className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-black flex items-center gap-2 font-medium shadow-sm transition-all"
                                >
                                  <PlusCircle size={20} /> Add Asset
                                </button>
                              )}
                            </div>
                            {loading ? (
                              <div className="flex justify-center p-12">
                                <Loader2
                                  className="animate-spin text-slate-400"
                                  size={32}
                                />
                              </div>
                            ) : (
                              <AssetList
                                assets={assets}
                                onEdit={(a) => {
                                  setEditingAsset(a);
                                  setView("form");
                                }}
                                onDuplicate={handleDuplicate}
                                onDelete={handleDeleteAsset}
                              />
                            )}
                          </div>
                        ) : (
                          <AssetForm
                            initialData={editingAsset}
                            onSave={handleSaveAsset}
                            onCancel={() => {
                              setView("list");
                              setEditingAsset(null);
                            }}
                          />
                        )
                      }
                    />
                    <Route path="/requests" element={<AssetRequests />} />
                    <Route path="/repairs" element={<RepairTickets />} />
                    <Route path="/invoices" element={<Invoices />} />
                    <Route path="/planner" element={<Planner />} />
                    <Route
                      path="/staff"
                      element={
                        <ProtectedRoute requiredRole="technician">
                          <StaffView />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <Settings />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </>
            }
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
