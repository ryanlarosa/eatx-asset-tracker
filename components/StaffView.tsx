
import React, { useState, useEffect, useMemo } from 'react';
import { Asset, UserProfile, HandoverDocument, PendingHandover } from '../types';
import { 
  listenToAssets, bulkAssignAssets, bulkReturnAssets, bulkTransferAssets, 
  getCurrentUserProfile, saveHandoverDocument, getHandoverDocuments, 
  createPendingHandover, getSandboxStatus, listenToPendingHandovers, deletePendingHandover 
} from '../services/storageService';
import { 
  Briefcase, Archive, ArrowRight, CheckCircle, Search, Laptop, Smartphone, Monitor, 
  User as UserIcon, AlertTriangle, X, FileText, Download, Link as LinkIcon, Mail, 
  Printer, Clock, Trash2, ExternalLink, Loader2, Filter, CheckCircle2, ChevronRight,
  ClipboardCheck, RotateCcw, UserPlus, UserMinus, HardDrive, ListFilter
} from 'lucide-react';
import HandoverModal from './HandoverModal';

const StaffView: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pendingLinks, setPendingLinks] = useState<PendingHandover[]>([]);
  const [mode, setMode] = useState<'onboard' | 'offboard'>('offboard');
  const [view, setView] = useState<'manage' | 'documents' | 'pending'>('manage');
  
  // Manage View Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [gridSearch, setGridSearch] = useState('');
  
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [targetEmployee, setTargetEmployee] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Document Filters
  const [docSearchTerm, setDocSearchTerm] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<'All' | 'Handover' | 'Return' | 'Transfer'>('All');
  const [docStatusFilter, setDocStatusFilter] = useState<'All' | 'Pending' | 'Completed'>('All');

  const [linkModal, setLinkModal] = useState<{ open: boolean, link: string, name: string }>({ open: false, link: '', name: '' });

  // Signature Modal State
  const [signModal, setSignModal] = useState<{
    isOpen: boolean;
    type: 'Handover' | 'Return' | 'Transfer';
    employeeName: string;
    targetName?: string;
    assets: Asset[];
    assetsSnapshot?: { id: string; name: string; serialNumber: string }[];
    docId?: string;
    initialData?: { employeeSig?: string, itSig?: string };
  }>({ isOpen: false, type: 'Handover', employeeName: '', assets: [] });

  const currentUser = getCurrentUserProfile();
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'technician' || currentUser?.role === 'sandbox_user';

  useEffect(() => {
    const unsubscribe = listenToAssets((data) => {
        setAssets(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
      if (view === 'pending') {
          const unsub = listenToPendingHandovers((data) => setPendingLinks(data));
          return () => unsub();
      }
  }, [view]);

  // Sync selected assets when mode changes
  useEffect(() => {
    setSelectedAssetIds(prev => {
        const newSet = new Set<string>();
        prev.forEach(id => {
            const asset = assets.find(a => a.id === id);
            if (!asset) return;
            if (mode === 'offboard') {
                 if (asset.assignedEmployee === selectedEmployee) newSet.add(id);
            } else {
                 if (asset.status === 'In Storage') newSet.add(id);
            }
        });
        return newSet;
    })
  }, [assets, mode, selectedEmployee]);

  const [documents, setDocuments] = useState<HandoverDocument[]>([]);
  useEffect(() => {
    if (view === 'documents') {
      loadDocuments();
    }
  }, [view]);

  const loadDocuments = async () => {
    const docs = await getHandoverDocuments();
    setDocuments(docs);
  };

  // Filtered Documents Logic
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = doc.employeeName.toLowerCase().includes(docSearchTerm.toLowerCase()) ||
                            doc.assets.some(a => a.name.toLowerCase().includes(docSearchTerm.toLowerCase()) || a.serialNumber.toLowerCase().includes(docSearchTerm.toLowerCase()));
      const matchesType = docTypeFilter === 'All' || doc.type === docTypeFilter;
      const matchesStatus = docStatusFilter === 'All' || 
                           (docStatusFilter === 'Pending' ? doc.status !== 'Completed' : doc.status === 'Completed');
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [documents, docSearchTerm, docTypeFilter, docStatusFilter]);

  const uniqueEmployees = Array.from(new Set(assets.map(a => a.assignedEmployee).filter(Boolean) as string[])).sort();
  const matchedEmployees = searchTerm 
    ? uniqueEmployees.filter(e => e.toLowerCase().includes(searchTerm.toLowerCase()))
    : uniqueEmployees;

  const filteredAssets = assets.filter(asset => {
    const matchesGrid = !gridSearch || 
                        asset.name.toLowerCase().includes(gridSearch.toLowerCase()) || 
                        asset.serialNumber.toLowerCase().includes(gridSearch.toLowerCase());
    
    if (!matchesGrid) return false;

    if (mode === 'offboard') {
      if (!selectedEmployee) return false;
      return asset.assignedEmployee === selectedEmployee;
    } else {
      return asset.status === 'In Storage';
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

  const handleGenerateLink = async (linkType: 'Handover' | 'Return') => {
    const empName = linkType === 'Handover' ? targetEmployee : selectedEmployee;
    if (!empName || selectedAssetIds.size === 0) return;
    
    setIsProcessing(true);
    try {
        const selectedAssetsList = assets.filter(a => selectedAssetIds.has(a.id));
        const pendingId = await createPendingHandover(empName, selectedAssetsList, linkType);
        const isSandbox = getSandboxStatus();
        const link = `${window.location.origin}/#/sign/${pendingId}${isSandbox ? '?env=sandbox' : ''}`;
        setLinkModal({ open: true, link, name: empName });
        setSelectedAssetIds(new Set());
        setTargetEmployee('');
    } catch (e) {
        alert("Failed to generate link");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDeletePending = async (id: string) => {
      if (confirm("Revoke this sign link?")) {
          await deletePendingHandover(id);
          setSuccessMsg("Sign link revoked.");
          setTimeout(() => setSuccessMsg(''), 3000);
      }
  };

  const handleReturnClick = () => {
      if (selectedAssetIds.size === 0 || !selectedEmployee) return;
      setSignModal({
          isOpen: true,
          type: 'Return',
          employeeName: selectedEmployee,
          assets: assets.filter(a => selectedAssetIds.has(a.id))
      });
  };

  const handleHandoverClick = () => {
    if (selectedAssetIds.size === 0 || !targetEmployee) return;
    setSignModal({
        isOpen: true,
        type: 'Handover',
        employeeName: targetEmployee,
        assets: assets.filter(a => selectedAssetIds.has(a.id))
    });
};

  const handleTransferClick = () => {
      if (selectedAssetIds.size === 0 || !selectedEmployee || !targetEmployee) return;
      setSignModal({
          isOpen: true,
          type: 'Transfer',
          employeeName: selectedEmployee,
          targetName: targetEmployee,
          assets: assets.filter(a => selectedAssetIds.has(a.id))
      });
  };

  const handleResumeSign = (doc: HandoverDocument) => {
      setSignModal({
          isOpen: true,
          type: doc.type,
          employeeName: doc.employeeName,
          assets: [],
          assetsSnapshot: doc.assets,
          docId: doc.id,
          initialData: {
              employeeSig: doc.signatureBase64,
              itSig: doc.itSignatureBase64
          }
      });
  };

  const handleSignatureConfirm = async (sigs: { employeeSig: string, itSig?: string, status: 'Pending' | 'Completed' }) => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
          const docId = signModal.docId || 'doc-' + Math.random().toString(36).substr(2, 9);
          const docData: HandoverDocument = {
              id: docId,
              employeeName: signModal.employeeName,
              assets: signModal.assetsSnapshot || signModal.assets.map(a => ({ id: a.id, name: a.name, serialNumber: a.serialNumber })),
              signatureBase64: sigs.employeeSig,
              itSignatureBase64: sigs.itSig,
              date: new Date().toISOString(),
              type: signModal.type,
              status: sigs.status
          };
          await saveHandoverDocument(docData);
          const assetIds = signModal.assetsSnapshot ? signModal.assetsSnapshot.map(a => a.id) : signModal.assets.map(a => a.id);
          
          if (sigs.status === 'Completed') {
            if (signModal.type === 'Return' && sigs.itSig) {
                await bulkReturnAssets(assetIds, docId);
            } else if (signModal.type === 'Transfer' && signModal.targetName) {
                await bulkTransferAssets(assetIds, signModal.targetName, docId);
            } else if (signModal.type === 'Handover') {
                await bulkAssignAssets(assetIds, signModal.employeeName, docId);
            }
            setSuccessMsg('Transaction Finalized.');
          } else {
            setSuccessMsg('Progress Saved.');
          }

          setSignModal({ ...signModal, isOpen: false });
          setSelectedAssetIds(new Set());
          setTargetEmployee('');
          if (!signModal.docId && selectedAssetIds.size === filteredAssets.length) setSelectedEmployee(null);
          if (view === 'documents') loadDocuments();
          setTimeout(() => setSuccessMsg(''), 4000);
      } catch (e) {
          alert("Error processing transaction.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handlePrintDocument = (doc: HandoverDocument) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const dateFormatted = new Date(doc.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const timestamp = new Date(doc.date).toLocaleString('en-US', { hour12: true });
    
    const docTitle = doc.type === 'Return' ? 'ASSET RETURN FORM' : doc.type === 'Transfer' ? 'ASSET TRANSFER ACKNOWLEDGEMENT' : 'ASSET HANDOVER FORM';
    const declaration = doc.type === 'Return' 
      ? `I, <b>${doc.employeeName}</b>, confirm the return of the following company assets.`
      : `I, <b>${doc.employeeName}</b>, acknowledge receipt/transfer of the following company assets. I agree to use them for company business and maintain them in good condition.`;

    const statusLabel = doc.status?.toUpperCase() || 'PENDING';
    const statusColor = doc.status === 'Completed' ? '#059669' : '#d97706';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; padding: 40px; line-height: 1.6; max-width: 850px; margin: 0 auto; }
              
              /* Header Section */
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; }
              .logo-side { display: flex; flex-direction: column; }
              .logo-main { font-size: 32pt; font-weight: 900; line-height: 1; margin: 0; color: #0f172a; letter-spacing: -2px; }
              .logo-sub { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; color: #64748b; margin-top: 5px; }
              
              .company-info { text-align: right; font-size: 8.5pt; color: #475569; }
              .company-name { font-weight: 800; font-size: 11pt; color: #0f172a; margin-bottom: 4px; }
              
              /* Document Title */
              .doc-title { font-size: 24pt; font-weight: 800; border-bottom: 4px solid #000; display: inline-block; margin-bottom: 30px; padding-bottom: 5px; }
              
              /* Info Grid */
              .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 1px solid #e2e8f0; margin-bottom: 40px; }
              .info-item { display: flex; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
              .info-label { width: 140px; font-size: 10pt; font-weight: 700; color: #64748b; }
              .info-value { font-size: 10pt; font-weight: 600; color: #0f172a; }
              .status-val { font-weight: 900; color: ${statusColor}; letter-spacing: 0.5px; }
              
              /* Declaration Block */
              .declaration-container { display: flex; margin-bottom: 40px; padding: 10px 0; }
              .declaration-bracket { border-left: 4px solid #000; width: 10px; border-radius: 8px 0 0 8px; margin-right: 20px; }
              .declaration-text { font-style: italic; font-size: 11pt; color: #334155; }
              
              /* Asset Table */
              table { width: 100%; border-collapse: collapse; margin-bottom: 50px; }
              th { text-align: left; padding: 12px 15px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
              td { padding: 15px; border: 1px solid #e2e8f0; font-size: 10pt; color: #0f172a; }
              .col-hash { width: 40px; text-align: center; color: #94a3b8; }
              .col-serial { font-family: 'Courier New', Courier, monospace; font-weight: 600; }
              
              /* Signature Section */
              .footer-rule { border-top: 2px solid #0f172a; margin-top: 60px; padding-top: 20px; }
              .signature-img { max-height: 55px; margin-bottom: 15px; display: block; mix-blend-mode: multiply; }
              .acknowledged-text { font-size: 10pt; font-weight: 800; margin: 0; }
              .signed-timestamp { font-size: 8.5pt; font-family: 'Courier New', Courier, monospace; color: #64748b; margin-top: 4px; }
              
              /* Disclaimer */
              .disclaimer { margin-top: 80px; text-align: center; font-size: 8pt; color: #94a3b8; font-style: italic; }
              
              @media print {
                  body { padding: 20px; }
                  .header { margin-bottom: 20px; }
                  @page { margin: 1cm; }
              }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="logo-side">
                  <h1 class="logo-main">eatx.</h1>
                  <span class="logo-sub">IT HUB OPERATIONS</span>
              </div>
              <div class="company-info">
                  <div class="company-name">EatX Facilities Management LLC</div>
                  Office No. 2005-06, Burj Al Salam Building No. 2735391504,<br>
                  Sheikh Zayed Road, Trade Centre First,<br>
                  Dubai, United Arab Emirates, 122500<br>
                  Tel: +971 4229 5775 • TRN: 100558980700003
              </div>
          </div>

          <div class="doc-title">${docTitle}</div>

          <div class="info-grid">
              <div class="info-item">
                  <span class="info-label">Employee Name:</span>
                  <span class="info-value">${doc.employeeName}</span>
              </div>
              <div class="info-item">
                  <span class="info-label">Date:</span>
                  <span class="info-value">${dateFormatted}</span>
              </div>
              <div class="info-item">
                  <span class="info-label">Document ID:</span>
                  <span class="info-value">${doc.id}</span>
              </div>
              <div class="info-item">
                  <span class="info-label">Status:</span>
                  <span class="info-value status-val">${statusLabel}</span>
              </div>
          </div>

          <div class="declaration-container">
              <div class="declaration-bracket"></div>
              <div class="declaration-text">${declaration}</div>
          </div>

          <table>
              <thead>
                  <tr>
                      <th class="col-hash">#</th>
                      <th>ASSET NAME / DESCRIPTION</th>
                      <th>SERIAL NUMBER</th>
                  </tr>
              </thead>
              <tbody>
                  ${doc.assets.map((a, i) => `
                    <tr>
                        <td class="col-hash">${i + 1}</td>
                        <td style="font-weight:700;">${a.name}</td>
                        <td class="col-serial">${a.serialNumber || 'N/A'}</td>
                    </tr>
                  `).join('')}
              </tbody>
          </table>

          <div class="footer-rule">
              ${doc.signatureBase64 ? `<img src="${doc.signatureBase64}" class="signature-img" />` : '<div style="height:60px;"></div>'}
              <p class="acknowledged-text">Acknowledged by: ${doc.employeeName}</p>
              <p class="signed-timestamp">Digitally Signed: ${timestamp}</p>
          </div>

          <div class="disclaimer">
              This document is generated through EatX IT Hub
          </div>

          <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!canEdit) {
      return <div className="p-8 text-center text-slate-500 dark:text-slate-400">You do not have permission to manage staff assets in IT Hub.</div>;
  }

  const inputClass = "w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600 bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-all";
  const labelClass = "block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 tracking-wider";

  return (
    <div className="space-y-6 relative h-full">
      <header className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Staff & Audit</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Digital handovers, offboarding, and asset verification.</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl self-start border border-slate-200 dark:border-slate-700 shadow-sm">
            <button onClick={() => setView('manage')} className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-all ${view === 'manage' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <RotateCcw size={16} /> Workflow
            </button>
            <button onClick={() => setView('pending')} className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-all ${view === 'pending' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <LinkIcon size={16} /> Pending Links
            </button>
            <button onClick={() => setView('documents')} className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-all ${view === 'documents' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <FileText size={16} /> Documents
            </button>
        </div>
      </header>

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2 border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      {view === 'manage' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Step-by-Step Command Sidebar */}
            <div className="lg:col-span-1 space-y-4 sticky top-24">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="space-y-8">
                        {/* Step 1: Process Type */}
                        <div>
                            <h2 className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white mb-4 uppercase tracking-widest">
                                <span className="bg-slate-100 dark:bg-slate-800 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">1</span> 
                                Process Type
                            </h2>
                            <div className="grid grid-cols-1 gap-2">
                                <button 
                                    onClick={() => { setMode('onboard'); setSelectedEmployee(null); setSelectedAssetIds(new Set()); }}
                                    className={`flex items-center justify-between p-3 rounded-xl border text-sm font-bold transition-all ${mode === 'onboard' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/30' : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700'}`}
                                >
                                    <div className="flex items-center gap-3"><UserPlus size={18}/> Assignment</div>
                                    {mode === 'onboard' && <CheckCircle2 size={16}/>}
                                </button>
                                <button 
                                    onClick={() => { setMode('offboard'); setSelectedEmployee(null); setSelectedAssetIds(new Set()); }}
                                    className={`flex items-center justify-between p-3 rounded-xl border text-sm font-bold transition-all ${mode === 'offboard' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 ring-2 ring-amber-100 dark:ring-amber-900/30' : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700'}`}
                                >
                                    <div className="flex items-center gap-3"><UserMinus size={18}/> Offboarding</div>
                                    {mode === 'offboard' && <CheckCircle2 size={16}/>}
                                </button>
                            </div>
                        </div>

                        {/* Step 2: Identification */}
                        <div>
                            <h2 className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white mb-4 uppercase tracking-widest">
                                <span className="bg-slate-100 dark:bg-slate-800 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">2</span> 
                                Identification
                            </h2>
                            
                            {mode === 'offboard' && selectedEmployee ? (
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 group">
                                    <label className={labelClass}>Selected Employee</label>
                                    <div className="flex items-center justify-between">
                                        <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm truncate">
                                            <div className="bg-white dark:bg-slate-700 p-1 rounded-full shadow-sm"><UserIcon size={14}/></div>
                                            {selectedEmployee}
                                        </div>
                                        <button onClick={() => { setSelectedEmployee(null); setSelectedAssetIds(new Set()); }} className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">Change</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input 
                                            placeholder={mode === 'onboard' ? "New User Name..." : "Search Assigned Employee..."}
                                            value={mode === 'onboard' ? targetEmployee : searchTerm}
                                            onChange={(e) => mode === 'onboard' ? setTargetEmployee(e.target.value) : setSearchTerm(e.target.value)}
                                            className={`pl-9 py-2.5 text-sm ${inputClass}`}
                                        />
                                    </div>
                                    
                                    {mode === 'offboard' && searchTerm && (
                                        <div className="max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-xl custom-scrollbar animate-in fade-in slide-in-from-top-1">
                                            {matchedEmployees.length > 0 ? matchedEmployees.map(emp => (
                                                <div 
                                                    key={emp} 
                                                    onClick={() => { setSelectedEmployee(emp); setSearchTerm(''); }}
                                                    className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b last:border-0 border-slate-50 dark:border-slate-800"
                                                >
                                                    <UserIcon size={14} className="text-slate-400"/> {emp}
                                                </div>
                                            )) : (
                                                <div className="p-4 text-xs text-slate-400 text-center">No matching staff found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Step 3: Actions */}
                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                            <h2 className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white mb-4 uppercase tracking-widest">
                                <span className="bg-slate-100 dark:bg-slate-800 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">3</span> 
                                Summary & Action
                            </h2>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <span className="text-xs text-slate-500">Selected Items:</span>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedAssetIds.size} Assets</span>
                                </div>

                                <div className="space-y-2">
                                    {mode === 'onboard' ? (
                                        <>
                                            <button 
                                                disabled={selectedAssetIds.size === 0 || !targetEmployee || isProcessing}
                                                onClick={() => handleGenerateLink('Handover')}
                                                className="w-full bg-slate-900 dark:bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 transition-all flex justify-center items-center gap-2 shadow-lg shadow-slate-900/10 dark:shadow-blue-900/20"
                                            >
                                                {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <><LinkIcon size={16}/> Generate Sign Link</>}
                                            </button>
                                            <button 
                                                disabled={selectedAssetIds.size === 0 || !targetEmployee || isProcessing}
                                                onClick={handleHandoverClick}
                                                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex justify-center items-center gap-2 border border-slate-200 dark:border-slate-700"
                                            >
                                                <ClipboardCheck size={16}/> Sign & Assign Now
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button 
                                                disabled={selectedAssetIds.size === 0 || !selectedEmployee || isProcessing}
                                                onClick={() => handleGenerateLink('Return')}
                                                className="w-full bg-amber-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-amber-600 disabled:opacity-50 transition-all flex justify-center items-center gap-2 shadow-lg shadow-amber-900/10"
                                            >
                                                {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <><LinkIcon size={16}/> Generate Return Link</>}
                                            </button>
                                            <button 
                                                disabled={selectedAssetIds.size === 0 || !selectedEmployee || isProcessing}
                                                onClick={handleReturnClick}
                                                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex justify-center items-center gap-2 border border-slate-200 dark:border-slate-700"
                                            >
                                                <Archive size={16}/> Sign & Return Now
                                            </button>
                                            
                                            <div className="pt-4 mt-4 border-t border-slate-50 dark:border-slate-800">
                                                <input 
                                                    placeholder="Transfer to employee..."
                                                    value={targetEmployee}
                                                    onChange={e => setTargetEmployee(e.target.value)}
                                                    className={`mb-2 text-xs ${inputClass}`}
                                                />
                                                <button 
                                                    disabled={selectedAssetIds.size === 0 || !selectedEmployee || !targetEmployee || isProcessing}
                                                    onClick={handleTransferClick}
                                                    className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                                >
                                                    Process Transfer <ArrowRight size={14}/>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Selection Grid Panel */}
            <div className="lg:col-span-3 space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                    <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="relative flex-1 w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                            <input 
                                placeholder="Search grid by name or serial..."
                                value={gridSearch}
                                onChange={e => setGridSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            {selectedAssetIds.size > 0 && (
                                <button 
                                    onClick={() => setSelectedAssetIds(new Set())}
                                    className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    Clear Selection ({selectedAssetIds.size})
                                </button>
                            )}
                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                                {mode === 'onboard' ? 'Available Stock' : 'Assigned Equipment'}
                            </div>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto flex-1 bg-white dark:bg-slate-900">
                        {filteredAssets.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center gap-4">
                                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl text-slate-200 dark:text-slate-700">
                                    <HardDrive size={64}/>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white">No Assets Found</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {mode === 'onboard' 
                                            ? "All items are currently assigned or out for repair." 
                                            : selectedEmployee ? "This employee has no active assets assigned." : "Search and select an employee on the left."}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800/30 sticky top-0 z-10">
                                    <tr className="text-[10px] uppercase text-slate-400 font-bold tracking-widest border-b border-slate-100 dark:border-slate-800">
                                        <th className="p-4 w-12 text-center">
                                            <input 
                                                type="checkbox" 
                                                onChange={selectAll} 
                                                checked={filteredAssets.length > 0 && selectedAssetIds.size === filteredAssets.length} 
                                                className="rounded-md border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500" 
                                            />
                                        </th>
                                        <th className="p-4">Item Identity</th>
                                        <th className="p-4">Category</th>
                                        <th className="p-4">Condition</th>
                                        {mode === 'onboard' && <th className="p-4">Current Warehouse</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {filteredAssets.map(asset => {
                                        const isSelected = selectedAssetIds.has(asset.id);
                                        return (
                                            <tr 
                                                key={asset.id} 
                                                onClick={() => toggleSelection(asset.id)}
                                                className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-all duration-150 ${isSelected ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                                            >
                                                <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected} 
                                                        onChange={() => toggleSelection(asset.id)} 
                                                        className="rounded-md border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500" 
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{asset.name}</div>
                                                    <div className="text-xs font-mono text-slate-400">{asset.serialNumber || 'No Serial'}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg w-fit">
                                                        {asset.category.includes('Laptop') ? <Laptop size={12}/> : 
                                                        asset.category.includes('Phone') ? <Smartphone size={12}/> : <Monitor size={12}/>}
                                                        {asset.category}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${asset.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30' : 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                                                        {asset.status}
                                                    </span>
                                                </td>
                                                {mode === 'onboard' && (
                                                    <td className="p-4">
                                                        <div className="text-xs text-slate-500 flex items-center gap-1.5"><Monitor size={12} className="opacity-40"/> {asset.location}</div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
      ) : view === 'pending' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingLinks.length > 0 ? pendingLinks.map(link => {
                const createdDate = new Date(link.createdAt);
                const daysAgo = Math.floor((new Date().getTime() - createdDate.getTime()) / (1000 * 3600 * 24));
                
                return (
                    <div key={link.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-all">
                        <div className="p-4 border-b bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700"><UserIcon size={18} className="text-slate-400"/></div>
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-white leading-tight">{link.employeeName}</div>
                                    <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">Pending {link.type} Link</div>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleDeletePending(link.id)} 
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                                title="Revoke Link"
                            >
                                <X size={16}/>
                            </button>
                        </div>
                        <div className="p-5 flex-1">
                            <div className="space-y-2 mb-6">
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2 mb-2">
                                    <HardDrive size={10}/> Line Items ({link.assetsSnapshot.length})
                                </div>
                                <div className="max-h-24 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                                    {link.assetsSnapshot.map(a => (
                                        <div key={a.id} className="text-xs text-slate-600 dark:text-slate-400 flex justify-between gap-4">
                                            <span className="truncate font-medium">{a.name}</span>
                                            <span className="font-mono text-[10px] opacity-40 shrink-0">{a.serialNumber || 'No SN'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="border-t border-slate-50 dark:border-slate-800 pt-4 flex items-center justify-between">
                                <div className={`text-[10px] font-bold flex items-center gap-1 ${daysAgo > 2 ? 'text-red-500' : 'text-slate-400'}`}>
                                    <Clock size={12}/> {daysAgo === 0 ? 'Created Today' : `${daysAgo}d old link`}
                                </div>
                                <button 
                                    onClick={() => {
                                        const isSandbox = getSandboxStatus();
                                        const url = `${window.location.origin}/#/sign/${link.id}${isSandbox ? '?env=sandbox' : ''}`;
                                        navigator.clipboard.writeText(url);
                                        setSuccessMsg("Copied to clipboard");
                                        setTimeout(() => setSuccessMsg(''), 2000);
                                    }}
                                    className="text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline flex items-center gap-1.5"
                                >
                                    <LinkIcon size={12}/> Copy URL
                                </button>
                            </div>
                        </div>
                    </div>
                );
            }) : (
                <div className="col-span-full py-20 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <LinkIcon size={48} className="mx-auto mb-4 opacity-10" />
                    <h3 className="font-bold text-slate-600 dark:text-slate-300">No Pending Links</h3>
                    <p className="text-sm opacity-70">New signature requests will appear here.</p>
                </div>
            )}
        </div>
      ) : (
        <div className="space-y-4">
            {/* Advanced Filters for Documents */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <input 
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                      placeholder="Filter documents by employee, asset or doc ID..."
                      value={docSearchTerm}
                      onChange={e => setDocSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="bg-slate-50 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-100 dark:border-slate-700">
                        <select 
                        className="p-2 bg-transparent text-xs font-bold text-slate-600 dark:text-slate-300 outline-none"
                        value={docTypeFilter}
                        onChange={e => setDocTypeFilter(e.target.value as any)}
                        >
                            <option value="All">All Types</option>
                            <option value="Handover">Handovers</option>
                            <option value="Return">Returns</option>
                            <option value="Transfer">Transfers</option>
                        </select>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                        <select 
                        className="p-2 bg-transparent text-xs font-bold text-slate-600 dark:text-slate-300 outline-none"
                        value={docStatusFilter}
                        onChange={e => setDocStatusFilter(e.target.value as any)}
                        >
                            <option value="All">All Status</option>
                            <option value="Pending">Action Required</option>
                            <option value="Completed">Completed</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Document Table/List */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction Date</th>
                                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee Name</th>
                                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Doc Type</th>
                                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipment Count</th>
                                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Status</th>
                                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {filteredDocuments.length > 0 ? filteredDocuments.map(doc => {
                                const isPendingAction = doc.type === 'Return' && doc.status !== 'Completed';
                                return (
                                    <tr key={doc.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isPendingAction ? 'bg-amber-50/10 dark:bg-amber-900/5' : ''}`}>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-700 dark:text-slate-300">{new Date(doc.date).toLocaleDateString()}</div>
                                            <div className="text-[10px] font-mono text-slate-400 mt-0.5 opacity-60">ID: {doc.id}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700"><UserIcon size={14} className="text-slate-400"/></div>
                                                {doc.employeeName}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${doc.type === 'Return' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' : doc.type === 'Transfer' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'}`}>{doc.type}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-xs text-slate-600 dark:text-slate-400">
                                                <span className="font-bold">{doc.assets.length} Assets</span>
                                                <div className="text-[10px] truncate max-w-[150px] opacity-50 mt-0.5">{doc.assets.map(a => a.name).join(', ')}</div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {isPendingAction ? (
                                                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase animate-pulse">
                                                    <AlertTriangle size={12}/> Needs Verification
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">
                                                    <CheckCircle2 size={12}/> Verified
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handlePrintDocument(doc)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all" title="Print Document"><Printer size={16}/></button>
                                                {isPendingAction ? (
                                                    <button 
                                                        onClick={() => handleResumeSign(doc)} 
                                                        className="px-3 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-black dark:hover:bg-blue-700 shadow-md flex items-center gap-1.5 transition-all"
                                                    >
                                                        Verify Now <ChevronRight size={12}/>
                                                    </button>
                                                ) : (
                                                    <div className="p-2 text-slate-200 dark:text-slate-800">
                                                        <CheckCircle2 size={18}/>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            }) : (
                                <tr>
                                    <td colSpan={6} className="p-20 text-center flex flex-col items-center gap-3">
                                        <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl text-slate-200 dark:text-slate-700">
                                            <FileText size={48} className="opacity-20" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-600 dark:text-slate-400">No Signed Documents</h4>
                                            <p className="text-xs opacity-60">Try adjusting your filters or completing a handover.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {/* Signature Modal */}
      <HandoverModal
        isOpen={signModal.isOpen}
        employeeName={signModal.employeeName}
        currentItName={currentUser?.email?.split('@')[0] || 'IT Staff'}
        assets={signModal.assetsSnapshot || signModal.assets}
        type={signModal.type}
        targetName={signModal.targetName}
        initialData={signModal.initialData}
        onConfirm={handleSignatureConfirm}
        onCancel={() => setSignModal(prev => ({ ...prev, isOpen: false }))}
        isProcessing={isProcessing}
      />

      {/* Link Generated Modal */}
      {linkModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Form link ready!</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Ready for <span className="font-bold text-slate-900 dark:text-white">{linkModal.name}</span>'s signature.</p>
                    </div>
                    <button onClick={() => setLinkModal({ ...linkModal, open: false })} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={20} className="text-slate-400"/></button>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 break-all text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-8 select-all shadow-inner">
                    {linkModal.link}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(linkModal.link);
                            setSuccessMsg("Copied to clipboard");
                            setTimeout(() => setSuccessMsg(''), 2000);
                        }}
                        className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all"
                    >
                        Copy to Clipboard
                    </button>
                    <a 
                        href={`mailto:?subject=Action Required: IT Asset Signature&body=Hello ${linkModal.name},%0D%0A%0D%0APlease review and digitally sign the asset form at the following link to complete your equipment transaction:%0D%0A%0D%0A${linkModal.link}%0D%0A%0D%0AThank you,%0D%0AIT Department`}
                        className="flex-1 py-3 bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-900/10 dark:shadow-blue-900/20"
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
