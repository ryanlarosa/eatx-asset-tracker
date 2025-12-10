import React, { useState, useRef, useEffect } from "react";
import { Asset, ASSET_STATUSES, AssetStatus } from "../types";
import {
  Edit2,
  Trash2,
  Search,
  MapPin,
  Tag,
  User,
  Upload,
  Download,
  Loader2,
  AlertTriangle,
  Lock,
  Copy,
  Building2,
  ShoppingCart,
  Calendar,
  Columns,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  importAssetsBulk,
  getAppConfig,
  getCurrentUserProfile,
} from "../services/storageService";
import ExcelJS from "exceljs";

interface AssetListProps {
  assets: Asset[];
  onEdit: (asset: Asset) => void;
  onDuplicate: (asset: Asset) => void;
  onDelete: (id: string) => void;
}

// Column Definition
type ColumnId =
  | "serialNumber"
  | "category"
  | "location"
  | "department"
  | "assignedEmployee"
  | "status"
  | "supplier"
  | "purchaseCost"
  | "purchaseDate";

interface ColumnConfig {
  id: ColumnId;
  label: string;
  defaultVisible: boolean;
}

const AVAILABLE_COLUMNS: ColumnConfig[] = [
  { id: "serialNumber", label: "Serial No.", defaultVisible: true },
  { id: "category", label: "Category", defaultVisible: true },
  { id: "location", label: "Location", defaultVisible: true },
  { id: "department", label: "Department", defaultVisible: false },
  { id: "assignedEmployee", label: "Assigned To", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "supplier", label: "Supplier", defaultVisible: false },
  { id: "purchaseCost", label: "Cost", defaultVisible: false },
  { id: "purchaseDate", label: "Purchase Date", defaultVisible: false },
];

const AssetList: React.FC<AssetListProps> = ({
  assets,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  // Filter States
  const [searchTerm, setSearchTerm] = useState(
    () => localStorage.getItem("eatx_filter_search") || ""
  );
  const [filterStatus, setFilterStatus] = useState<string>(
    () => localStorage.getItem("eatx_filter_status") || "All"
  );
  const [filterCategory, setFilterCategory] = useState<string>(
    () => localStorage.getItem("eatx_filter_category") || "All"
  );
  const [filterLocation, setFilterLocation] = useState<string>(
    () => localStorage.getItem("eatx_filter_location") || "All"
  );
  const [filterSerial, setFilterSerial] = useState(
    () => localStorage.getItem("eatx_filter_serial") || ""
  );
  const [filterEmployee, setFilterEmployee] = useState(
    () => localStorage.getItem("eatx_filter_employee") || ""
  );
  const [filterSupplier, setFilterSupplier] = useState(
    () => localStorage.getItem("eatx_filter_supplier") || ""
  );

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState<
    Record<ColumnId, boolean>
  >(() => {
    const saved = localStorage.getItem("eatx_table_columns");
    if (saved) return JSON.parse(saved);
    const defaults: any = {};
    AVAILABLE_COLUMNS.forEach((col) => (defaults[col.id] = col.defaultVisible));
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
  const canEdit = user?.role === "admin" || user?.role === "technician";
  const canDelete = user?.role === "admin";

  useEffect(() => {
    const loadConfig = async () => {
      const config = await getAppConfig();
      setCategories(config.categories);
      setLocations(config.locations);
    };
    loadConfig();

    // Close column menu on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        columnMenuRef.current &&
        !columnMenuRef.current.contains(event.target as Node)
      ) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [assets]);

  // Persist Filters & Columns
  useEffect(() => {
    localStorage.setItem("eatx_filter_search", searchTerm);
    localStorage.setItem("eatx_filter_status", filterStatus);
    localStorage.setItem("eatx_filter_category", filterCategory);
    localStorage.setItem("eatx_filter_location", filterLocation);
    localStorage.setItem("eatx_filter_serial", filterSerial);
    localStorage.setItem("eatx_filter_employee", filterEmployee);
    localStorage.setItem("eatx_filter_supplier", filterSupplier);
  }, [
    searchTerm,
    filterStatus,
    filterCategory,
    filterLocation,
    filterSerial,
    filterEmployee,
    filterSupplier,
  ]);

  useEffect(() => {
    localStorage.setItem("eatx_table_columns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "All" || asset.status === filterStatus;
    const matchesCategory =
      filterCategory === "All" || asset.category === filterCategory;
    const matchesLocation =
      filterLocation === "All" || asset.location === filterLocation;
    const matchesSerial =
      filterSerial === "" ||
      (asset.serialNumber &&
        asset.serialNumber.toLowerCase().includes(filterSerial.toLowerCase()));
    const matchesEmployee =
      filterEmployee === "" ||
      (asset.assignedEmployee &&
        asset.assignedEmployee
          .toLowerCase()
          .includes(filterEmployee.toLowerCase()));
    const matchesSupplier =
      filterSupplier === "" ||
      (asset.supplier &&
        asset.supplier.toLowerCase().includes(filterSupplier.toLowerCase()));

    return (
      matchesSearch &&
      matchesStatus &&
      matchesCategory &&
      matchesLocation &&
      matchesSerial &&
      matchesEmployee &&
      matchesSupplier
    );
  });

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("All");
    setFilterCategory("All");
    setFilterLocation("All");
    setFilterSerial("");
    setFilterEmployee("");
    setFilterSupplier("");
  };

  const toggleColumn = (id: ColumnId) => {
    setVisibleColumns((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-emerald-100 text-emerald-800";
      case "Under Repair":
        return "bg-amber-100 text-amber-800";
      case "Retired":
        return "bg-red-100 text-red-800";
      case "In Storage":
        return "bg-slate-100 text-slate-800";
      case "Lost/Stolen":
        return "bg-gray-800 text-white";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // --- Import/Export Handlers ---
  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const validatorSheet = workbook.addWorksheet("Validators");
    validatorSheet.state = "hidden";
    validatorSheet.getColumn(1).values = ["Categories", ...categories];
    validatorSheet.getColumn(2).values = ["Locations", ...locations];
    validatorSheet.getColumn(3).values = ["Statuses", ...ASSET_STATUSES];

    const sheet = workbook.addWorksheet("Assets");
    sheet.columns = [
      { header: "Asset Name (Required)", key: "name", width: 30 },
      { header: "Category", key: "category", width: 25 },
      { header: "Status", key: "status", width: 15 },
      { header: "Location", key: "location", width: 25 },
      { header: "Department", key: "department", width: 20 },
      { header: "Serial Number", key: "serialNumber", width: 20 },
      { header: "Supplier / Vendor", key: "supplier", width: 25 },
      { header: "Cost (AED)", key: "cost", width: 15 },
      { header: "Purchase Date (YYYY-MM-DD)", key: "purchaseDate", width: 25 },
      { header: "Assigned Employee", key: "assignedEmployee", width: 25 },
      { header: "Description / Notes", key: "description", width: 40 },
    ];
    sheet.getRow(1).font = { bold: true };

    // Validations
    const rowCount = 1000;
    for (let i = 2; i <= rowCount; i++) {
      sheet.getCell(`B${i}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`Validators!$A$2:$A$${categories.length + 1}`],
      };
      sheet.getCell(`C${i}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [`Validators!$C$2:$C$${ASSET_STATUSES.length + 1}`],
      };
      sheet.getCell(`C${i}`).value = "Active";
      sheet.getCell(`D${i}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`Validators!$B$2:$B$${locations.length + 1}`],
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "AssetTrack_Import_Template.xlsx";
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
      const sheet = workbook.getWorksheet("Assets") || workbook.worksheets[0];
      const newAssets: Asset[] = [];

      sheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return;
        const getVal = (idx: number) => {
          const val = row.getCell(idx).value;
          if (val && typeof val === "object" && "text" in val) return val.text;
          return val ? String(val).trim() : "";
        };

        const name = getVal(1);
        if (!name) return;
        const costVal = getVal(8);
        const dateVal = getVal(9);

        newAssets.push({
          id: "ast-" + Math.random().toString(36).substr(2, 9),
          name: name,
          category: getVal(2) || "Other",
          status: (ASSET_STATUSES.includes(getVal(3) as AssetStatus)
            ? getVal(3)
            : "Active") as AssetStatus,
          location: getVal(4) || "Head Office",
          department: getVal(5) || "",
          serialNumber: getVal(6) || "",
          supplier: getVal(7) || "",
          purchaseCost: costVal ? parseFloat(costVal) : undefined,
          purchaseDate: dateVal || undefined,
          assignedEmployee: getVal(10) || "",
          description: getVal(11) || "Imported via Excel",
          lastUpdated: new Date().toISOString(),
        });
      });

      if (newAssets.length > 0) {
        await importAssetsBulk(newAssets);
        alert(`Successfully imported ${newAssets.length} assets.`);
      } else {
        alert("No valid asset data found.");
      }
    } catch (err) {
      console.error(err);
      alert("Error parsing Excel file.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
        {/* Top Bar: Global Search & Actions - INCREASED Z-INDEX to 30 */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row justify-between gap-4 relative z-30">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Global search (Name, Description)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm shadow-sm"
            />
          </div>
          <div className="flex gap-2">
            {/* Column Selector */}
            <div className="relative" ref={columnMenuRef}>
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  showColumnMenu
                    ? "bg-slate-100 border-slate-400 text-slate-900"
                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Columns size={16} /> Columns
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Toggle Visibility
                  </div>
                  <div className="p-2 max-h-60 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-sm text-slate-400 cursor-not-allowed">
                      <Check size={14} className="text-slate-400" /> Asset Name
                      (Locked)
                    </div>
                    {AVAILABLE_COLUMNS.map((col) => (
                      <label
                        key={col.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns[col.id]}
                          onChange={() => toggleColumn(col.id)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
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
                <button
                  onClick={handleDownloadTemplate}
                  className="p-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                  title="Download Template"
                >
                  <Download size={18} />
                </button>
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="p-2 bg-slate-900 text-white border border-slate-900 rounded-lg hover:bg-black disabled:opacity-50"
                    title="Import Excel"
                  >
                    {isImporting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Upload size={18} />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Filter Bar - INCREASED Z-INDEX to 20 */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 relative z-20">
          <div className="relative">
            <input
              type="text"
              placeholder="Serial No."
              value={filterSerial}
              onChange={(e) => setFilterSerial(e.target.value)}
              className="w-full pl-2 pr-2 py-1.5 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Employee"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full pl-2 pr-2 py-1.5 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Supplier"
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="w-full pl-2 pr-2 py-1.5 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full py-1.5 px-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full py-1.5 px-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="All">All Statuses</option>
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="w-full py-1.5 px-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="All">All Locations</option>
              {locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={clearFilters}
            className="py-1.5 px-2 border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 rounded-md text-xs font-medium flex items-center justify-center gap-1"
          >
            <RefreshCw size={12} /> Clear Filters
          </button>
        </div>

        {/* Table Area */}
        <div className="overflow-x-auto min-h-[400px]">
          {/* Added min-w-[1200px] to prevent column squishing/overlap on small screens */}
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                <th className="p-4 w-[250px] sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  Asset Name
                </th>

                {visibleColumns.serialNumber && (
                  <th className="p-4 w-[120px]">Serial No.</th>
                )}
                {visibleColumns.category && (
                  <th className="p-4 w-[120px]">Category</th>
                )}
                {visibleColumns.status && (
                  <th className="p-4 w-[100px]">Status</th>
                )}
                {visibleColumns.location && (
                  <th className="p-4 w-[150px]">Location</th>
                )}
                {visibleColumns.department && (
                  <th className="p-4 w-[120px]">Department</th>
                )}
                {visibleColumns.assignedEmployee && (
                  <th className="p-4 w-[150px]">Assigned To</th>
                )}
                {visibleColumns.supplier && (
                  <th className="p-4 w-[150px]">Supplier</th>
                )}
                {visibleColumns.purchaseCost && (
                  <th className="p-4 w-[100px] text-right">Cost</th>
                )}
                {visibleColumns.purchaseDate && (
                  <th className="p-4 w-[120px]">Purchase Date</th>
                )}

                {/* Added shadow to sticky right column for better separation */}
                <th className="p-4 text-right sticky right-0 bg-slate-50 z-10 w-[100px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.map((asset) => (
                <tr
                  key={asset.id}
                  className="hover:bg-slate-50 transition-colors group"
                >
                  {/* Fixed Name Column */}
                  <td className="p-4 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-slate-50">
                    <div className="font-bold text-slate-800 text-sm">
                      {asset.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate max-w-[220px] mt-0.5">
                      {asset.description}
                    </div>
                  </td>

                  {/* Dynamic Columns */}
                  {visibleColumns.serialNumber && (
                    <td className="p-4 text-xs font-mono text-slate-600">
                      {asset.serialNumber || "-"}
                    </td>
                  )}

                  {visibleColumns.category && (
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 bg-slate-100 rounded-md w-fit text-slate-700 whitespace-nowrap">
                        <Tag size={12} /> {asset.category}
                      </div>
                    </td>
                  )}

                  {visibleColumns.status && (
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${getStatusColor(
                          asset.status
                        )}`}
                      >
                        {asset.status}
                      </span>
                    </td>
                  )}

                  {visibleColumns.location && (
                    <td className="p-4 text-sm text-slate-600 flex items-center gap-1">
                      <MapPin size={14} className="text-slate-400 shrink-0" />{" "}
                      {asset.location}
                    </td>
                  )}

                  {visibleColumns.department && (
                    <td className="p-4 text-xs text-slate-500">
                      {asset.department ? (
                        <div className="flex items-center gap-1">
                          <Building2 size={12} /> {asset.department}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  )}

                  {visibleColumns.assignedEmployee && (
                    <td className="p-4">
                      {asset.assignedEmployee ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-800 font-medium bg-slate-100 px-1.5 py-0.5 rounded w-fit whitespace-nowrap">
                          <User size={12} /> {asset.assignedEmployee}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                  )}

                  {visibleColumns.supplier && (
                    <td className="p-4 text-sm text-slate-600">
                      {asset.supplier ? (
                        <div className="flex items-center gap-1">
                          <ShoppingCart size={14} className="text-slate-400" />{" "}
                          {asset.supplier}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  )}

                  {visibleColumns.purchaseCost && (
                    <td className="p-4 text-sm text-slate-700 text-right font-mono">
                      {asset.purchaseCost
                        ? `AED ${asset.purchaseCost.toLocaleString()}`
                        : "-"}
                    </td>
                  )}

                  {visibleColumns.purchaseDate && (
                    <td className="p-4 text-xs text-slate-500 flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400" />{" "}
                      {asset.purchaseDate || "-"}
                    </td>
                  )}

                  {/* Actions */}
                  <td className="p-4 text-right sticky right-0 bg-white z-10 group-hover:bg-slate-50 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <div className="flex justify-end gap-1">
                      {canEdit ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(asset);
                            }}
                            className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-md"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicate(asset);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
                            title="Duplicate"
                          >
                            <Copy size={16} />
                          </button>
                        </>
                      ) : null}
                      {canDelete ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssetToDelete(asset);
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                      {!canEdit && !canDelete && (
                        <span className="p-2 text-slate-300 cursor-not-allowed">
                          <Lock size={16} />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400">
                    No assets found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {assetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-100">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-red-50 p-3 rounded-full text-red-600">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Delete Asset?
                </h3>
                <p className="text-slate-500 text-sm mt-2">
                  Permanently remove{" "}
                  <span className="font-semibold text-slate-900">
                    {assetToDelete.name}
                  </span>
                  ?
                </p>
              </div>
              <div className="flex gap-3 w-full mt-4">
                <button
                  onClick={() => setAssetToDelete(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDelete(assetToDelete.id);
                    setAssetToDelete(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-lg shadow-red-200"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AssetList;
