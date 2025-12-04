
import React, { useState, useEffect } from 'react';
import { getAppConfig, saveAppConfig, resetDatabase, getDBSettings, saveDBSettings, getAssets } from '../services/storageService';
import { AppConfig, DatabaseSettings } from '../types';
import { Plus, X, Save, AlertTriangle, Database, Cloud, HardDrive, Info, Trash2, CheckCircle } from 'lucide-react';

const Settings: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({ categories: [], locations: [] });
  const [dbSettings, setDbSettings] = useState<DatabaseSettings>({ useFirebase: false });
  const [firebaseJson, setFirebaseJson] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newLoc, setNewLoc] = useState('');
  
  // Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'category' | 'location';
    value: string;
    isInUse: boolean;
  }>({ isOpen: false, type: 'category', value: '', isInUse: false });

  useEffect(() => {
    const init = async () => {
        setConfig(await getAppConfig());
        const settings = getDBSettings();
        setDbSettings(settings);
        if (settings.firebaseConfig) {
            setFirebaseJson(JSON.stringify(settings.firebaseConfig, null, 2));
        }
    };
    init();
  }, []);

  const handleAddCategory = async () => {
    if (newCat && !config.categories.includes(newCat)) {
      const updated = { ...config, categories: [...config.categories, newCat] };
      setConfig(updated);
      await saveAppConfig(updated);
      setNewCat('');
    }
  };

  const initiateDelete = async (type: 'category' | 'location', value: string) => {
    const assets = await getAssets();
    let isUsed = false;
    
    if (type === 'category') {
        isUsed = assets.some(a => a.category === value);
    } else {
        isUsed = assets.some(a => a.location === value);
    }

    setDeleteModal({
        isOpen: true,
        type,
        value,
        isInUse: isUsed
    });
  };

  const confirmDelete = async () => {
    const { type, value, isInUse } = deleteModal;
    
    if (isInUse) {
        // Should not happen if UI is correct, but extra safety
        return; 
    }

    if (type === 'category') {
      const updated = { ...config, categories: config.categories.filter(c => c !== value) };
      setConfig(updated);
      await saveAppConfig(updated);
    } else {
      const updated = { ...config, locations: config.locations.filter(l => l !== value) };
      setConfig(updated);
      await saveAppConfig(updated);
    }
    
    setDeleteModal({ ...deleteModal, isOpen: false });
  };

  const handleAddLocation = async () => {
    if (newLoc && !config.locations.includes(newLoc)) {
      const updated = { ...config, locations: [...config.locations, newLoc] };
      setConfig(updated);
      await saveAppConfig(updated);
      setNewLoc('');
    }
  };

  const handleReset = () => {
    if (confirm('WARNING: This will delete ALL assets and projects permanently. This cannot be undone. Are you sure?')) {
      resetDatabase();
    }
  };

  const sanitizeInputToJSON = (input: string): string => {
      let cleaned = input.trim();
      
      // 1. Remove JavaScript comments // ...
      cleaned = cleaned.replace(/\/\/.*$/gm, '');
      
      // 2. Remove "const firebaseConfig =" and trailing semicolon
      cleaned = cleaned.replace(/const\s+\w+\s*=\s*/, '');
      cleaned = cleaned.replace(/;$/, '');
      
      // 3. Attempt to quote unquoted keys (basic heuristic for apiKey: "val")
      // Finds alphanumeric keys followed by a colon and adds quotes
      cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
      
      // 4. Clean up trailing commas before closing braces (invalid in strict JSON)
      cleaned = cleaned.replace(/,(\s*})/g, '$1');

      return cleaned;
  };

  const handleSaveDbSettings = () => {
      try {
          let fbConfig = undefined;
          if (dbSettings.useFirebase) {
             if (!firebaseJson.trim()) {
                 alert("Please paste the Firebase Config JSON");
                 return;
             }
             
             // Try to parse, if fails, try to sanitize
             try {
                fbConfig = JSON.parse(firebaseJson);
             } catch (e) {
                 const sanitized = sanitizeInputToJSON(firebaseJson);
                 try {
                     fbConfig = JSON.parse(sanitized);
                     // If successful, update the text box to the clean version
                     setFirebaseJson(JSON.stringify(fbConfig, null, 2));
                 } catch (e2) {
                     throw new Error("Could not parse JSON. Please ensure keys are quoted.");
                 }
             }

             if (!fbConfig.apiKey) {
                 alert("Invalid Firebase Config: Missing 'apiKey'. Please check your JSON.");
                 return;
             }
             if (!fbConfig.projectId) {
                 alert("Invalid Firebase Config: Missing 'projectId'. Please check your JSON.");
                 return;
             }
          }
          
          saveDBSettings({
              useFirebase: dbSettings.useFirebase,
              firebaseConfig: fbConfig
          });
          alert("Database settings saved. The app will reload.");
      } catch (e) {
          alert("Invalid JSON format. \n\nTip: You can paste the raw JS from Firebase, we try to auto-convert it, but if that fails, ensure all keys are in double quotes like \"apiKey\": \"...\"");
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <h1 className="text-2xl font-bold text-slate-800">System Configuration</h1>
         <div className="bg-slate-100 text-slate-600 px-3 py-1 rounded text-xs font-mono">
            {dbSettings.useFirebase ? 'Cloud Mode (Firebase)' : 'Local Mode (Browser)'}
         </div>
      </div>

      {/* Database Connection */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Database size={20} /> Database Connection
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button 
                onClick={() => setDbSettings({ ...dbSettings, useFirebase: false })}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${!dbSettings.useFirebase ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
                <HardDrive size={32} />
                <span className="font-semibold">Local Storage</span>
                <span className="text-xs opacity-80">Data stays on this device</span>
            </button>
            <button 
                onClick={() => setDbSettings({ ...dbSettings, useFirebase: true })}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${dbSettings.useFirebase ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
                <Cloud size={32} />
                <span className="font-semibold">Firebase Cloud</span>
                <span className="text-xs opacity-80">Sync across devices</span>
            </button>
        </div>

        {dbSettings.useFirebase && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-fade-in">
                <label className="block text-sm font-medium text-slate-700 mb-2">Firebase Config</label>
                <textarea 
                    value={firebaseJson}
                    onChange={(e) => setFirebaseJson(e.target.value)}
                    className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg h-32 focus:ring-2 focus:ring-slate-900"
                    placeholder={`Paste the 'const firebaseConfig = { ... }' code block here directly from Firebase Console.`}
                />
                <div className="mt-2 text-xs text-slate-500 flex items-start gap-1">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <span>Paste the full code block from Firebase Console &gt; Project Settings. We will automatically format it for you.</span>
                </div>
            </div>
        )}
        
        <div className="mt-4 flex justify-end">
            <button 
                onClick={handleSaveDbSettings}
                className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-black flex items-center gap-2"
            >
                <Save size={18} /> Save & Connect
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Categories Config */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Asset Categories</h3>
          <div className="flex gap-2 mb-4">
            <input 
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="New Category..."
              className="flex-1 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
            />
            <button 
              onClick={handleAddCategory}
              disabled={!newCat}
              className="bg-slate-900 text-white p-2 rounded-lg hover:bg-black disabled:opacity-50"
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {config.categories.map(cat => (
              <div key={cat} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100 group hover:border-slate-300 transition-colors">
                <span className="text-sm font-medium text-slate-700">{cat}</span>
                <button 
                  onClick={() => initiateDelete('category', cat)}
                  className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={16} />
                </button>
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
              className="flex-1 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
            />
            <button 
              onClick={handleAddLocation}
              disabled={!newLoc}
              className="bg-slate-900 text-white p-2 rounded-lg hover:bg-black disabled:opacity-50"
            >
              <Plus size={20} />
            </button>
          </div>
           <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {config.locations.map(loc => (
              <div key={loc} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100 group hover:border-slate-300 transition-colors">
                <span className="text-sm font-medium text-slate-700">{loc}</span>
                <button 
                  onClick={() => initiateDelete('location', loc)}
                  className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 p-6 rounded-xl border border-red-100">
        <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
          <AlertTriangle size={20} /> Danger Zone
        </h3>
        <p className="text-sm text-red-700 mb-4">
          Resetting the database will clear all locally stored assets and projects. This action cannot be undone.
        </p>
        <button 
          onClick={handleReset}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2"
        >
          <Trash2 size={16} /> Reset Database
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-100">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className={`p-3 rounded-full ${deleteModal.isInUse ? 'bg-amber-100 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                        {deleteModal.isInUse ? <Info size={32} /> : <AlertTriangle size={32} />}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">
                            {deleteModal.isInUse ? 'Cannot Delete' : 'Delete Item?'}
                        </h3>
                        <p className="text-slate-500 text-sm mt-2">
                            {deleteModal.isInUse ? (
                                <span>The {deleteModal.type} <strong>{deleteModal.value}</strong> is currently assigned to one or more assets. You must reassign or delete those assets first.</span>
                            ) : (
                                <span>Are you sure you want to remove <strong>{deleteModal.value}</strong> from the {deleteModal.type} list?</span>
                            )}
                        </p>
                    </div>
                    
                    <div className="flex gap-3 w-full mt-4">
                        <button 
                            onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                            className={`flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors ${deleteModal.isInUse ? 'bg-slate-900 text-white hover:bg-black border-none' : ''}`}
                        >
                            {deleteModal.isInUse ? 'Okay, I understand' : 'Cancel'}
                        </button>
                        
                        {!deleteModal.isInUse && (
                            <button 
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
