import React, { useState, useEffect } from "react";
import {
  getAppConfig,
  saveAppConfig,
  getAssets,
  getCurrentUserProfile,
  getAllUsers,
  updateUserRole,
  adminCreateUser,
  resetDatabase,
  renameMasterDataItem,
} from "../services/storageService";
import { AppConfig, UserProfile, UserRole } from "../types";
import {
  Plus,
  X,
  Shield,
  Users,
  Loader2,
  Check,
  Mail,
  Lock,
  AlertTriangle,
  Trash2,
  Edit2,
} from "lucide-react";

const Settings: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({
    categories: [],
    locations: [],
    departments: [],
  });
  const [newCat, setNewCat] = useState("");
  const [newLoc, setNewLoc] = useState("");
  const [newDept, setNewDept] = useState("");

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Create User State
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("viewer");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Constraint Checking State
  const [checkingItem, setCheckingItem] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    type: "category" | "location" | "department" | "reset" | null;
    value: string;
  }>({ isOpen: false, type: null, value: "" });

  // Edit State
  const [editState, setEditState] = useState<{
    isOpen: boolean;
    type: "category" | "location" | "department" | null;
    oldValue: string;
    newValue: string;
    isProcessing: boolean;
  }>({
    isOpen: false,
    type: null,
    oldValue: "",
    newValue: "",
    isProcessing: false,
  });

  // Auth Check
  const currentUser = getCurrentUserProfile();
  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    const init = async () => {
      setConfig(await getAppConfig());
      if (isAdmin) {
        refreshUsers();
      }
    };
    init();
  }, [isAdmin]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(""), 5000);
  };

  const refreshUsers = async () => {
    setIsLoadingUsers(true);
    try {
      setUsers(await getAllUsers());
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    try {
      await updateUserRole(uid, newRole);
      setUsers(users.map((u) => (u.uid === uid ? { ...u, role: newRole } : u)));
      showSuccess(`User role updated to ${newRole}`);
    } catch (e) {
      showError("Failed to update role");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPass) return;
    if (newUserPass.length < 6) {
      showError("Password must be at least 6 characters.");
      return;
    }

    setIsCreatingUser(true);
    setErrorMsg("");
    try {
      await adminCreateUser(newUserEmail, newUserPass, newUserRole);
      setNewUserEmail("");
      setNewUserPass("");
      await refreshUsers();
      showSuccess(`User ${newUserEmail} created successfully.`);
    } catch (e: any) {
      if (e.code === "auth/email-already-in-use") {
        showError("Email already exists.");
      } else {
        showError("Failed to create user. " + e.message);
      }
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleAddCategory = async () => {
    if (newCat && !config.categories.includes(newCat)) {
      const updated = { ...config, categories: [...config.categories, newCat] };
      setConfig(updated);
      await saveAppConfig(updated);
      setNewCat("");
    }
  };

  const requestDeleteCategory = async (cat: string) => {
    setCheckingItem(cat);
    try {
      const assets = await getAssets();
      if (assets.some((a) => a.category === cat)) {
        showError(`Cannot delete '${cat}': Linked to active assets.`);
        return;
      }
      setDeleteConfirmation({ isOpen: true, type: "category", value: cat });
    } catch (e) {
      showError("Failed to verify assets.");
    } finally {
      setCheckingItem(null);
    }
  };

  const handleAddLocation = async () => {
    if (newLoc && !config.locations.includes(newLoc)) {
      const updated = { ...config, locations: [...config.locations, newLoc] };
      setConfig(updated);
      await saveAppConfig(updated);
      setNewLoc("");
    }
  };

  const requestDeleteLocation = async (loc: string) => {
    setCheckingItem(loc);
    try {
      const assets = await getAssets();
      if (assets.some((a) => a.location === loc)) {
        showError(`Cannot delete '${loc}': Linked to active assets.`);
        return;
      }
      setDeleteConfirmation({ isOpen: true, type: "location", value: loc });
    } catch (e) {
      showError("Failed to verify assets.");
    } finally {
      setCheckingItem(null);
    }
  };

  const handleAddDepartment = async () => {
    if (newDept && !config.departments?.includes(newDept)) {
      const currentDepts = config.departments || [];
      const updated = { ...config, departments: [...currentDepts, newDept] };
      setConfig(updated);
      await saveAppConfig(updated);
      setNewDept("");
    }
  };

  const requestDeleteDepartment = async (dept: string) => {
    setCheckingItem(dept);
    try {
      const assets = await getAssets();
      if (assets.some((a) => a.department === dept)) {
        showError(`Cannot delete '${dept}': Linked to active assets.`);
        return;
      }
      setDeleteConfirmation({ isOpen: true, type: "department", value: dept });
    } catch (e) {
      showError("Failed to verify assets.");
    } finally {
      setCheckingItem(null);
    }
  };

  const requestResetDatabase = () => {
    setDeleteConfirmation({ isOpen: true, type: "reset", value: "ALL DATA" });
  };

  const confirmDelete = async () => {
    const { type, value } = deleteConfirmation;

    if (type === "reset") {
      await resetDatabase();
      showSuccess("Database has been reset.");
      setDeleteConfirmation({ isOpen: false, type: null, value: "" });
      return;
    }

    if (!type || !value) return;

    let updated = { ...config };

    if (type === "category") {
      updated.categories = config.categories.filter((c) => c !== value);
    } else if (type === "location") {
      updated.locations = config.locations.filter((l) => l !== value);
    } else if (type === "department") {
      updated.departments =
        config.departments?.filter((d) => d !== value) || [];
    }

    setConfig(updated);
    await saveAppConfig(updated);
    setDeleteConfirmation({ isOpen: false, type: null, value: "" });
    showSuccess(`${value} deleted.`);
  };

  const handleEditClick = (
    type: "category" | "location" | "department",
    value: string
  ) => {
    setEditState({
      isOpen: true,
      type,
      oldValue: value,
      newValue: value,
      isProcessing: false,
    });
  };

  const confirmEdit = async () => {
    const { type, oldValue, newValue } = editState;
    if (!type || !newValue.trim() || oldValue === newValue) {
      setEditState((prev) => ({ ...prev, isOpen: false }));
      return;
    }

    setEditState((prev) => ({ ...prev, isProcessing: true }));
    try {
      await renameMasterDataItem(type, oldValue, newValue);

      // Update local state immediately for UI response
      const updated = { ...config };
      if (type === "category") {
        updated.categories = config.categories.map((c) =>
          c === oldValue ? newValue : c
        );
      } else if (type === "location") {
        updated.locations = config.locations.map((l) =>
          l === oldValue ? newValue : l
        );
      } else if (type === "department") {
        updated.departments = (config.departments || []).map((d) =>
          d === oldValue ? newValue : d
        );
      }
      setConfig(updated);

      showSuccess(`Renamed to '${newValue}'. Linked assets updated.`);
      setEditState((prev) => ({ ...prev, isOpen: false }));
    } catch (e) {
      showError("Failed to rename item.");
    } finally {
      setEditState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-slate-200">
        <Shield className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-slate-500 mt-2">
          Only Administrators can access System Configuration.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">
          System Configuration
        </h1>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
          <Check size={14} />
          <span>Connected to Cloud</span>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Users size={20} /> User Management
          </h3>
          <button
            onClick={refreshUsers}
            className="text-sm text-slate-500 hover:text-slate-900 underline"
          >
            Refresh List
          </button>
        </div>

        <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Mail size={16} /> Create New User
          </h4>
          <p className="text-xs text-slate-500 mb-3">
            Create an account for a new employee. You will need to share these
            credentials with them manually.
          </p>

          <form
            onSubmit={handleCreateUser}
            className="flex flex-col md:flex-row gap-3 items-end"
          >
            <div className="flex-1 w-full">
              <label className="text-xs text-slate-500 block mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="new.user@eatx.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="text-xs text-slate-500 block mb-1">
                Password (min 6 chars)
              </label>
              <input
                type="password"
                required
                placeholder="••••••"
                value={newUserPass}
                onChange={(e) => setNewUserPass(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="w-full md:w-32">
              <label className="text-xs text-slate-500 block mb-1">Role</label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="viewer">Viewer</option>
                <option value="technician">Technician</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              disabled={isCreatingUser}
              type="submit"
              className="w-full md:w-auto bg-slate-900 text-white p-2 px-4 rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCreatingUser ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Plus size={18} />
              )}{" "}
              Create
            </button>
          </form>
        </div>

        {isLoadingUsers ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-3 font-medium text-slate-600">User</th>
                  <th className="p-3 font-medium text-slate-600">Status</th>
                  <th className="p-3 font-medium text-slate-600">Role</th>
                  <th className="p-3 font-medium text-slate-600 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-800 font-medium">
                      {u.email}
                      {currentUser?.uid === u.uid && (
                        <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">
                          You
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-emerald-600 text-xs font-medium">
                      Active
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs uppercase font-bold ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : u.role === "technician"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {u.role || "Viewer"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          handleRoleChange(u.uid, e.target.value as UserRole)
                        }
                        className="p-1.5 border border-slate-200 rounded text-slate-700 focus:ring-2 focus:ring-slate-900 text-xs bg-white"
                        disabled={currentUser?.uid === u.uid}
                      >
                        <option value="admin">Promote to Admin</option>
                        <option value="technician">Set as Technician</option>
                        <option value="viewer">Demote to Viewer</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Categories Config */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Categories</h3>
          <div className="flex gap-2 mb-4">
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="New Category..."
              className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
            />
            <button
              onClick={handleAddCategory}
              disabled={!newCat}
              className="bg-slate-900 text-white p-2 rounded-lg hover:bg-black disabled:opacity-50"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {config.categories.map((cat) => (
              <div
                key={cat}
                className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100 group hover:border-slate-300"
              >
                <span className="text-sm font-medium text-slate-700">
                  {cat}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEditClick("category", cat)}
                    disabled={!!checkingItem}
                    className="p-1 text-slate-400 hover:text-blue-600"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => requestDeleteCategory(cat)}
                    disabled={checkingItem === cat}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    {checkingItem === cat ? (
                      <Loader2
                        size={16}
                        className="animate-spin text-slate-400"
                      />
                    ) : (
                      <X size={16} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Locations Config */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Locations</h3>
          <div className="flex gap-2 mb-4">
            <input
              value={newLoc}
              onChange={(e) => setNewLoc(e.target.value)}
              placeholder="New Location..."
              className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
            />
            <button
              onClick={handleAddLocation}
              disabled={!newLoc}
              className="bg-slate-900 text-white p-2 rounded-lg hover:bg-black disabled:opacity-50"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {config.locations.map((loc) => (
              <div
                key={loc}
                className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100 group hover:border-slate-300"
              >
                <span className="text-sm font-medium text-slate-700">
                  {loc}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEditClick("location", loc)}
                    disabled={!!checkingItem}
                    className="p-1 text-slate-400 hover:text-blue-600"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => requestDeleteLocation(loc)}
                    disabled={checkingItem === loc}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    {checkingItem === loc ? (
                      <Loader2
                        size={16}
                        className="animate-spin text-slate-400"
                      />
                    ) : (
                      <X size={16} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Departments Config */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Departments</h3>
          <div className="flex gap-2 mb-4">
            <input
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              placeholder="New Dept (e.g. IT)..."
              className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
            />
            <button
              onClick={handleAddDepartment}
              disabled={!newDept}
              className="bg-slate-900 text-white p-2 rounded-lg hover:bg-black disabled:opacity-50"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {(config.departments || []).map((dept) => (
              <div
                key={dept}
                className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100 group hover:border-slate-300"
              >
                <span className="text-sm font-medium text-slate-700">
                  {dept}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEditClick("department", dept)}
                    disabled={!!checkingItem}
                    className="p-1 text-slate-400 hover:text-blue-600"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => requestDeleteDepartment(dept)}
                    disabled={checkingItem === dept}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    {checkingItem === dept ? (
                      <Loader2
                        size={16}
                        className="animate-spin text-slate-400"
                      />
                    ) : (
                      <X size={16} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 p-6 rounded-xl border border-red-100 mt-8">
        <div className="flex items-center gap-3 mb-2 text-red-700">
          <AlertTriangle size={24} />
          <h3 className="font-bold text-lg">Danger Zone</h3>
        </div>
        <p className="text-red-600 text-sm mb-4">
          Irreversible actions. Proceed with caution.
        </p>
        <button
          onClick={requestResetDatabase}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm"
        >
          <Trash2 size={16} /> Reset Database (Clear All Data)
        </button>
      </div>

      {/* Toast Notifications (Fixed) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {successMsg && (
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg shadow-emerald-200 flex items-center gap-2 text-sm animate-in slide-in-from-bottom-5 pointer-events-auto">
            <Check size={18} /> {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg shadow-red-200 flex items-center gap-2 text-sm animate-in slide-in-from-bottom-5 pointer-events-auto">
            <AlertTriangle size={18} /> {errorMsg}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 animate-in fade-in zoom-in">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-red-50 p-3 rounded-full text-red-600">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {deleteConfirmation.type === "reset"
                    ? "Reset Entire Database?"
                    : `Delete ${deleteConfirmation.type}?`}
                </h3>
                <p className="text-slate-500 text-sm mt-2">
                  {deleteConfirmation.type === "reset" ? (
                    "This will PERMANENTLY DELETE all assets, logs, tickets, invoices, and requests. This action cannot be undone."
                  ) : (
                    <span>
                      Permanently remove{" "}
                      <span className="font-semibold text-slate-900">
                        {deleteConfirmation.value}
                      </span>{" "}
                      from the system configuration?
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-3 w-full mt-4">
                <button
                  onClick={() =>
                    setDeleteConfirmation({
                      isOpen: false,
                      type: null,
                      value: "",
                    })
                  }
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-lg shadow-red-200"
                >
                  {deleteConfirmation.type === "reset"
                    ? "Yes, Reset Everything"
                    : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 animate-in fade-in zoom-in">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Rename Item
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  Renaming{" "}
                  <span className="font-semibold text-slate-800">
                    {editState.oldValue}
                  </span>{" "}
                  will also update all linked assets.
                </p>
              </div>
              <input
                value={editState.newValue}
                onChange={(e) =>
                  setEditState((prev) => ({
                    ...prev,
                    newValue: e.target.value,
                  }))
                }
                className="w-full p-3 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-slate-900"
                placeholder="Enter new name"
                autoFocus
              />
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() =>
                    setEditState((prev) => ({ ...prev, isOpen: false }))
                  }
                  disabled={editState.isProcessing}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmEdit}
                  disabled={
                    editState.isProcessing ||
                    !editState.newValue.trim() ||
                    editState.newValue === editState.oldValue
                  }
                  className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-black shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editState.isProcessing ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
