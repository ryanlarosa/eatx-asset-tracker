
import React, { useState, useEffect } from 'react';
import { Asset, UserProfile, HandoverDocument } from '../types';
import { getAssets, bulkAssignAssets, bulkReturnAssets, bulkTransferAssets, getCurrentUserProfile, saveHandoverDocument, getHandoverDocuments, createPendingHandover } from '../services/storageService';
import { Briefcase, Archive, ArrowRight, CheckCircle, Search, Laptop, Smartphone, Monitor, User as UserIcon, AlertTriangle, X, FileText, Download, Link as LinkIcon, Mail } from 'lucide-react';

const StaffView: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [mode, setMode] = useState<'onboard' | 'offboard'>('offboard');
  const [view, setView] = useState<'manage' | 'documents'>('manage');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [targetEmployee, setTargetEmployee] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Link Modal State
  const [linkModal, setLinkModal] = useState<{ open: boolean, link: string, name: string }>({ open: false, link: '', name: '' });

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    type: 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '', action: async () => {}, type: 'info' });

  const currentUser = getCurrentUserProfile();
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'technician';

  useEffect(() => {
    refreshAssets();
  }, []);

  useEffect(() => {
    if (view === 'documents') {
      loadDocuments();
    }
  }, [view]);

  const refreshAssets = async () => {
    setAssets(await getAssets());
    setSelectedAssetIds(new Set());
  };

  const [documents, setDocuments] = useState<HandoverDocument[]>([]);
  const loadDocuments = async () => {
    const docs = await getHandoverDocuments();
    setDocuments(docs);
  };

  // derived lists
  const uniqueEmployees = Array.from(new Set(assets.map(a => a.assignedEmployee).filter(Boolean) as string[])).sort();
  const matchedEmployees = searchTerm 
    ? uniqueEmployees.filter(e => e.toLowerCase().includes(searchTerm.toLowerCase()))
    : uniqueEmployees;

  // Filter Logic
  const filteredAssets = assets.filter(asset => {
    if (mode === 'offboard') {
      if (!selectedEmployee) return false;
      return asset.assignedEmployee === selectedEmployee;
    } else {
      const isUnassigned = !asset.assignedEmployee || asset.status === 'In Storage';
      const matchesSearch = !searchTerm || 
                            asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            asset.category.toLowerCase().includes(searchTerm.toLowerCase());
      return isUnassigned && matchesSearch;
    }
  });

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedAssetIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedAssetIds(newSet);
  };

  const selectAll = () => {
    if (selectedAssetIds.size === filteredAssets.length) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(filteredAssets.map(a => a.id)));
    }
  };

  // Actions
  const handleAssignClick = async () => {
    if (!targetEmployee || selectedAssetIds.size === 0) return;
    setIsProcessing(true);
    try {
        const selectedAssetsList = assets.filter(a => selectedAssetIds.has(a.id));
        const pendingId = await createPendingHandover(targetEmployee, selectedAssetsList);
        
        // Generate Link
        const link = `${window.location.origin}/#/sign/${pendingId}`;
        setLinkModal({ open: true, link, name: targetEmployee });
        
        // Reset Selection
        setSelectedAssetIds(new Set());
        setTargetEmployee('');
    } catch (e) {
        alert("Failed to generate link");
    } finally {
        setIsProcessing(false);
    }
  };

  const triggerReturn = () => {
      if (selectedAssetIds.size === 0) return;
      setConfirmModal({
          isOpen: true,
          title: 'Return to Storage',
          message: `Are you sure you want to return ${selectedAssetIds.size} assets from ${selectedEmployee} to storage? This will clear the assignment.`,
          type: 'warning',
          action: async () => {
              setIsProcessing(true);
              await bulkReturnAssets(Array.from(selectedAssetIds));
              await refreshAssets();
              setSuccessMsg(`Successfully returned ${selectedAssetIds.size} assets.`);
              setIsProcessing(false);
              setConfirmModal(prev => ({ ...prev, isOpen: false }));
              if (selectedAssetIds.size === filteredAssets.length) {
                  setSelectedEmployee(null); 
              }
              setSelectedAssetIds(new Set());
              setTimeout(() => setSuccessMsg(''), 4000);
          }
      });
  };

  const triggerTransfer = () => {
      if (selectedAssetIds.size === 0 || !targetEmployee) return;
      setConfirmModal({
          isOpen: true,
          title: 'Transfer Assets',
          message: `Transfer ${selectedAssetIds.size} assets from ${selectedEmployee} to ${targetEmployee}?`,
          type: 'info',
          action: async () => {
              setIsProcessing(true);
              await bulkTransferAssets(Array.from(selectedAssetIds), targetEmployee);
              await refreshAssets();
              setSuccessMsg(`Successfully transferred assets to ${targetEmployee}`);
              setIsProcessing(false);
              setConfirmModal(prev => ({ ...prev, isOpen: false }));
              setTargetEmployee('');
              setSelectedAssetIds(new Set());
              if (selectedAssetIds.size === filteredAssets.length) {
                  setSelectedEmployee(null);
              }
              setTimeout(() => setSuccessMsg(''), 4000);
          }
      });
  };

  if (!canEdit) {
      return <div className="p-8 text-center text-slate-500">You do not have permission to manage staff assets.</div>;
  }

  return (
    <div className="space-y-6 relative">
      <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Staff & Audit</h1>
          <p className="text-slate-500 text-sm">Onboard new hires or offboard leaving staff.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg self-start">
            <button onClick={() => setView('manage')} className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${view === 'manage' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                <UserIcon size={16} /> Asset Management
            </button>
            <button onClick={() => setView('documents')} className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${view === 'documents' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                <FileText size={16} /> Signed Documents
            </button>
        </div>
      </header>

      {successMsg && <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2"><CheckCircle size={18} /> {successMsg}</div>}

      {view === 'manage' ? (
        <>
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit mb-4">
            <button 
                onClick={() => { setMode('onboard'); setSearchTerm(''); setSelectedAssetIds(new Set()); setSelectedEmployee(null); }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${mode === 'onboard' ? 'bg-slate-900 text-white shadow' : 'text-slate-500'}`}
            >
                <Briefcase size={16} /> Onboard (Assign)
            </button>
            <button 
                onClick={() => { setMode('offboard'); setSearchTerm(''); setSelectedAssetIds(new Set()); setSelectedEmployee(null); }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${mode === 'offboard' ? 'bg-slate-900 text-white shadow' : 'text-slate-500'}`}
            >
                <Archive size={16} /> Offboard (Return)
            </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel: Search & Actions */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                {mode === 'onboard' ? '1. Select Assets' : '1. Find Employee'}
            </h2>
            
            {mode === 'offboard' && selectedEmployee ? (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Selected Employee</div>
                    <div className="flex items-center justify-between">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                            <div className="bg-slate-200 p-1.5 rounded-full"><UserIcon size={16}/></div>
                            {selectedEmployee}
                        </div>
                        <button onClick={() => { setSelectedEmployee(null); setSelectedAssetIds(new Set()); }} className="text-xs text-blue-600 hover:underline">Change</button>
                    </div>
                </div>
            ) : (
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                    type="text" 
                    placeholder={mode === 'onboard' ? "Filter assets (e.g. Laptop)..." : "Search Employee Name..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                    />
                    
                    {mode === 'offboard' && searchTerm && (
                        <div className="mt-2 max-h-40 overflow-y-auto border border-slate-100 rounded-lg bg-white shadow-sm">
                            {matchedEmployees.length > 0 ? matchedEmployees.map(emp => (
                                <div 
                                    key={emp} 
                                    onClick={() => { setSelectedEmployee(emp); setSearchTerm(''); }}
                                    className="p-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 flex items-center gap-2"
                                >
                                    <UserIcon size={14} className="text-slate-400"/> {emp}
                                </div>
                            )) : (
                                <div className="p-2 text-xs text-slate-400 text-center">No matching employees found</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="border-t border-slate-100 pt-6">
                <h2 className="font-bold text-slate-800 mb-4">2. Actions</h2>
                
                {mode === 'onboard' ? (
                <div className="space-y-3">
                    <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Assign To (New Hire)</label>
                    <input 
                        value={targetEmployee}
                        onChange={(e) => setTargetEmployee(e.target.value)}
                        placeholder="Enter Name..."
                        className="w-full p-2 border border-slate-300 rounded-lg mb-2"
                    />
                    </div>
                    <button 
                    onClick={handleAssignClick}
                    disabled={selectedAssetIds.size === 0 || !targetEmployee || isProcessing}
                    className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium hover:bg-black disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                    {isProcessing ? 'Generating...' : <>Generate Sign Link <LinkIcon size={16}/></>}
                    </button>
                </div>
                ) : (
                <div className="space-y-3">
                    <div className={`transition-opacity ${!selectedEmployee ? 'opacity-50 pointer-events-none' : ''}`}>
                        <button 
                            onClick={triggerReturn}
                            disabled={selectedAssetIds.size === 0 || isProcessing}
                            className="w-full bg-slate-100 text-slate-700 py-2 rounded-lg font-medium hover:bg-slate-200 disabled:opacity-50 flex justify-center items-center gap-2 border border-slate-200"
                        >
                            <Archive size={16} /> Return to Storage
                        </button>
                        
                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-slate-200"></div>
                            <span className="flex-shrink mx-2 text-slate-400 text-xs uppercase">OR Transfer</span>
                            <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                        <div>
                        <input 
                            value={targetEmployee}
                            onChange={(e) => setTargetEmployee(e.target.value)}
                            placeholder="Transfer to..."
                            className="w-full p-2 border border-slate-300 rounded-lg mb-2 text-sm"
                        />
                        <button 
                            onClick={triggerTransfer}
                            disabled={selectedAssetIds.size === 0 || !targetEmployee || isProcessing}
                            className="w-full bg-slate-800 text-white py-2 rounded-lg font-medium hover:bg-slate-900 disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            Transfer <ArrowRight size={16} />
                        </button>
                        </div>
                    </div>
                </div>
                )}
            </div>
            </div>

            {/* Right Panel: Asset List */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div className="font-semibold text-slate-700">
                {mode === 'onboard' 
                    ? 'Available Assets (Unassigned)' 
                    : selectedEmployee ? `Assets assigned to ${selectedEmployee}` : 'Select an employee to view assets'}
                </div>
                <div className="text-sm text-slate-500">
                {selectedAssetIds.size} selected
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[600px] p-0 bg-white">
                {filteredAssets.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                    {mode === 'onboard' 
                        ? "No unassigned assets found." 
                        : selectedEmployee ? "No assets assigned to this user." : <div className="flex flex-col items-center gap-2"><Search size={32} className="opacity-20"/><span>Search and select an employee on the left.</span></div>}
                </div>
                ) : (
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white sticky top-0 z-10 shadow-sm">
                    <tr className="text-xs uppercase text-slate-500 font-semibold border-b border-slate-100">
                        <th className="p-4 w-10">
                        <input type="checkbox" onChange={selectAll} checked={filteredAssets.length > 0 && selectedAssetIds.size === filteredAssets.length} />
                        </th>
                        <th className="p-4">Asset Name</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Status</th>
                        {mode === 'onboard' && <th className="p-4">Location</th>}
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                    {filteredAssets.map(asset => (
                        <tr key={asset.id} className={`hover:bg-slate-50 cursor-pointer ${selectedAssetIds.has(asset.id) ? 'bg-slate-50' : ''}`} onClick={() => toggleSelection(asset.id)}>
                        <td className="p-4" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedAssetIds.has(asset.id)} onChange={() => toggleSelection(asset.id)} />
                        </td>
                        <td className="p-4 font-medium text-slate-800">
                            {asset.name}
                            <div className="text-xs text-slate-400">{asset.serialNumber}</div>
                        </td>
                        <td className="p-4 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                                {asset.category.includes('Laptop') ? <Laptop size={14}/> : 
                                asset.category.includes('Phone') ? <Smartphone size={14}/> : <Monitor size={14}/>}
                                {asset.category}
                            </div>
                        </td>
                        <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${asset.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {asset.status}
                            </span>
                        </td>
                        {mode === 'onboard' && <td className="p-4 text-sm text-slate-500">{asset.location}</td>}
                        </tr>
                    ))}
                    </tbody>
                </table>
                )}
            </div>
            </div>
            </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.length > 0 ? documents.map(doc => (
                <div key={doc.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                        <div>
                            <div className="font-bold text-slate-800">{doc.employeeName}</div>
                            <div className="text-xs text-slate-500">{new Date(doc.date).toLocaleDateString()} at {new Date(doc.date).toLocaleTimeString()}</div>
                        </div>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium">{doc.type}</span>
                    </div>
                    <div className="p-4">
                        <div className="text-xs text-slate-400 uppercase font-bold mb-2">Assets Included</div>
                        <div className="space-y-1 mb-4">
                            {doc.assets.slice(0, 3).map(a => (
                                <div key={a.id} className="text-sm text-slate-700 flex justify-between">
                                    <span>{a.name}</span>
                                    <span className="text-slate-400 text-xs font-mono">{a.serialNumber}</span>
                                </div>
                            ))}
                            {doc.assets.length > 3 && <div className="text-xs text-slate-400 italic">+{doc.assets.length - 3} more items</div>}
                        </div>
                        <div className="border-t border-slate-100 pt-3">
                            <div className="text-xs text-slate-400 mb-1">Signed</div>
                            <img src={doc.signatureBase64} alt="Sig" className="h-10 opacity-70" />
                        </div>
                    </div>
                </div>
            )) : (
                <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
                    <FileText size={48} className="mx-auto mb-2 opacity-20" />
                    No signed documents found.
                </div>
            )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-100">
                  <div className="flex flex-col items-center text-center gap-4">
                      <div className={`p-3 rounded-full ${confirmModal.type === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                          {confirmModal.type === 'warning' ? <AlertTriangle size={32} /> : <CheckCircle size={32} />}
                      </div>
                      <div>
                          <h3 className="text-xl font-bold text-slate-900">{confirmModal.title}</h3>
                          <p className="text-slate-500 text-sm mt-2">{confirmModal.message}</p>
                      </div>
                      <div className="flex gap-3 w-full mt-4">
                          <button 
                            onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                          >
                              Cancel
                          </button>
                          <button 
                            onClick={confirmModal.action} 
                            disabled={isProcessing}
                            className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium shadow-lg transition-colors ${confirmModal.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
                          >
                              Confirm
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Link Generated Modal */}
      {linkModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100 animate-in fade-in zoom-in">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-slate-900">Sign Link Generated</h3>
                    <button onClick={() => setLinkModal({ ...linkModal, open: false })}><X size={20} className="text-slate-400"/></button>
                </div>
                <p className="text-slate-600 text-sm mb-4">
                    A digital handover form has been created for <span className="font-bold">{linkModal.name}</span>. Send this link to the employee to collect their signature.
                </p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 break-all text-xs font-mono text-slate-600 mb-4 select-all">
                    {linkModal.link}
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => navigator.clipboard.writeText(linkModal.link)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                    >
                        Copy Link
                    </button>
                    <a 
                        href={`mailto:?subject=Asset Handover Signature Required&body=Hello ${linkModal.name},%0D%0A%0D%0APlease review and sign the asset handover form at the following link:%0D%0A%0D%0A${linkModal.link}%0D%0A%0D%0AThank you.`}
                        className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                    >
                        Send Email <Mail size={16}/>
                    </a>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default StaffView;
