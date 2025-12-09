
import React, { useState, useRef, useEffect } from 'react';
import { Asset, ASSET_STATUSES, AssetStatus } from '../types';
import { Edit2, Trash2, Search, MapPin, Tag, User, Upload, Download, FileSpreadsheet, Loader2, AlertTriangle, X, Lock, Copy, Building2, ShoppingCart } from 'lucide-react';
import { importAssetsFromCSV, getAppConfig, getCurrentUserProfile } from '../services/storageService';

interface AssetListProps {
  assets: Asset[];
  onEdit: (asset: Asset) => void;
  onDuplicate: (asset: Asset) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

const AssetList: React.FC<AssetListProps> = ({ assets, onEdit, onDuplicate, onDelete, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('eatx_filter_search') || '');
  const [filterStatus, setFilterStatus] = useState<string>(() => localStorage.getItem('eatx_filter_status') || 'All');
  const [filterCategory, setFilterCategory] = useState<string>(() => localStorage.getItem('eatx_filter_category') || 'All');
  const [filterLocation, setFilterLocation] = useState<string>(() => localStorage.getItem('eatx_filter_location') || 'All');
  const [filterSerial, setFilterSerial] = useState(() => localStorage.getItem('eatx_filter_serial') || '');
  const [filterEmployee, setFilterEmployee] = useState(() => localStorage.getItem('eatx_filter_employee') || '');

  const [isImporting, setIsImporting] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Role Checks
  const user = getCurrentUserProfile();
  const canEdit = user?.role === 'admin' || user?.role === 'technician';
  const canDelete = user?.role === 'admin';

  useEffect(() => {
    const loadConfig = async () => {
        const config = await getAppConfig();
        setCategories(config.categories);
        setLocations(config.locations);
    };
    loadConfig();
  }, [assets]); 

  useEffect(() => {
    localStorage.setItem('eatx_filter_search', searchTerm);
    localStorage.setItem('eatx_filter_status', filterStatus);
    localStorage.setItem('eatx_filter_category', filterCategory);
    localStorage.setItem('eatx_filter_location', filterLocation);
    localStorage.setItem('eatx_filter_serial', filterSerial);
    localStorage.setItem('eatx_filter_employee', filterEmployee);
  }, [searchTerm, filterStatus, filterCategory, filterLocation, filterSerial, filterEmployee]);

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          asset.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (asset.supplier && asset.supplier.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === 'All' || asset.status === filterStatus;
    const matchesCategory = filterCategory === 'All' || asset.category === filterCategory;
    const matchesLocation = filterLocation === 'All' || asset.location === filterLocation;
    const matchesSerial = filterSerial === '' || (asset.serialNumber && asset.serialNumber.toLowerCase().includes(filterSerial.toLowerCase()));
    const matchesEmployee = filterEmployee === '' || (asset.assignedEmployee && asset.assignedEmployee.toLowerCase().includes(filterEmployee.toLowerCase()));

    return matchesSearch && matchesStatus && matchesCategory && matchesLocation && matchesSerial && matchesEmployee;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-100 text-emerald-800';
      case 'Under Repair': return 'bg-amber-100 text-amber-800';
      case 'Retired': return 'bg-red-100 text-red-800';
      case 'In Storage': return 'bg-slate-100 text-slate-800';
      case 'Lost/Stolen': return 'bg-gray-800 text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        const text = evt.target?.result as string;
        if (!text) return;
        setIsImporting(true);
        try {
            const lines = text.split('\n').filter(line => line.trim() !== '');
            const newAssets: Asset[] = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length < 3) continue;
                newAssets.push({
                    id: 'ast-' + Math.random().toString(36).substr(2, 9),
                    name: cols[0]?.trim() || 'Imported Asset',
                    category: cols[1]?.trim() || 'Other',
                    status: (ASSET_STATUSES.includes(cols[2]?.trim() as AssetStatus) ? cols[2]?.trim() : 'Active') as AssetStatus,
                    location: cols[3]?.trim() || 'Unknown',
                    purchaseCost: parseFloat(cols[4]) || 0,
                    purchaseDate: cols[5]?.trim() || new Date().toISOString().split('T')[0],
                    serialNumber: cols[6]?.trim() || '',
                    assignedEmployee: cols[7]?.trim() || '',
                    description: cols[8]?.trim() || 'Imported from CSV',
                    supplier: cols[9]?.trim() || '',
                    lastUpdated: new Date().toISOString()
                });
            }
            if (newAssets.length > 0) {
                await importAssetsFromCSV(newAssets);
                onRefresh();
                alert(`Successfully imported ${newAssets.length} assets.`);
            }
        } catch (err) {
            alert("Error parsing CSV.");
        } finally {
            setIsImporting(false);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <>
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
      <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-4">
         <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Search name, supplier, details..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm" />
            </div>
            {canEdit && (
            <div className="flex gap-2">
                <div className="relative">
                    <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white border border-slate-800 rounded-lg hover:bg-slate-900 text-sm font-medium disabled:opacity-50">
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Import CSV
                    </button>
                </div>
            </div>
            )}
         </div>
         <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
             <div className="md:col-span-1"><input type="text" placeholder="Serial No." value={filterSerial} onChange={e => setFilterSerial(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" /></div>
             <div className="md:col-span-1"><input type="text" placeholder="Employee" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" /></div>
             <div className="md:col-span-1"><select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm"><option value="All">All Categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
             <div className="md:col-span-1"><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm"><option value="All">All Statuses</option>{ASSET_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
             <div className="md:col-span-1"><select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm"><option value="All">All Locations</option>{locations.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
         </div>
      </div>

      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
              <th className="p-4">Asset</th>
              <th className="p-4">Category</th>
              <th className="p-4">Location & Dept</th>
              <th className="p-4">Assigned To</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAssets.map(asset => (
              <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">
                  <div className="font-semibold text-slate-900">{asset.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                      {asset.supplier && (
                          <span className="text-xs font-medium text-slate-600 flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                              <ShoppingCart size={10} /> {asset.supplier}
                          </span>
                      )}
                      <span className="text-xs text-slate-400 font-mono">{asset.serialNumber}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate max-w-[180px] mt-1">{asset.description}</div>
                </td>
                <td className="p-4"><div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 bg-slate-100 rounded-md w-fit text-slate-700"><Tag size={12} /> {asset.category}</div></td>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-sm text-slate-600"><MapPin size={14} /> {asset.location}</div>
                    {asset.department && <div className="flex items-center gap-1.5 text-xs text-slate-500"><Building2 size={12} /> {asset.department}</div>}
                  </div>
                </td>
                <td className="p-4">
                    {asset.assignedEmployee ? 
                        <div className="flex items-center gap-1.5 text-xs text-slate-800 font-medium bg-slate-100 px-1.5 py-0.5 rounded w-fit"><User size={12} /> {asset.assignedEmployee}</div> : 
                        <span className="text-slate-400 text-xs">-</span>
                    }
                </td>
                <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(asset.status)}`}>{asset.status}</span></td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    {canEdit ? (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); onEdit(asset); }} className="p-2 text-slate-600 hover:bg-slate-200 rounded-md" title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDuplicate(asset); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-md" title="Duplicate">
                          <Copy size={16} />
                        </button>
                      </>
                    ) : null}
                    {canDelete ? (
                      <button onClick={(e) => { e.stopPropagation(); setAssetToDelete(asset); }} className="p-2 text-red-600 hover:bg-red-50 rounded-md" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                    {!canEdit && !canDelete && <span className="p-2 text-slate-300 cursor-not-allowed"><Lock size={16} /></span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    
    {assetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-100">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="bg-red-50 p-3 rounded-full text-red-600"><AlertTriangle size={32} /></div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Delete Asset?</h3>
                        <p className="text-slate-500 text-sm mt-2">Permanently remove <span className="font-semibold text-slate-900">{assetToDelete.name}</span>?</p>
                    </div>
                    <div className="flex gap-3 w-full mt-4">
                        <button onClick={() => setAssetToDelete(null)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50">Cancel</button>
                        <button onClick={() => { onDelete(assetToDelete.id); setAssetToDelete(null); }} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-lg shadow-red-200">Yes, Delete</button>
                    </div>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default AssetList;
