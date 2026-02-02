
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Asset, ASSET_STATUSES, AssetStatus } from '../types';
import { Edit2, Trash2, Search, MapPin, Tag, User, Upload, AlertTriangle, Lock, Building2, Columns, Check, RefreshCw, ChevronLeft, ChevronRight, FileSpreadsheet, FileOutput, QrCode, X, CheckCircle2, Copy, ChevronsLeft, ChevronsRight, ShoppingCart, Loader2 } from 'lucide-react';
import { importAssetsBulk, getAppConfig, getCurrentUserProfile, getSandboxStatus } from '../services/storageService';
import ExcelJS from 'exceljs';
import QRCode from 'react-qr-code';
import ReactDOMServer from 'react-dom/server';

interface AssetListProps {
  assets: Asset[];
  onEdit: (asset: Asset) => void;
  onDuplicate: (asset: Asset) => void;
  onDelete: (id: string) => void;
}

type ColumnId = 'serialNumber' | 'category' | 'status' | 'location' | 'department' | 'assignedEmployee' | 'purchaseCost';

interface ColumnConfig {
    id: ColumnId;
    label: string;
    defaultVisible: boolean;
}

const AVAILABLE_COLUMNS: ColumnConfig[] = [
    { id: 'serialNumber', label: 'SERIAL NO.', defaultVisible: true },
    { id: 'category', label: 'CATEGORY', defaultVisible: true },
    { id: 'status', label: 'STATUS', defaultVisible: true },
    { id: 'location', label: 'LOCATION', defaultVisible: true },
    { id: 'department', label: 'DEPARTMENT', defaultVisible: true },
    { id: 'assignedEmployee', label: 'ASSIGNED TO', defaultVisible: true },
    { id: 'purchaseCost', label: 'COST', defaultVisible: true },
];

const AssetList: React.FC<AssetListProps> = ({ assets, onEdit, onDuplicate, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('eatx_filter_search') || '');
  const [filterStatus, setFilterStatus] = useState<string>(() => localStorage.getItem('eatx_filter_status') || 'All');
  const [filterCategory, setFilterCategory] = useState<string>(() => localStorage.getItem('eatx_filter_category') || 'All');
  const [filterLocation, setFilterLocation] = useState<string>(() => localStorage.getItem('eatx_filter_location') || 'All');
  const [filterSerial, setFilterSerial] = useState(() => localStorage.getItem('eatx_filter_serial') || '');
  const [filterEmployee, setFilterEmployee] = useState(() => localStorage.getItem('eatx_filter_employee') || '');
  const [filterSupplier, setFilterSupplier] = useState(() => localStorage.getItem('eatx_filter_supplier') || '');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnId, boolean>>(() => {
      const saved = localStorage.getItem('eatx_table_columns');
      if (saved) return JSON.parse(saved);
      const defaults: any = {};
      AVAILABLE_COLUMNS.forEach(col => defaults[col.id] = col.defaultVisible);
      return defaults;
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [showImportSuccess, setShowImportSuccess] = useState<number | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  const user = getCurrentUserProfile();
  const canEdit = user?.role === 'admin' || user?.role === 'technician' || user?.role === 'sandbox_user';
  const isSandbox = getSandboxStatus();

  useEffect(() => {
    const loadConfig = async () => {
        const config = await getAppConfig();
        setCategories(config.categories);
        setLocations(config.locations);
        setDepartments(config.departments || []);
    };
    loadConfig();
    
    const handleClickOutside = (event: MouseEvent) => {
        if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
            setShowColumnMenu(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem('eatx_filter_search', searchTerm);
    localStorage.setItem('eatx_filter_status', filterStatus);
    localStorage.setItem('eatx_filter_category', filterCategory);
    localStorage.setItem('eatx_filter_location', filterLocation);
    localStorage.setItem('eatx_filter_serial', filterSerial);
    localStorage.setItem('eatx_filter_employee', filterEmployee);
    localStorage.setItem('eatx_filter_supplier', filterSupplier);
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterCategory, filterLocation, filterSerial, filterEmployee, filterSupplier]);

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
        const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              asset.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || asset.status === filterStatus;
        const matchesCategory = filterCategory === 'All' || asset.category === filterCategory;
        const matchesLocation = filterLocation === 'All' || asset.location === filterLocation;
        const matchesSerial = filterSerial === '' || (asset.serialNumber && asset.serialNumber.toLowerCase().includes(filterSerial.toLowerCase()));
        const matchesEmployee = filterEmployee === '' || (asset.assignedEmployee && asset.assignedEmployee.toLowerCase().includes(filterEmployee.toLowerCase()));
        const matchesSupplier = filterSupplier === '' || (asset.supplier && asset.supplier.toLowerCase().includes(filterSupplier.toLowerCase()));
        return matchesSearch && matchesStatus && matchesCategory && matchesLocation && matchesSerial && matchesEmployee && matchesSupplier;
    });
  }, [assets, searchTerm, filterStatus, filterCategory, filterLocation, filterSerial, filterEmployee, filterSupplier]);

  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredAssets.length);
  const paginatedAssets = filteredAssets.slice(startIndex, endIndex);

  const toggleColumn = (id: ColumnId) => {
      const updated = { ...visibleColumns, [id]: !visibleColumns[id] };
      setVisibleColumns(updated);
      localStorage.setItem('eatx_table_columns', JSON.stringify(updated));
  };

  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const validatorSheet = workbook.addWorksheet('Validators');
    validatorSheet.state = 'hidden';
    validatorSheet.getColumn(1).values = ['Categories', ...categories];
    validatorSheet.getColumn(2).values = ['Locations', ...locations];
    validatorSheet.getColumn(3).values = ['Statuses', ...ASSET_STATUSES];
    validatorSheet.getColumn(4).values = ['Departments', ...(departments.length > 0 ? departments : ['N/A'])];

    const sheet = workbook.addWorksheet('Assets');
    sheet.columns = [
        { header: 'System ID', key: 'id', width: 30 }, { header: 'Asset Name', key: 'name', width: 30 },
        { header: 'Category', key: 'category', width: 25 }, { header: 'Status', key: 'status', width: 15 },
        { header: 'Location', key: 'location', width: 25 }, { header: 'Department', key: 'department', width: 20 },
        { header: 'Serial Number', key: 'serialNumber', width: 20 }, { header: 'Supplier', key: 'supplier', width: 25 },
        { header: 'Cost', key: 'cost', width: 15 }, { header: 'Purchase Date', key: 'purchaseDate', width: 25 },
        { header: 'Assigned To', key: 'assignedEmployee', width: 25 }, { header: 'Description', key: 'description', width: 40 },
    ];
    
    for (let i = 2; i <= 1000; i++) {
        sheet.getCell(`C${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Validators!$A$2:$A$${categories.length + 1}`] };
        sheet.getCell(`D${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`Validators!$C$2:$C$${ASSET_STATUSES.length + 1}`] };
        sheet.getCell(`D${i}`).value = 'Active';
        sheet.getCell(`E${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Validators!$B$2:$B$${locations.length + 1}`] };
        sheet.getCell(`F${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Validators!$D$2:$D$${Math.max(2, departments.length + 1)}`] };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'AssetTrack_Import_Template.xlsx'; a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportData = async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Assets Backup');
      sheet.columns = [
        { header: 'System ID', key: 'id' }, { header: 'Asset Name', key: 'name' }, { header: 'Category', key: 'category' },
        { header: 'Status', key: 'status' }, { header: 'Location', key: 'location' }, { header: 'Department', key: 'department' },
        { header: 'Serial Number', key: 'serialNumber' }, { header: 'Supplier', key: 'supplier' }, { header: 'Cost', key: 'cost' },
        { header: 'Purchase Date', key: 'purchaseDate' }, { header: 'Assigned Employee', key: 'assignedEmployee' }, { header: 'Description', key: 'description' }
      ];
      assets.forEach(asset => {
          sheet.addRow({
              id: asset.id, name: asset.name, category: asset.category, status: asset.status, location: asset.location,
              department: asset.department, serialNumber: asset.serialNumber, supplier: asset.supplier,
              cost: asset.purchaseCost, purchaseDate: asset.purchaseDate, assignedEmployee: asset.assignedEmployee, description: asset.description
          });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `AssetTrack_Backup_${new Date().toISOString().split('T')[0]}.xlsx`; a.click();
      window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const proceed = window.confirm(`Proceed importing "${file.name}"? Existing items with matching IDs will be updated, others will be created.`);
    if (!proceed) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    setIsImporting(true);
    try {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const sheet = workbook.getWorksheet('Assets') || workbook.worksheets[0];
        const newAssets: Asset[] = [];

        sheet.eachRow((row: any, rowNumber: number) => {
            if (rowNumber === 1) return;
            const getVal = (idx: number) => {
                const cell = row.getCell(idx);
                if (cell.value && typeof cell.value === 'object' && 'text' in (cell.value as any)) return (cell.value as any).text;
                return cell.value ? String(cell.value).trim() : '';
            };
            const sysId = getVal(1);
            const name = getVal(2);
            if (!name) return;
            newAssets.push({
                id: sysId || 'ast-' + Math.random().toString(36).substr(2, 9),
                name: name, category: getVal(3) || 'Other', status: (ASSET_STATUSES.includes(getVal(4) as AssetStatus) ? getVal(4) : 'Active') as AssetStatus,
                location: getVal(5) || 'Head Office', department: getVal(6) || '', serialNumber: getVal(7) || '', supplier: getVal(8) || '',
                purchaseCost: getVal(9) ? parseFloat(getVal(9)) : undefined, purchaseDate: getVal(10) || undefined, assignedEmployee: getVal(11) || '',
                description: getVal(12) || 'Imported via Excel', lastUpdated: new Date().toISOString()
            });
        });

        if (newAssets.length > 0) {
            await importAssetsBulk(newAssets);
            setShowImportSuccess(newAssets.length);
        } else {
            alert("No valid data found in the spreadsheet.");
        }
    } catch (err) { console.error(err); alert("Error parsing file. Ensure it follows the template format."); } finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const inputClass = "p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#0b1120] text-slate-700 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all";

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Global search..." 
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
            />
        </div>
        
        <div className="flex items-center gap-2" ref={columnMenuRef}>
            <div className="relative">
                <button onClick={() => setShowColumnMenu(!showColumnMenu)} className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all">
                    <Columns size={16} className="text-slate-400" /> Columns
                </button>
                {showColumnMenu && (
                    <div className="absolute right-0 top-12 w-60 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Toggle Columns</div>
                        <div className="p-2 space-y-1">
                            {AVAILABLE_COLUMNS.map(col => (
                                <label key={col.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs text-slate-700 dark:text-slate-300 font-bold uppercase">
                                    <input type="checkbox" checked={visibleColumns[col.id]} onChange={() => toggleColumn(col.id)} className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-950"/>
                                    {col.label}
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {canEdit && (
                <div className="flex gap-2">
                    <button onClick={handleDownloadTemplate} className="p-2.5 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 hover:text-amber-500 shadow-sm transition-colors" title="Download Import Template"><FileSpreadsheet size={18}/></button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 hover:text-emerald-500 shadow-sm transition-colors" title="Import / Bulk Update">
                        {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18}/>}
                    </button>
                    <button onClick={handleExportData} className="p-2.5 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 hover:text-blue-500 shadow-sm transition-colors" title="Export Full Registry"><FileOutput size={18}/></button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls" />
                </div>
            )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
          <input placeholder="Serial No." value={filterSerial} onChange={e => setFilterSerial(e.target.value)} className={`${inputClass} flex-1 min-w-[120px]`} />
          <input placeholder="Employee" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className={`${inputClass} flex-1 min-w-[120px]`} />
          <input placeholder="Supplier" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className={`${inputClass} flex-1 min-w-[120px]`} />
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={`${inputClass} flex-1 min-w-[140px]`}>
              <option value="All">All Categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${inputClass} flex-1 min-w-[130px]`}>
              <option value="All">All Statuses</option>{ASSET_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className={`${inputClass} flex-1 min-w-[140px]`}>
              <option value="All">All Locations</option>{locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={() => { setSearchTerm(''); setFilterStatus('All'); setFilterCategory('All'); setFilterLocation('All'); setFilterSerial(''); setFilterEmployee(''); setFilterSupplier(''); }} className="flex items-center justify-center gap-2 text-[11px] font-black uppercase text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors px-2 whitespace-nowrap">
              <RefreshCw size={14} /> Clear Filters
          </button>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-[#020617] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="p-4 pl-6 text-[11px] font-black uppercase tracking-widest text-slate-400 w-[18%]">Asset Name</th>
                {visibleColumns.serialNumber && <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-400 w-[12%]">Serial No.</th>}
                {visibleColumns.category && <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-400 w-[16%]">Category</th>}
                {visibleColumns.status && <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-400 w-[10%]">Status</th>}
                {visibleColumns.location && <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-400 w-[12%]">Location</th>}
                {visibleColumns.department && <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-400 w-[10%]">Department</th>}
                {visibleColumns.assignedEmployee && <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-400 w-[12%]">Assigned To</th>}
                {visibleColumns.purchaseCost && <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-400 w-[10%]">Cost</th>}
                <th className="p-4 pr-6 text-[11px] font-black uppercase tracking-widest text-slate-400 w-[8%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {paginatedAssets.map(asset => (
                <tr key={asset.id} className="group hover:bg-slate-50/50 dark:hover:bg-blue-500/[0.03] transition-colors">
                  <td className="p-4 pl-6">
                    <div className="font-black text-slate-900 dark:text-slate-100 text-[12px] uppercase truncate" title={asset.name}>{asset.name}</div>
                  </td>
                  {visibleColumns.serialNumber && (
                    <td className="p-4 text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                      {asset.serialNumber || '-'}
                    </td>
                  )}
                  {visibleColumns.category && (
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-[9px] font-black bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-2 py-1 rounded-md w-fit text-slate-600 dark:text-slate-300 uppercase truncate max-w-full">
                        <Tag size={10} className="text-slate-400 shrink-0"/> {asset.category}
                      </div>
                    </td>
                  )}
                  {visibleColumns.status && (
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight border ${asset.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {asset.status}
                      </span>
                    </td>
                  )}
                  {visibleColumns.location && (
                    <td className="p-4 text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate">
                      <div className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-300 shrink-0"/> {asset.location}</div>
                    </td>
                  )}
                  {visibleColumns.department && (
                    <td className="p-4 text-[11px] font-bold text-slate-500 dark:text-slate-500 truncate">
                      <div className="flex items-center gap-1.5"><Building2 size={12} className="text-slate-300 shrink-0"/> {asset.department || '-'}</div>
                    </td>
                  )}
                  {visibleColumns.assignedEmployee && (
                    <td className="p-4 text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate">
                      <div className="flex items-center gap-1.5"><User size={12} className="text-slate-300 shrink-0"/> {asset.assignedEmployee || '-'}</div>
                    </td>
                  )}
                  {visibleColumns.purchaseCost && (
                    <td className="p-4">
                      <div className="text-[11px] text-slate-900 dark:text-slate-200">
                        {asset.purchaseCost ? (
                          <span className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-400 font-bold uppercase">AED</span> 
                            <span className="font-black">{asset.purchaseCost.toLocaleString(undefined, {minimumFractionDigits: 0})}</span>
                          </span>
                        ) : '-'}
                      </div>
                    </td>
                  )}
                  <td className="p-4 pr-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(asset)} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"><Edit2 size={14}/></button>
                      <button onClick={() => onDuplicate(asset)} className="p-1.5 text-slate-400 hover:text-indigo-500 transition-colors"><Copy size={14}/></button>
                      <button onClick={() => onDelete(asset.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-20 text-center text-slate-400 font-bold text-xs uppercase tracking-[0.2em] opacity-30">No matching records</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="bg-white dark:bg-[#020617] rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rows:</span>
                  <select 
                    value={itemsPerPage} 
                    onChange={e => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
                    className="bg-transparent border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-700 dark:text-slate-300 outline-none px-1 cursor-pointer"
                  >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                  </select>
              </div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {startIndex + 1}-{endIndex} / {filteredAssets.length}
              </div>
          </div>

          <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-20 transition-all"><ChevronsLeft size={16}/></button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-20 transition-all"><ChevronLeft size={16}/></button>
              <div className="px-4 text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Page {currentPage}</div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-20 transition-all"><ChevronRight size={16}/></button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-20 transition-all"><ChevronsRight size={16}/></button>
          </div>
      </div>

      {/* Success Modal */}
      {showImportSuccess !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-8 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in">
                <div className="flex flex-col items-center text-center gap-6">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-full text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-100 dark:border-emerald-900/30">
                        <CheckCircle2 size={48} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Import Complete</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 leading-relaxed">
                            Successfully processed <span className="font-bold text-slate-900 dark:text-white">{showImportSuccess}</span> assets from the spreadsheet.
                        </p>
                    </div>
                    <button 
                        onClick={() => setShowImportSuccess(null)} 
                        className="w-full py-3.5 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-bold hover:bg-black dark:hover:bg-blue-700 shadow-lg transition-all active:scale-95"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AssetList;
