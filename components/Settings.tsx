
import React, { useState, useEffect } from 'react';
import { getAppConfig, saveAppConfig, getAssets, getCurrentUserProfile, getAllUsers, updateUserRole, adminCreateUser, resetDatabase, renameMasterDataItem, getSandboxStatus, setSandboxMode, getEmailConfig, saveEmailConfig, sendSystemEmail } from '../services/storageService';
import { AppConfig, UserProfile, UserRole, EmailConfig } from '../types';
import { Plus, X, Shield, Users, Loader2, Check, Mail, Lock, AlertTriangle, Trash2, Edit2, Database, Bell, Save, Send } from 'lucide-react';

const Settings: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({ categories: [], locations: [], departments: [] });
  const [newCat, setNewCat] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [newDept, setNewDept] = useState('');
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Email Config State
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({ serviceId: '', templateId: '', publicKey: '', targetEmail: '', enabled: false });
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  // Create User State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('viewer');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Constraint Checking State
  const [checkingItem, setCheckingItem] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    type: 'category' | 'location' | 'department' | 'reset' | null;
    value: string;
  }>({ isOpen: false, type: null, value: '' });

  // Edit State
  const [editState, setEditState] = useState<{
      isOpen: boolean;
      type: 'category' | 'location' | 'department' | null;
      oldValue: string;
      newValue: string;
      isProcessing: boolean;
  }>({ isOpen: false, type: null, oldValue: '', newValue: '', isProcessing: false });

  // Sandbox State
  const isSandbox = getSandboxStatus();

  // Auth Check
  const currentUser = getCurrentUserProfile();
  const isAdmin = currentUser?.role === 'admin';
  const isSandboxUser = currentUser?.role === 'sandbox_user';

  useEffect(() => {
    const init = async () => {
        setConfig(await getAppConfig());
        const mailConf = await getEmailConfig();
        if (mailConf) setEmailConfig(mailConf);
        if (isAdmin) {
            refreshUsers();
        }
    };
    init();
  }, [isAdmin]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
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
          setUsers(users.map(u => u.uid === uid ? { ...u, role: newRole } : u));
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
      setErrorMsg('');
      try {
          await adminCreateUser(newUserEmail, newUserPass, newUserRole);
          setNewUserEmail('');
          setNewUserPass('');
          await refreshUsers();
          showSuccess(`User ${newUserEmail} created successfully.`);
      } catch(e: any) {
          if (e.code === 'auth/email-already-in-use') {
              showError("Email already exists.");
          } else {
              showError("Failed to create user. " + e.message);
          }
      } finally {
          setIsCreatingUser(false);
      }
  };

  const handleSaveEmailConfig = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSavingEmail(true);
      try {
          await saveEmailConfig(emailConfig);
          showSuccess("Email preferences saved.");
      } catch(e) {
          showError("Failed to save email settings.");
      } finally {
          setIsSavingEmail(false);
      }
  };

  const handleTestEmail = async () => {
      if (!emailConfig.enabled || !emailConfig.serviceId) {
          showError("Please enable and save configuration first.");
          return;
      }
      setIsTestingEmail(true);
      try {
          // We assume config is saved, but we can also pass current state if we refactored service.
          // For now, rely on saved config as per service architecture.
          await saveEmailConfig(emailConfig); // Save first to ensure service uses latest
          
          await sendSystemEmail(
              "Test Notification", 
              "This is a test email from your AssetTrack System. If you are reading this, the integration is working correctly.",
              window.location.href
          );
          showSuccess(`Test email sent to ${emailConfig.targetEmail}`);
      } catch (e) {
          showError("Failed to send test email. Check console.");
      } finally {
          setIsTestingEmail(false);
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

  const requestDeleteCategory = async (cat: string) => {
      setCheckingItem(cat);
      try {
        const assets = await getAssets();
        if (assets.some(a => a.category === cat)) {
            showError(`Cannot delete '${cat}': Linked to active assets.`);
            return;
        }
        setDeleteConfirmation({ isOpen: true, type: 'category', value: cat });
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
      setNewLoc('');
    }
  };
  
  const requestDeleteLocation = async (loc: string) => {
      setCheckingItem(loc);
      try {
        const assets = await getAssets();
        if (assets.some(a => a.location === loc)) {
            showError(`Cannot delete '${loc}': Linked to active assets.`);
            return;
        }
        setDeleteConfirmation({ isOpen: true, type: 'location', value: loc });
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
        setNewDept('');
    }
  };

  const requestDeleteDepartment = async (dept: string) => {
      setCheckingItem(dept);
      try {
        const assets = await getAssets();
        if (assets.some(a => a.department === dept)) {
            showError(`Cannot delete '${dept}': Linked to active assets.`);
            return;
        }
        setDeleteConfirmation({ isOpen: true, type: 'department', value: dept });
      } catch (e) {
        showError("Failed to verify assets.");
      } finally {
        setCheckingItem(null);
      }
  };

  const requestResetDatabase = () => {
      setDeleteConfirmation({ isOpen: true, type: 'reset', value: 'ALL DATA' });
  };

  const confirmDelete = async () => {
      const { type, value } = deleteConfirmation;
      
      if (type === 'reset') {
          await resetDatabase();
          showSuccess("Database has been reset.");
          setDeleteConfirmation({ isOpen: false, type: null, value: '' });
          return;
      }

      if (!type || !value) return;

      let updated = { ...config };

      if (type === 'category') {
          updated.categories = config.categories.filter(c => c !== value);
      } else if (type === 'location') {
          updated.locations = config.locations.filter(l => l !== value);
      } else if (type === 'department') {
          updated.departments = config.departments?.filter(d => d !== value) || [];
      }

      setConfig(updated);
      await saveAppConfig(updated);
      setDeleteConfirmation({ isOpen: false, type: null, value: '' });
      showSuccess(`${value} deleted.`);
  };

  const handleEditClick = (type: 'category' | 'location' | 'department', value: string) => {
      setEditState({
          isOpen: true,
          type,
          oldValue: value,
          newValue: value,
          isProcessing: false
      });
  };

  const confirmEdit = async () => {
      const { type, oldValue, newValue } = editState;
      if (!type || !newValue.trim() || oldValue === newValue) {
          setEditState(prev => ({ ...prev, isOpen: false }));
          return;
      }
      
      setEditState(prev => ({ ...prev, isProcessing: true }));
      try {
          await renameMasterDataItem(type, oldValue, newValue);
          
          // Update local state immediately for UI response
          const updated = { ...config };
          if (type === 'category') {
             updated.categories = config.categories.map(c => c === oldValue ? newValue : c);
          } else if (type === 'location') {
             updated.locations = config.locations.map(l => l === oldValue ? newValue : l);
          } else if (type === 'department') {
             updated.departments = (config.departments || []).map(d => d === oldValue ? newValue : d);
          }
          setConfig(updated);
          
          showSuccess(`Renamed to '${newValue}'. Linked assets updated.`);
          setEditState(prev => ({ ...prev, isOpen: false }));
      } catch (e) {
          showError("Failed to rename item.");
      } finally {
          setEditState(prev => ({ ...prev, isProcessing: false }));
      }
  };

  const inputClass = "w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600";

  if (!isAdmin && !isSandboxUser) {
      return (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
              <Shield className="mx-auto text-red-500 mb-4" size={48} />
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Access Denied</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Only Administrators can access System Configuration.</p>
          </div>
      );
  }

  // Sandbox Users can only see the Sandbox Toggle (locked to ON)
  if (isSandboxUser) {
      return (
         <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">System Configuration</h1>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Database size={20} /> Database Environment
                    </h3>
                    <div className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        Sandbox Mode
                    </div>
                </div>
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-900/30 flex items-center gap-3">
                    <Lock size={20} className="text-amber-600 dark:text-amber-400"/>
                    <p className="text-sm text-amber-800 dark:text-amber-200">Your account is restricted to the Sandbox Environment. You cannot switch to Live.</p>
                </div>
            </div>
         </div>
      );
  }

  return (
    <div className="space-y-6 relative pb-12">
      <div className="flex items-center justify-between">
         <h1 className="text-2xl font-bold text-slate-800 dark:text-white">System Configuration</h1>
         <div className="flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/30">
             <Check size={14} />
             <span>Connected to Cloud</span>
         </div>
      </div>

      {/* Database Mode Config */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Database size={20} /> Database Environment
            </h3>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isSandbox ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                {isSandbox ? 'Sandbox Mode' : 'Live Mode'}
            </div>
        </div>
        
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="max-w-lg">
                <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Sandbox Testing Mode</div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Switch to a separate database environment for testing. Data created in Sandbox will not affect the Live system. 
                    <br/><strong className="text-amber-600 dark:text-amber-400">Note:</strong> Switching modes will reload the application.
                </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={isSandbox}
                    onChange={(e) => setSandboxMode(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 dark:peer-focus:ring-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300">{isSandbox ? 'Enabled' : 'Disabled'}</span>
            </label>
        </div>
      </div>

      {/* Notification Preferences (EmailJS) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Bell size={20} /> Notification Preferences
            </h3>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30 flex items-start gap-3 mb-6">
              <Mail size={20} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                  <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">Email Alerts</h4>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                      Configure <a href="https://www.emailjs.com" target="_blank" rel="noreferrer" className="underline font-bold">EmailJS</a> to send real-time alerts for critical events (Ticket Created, Handover Signed).
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                      Template Variables: <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{{title}}'}</span>, <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{{message}}'}</span>, <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{{link}}'}</span>, <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{{date}}'}</span>
                  </p>
              </div>
          </div>

          <form onSubmit={handleSaveEmailConfig} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" id="emailEnabled" checked={emailConfig.enabled} onChange={e => setEmailConfig({...emailConfig, enabled: e.target.checked})} className="rounded border-slate-300" />
                  <label htmlFor="emailEnabled" className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Email Notifications</label>
              </div>
              
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!emailConfig.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Service ID</label>
                      <input className={inputClass} value={emailConfig.serviceId} onChange={e => setEmailConfig({...emailConfig, serviceId: e.target.value})} placeholder="service_xxx" />
                  </div>
                  <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Template ID</label>
                      <input className={inputClass} value={emailConfig.templateId} onChange={e => setEmailConfig({...emailConfig, templateId: e.target.value})} placeholder="template_xxx" />
                  </div>
                  <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Public Key</label>
                      <input className={inputClass} value={emailConfig.publicKey} onChange={e => setEmailConfig({...emailConfig, publicKey: e.target.value})} placeholder="user_xxx" type="password" />
                  </div>
                  <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Receiver Email (IT Manager)</label>
                      <input className={inputClass} value={emailConfig.targetEmail} onChange={e => setEmailConfig({...emailConfig, targetEmail: e.target.value})} placeholder="it@eatx.com" type="email" />
                  </div>
              </div>
              <div className="flex justify-end gap-3">
                  <button type="button" onClick={handleTestEmail} disabled={isTestingEmail || !emailConfig.enabled} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50">
                      {isTestingEmail ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>} Test
                  </button>
                  <button type="submit" disabled={isSavingEmail} className="bg-slate-900 dark:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50">
                      {isSavingEmail ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Save Configuration
                  </button>
              </div>
          </form>
      </div>

      {/* User Management */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Users size={20} /> User Management
            </h3>
            <button onClick={refreshUsers} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline">Refresh List</button>
          </div>

          <div className="mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><Mail size={16}/> Create New User</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Create an account for a new employee. You will need to share these credentials with them manually.</p>
              
              <form onSubmit={handleCreateUser} className="flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                      <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Email Address</label>
                      <input 
                        type="email" 
                        required 
                        placeholder="new.user@eatx.com" 
                        value={newUserEmail} 
                        onChange={e => setNewUserEmail(e.target.value)}
                        className={inputClass}
                      />
                  </div>
                  <div className="flex-1 w-full">
                      <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Password (min 6 chars)</label>
                      <input 
                        type="password" 
                        required 
                        placeholder="••••••" 
                        value={newUserPass} 
                        onChange={e => setNewUserPass(e.target.value)}
                        className={inputClass}
                      />
                  </div>
                  <div className="w-full md:w-32">
                      <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Role</label>
                      <select 
                        value={newUserRole}
                        onChange={e => setNewUserRole(e.target.value as UserRole)}
                        className={inputClass}
                      >
                          <option value="viewer">Viewer</option>
                          <option value="technician">Technician</option>
                          <option value="admin">Admin</option>
                          <option value="sandbox_user">Sandbox User</option>
                      </select>
                  </div>
                  <button disabled={isCreatingUser} type="submit" className="w-full md:w-auto bg-slate-900 dark:bg-blue-600 text-white p-2 px-4 rounded-lg text-sm font-medium hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      {isCreatingUser ? <Loader2 className="animate-spin" size={18}/> : <Plus size={18}/>} Create
                  </button>
              </form>
          </div>
          
          {isLoadingUsers ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
          ) : (
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                              <th className="p-3 font-medium text-slate-600 dark:text-slate-300">User</th>
                              <th className="p-3 font-medium text-slate-600 dark:text-slate-300">Status</th>
                              <th className="p-3 font-medium text-slate-600 dark:text-slate-300">Role</th>
                              <th className="p-3 font-medium text-slate-600 dark:text-slate-300 text-right">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                          {users.map(u => (
                              <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                  <td className="p-3 text-slate-800 dark:text-slate-200 font-medium">
                                    {u.email} 
                                    {currentUser?.uid === u.uid && <span className="ml-2 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-xs">You</span>}
                                  </td>
                                  <td className="p-3 text-emerald-600 dark:text-emerald-400 text-xs font-medium">Active</td>
                                  <td className="p-3">
                                      <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${
                                          u.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                          u.role === 'technician' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                          u.role === 'sandbox_user' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                                          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                      }`}>
                                          {u.role === 'sandbox_user' ? 'Sandbox User' : u.role || 'Viewer'}
                                      </span>
                                  </td>
                                  <td className="p-3 text-right">
                                      <select 
                                        value={u.role}
                                        onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                                        className="p-1.5 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600 text-xs bg-white dark:bg-slate-900"
                                        disabled={currentUser?.uid === u.uid}
                                      >
                                          <option value="admin">Promote to Admin</option>
                                          <option value="technician">Set as Technician</option>
                                          <option value="viewer">Demote to Viewer</option>
                                          <option value="sandbox_user">Restrict to Sandbox</option>
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
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">Categories</h3>
          <div className="flex gap-2 mb-4">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New Category..." className={inputClass} />
            <button onClick={handleAddCategory} disabled={!newCat} className="bg-slate-900 dark:bg-blue-600 text-white p-2 rounded-lg hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50"><Plus size={18} /></button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {config.categories.map(cat => (
              <div key={cat} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 group hover:border-slate-300 dark:hover:border-slate-500">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cat}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => handleEditClick('category', cat)} 
                        disabled={!!checkingItem}
                        className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button 
                        onClick={() => requestDeleteCategory(cat)} 
                        disabled={checkingItem === cat}
                        className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                        {checkingItem === cat ? <Loader2 size={16} className="animate-spin text-slate-400"/> : <X size={16} />}
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Locations Config */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">Locations</h3>
          <div className="flex gap-2 mb-4">
            <input value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="New Location..." className={inputClass} />
            <button onClick={handleAddLocation} disabled={!newLoc} className="bg-slate-900 dark:bg-blue-600 text-white p-2 rounded-lg hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50"><Plus size={18} /></button>
          </div>
           <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {config.locations.map(loc => (
              <div key={loc} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 group hover:border-slate-300 dark:hover:border-slate-500">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{loc}</span>
                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => handleEditClick('location', loc)} 
                        disabled={!!checkingItem}
                        className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button 
                        onClick={() => requestDeleteLocation(loc)} 
                        disabled={checkingItem === loc}
                        className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                        {checkingItem === loc ? <Loader2 size={16} className="animate-spin text-slate-400"/> : <X size={16} />}
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Departments Config */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">Departments</h3>
          <div className="flex gap-2 mb-4">
            <input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="New Dept..." className={inputClass} />
            <button onClick={handleAddDepartment} disabled={!newDept} className="bg-slate-900 dark:bg-blue-600 text-white p-2 rounded-lg hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50"><Plus size={18} /></button>
          </div>
           <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {(config.departments || []).map(dept => (
              <div key={dept} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 group hover:border-slate-300 dark:hover:border-slate-500">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{dept}</span>
                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => handleEditClick('department', dept)} 
                        disabled={!!checkingItem}
                        className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button 
                        onClick={() => requestDeleteDepartment(dept)} 
                        disabled={checkingItem === dept}
                        className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                        {checkingItem === dept ? <Loader2 size={16} className="animate-spin text-slate-400"/> : <X size={16} />}
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-xl border border-red-100 dark:border-red-900/30 mt-8">
          <div className="flex items-center gap-3 mb-2 text-red-700 dark:text-red-400">
              <AlertTriangle size={24} />
              <h3 className="font-bold text-lg">Danger Zone</h3>
          </div>
          <p className="text-red-600 dark:text-red-400/80 text-sm mb-4">Irreversible actions. Proceed with caution.</p>
          <button 
            onClick={requestResetDatabase}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm"
          >
              <Trash2 size={16} /> Reset {isSandbox ? 'Sandbox' : 'Live'} Database (Clear All Data)
          </button>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
          {successMsg && (
            <div className="bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg shadow-emerald-200 dark:shadow-emerald-900/50 flex items-center gap-2 text-sm animate-in slide-in-from-bottom-5 pointer-events-auto">
                <Check size={18} /> {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg shadow-red-200 dark:shadow-red-900/50 flex items-center gap-2 text-sm animate-in slide-in-from-bottom-5 pointer-events-auto">
                <AlertTriangle size={18} /> {errorMsg}
            </div>
          )}
      </div>

      {/* Confirmation Modal */}
      {deleteConfirmation.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded-full text-red-600 dark:text-red-400"><AlertTriangle size={32} /></div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            {deleteConfirmation.type === 'reset' ? 'Reset Entire Database?' : `Delete ${deleteConfirmation.type}?`}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
                            {deleteConfirmation.type === 'reset' 
                                ? `This will PERMANENTLY DELETE all assets, logs, tickets, invoices, and requests in ${isSandbox ? 'SANDBOX' : 'LIVE'} mode. This action cannot be undone.`
                                : <span>Permanently remove <span className="font-semibold text-slate-900 dark:text-white">{deleteConfirmation.value}</span> from the system configuration?</span>
                            }
                        </p>
                    </div>
                    <div className="flex gap-3 w-full mt-4">
                        <button 
                            onClick={() => setDeleteConfirmation({ isOpen: false, type: null, value: '' })} 
                            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmDelete} 
                            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-red-900/30"
                        >
                            {deleteConfirmation.type === 'reset' ? 'Yes, Reset Everything' : 'Yes, Delete'}
                        </button>
                    </div>
                </div>
            </div>
          </div>
      )}

      {/* Edit Modal */}
      {editState.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in">
                <div className="flex flex-col gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rename Item</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            Renaming <span className="font-semibold text-slate-800 dark:text-white">{editState.oldValue}</span> will also update all linked assets.
                        </p>
                    </div>
                    <input 
                        value={editState.newValue}
                        onChange={(e) => setEditState(prev => ({ ...prev, newValue: e.target.value }))}
                        className={`font-medium ${inputClass}`}
                        placeholder="Enter new name"
                        autoFocus
                    />
                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setEditState(prev => ({ ...prev, isOpen: false }))} 
                            disabled={editState.isProcessing}
                            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmEdit} 
                            disabled={editState.isProcessing || !editState.newValue.trim() || editState.newValue === editState.oldValue}
                            className="flex-1 px-4 py-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg font-medium hover:bg-black dark:hover:bg-blue-700 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {editState.isProcessing ? <Loader2 className="animate-spin" size={16} /> : 'Save Changes'}
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
