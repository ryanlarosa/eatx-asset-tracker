
import React, { useState, useEffect } from 'react';
import { Asset, ASSET_STATUSES, AssetLog } from '../types';
import { parseAssetDescription, isAiConfigured } from '../services/geminiService';
import { getAppConfig, getAssetLogs } from '../services/storageService';
import { Sparkles, Save, X, Loader2, Clock, User, Circle } from 'lucide-react';

interface AssetFormProps {
  initialData?: Asset | null;
  onSave: (asset: Asset) => void;
  onCancel: () => void;
}

const emptyAsset: Asset = {
  id: '',
  name: '',
  description: '',
  category: '',
  status: 'Active',
  location: '',
  assignedEmployee: '',
  serialNumber: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  purchaseCost: 0,
  lastUpdated: ''
};

const AssetForm: React.FC<AssetFormProps> = ({ initialData, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Asset>(emptyAsset);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [error, setError] = useState<string | null>(null);
  
  // History Logs
  const [logs, setLogs] = useState<AssetLog[]>([]);
  
  // Config state
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  // Check if AI is available in this environment
  const aiAvailable = isAiConfigured();

  useEffect(() => {
    const loadConfig = async () => {
        const config = await getAppConfig();
        setCategories(config.categories);
        setLocations(config.locations);

        if (initialData) {
            setFormData(initialData);
            // Load logs
            setLogs(await getAssetLogs(initialData.id));
        } else {
            setFormData({
                ...emptyAsset,
                id: `ast-${Math.random().toString(36).substr(2, 9)}`,
                category: config.categories[0] || 'Other',
                location: config.locations[0] || ''
            });
        }
    };
    loadConfig();
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'purchaseCost' ? parseFloat(value) || 0 : value
    }));
  };

  const handleAiParse = async () => {
    if (!aiInput.trim()) return;
    setIsAiLoading(true);
    setError(null);
    try {
      const parsedData = await parseAssetDescription(aiInput);
      setFormData(prev => ({
        ...prev,
        ...parsedData,
        id: prev.id 
      }));
      setMode('manual'); 
    } catch (err) {
      setError("Failed to parse with AI. Please check API Key configuration or enter manually.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        await onSave(formData);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">
          {initialData ? 'Edit Asset' : 'Onboard New Asset'}
        </h2>
        {!initialData && aiAvailable && (
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setMode('manual')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${mode === 'manual' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Manual
            </button>
            <button
              onClick={() => setMode('ai')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-all flex items-center gap-1 ${mode === 'ai' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Sparkles size={14} /> AI Assist
            </button>
          </div>
        )}
      </div>

      {mode === 'ai' && !initialData ? (
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Describe the assets to onboard
            </label>
            <textarea
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 min-h-[120px]"
              placeholder="e.g., Assigned a new MacBook Air M2 to Sarah from HR today, approximate value 4500 AED. Also bought 3 Hikvision security cameras for the warehouse."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleAiParse}
                disabled={isAiLoading || !aiInput.trim()}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-black disabled:opacity-50 transition-colors"
              >
                {isAiLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Generate Details
              </button>
            </div>
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Asset Name</label>
              <input
                required
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                placeholder="e.g. Epson Receipt Printer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
              <input
                type="text"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              >
                {ASSET_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
               <select
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              >
                <option value="" disabled>Select Location</option>
                {locations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Employee</label>
              <input
                type="text"
                name="assignedEmployee"
                value={formData.assignedEmployee || ''}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                placeholder="e.g. John Doe (Optional)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cost (AED)</label>
              <input
                type="number"
                name="purchaseCost"
                value={formData.purchaseCost}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Date</label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description / Notes</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <X size={18} /> Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-black shadow-sm transition-colors flex items-center gap-2 disabled:opacity-70"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {isSaving ? 'Saving...' : 'Save Asset'}
            </button>
          </div>
        </form>
      )}

      {/* History Timeline */}
      {initialData && logs.length > 0 && (
        <div className="mt-8 pt-8 border-t border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Clock size={20} /> Asset History
            </h3>
            <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:h-full before:w-[2px] before:bg-slate-100">
                {logs.map((log) => (
                    <div key={log.id} className="relative flex items-start gap-4">
                        <div className={`z-10 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${log.action === 'Created' ? 'bg-emerald-100 text-emerald-600' : log.action === 'Returned' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                            <Circle size={12} fill="currentColor" />
                        </div>
                        <div className="flex-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="flex justify-between items-start">
                                <span className="font-semibold text-slate-800 text-sm">{log.action}</span>
                                <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{log.details}</p>
                            <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                                <User size={12} /> {log.performedBy}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default AssetForm;
