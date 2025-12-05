
import React, { useState, useEffect } from 'react';
import { getAppConfig, saveAppConfig, getAssets, getCurrentUserProfile, getAllUsers, updateUserRole } from '../services/storageService';
import { AppConfig, UserProfile, UserRole } from '../types';
import { Plus, X, Shield, Users, Loader2, Info, Check } from 'lucide-react';

const Settings: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({ categories: [], locations: [] });
  const [newCat, setNewCat] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Auth Check
  const currentUser = getCurrentUserProfile();
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    const init = async () => {
        setConfig(await getAppConfig());
        if (isAdmin) {
            refreshUsers();
        }
    };
    init();
  }, [isAdmin]);

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
          setUsers(users.map(u => u.uid === uid ? { ...u, role: newRole } : u));
          setSuccessMsg(`User role updated to ${newRole}`);
          setTimeout(() => setSuccessMsg(''), 3000);
      } catch (e) {
          alert("Failed to update role");
      }
  };

  const handleAddCategory = async () => {
    if (newCat && !config.categories.includes(newCat)) {
      const updated = { ...config, categories: [...config.categories, newCat] };
      setConfig(updated);
      await saveAppConfig(updated);
      setNewCat('');
    }
  };

  const handleDeleteCategory = async (cat: string) => {
      const assets = await getAssets();
      if (assets.some(a => a.category === cat)) {
          alert(`Cannot delete category '${cat}' because it is in use by active assets.`);
          return;
      }
      const updated = { ...config, categories: config.categories.filter(c => c !== cat) };
      setConfig(updated);
      await saveAppConfig(updated);
  };

  const handleAddLocation = async () => {
    if (newLoc && !config.locations.includes(newLoc)) {
      const updated = { ...config, locations: [...config.locations, newLoc] };
      setConfig(updated);
      await saveAppConfig(updated);
      setNewLoc('');
    }
  };
  
  const handleDeleteLocation = async (loc: string) => {
      const assets = await getAssets();
      if (assets.some(a => a.location === loc)) {
          alert(`Cannot delete location '${loc}' because it is in use by active assets.`);
          return;
      }
      const updated = { ...config, locations: config.locations.filter(l => l !== loc) };
      setConfig(updated);
      await saveAppConfig(updated);
  };

  if (!isAdmin) {
      return (
          <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-slate-200">
              <Shield className="mx-auto text-red-500 mb-4" size={48} />
              <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
              <p className="text-slate-500 mt-2">Only Administrators can access System Configuration.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <h1 className="text-2xl font-bold text-slate-800">System Configuration</h1>
         <div className="flex items-center gap-2 text-xs font-mono text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
             <Check size={14} />
             <span>Connected to Cloud</span>
         </div>
      </div>

      {successMsg && <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm"><Check size={16} /> {successMsg}</div>}

      {/* User Management */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Users size={20} /> User Management
            </h3>
            <button onClick={refreshUsers} className="text-sm text-slate-500 hover:text-slate-900 underline">Refresh List</button>
          </div>
          
          {isLoadingUsers ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
          ) : (
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="p-3 font-medium text-slate-600">Email</th>
                              <th className="p-3 font-medium text-slate-600">Current Role</th>
                              <th className="p-3 font-medium text-slate-600 text-right">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {users.map(u => (
                              <tr key={u.uid} className="hover:bg-slate-50">
                                  <td className="p-3 text-slate-800 font-medium">
                                    {u.email} 
                                    {currentUser?.uid === u.uid && <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">You</span>}
                                  </td>
                                  <td className="p-3">
                                      <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${
                                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                          u.role === 'technician' ? 'bg-blue-100 text-blue-700' :
                                          'bg-slate-100 text-slate-600'
                                      }`}>
                                          {u.role || 'Viewer'}
                                      </span>
                                  </td>
                                  <td className="p-3 text-right">
                                      <select 
                                        value={u.role}
                                        onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Categories Config */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Asset Categories</h3>
          <div className="flex gap-2 mb-4">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New Category..." className="flex-1 p-2 border border-slate-300 rounded-lg" />
            <button onClick={handleAddCategory} disabled={!newCat} className="bg-slate-900 text-white p-2 rounded-lg hover:bg-black disabled:opacity-50"><Plus size={20} /></button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {config.categories.map(cat => (
              <div key={cat} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100 group hover:border-slate-300">
                <span className="text-sm font-medium text-slate-700">{cat}</span>
                <button onClick={() => handleDeleteCategory(cat)} className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Locations Config */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Locations</h3>
          <div className="flex gap-2 mb-4">
            <input value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="New Location..." className="flex-1 p-2 border border-slate-300 rounded-lg" />
            <button onClick={handleAddLocation} disabled={!newLoc} className="bg-slate-900 text-white p-2 rounded-lg hover:bg-black disabled:opacity-50"><Plus size={20} /></button>
          </div>
           <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {config.locations.map(loc => (
              <div key={loc} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100 group hover:border-slate-300">
                <span className="text-sm font-medium text-slate-700">{loc}</span>
                <button onClick={() => handleDeleteLocation(loc)} className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
