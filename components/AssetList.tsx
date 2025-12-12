import React, { useState, useRef, useEffect } from 'react';
import { Asset, ASSET_STATUSES, AssetStatus } from '../types';
import { Edit2, Trash2, Search, MapPin, Tag, User, Upload, Download, Loader2, AlertTriangle, Lock, Copy, Building2, ShoppingCart, Calendar, Columns, Check, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileSpreadsheet, FileOutput, MoreVertical } from 'lucide-react';
import { importAssetsBulk, getAppConfig, getCurrentUserProfile } from '../services/storageService';
import ExcelJS from 'exceljs';

interface AssetListProps {
  assets: Asset[];
  onEdit: (asset: Asset) => void;
  onDuplicate: (asset: Asset) => void;
  onDelete: (id: string) => void;
}

// Column Definition
type ColumnId = 'serialNumber' | 'category' | 'location' | 'department' | 'assignedEmployee' | 'status' | 'supplier' | 'purchaseCost' | 'purchaseDate';

interface ColumnConfig {
    id: ColumnId;
    label: string;
    defaultVisible: boolean;
}

const AVAILABLE_COLUMNS: ColumnConfig[] = [
    { id: 'serialNumber', label: 'Serial No.', defaultVisible: true },
    { id: 'category', label: 'Category', defaultVisible: true },
    { id: 'location', label: 'Location', defaultVisible: true },
    { id: 'department', label: 'Department', defaultVisible: false },
    { id: 'assignedEmployee', label: 'Assigned To', defaultVisible: true },
    { id: 'status', label: 'Status', defaultVisible: true },
    { id: 'supplier', label: 'Supplier', defaultVisible: false },
    { id: 'purchaseCost', label: 'Cost', defaultVisible: false },
    { id: 'purchaseDate', label: 'Purchase Date', defaultVisible: false },
];

const AssetList: React.FC<AssetListProps> = ({ assets, onEdit, onDuplicate, onDelete }) => {
  // Filter States
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('eatx_filter_search') || '');
  const [filterStatus, setFilterStatus] = useState<string>(() => localStorage.getItem('eatx_filter_status') || 'All');
  const [filterCategory, setFilterCategory] = useState<string>(() => localStorage.getItem('eatx_filter_category') || 'All');
  const [filterLocation, setFilterLocation] = useState<string>(() => localStorage.getItem('eatx_filter_location') || 'All');
  const [filterSerial, setFilterSerial] = useState(() => localStorage.getItem('eatx_filter_serial') || '');
  const [filterEmployee, setFilterEmployee] = useState(() => localStorage.getItem('eatx_filter_employee') || '');
  const [filterSupplier, setFilterSupplier] = useState(() => localStorage.getItem('eatx_filter_supplier') || '');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnId, boolean>>(() => {
      const saved = localStorage.getItem('eatx_table_columns');
      if (saved) return JSON.parse(saved);
      const defaults: any = {};
      AVAILABLE_COLUMNS.forEach(col => defaults[col.id] = col.defaultVisible);
      return defaults;
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  // General State
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
    
    // Close column menu on click outside
    const handleClickOutside = (event: MouseEvent) => {
        if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
            setShowColumnMenu(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [assets]);

  // Persist Filters & Columns
  useEffect(() => {
    localStorage.setItem('eatx_filter_search', searchTerm);
    localStorage.setItem('eatx_filter_status', filterStatus);
    localStorage.setItem('eatx_filter_category', filterCategory);
    localStorage.setItem('eatx_filter_location', filterLocation);
    localStorage.setItem('eatx_filter_serial', filterSerial);
    localStorage.setItem('eatx_filter_employee', filterEmployee);
    localStorage.setItem('eatx_filter_supplier', filterSupplier);
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterCategory, filterLocation, filterSerial, filterEmployee, filterSupplier]);

  useEffect(() => {
      localStorage.setItem('eatx_table_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const filteredAssets = assets.filter(asset => {
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

  const clearFilters = () => {
      setSearchTerm('');
      setFilterStatus('All');
      setFilterCategory('All');
      setFilterLocation('All');
      setFilterSerial('');
      setFilterEmployee('');
      setFilterSupplier('');
  };

  // Pagination Logic
  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredAssets.length);
  const paginatedAssets = filteredAssets.slice(startIndex, endIndex);

  const toggleColumn = (id: ColumnId) => {
      setVisibleColumns(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
      case 'Under Repair': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
      case 'Retired': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      case 'In Storage': return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      case 'Lost/Stolen': return 'bg-gray-800 text-white border-gray-700 dark:bg-gray-700 dark:border-gray-600';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // --- Import/Export Handlers ---
  const setupWorkbookColumns = (sheet: ExcelJS.Worksheet) => {
      sheet.columns = [
        { header: 'System ID (Leave empty for new)', key: 'id', width: 30 },
        { header: 'Asset Name (Required)', key: 'name', width: 30 },
        { header: 'Category', key: 'category', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Location', key: 'location', width: 25 },
        { header: 'Department', key: 'department', width: 20 },
        { header: 'Serial Number', key: 'serialNumber', width: 20 },
        { header: 'Supplier / Vendor', key: 'supplier', width: 25 },
        { header: 'Cost (AED)', key: 'cost', width: 15 },
        { header: 'Purchase Date (YYYY-MM-DD)', key: 'purchaseDate', width: 25 },
        { header: 'Assigned Employee', key: 'assignedEmployee', width: 25 },
        { header: 'Description / Notes', key: 'description', width: 40 },
    ];
    sheet.getRow(1).font = { bold: true };
  };

  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const validatorSheet = workbook.addWorksheet('Validators');
    validatorSheet.state = 'hidden';
    validatorSheet.getColumn(1).values = ['Categories', ...categories];
    validatorSheet.getColumn(2).values = ['Locations', ...locations];
    validatorSheet.getColumn(3).values = ['Statuses', ...ASSET_STATUSES];

    const sheet = workbook.addWorksheet('Assets');
    setupWorkbookColumns(sheet);
    
    // Validations (Indices shifted by 1 because ID is now col 1)
    const rowCount = 1000;
    for (let i = 2; i <= rowCount; i++) {
        sheet.getCell(`C${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Validators!$A$2:$A$${categories.length + 1}`] };
        sheet.getCell(`D${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`Validators!$C$2:$C$${ASSET_STATUSES.length + 1}`] };
        sheet.getCell(`D${i}`).value = 'Active';
        sheet.getCell(`E${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Validators!$B$2:$B$${locations.length + 1}`] };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AssetTrack_Import_Template.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportData = async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Assets Backup');
      setupWorkbookColumns(sheet);

      assets.forEach(asset => {
          sheet.addRow({
              id: asset.id,
              name: asset.name,
              category: asset.category,
              status: asset.status,
              location: asset.location,
              department: asset.department,
              serialNumber: asset.serialNumber,
              supplier: asset.supplier,
              cost: asset.purchaseCost,
              purchaseDate: asset.purchaseDate,
              assignedEmployee: asset.assignedEmployee,
              description: asset.description
          });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AssetTrack_Backup_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;

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
                const val = row.getCell(idx).value;
                if (val && typeof val === 'object' && 'text' in val) return val.text;
                return val ? String(val).trim() : '';
            };

            const sysId = getVal(1); // Column A
            const name = getVal(2);  // Column B
            if (!name) return;
            
            const costVal = getVal(9); // Column I
            const dateVal = getVal(10); // Column J

            newAssets.push({
                id: sysId || 'ast-' + Math.random().toString(36).substr(2, 9),
                name: name,
                category: getVal(3) || 'Other',
                status: (ASSET_STATUSES.includes(getVal(4) as AssetStatus) ? getVal(4) : 'Active') as AssetStatus,
                location: getVal(5) || 'Head Office',
                department: getVal(6) || '',
                serialNumber: getVal(7) || '',
                supplier: getVal(8) || '',
                purchaseCost: costVal ? parseFloat(costVal) : undefined,
                purchaseDate: dateVal || undefined,
                assignedEmployee: getVal(11) || '',
                description: getVal(12) || 'Imported/Updated via Excel',
                lastUpdated: new Date().toISOString()
            });
        });

        if (newAssets.length > 0) {
            await importAssetsBulk(newAssets);
            alert(`Successfully processed ${newAssets.length} assets.`);
        } else {
            alert("No valid asset data found.");
        }
    } catch (err) {
        console.error(err);
        alert("Error parsing Excel file.");
    } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-full relative">
      {/* Top Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row gap-4 relative z-30 rounded-t-xl">
         <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Global search..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600 text-sm shadow-sm bg-white dark:bg-slate-950 dark:text-white" 
            />
         </div>
         <div className="flex flex-wrap gap-2 items-center md:justify-end">
            {/* Column Selector */}
            <div className="relative" ref={columnMenuRef}>
                <button 
                    onClick={() => setShowColumnMenu(!showColumnMenu)} 
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showColumnMenu ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600 text-slate-900 dark:text-white' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <Columns size={16} /> <span className="hidden sm:inline">Columns</span>
                </button>
                {showColumnMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Toggle Visibility
                        </div>
                        <div className="p-2 max-h-60 overflow-y-auto custom-scrollbar">
                             <div className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-slate-400 cursor-not-allowed">
                                <Check size={14} className="text-slate-400"/> Asset Name (Locked)
                             </div>
                             {AVAILABLE_COLUMNS.map(col => (
                                 <label key={col.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                                     <input 
                                        type="checkbox" 
                                        checked={visibleColumns[col.id]} 
                                        onChange={() => toggleColumn(col.id)}
                                        className="rounded border-slate-300 dark:border-slate-600 text-slate-900 dark:text-blue-600 focus:ring-slate-900 dark:focus:ring-blue-600 bg-white dark:bg-slate-950"
                                     />
                                     {col.label}
                                 </label>
                             ))}
                        </div>
                    </div>
                )}
            </div>

            {canEdit && (
            <>
                <button onClick={handleDownloadTemplate} className="p-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2" title="Download Import Template">
                    <FileSpreadsheet size={18} /> <span className="hidden sm:inline text-xs font-medium">Template</span>
                </button>
                
                <button onClick={handleExportData} className="p-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2" title="Export All Data">
                    <FileOutput size={18} /> <span className="hidden sm:inline text-xs font-medium">Export</span>
                </button>

                <div className="relative">
                    <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="p-2 bg-slate-900 dark:bg-blue-600 text-white border border-slate-900 dark:border-blue-600 rounded-lg hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2" title="Import / Bulk Update">
                        {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />} <span className="hidden sm:inline text-xs font-medium">Import</span>
                    </button>
                </div>
            </>
            )}
         </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 relative z-20">
          <div className="relative col-span-1">
             <input type="text" placeholder="Serial No." value={filterSerial} onChange={e => setFilterSerial(e.target.value)} className="w-full pl-2 pr-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-900 dark:text-white" />
          </div>
          <div className="relative col-span-1">
             <input type="text" placeholder="Employee" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className="w-full pl-2 pr-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-900 dark:text-white" />
          </div>
          <div className="relative col-span-1">
             <input type="text" placeholder="Supplier" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="w-full pl-2 pr-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-900 dark:text-white" />
          </div>
          <div className="col-span-1">
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full py-1.5 px-2 border border-slate-300 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-900 dark:text-white">
                <option value="All">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-span-1">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full py-1.5 px-2 border border-slate-300 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-900 dark:text-white">
                <option value="All">All Statuses</option>
                {ASSET_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-1">
            <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="w-full py-1.5 px-2 border border-slate-300 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-900 dark:text-white">
                <option value="All">All Locations</option>
                {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <button onClick={clearFilters} className="col-span-2 xl:col-span-1 py-1.5 px-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-medium flex items-center justify-center gap-1">
              <RefreshCw size={12}/> Clear Filters
          </button>
      </div>

      {/* --- DESKTOP TABLE VIEW (Hidden on Mobile) --- */}
      <div className="hidden md:block overflow-x-auto min-h-[400px]">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <th className="p-4 w-[250px] sticky left-0 bg-slate-50 dark:bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Asset Name</th>
              
              {visibleColumns.serialNumber && <th className="p-4 w-[120px]">Serial No.</th>}
              {visibleColumns.category && <th className="p-4 w-[150px]">Category</th>}
              {visibleColumns.status && <th className="p-4 w-[120px]">Status</th>}
              {visibleColumns.location && <th className="p-4 w-[150px]">Location</th>}
              {visibleColumns.department && <th className="p-4 w-[120px]">Department</th>}
              {visibleColumns.assignedEmployee && <th className="p-4 w-[150px]">Assigned To</th>}
              {visibleColumns.supplier && <th className="p-4 w-[150px]">Supplier</th>}
              {visibleColumns.purchaseCost && <th className="p-4 w-[100px] text-right">Cost</th>}
              {visibleColumns.purchaseDate && <th className="p-4 w-[120px]">Purchase Date</th>}
              
              <th className="p-4 text-right sticky right-0 bg-slate-50 dark:bg-slate-950 z-10 w-[100px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedAssets.map(asset => (
              <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                {/* Fixed Name Column */}
                <td className="p-4 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50">
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{asset.name}</div>
                  {asset.description && <div className="text-xs text-slate-500 dark:text-slate-500 truncate max-w-[220px] mt-0.5">{asset.description}</div>}
                </td>

                {visibleColumns.serialNumber && (
                    <td className="p-4 text-xs font-mono text-slate-600 dark:text-slate-400">{asset.serialNumber || '-'}</td>
                )}

                {visibleColumns.category && (
                    <td className="p-4"><div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md w-fit text-slate-700 dark:text-slate-300 whitespace-nowrap"><Tag size={12} /> {asset.category}</div></td>
                )}

                {visibleColumns.status && (
                    <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap border ${getStatusColor(asset.status)}`}>{asset.status}</span></td>
                )}

                {visibleColumns.location && (
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1"><MapPin size={14} className="text-slate-400 shrink-0"/> {asset.location}</td>
                )}

                {visibleColumns.department && (
                    <td className="p-4 text-xs text-slate-500">{asset.department ? <div className="flex items-center gap-1"><Building2 size={12}/> {asset.department}</div> : '-'}</td>
                )}

                {visibleColumns.assignedEmployee && (
                    <td className="p-4">
                        {asset.assignedEmployee ? 
                            <div className="flex items-center gap-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded w-fit whitespace-nowrap"><User size={12} /> {asset.assignedEmployee}</div> : 
                            <span className="text-slate-400 text-xs">-</span>
                        }
                    </td>
                )}

                {visibleColumns.supplier && (
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{asset.supplier ? <div className="flex items-center gap-1"><ShoppingCart size={14} className="text-slate-400"/> {asset.supplier}</div> : '-'}</td>
                )}

                {visibleColumns.purchaseCost && (
                    <td className="p-4 text-sm text-slate-700 dark:text-slate-300 text-right font-mono">{asset.purchaseCost ? `AED ${asset.purchaseCost.toLocaleString()}` : '-'}</td>
                )}

                {visibleColumns.purchaseDate && (
                    <td className="p-4 text-xs text-slate-500 flex items-center gap-1"><Calendar size={12} className="text-slate-400"/> {asset.purchaseDate || '-'}</td>
                )}

                {/* Actions */}
                <td className="p-4 text-right sticky right-0 bg-white dark:bg-slate-900 z-10 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                  <div className="flex justify-end gap-1">
                    {canEdit ? (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); onEdit(asset); }} className="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md" title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDuplicate(asset); }} className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md" title="Duplicate">
                          <Copy size={16} />
                        </button>
                      </>
                    ) : null}
                    {canDelete ? (
                      <button onClick={(e) => { e.stopPropagation(); setAssetToDelete(asset); }} className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                    {!canEdit && !canDelete && <span className="p-2 text-slate-300 dark:text-slate-600 cursor-not-allowed"><Lock size={16} /></span>}
                  </div>
                </td>
              </tr>
            ))}
            {filteredAssets.length === 0 && (
                <tr>
                    <td colSpan={12} className="p-12 text-center text-slate-400 dark:text-slate-600">
                        No assets found matching your filters.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- MOBILE CARD VIEW (Visible only on Mobile) --- */}
      <div className="md:hidden bg-slate-50 dark:bg-slate-950 p-4 space-y-4 min-h-[400px] pb-28">
          {paginatedAssets.map(asset => (
              <div key={asset.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                      <div className="min-w-0 pr-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">{asset.name}</h3>
                          <div className="text-xs text-slate-500 font-mono mt-0.5 truncate">{asset.serialNumber || 'No Serial'}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border whitespace-nowrap ${getStatusColor(asset.status)}`}>
                          {asset.status}
                      </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                      <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Category</span>
                          <div className="flex items-center gap-1 truncate"><Tag size={12} className="shrink-0"/> {asset.category}</div>
                      </div>
                      <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Location</span>
                          <div className="flex items-center gap-1 truncate"><MapPin size={12} className="shrink-0"/> {asset.location}</div>
                      </div>
                      <div className="col-span-2">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Assigned To</span>
                          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                             <div className="bg-white dark:bg-slate-700 p-1 rounded-full shadow-sm"><User size={12}/></div>
                             <span className="truncate font-medium text-slate-700 dark:text-slate-200">{asset.assignedEmployee || <span className="text-slate-400 italic font-normal">Unassigned</span>}</span>
                          </div>
                      </div>
                  </div>

                  <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
                      {canEdit && (
                          <>
                            <button onClick={() => onEdit(asset)} className="flex-1 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-black dark:hover:bg-blue-700 shadow-sm">
                                <Edit2 size={14} /> Edit Asset
                            </button>
                            <button onClick={() => onDuplicate(asset)} className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-900/50 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50">
                                <Copy size={16} />
                            </button>
                          </>
                      )}
                      {canDelete && (
                          <button onClick={() => setAssetToDelete(asset)} className="p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-900/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50">
                                <Trash2 size={16} />
                          </button>
                      )}
                  </div>
              </div>
          ))}
          {filteredAssets.length === 0 && (
               <div className="p-12 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                   <Search size={32} className="mx-auto mb-2 opacity-20"/>
                   No assets found.
               </div>
          )}
      </div>

      {/* Pagination Controls - FIXED BOTTOM FOR MOBILE */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] md:static md:shadow-none md:rounded-b-xl md:border-t flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2">
                <span className="hidden sm:inline">Rows:</span>
                <select 
                    value={itemsPerPage} 
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1 focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600 outline-none bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                </select>
            </div>
            
            <span className="text-slate-500 text-xs sm:text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                {filteredAssets.length > 0 ? `${startIndex + 1}-${endIndex} / ${filteredAssets.length}` : '0 / 0'}
            </span>
        </div>

        <div className="flex items-center gap-1 w-full md:w-auto justify-center">
            <button 
                onClick={() => setCurrentPage(1)} 
                disabled={currentPage === 1}
                className="p-2 md:p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-400 flex-1 md:flex-none flex justify-center"
            >
                <ChevronsLeft size={20} />
            </button>
            <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                disabled={currentPage === 1}
                className="p-2 md:p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-400 flex-1 md:flex-none flex justify-center"
            >
                <ChevronLeft size={20} />
            </button>
            
            <span className="text-xs sm:text-sm font-bold px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Page {currentPage}
            </span>
            
            <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 md:p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-400 flex-1 md:flex-none flex justify-center"
            >
                <ChevronRight size={20} />
            </button>
            <button 
                onClick={() => setCurrentPage(totalPages)} 
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 md:p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-400 flex-1 md:flex-none flex justify-center"
            >
                <ChevronsRight size={20} />
            </button>
        </div>
      </div>
    </div>
    
    {assetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded-full text-red-600 dark:text-red-400"><AlertTriangle size={32} /></div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Delete Asset?</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Permanently remove <span className="font-semibold text-slate-900 dark:text-white">{assetToDelete.name}</span>?</p>
                    </div>
                    <div className="flex gap-3 w-full mt-4">
                        <button onClick={() => setAssetToDelete(null)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                        <button onClick={() => { onDelete(assetToDelete.id); setAssetToDelete(null); }} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-red-900/30">Yes, Delete</button>
                    </div>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default AssetList;