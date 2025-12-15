
import React, { useState, useEffect } from 'react';
import { Asset, ASSET_STATUSES, AssetLog } from '../types';
import { parseAssetDescription, isAiConfigured } from '../services/geminiService';
import { getAppConfig, getAssetLogs } from '../services/storageService';
import { Sparkles, Save, X, Loader2, Clock, User, Circle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';

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
  department: '',
  assignedEmployee: '',
  serialNumber: '',
  supplier: '',
  purchaseDate: '',
  purchaseCost: undefined,
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
  const [showHistory, setShowHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const LOGS_PER_PAGE = 5;
  
  // Config state
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  // Check if AI is available in this environment
  const aiAvailable = isAiConfigured();

  useEffect(() => {
    const loadConfig = async () => {
        const config = await getAppConfig();
        setCategories(config.categories);
        setLocations(config.locations);
        setDepartments(config.departments || []);

        if (initialData) {
            setFormData(initialData);
            // Load logs
            const assetLogs = await getAssetLogs(initialData.id);
            setLogs(assetLogs);
        } else {
            setFormData({
                ...emptyAsset,
                id: `ast-${Math.random().toString(36).substr(2, 9)}`,
                category: config.categories[0] || 'Other',
                location: config.locations[0] || '',
                department: config.departments?.[0] || ''
            });
        }
    };
    loadConfig();
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'purchaseCost' ? (value === '' ? undefined : parseFloat(value)) : value
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

  // Pagination Logic
  const totalPages = Math.ceil(logs.length / LOGS_PER_PAGE);
  const displayedLogs = logs.slice((historyPage - 1) * LOGS_PER_PAGE, historyPage * LOGS_PER_PAGE);

  const inputClass = "w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600 focus:border-transparent bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-all";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

  // Generate Deep Link URL for QR
  const qrUrl = initialData ? `${window.location.origin}${window.location.pathname}#/assets?id=${initialData.id}` : '';

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {initialData ? 'Edit Asset' : 'Onboard New Asset'}
        </h2>
        {!initialData && aiAvailable && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setMode('manual')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${mode === 'manual' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              Manual
            </button>
            <button
              onClick={() => setMode('ai')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-all flex items-center gap-1 ${mode === 'ai' ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <Sparkles size={14} /> AI Assist
            </button>
          </div>
        )}
      </div>

      {mode === 'ai' && !initialData ? (
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
              Describe the assets to onboard
            </label>
            <textarea
              className={inputClass}
              placeholder="e.g. Assigned a new MacBook Air M2 to Sarah from HR today, approximate value 4500 AED. Also bought 3 Hikvision security cameras for the warehouse from Jumbo Electronics."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              rows={4}
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleAiParse}
                disabled={isAiLoading || !aiInput.trim()}
                className="flex items-center gap-2 bg-slate-900 dark:bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isAiLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Generate Details
              </button>
            </div>
            {error && <p className="text-red-600 dark:text-red-400 text-sm mt-2">{error}</p>}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col-reverse md:flex-row gap-6">
            <div className="flex-1 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                    <label className={labelClass}>Asset Name</label>
                    <input
                        required
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="e.g. Epson Receipt Printer"
                    />
                    </div>
                    <div>
                    <label className={labelClass}>Serial Number</label>
                    <input
                        type="text"
                        name="serialNumber"
                        value={formData.serialNumber}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="Optional"
                    />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                    <label className={labelClass}>Category</label>
                    <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        className={inputClass}
                    >
                        {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    </div>
                    <div>
                    <label className={labelClass}>Status</label>
                    <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className={inputClass}
                    >
                        {ASSET_STATUSES.map(status => (
                        <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                    <label className={labelClass}>Location</label>
                    <select
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        className={inputClass}
                    >
                        <option value="" disabled>Select Location</option>
                        {locations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                    </div>
                    <div>
                    <label className={labelClass}>Department</label>
                    <select
                        name="department"
                        value={formData.department || ''}
                        onChange={handleChange}
                        className={inputClass}
                    >
                        <option value="">None</option>
                        {departments.map(d => (
                        <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                    </div>
                    <div>
                    <label className={labelClass}>Assigned Employee</label>
                    <input
                        type="text"
                        name="assignedEmployee"
                        value={formData.assignedEmployee || ''}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="e.g. John Doe (Optional)"
                    />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                    <label className={labelClass}>Supplier / Vendor</label>
                    <input
                        type="text"
                        name="supplier"
                        value={formData.supplier || ''}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="e.g. Amazon, Jumbo"
                    />
                    </div>
                    <div>
                    <label className={labelClass}>Cost (AED)</label>
                    <input
                        type="number"
                        name="purchaseCost"
                        value={formData.purchaseCost === undefined ? '' : formData.purchaseCost}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="Optional"
                        className={inputClass}
                    />
                    </div>
                    <div>
                    <label className={labelClass}>Purchase Date</label>
                    <input
                        type="date"
                        name="purchaseDate"
                        value={formData.purchaseDate || ''}
                        onChange={handleChange}
                        className={inputClass}
                    />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>Description / Notes</label>
                    <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className={inputClass}
                    />
                </div>
            </div>

            {/* QR Code Section */}
            {initialData && (
                <div className="md:w-48 flex flex-col items-center justify-start pt-6">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
                        <QRCode value={qrUrl} size={128} />
                        <span className="text-xs font-mono text-slate-500 mt-2">{initialData.id}</span>
                    </div>
                    <p className="text-xs text-center text-slate-400 mt-2">
                        Scan to View Asset
                    </p>
                </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
            >
              <X size={18} /> Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-black dark:hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-70"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {isSaving ? 'Saving...' : 'Save Asset'}
            </button>
          </div>
        </form>
      )}

      {/* History Timeline - Redesigned with Accordion & Pagination */}
      {initialData && logs.length > 0 && (
        <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
            <button 
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between group"
            >
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                    <Clock size={20} /> Asset History 
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{logs.length} Events</span>
                </h3>
                {showHistory ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </button>
            
            {showHistory && (
                <div className="mt-6 animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:h-full before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
                        {displayedLogs.map((log) => (
                            <div key={log.id} className="relative flex items-start gap-4">
                                <div className={`z-10 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-sm ${log.action === 'Created' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : log.action === 'Returned' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                    <Circle size={12} fill="currentColor" />
                                </div>
                                <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="flex justify-between items-start">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{log.action}</span>
                                        <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{log.details}</p>
                                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-400 dark:text-slate-500">
                                        <User size={12} /> {log.performedBy}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6 pl-14">
                            <span className="text-xs text-slate-400">Page {historyPage} of {totalPages}</span>
                            <div className="flex gap-2">
                                <button
                                    type="button" 
                                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                    disabled={historyPage === 1}
                                    className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-600 dark:text-slate-400"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                                    disabled={historyPage === totalPages}
                                    className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-600 dark:text-slate-400"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default AssetForm;
