import React, { useState, useEffect } from 'react';
import { Invoice, Asset } from '../types';
import { listenToInvoices, listenToAssets, saveInvoice, deleteInvoice, getCurrentUserProfile } from '../services/storageService';
import { Receipt, Plus, Search, Trash2, Download, FileText, CheckSquare, Loader2, X, Paperclip } from 'lucide-react';

const Invoices: React.FC = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [searchAsset, setSearchAsset] = useState('');
    const [saving, setSaving] = useState(false);

    // Form
    const [vendor, setVendor] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [date, setDate] = useState('');
    const [fileBase64, setFileBase64] = useState('');
    const [fileName, setFileName] = useState('');
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());

    const currentUser = getCurrentUserProfile();
    const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'technician';

    useEffect(() => {
        setLoading(true);
        const unsubInvoices = listenToInvoices((data) => setInvoices(data));
        const unsubAssets = listenToAssets((data) => setAssets(data));
        setLoading(false);
        return () => {
            unsubInvoices();
            unsubAssets();
        }
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                if (event.target?.result) {
                    setFileBase64(event.target.result as string);
                }
            };
        }
    };

    const toggleAsset = (id: string) => {
        const newSet = new Set(selectedAssetIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedAssetIds(newSet);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const newInvoice: Invoice = {
                id: 'inv-' + Math.random().toString(36).substr(2, 9),
                vendor,
                invoiceNumber,
                amount,
                date,
                fileBase64,
                fileName,
                linkedAssetIds: Array.from(selectedAssetIds),
                createdAt: new Date().toISOString()
            };
            await saveInvoice(newInvoice);
            // Listener updates list
            setIsCreating(false);
            resetForm();
        } catch (error) {
            alert("Failed to save invoice.");
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setVendor('');
        setInvoiceNumber('');
        setAmount(0);
        setDate('');
        setFileBase64('');
        setFileName('');
        setSelectedAssetIds(new Set());
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this invoice?")) {
            await deleteInvoice(id);
        }
    };

    const filteredAssets = assets.filter(a => 
        a.name.toLowerCase().includes(searchAsset.toLowerCase()) || 
        a.serialNumber.toLowerCase().includes(searchAsset.toLowerCase()) ||
        (a.supplier && a.supplier.toLowerCase().includes(searchAsset.toLowerCase()))
    );

    const inputClass = "w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600";
    const labelClass = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1";

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Receipt className="text-slate-900 dark:text-white"/> Invoices
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Upload and manage purchase invoices.</p>
                </div>
                {canEdit && (
                    <button onClick={() => setIsCreating(true)} className="bg-slate-900 dark:bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-black dark:hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm transition-all">
                        <Plus size={20} /> Upload Invoice
                    </button>
                )}
            </header>

            {isCreating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 dark:text-white text-lg">New Invoice</h3>
                            <button onClick={() => { setIsCreating(false); resetForm(); }}><X size={20} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"/></button>
                        </div>
                        
                        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                            {/* Form Side */}
                            <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-slate-200 dark:border-slate-800">
                                <form id="invoiceForm" onSubmit={handleSave} className="space-y-4">
                                    <div>
                                        <label className={labelClass}>Vendor Name</label>
                                        <input required className={inputClass} placeholder="e.g. Amazon, Apple" value={vendor} onChange={e => setVendor(e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Invoice #</label>
                                            <input required className={inputClass} value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Date</label>
                                            <input required type="date" className={inputClass} value={date} onChange={e => setDate(e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Total Amount (AED)</label>
                                        <input required type="number" step="0.01" className={inputClass} value={amount} onChange={e => setAmount(parseFloat(e.target.value))} />
                                    </div>
                                    
                                    <div>
                                        <label className={labelClass}>Upload File (PDF/Image)</label>
                                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-800/80 transition-colors cursor-pointer relative">
                                            <input type="file" required accept=".pdf,image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                            <Paperclip className="text-slate-400 mb-2" />
                                            <span className="text-sm text-slate-600 dark:text-slate-400">{fileName || "Click to upload file"}</span>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            {/* Asset Link Side */}
                            <div className="w-full md:w-1/2 p-6 bg-slate-50 dark:bg-slate-950 flex flex-col">
                                <div className="mb-4">
                                    <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-2"><CheckSquare size={18}/> Link Assets</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Select assets covered by this invoice.</p>
                                    <div className="relative">
                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input 
                                            placeholder="Search asset name, supplier or serial..." 
                                            className="w-full pl-8 p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                            value={searchAsset}
                                            onChange={e => setSearchAsset(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-2 space-y-1 custom-scrollbar">
                                    {filteredAssets.map(asset => (
                                        <div 
                                            key={asset.id} 
                                            onClick={() => toggleAsset(asset.id)}
                                            className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer text-sm ${selectedAssetIds.has(asset.id) ? 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedAssetIds.has(asset.id) ? 'bg-slate-900 dark:bg-blue-600 border-slate-900 dark:border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                                                {selectedAssetIds.has(asset.id) && <div className="w-2 h-2 bg-white rounded-sm" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium text-slate-800 dark:text-slate-200">{asset.name}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    {asset.supplier && <span className="font-semibold text-slate-700 dark:text-slate-300">{asset.supplier} • </span>}
                                                    {asset.serialNumber} • AED {asset.purchaseCost}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 text-right text-xs text-slate-500 dark:text-slate-400">
                                    {selectedAssetIds.size} assets selected
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                            <button onClick={() => setIsCreating(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium hover:bg-white dark:hover:bg-slate-800">Cancel</button>
                            <button form="invoiceForm" type="submit" disabled={saving} className="px-6 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-black dark:hover:bg-blue-700 font-medium flex items-center gap-2 disabled:opacity-50">
                                {saving ? <Loader2 className="animate-spin" size={18}/> : 'Save Invoice'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-slate-400"/></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {invoices.length > 0 ? invoices.map(inv => (
                        <div key={inv.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-800/30">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white">{inv.vendor}</h3>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">#{inv.invoiceNumber}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-slate-900 dark:text-white">AED {inv.amount.toLocaleString()}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(inv.date).toLocaleDateString()}</div>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Linked Assets ({inv.linkedAssetIds.length})</div>
                                <div className="space-y-1 mb-4">
                                    {inv.linkedAssetIds.slice(0, 3).map(id => {
                                        const asset = assets.find(a => a.id === id);
                                        return asset ? (
                                            <div key={id} className="text-sm text-slate-600 dark:text-slate-300 flex justify-between">
                                                <span className="truncate max-w-[180px]">{asset.name}</span>
                                                <span className="font-mono text-xs text-slate-400">{asset.serialNumber}</span>
                                            </div>
                                        ) : null;
                                    })}
                                    {inv.linkedAssetIds.length > 3 && (
                                        <div className="text-xs text-slate-400 italic">+{inv.linkedAssetIds.length - 3} more assets</div>
                                    )}
                                </div>
                                
                                <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    {inv.fileBase64 && (
                                        <a href={inv.fileBase64} download={inv.fileName || `invoice-${inv.invoiceNumber}`} className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                                            <Download size={14}/> Download File
                                        </a>
                                    )}
                                    {canEdit && (
                                        <button onClick={() => handleDelete(inv.id)} className="p-2 rounded-lg border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                            <Trash2 size={16}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-full py-12 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
                            <Receipt size={48} className="mx-auto mb-2 opacity-20" />
                            No invoices uploaded yet.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Invoices;