import React, { useState, useEffect } from 'react';
import { Asset, AssetRequest } from '../types';
import { listenToRequests, listenToAssets, updateAssetRequest, fulfillAssetRequest } from '../services/storageService';
import { ShoppingBag, Clock, CheckCircle, XCircle, ChevronRight, User, AlertCircle, Link as LinkIcon, Box, Loader2, ArrowRight, DollarSign, Send } from 'lucide-react';

const AssetRequests: React.FC = () => {
    const [requests, setRequests] = useState<AssetRequest[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [selectedRequest, setSelectedRequest] = useState<AssetRequest | null>(null);
    
    // Processing State
    const [selectedAssetId, setSelectedAssetId] = useState('');
    const [notes, setNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        setLoading(true);
        const unsubRequests = listenToRequests((data) => {
            setRequests(data);
            setSelectedRequest(prev => prev ? data.find(r => r.id === prev.id) || null : null);
        });
        const unsubAssets = listenToAssets((data) => setAssets(data));
        setLoading(false);
        return () => {
            unsubRequests();
            unsubAssets();
        }
    }, []);

    const updateStatus = async (status: AssetRequest['status'], notePrefix: string = '') => {
        if (!selectedRequest) return;
        setIsProcessing(true);
        try {
            await updateAssetRequest(selectedRequest.id, {
                status,
                resolutionNotes: notes ? `${notePrefix} ${notes}` : notePrefix
            });
            setNotes('');
            setSelectedAssetId('');
        } catch (e) {
            alert("Update failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeploy = async () => {
        if (!selectedRequest || !selectedAssetId) return;
        setIsProcessing(true);
        try {
            await fulfillAssetRequest(selectedRequest.id, selectedAssetId, notes);
            setNotes('');
            setSelectedAssetId('');
        } catch (e) {
            alert("Deployment failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredRequests = requests.filter(r => {
        const isActive = ['New', 'Acknowledged', 'Pending Finance', 'Approved'].includes(r.status);
        if (activeTab === 'active') return isActive;
        return !isActive; // Deployed or Rejected
    });

    // Smart search for available assets based on request category
    const inventoryAssets = assets.filter(a => a.status === 'In Storage');

    const getUrgencyColor = (u: string) => {
        switch(u) {
            case 'High': return 'text-red-600 bg-red-50 border-red-100 dark:bg-red-900/40 dark:text-red-300 dark:border-red-900/50';
            case 'Medium': return 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-900/50';
            default: return 'text-slate-600 bg-slate-50 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
        }
    };

    const getStatusStep = (status: string) => {
        switch(status) {
            case 'New': return 1;
            case 'Acknowledged': return 2;
            case 'Pending Finance': return 3;
            case 'Approved': return 4;
            case 'Deployed': return 5;
            default: return 0;
        }
    };

    const publicLink = `${window.location.origin}/#/request-asset`;

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <ShoppingBag className="text-slate-900 dark:text-white"/> Asset Requests
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Track lifecycle: Request → Acknowledge → Finance/Stock → Deploy</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(publicLink)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-sm font-medium w-fit">
                    <LinkIcon size={16} /> Copy Request Link
                </button>
            </header>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[600px] flex flex-col">
                <div className="flex border-b border-slate-200 dark:border-slate-800">
                     <button onClick={() => setActiveTab('active')} className={`flex-1 py-3 text-sm font-medium border-b-2 flex items-center justify-center gap-2 ${activeTab === 'active' ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                        Active Queue
                        {requests.filter(r => ['New', 'Acknowledged', 'Pending Finance', 'Approved'].includes(r.status)).length > 0 && 
                            <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                {requests.filter(r => ['New', 'Acknowledged', 'Pending Finance', 'Approved'].includes(r.status)).length}
                            </span>
                        }
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'history' ? 'border-slate-900 dark:border-blue-600 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                        History (Deployed / Rejected)
                    </button>
                </div>

                {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div> : (
                    <div className="flex flex-1 overflow-hidden">
                        {/* List */}
                        <div className={`${selectedRequest ? 'hidden md:block w-1/3' : 'w-full'} border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50`}>
                            {filteredRequests.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 dark:text-slate-500">No requests found.</div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredRequests.map(r => (
                                        <div 
                                            key={r.id} 
                                            onClick={() => setSelectedRequest(r)}
                                            className={`p-4 cursor-pointer hover:bg-white dark:hover:bg-slate-900 transition-colors ${selectedRequest?.id === r.id ? 'bg-white dark:bg-slate-900 border-l-4 border-l-slate-900 dark:border-l-blue-600 shadow-sm' : 'border-l-4 border-l-transparent'}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-mono text-xs text-slate-400">{r.requestNumber}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold ${getUrgencyColor(r.urgency)}`}>{r.urgency}</span>
                                            </div>
                                            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">{r.category}</h4>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                                                <User size={12}/> {r.requesterName}
                                            </div>
                                            
                                            {/* Status Badge */}
                                            <div className="flex items-center gap-1">
                                                <div className={`w-2 h-2 rounded-full ${
                                                    r.status === 'New' ? 'bg-blue-500' : 
                                                    r.status === 'Acknowledged' ? 'bg-purple-500' : 
                                                    r.status === 'Pending Finance' ? 'bg-amber-500' :
                                                    r.status === 'Approved' ? 'bg-indigo-500' :
                                                    r.status === 'Deployed' ? 'bg-emerald-500' : 'bg-red-500'
                                                }`}></div>
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{r.status}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Detail View */}
                        <div className={`${selectedRequest ? 'w-full md:w-2/3' : 'hidden'} bg-white dark:bg-slate-900 overflow-y-auto flex flex-col`}>
                            {selectedRequest ? (
                                <div className="h-full flex flex-col">
                                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-white dark:bg-slate-900">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedRequest.category} Request</h2>
                                                <span className="font-mono text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{selectedRequest.requestNumber}</span>
                                            </div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                                <Clock size={14}/> {new Date(selectedRequest.createdAt).toLocaleDateString()} 
                                                <span className="text-slate-300 dark:text-slate-600">|</span> 
                                                {selectedRequest.department}
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedRequest(null)} className="md:hidden p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">Back</button>
                                    </div>

                                    {/* Progress Stepper */}
                                    {selectedRequest.status !== 'Rejected' && (
                                    <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {[
                                                { l: 'Request', s: 'New' },
                                                { l: 'Ack.', s: 'Acknowledged' },
                                                { l: 'Finance/Stock', s: 'Pending Finance' }, // Merged step visual for Pending Finance/Approved
                                                { l: 'Deploy', s: 'Deployed' }
                                            ].map((step, idx) => {
                                                const currentStepIdx = getStatusStep(selectedRequest.status);
                                                const stepIdx = idx + 1;
                                                // Adjust visual logic: Finance step covers both 'Pending Finance' and 'Approved'
                                                const isCompleted = currentStepIdx > stepIdx || (stepIdx === 3 && selectedRequest.status === 'Approved');
                                                const isCurrent = currentStepIdx === stepIdx || (stepIdx === 3 && selectedRequest.status === 'Approved');
                                                
                                                return (
                                                    <div key={step.l} className="flex items-center flex-1 last:flex-none">
                                                        <div className={`flex items-center gap-2 ${isCurrent ? 'text-slate-900 dark:text-white font-bold' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${isCompleted ? 'bg-emerald-100 border-emerald-200 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400' : isCurrent ? 'bg-slate-900 border-slate-900 text-white dark:bg-blue-600 dark:border-blue-600' : 'bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700'}`}>
                                                                {isCompleted ? <CheckCircle size={12}/> : stepIdx}
                                                            </div>
                                                            <span>{step.l}</span>
                                                        </div>
                                                        {idx < 3 && <div className={`h-0.5 flex-1 mx-2 ${isCompleted ? 'bg-emerald-200 dark:bg-emerald-900/50' : 'bg-slate-200 dark:bg-slate-800'}`}></div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    )}
                                    
                                    <div className="p-6 flex-1">
                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 mb-6 shadow-sm">
                                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Justification</h4>
                                            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedRequest.reason}</p>
                                        </div>

                                        {/* ACTION ZONE */}
                                        <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                                            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                                Processing Action: <span className="text-slate-500 dark:text-slate-400 font-normal">{selectedRequest.status}</span>
                                            </h3>

                                            {/* 1. New -> Acknowledge */}
                                            {selectedRequest.status === 'New' && (
                                                <div className="space-y-3">
                                                    <p className="text-sm text-slate-600 dark:text-slate-400">Review the request details. Acknowledge to proceed or reject if invalid.</p>
                                                    <div className="flex gap-3">
                                                        <button onClick={() => updateStatus('Acknowledged', 'Request acknowledged.')} disabled={isProcessing} className="flex-1 bg-slate-900 dark:bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-black dark:hover:bg-blue-700 flex justify-center items-center gap-2">
                                                            {isProcessing ? <Loader2 className="animate-spin"/> : <CheckCircle size={16}/>} Acknowledge Request
                                                        </button>
                                                        <button onClick={() => updateStatus('Rejected', 'Rejected by IT.')} disabled={isProcessing} className="px-4 py-2 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-lg font-bold hover:bg-red-50 dark:hover:bg-red-900/20">
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 2. Acknowledged -> Check Stock or Finance */}
                                            {selectedRequest.status === 'Acknowledged' && (
                                                <div className="space-y-4">
                                                    <p className="text-sm text-slate-600 dark:text-slate-400">Check inventory. If available, deploy immediately. If not, request finance approval for purchase.</p>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                                            <div className="font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2"><Box size={16}/> In Stock ({inventoryAssets.length})</div>
                                                            <select className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded text-sm mb-2 bg-white dark:bg-slate-950 dark:text-white" value={selectedAssetId} onChange={e => setSelectedAssetId(e.target.value)}>
                                                                <option value="">Select Asset to Deploy...</option>
                                                                {inventoryAssets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.serialNumber})</option>)}
                                                            </select>
                                                            <button 
                                                                onClick={handleDeploy}
                                                                disabled={!selectedAssetId || isProcessing}
                                                                className="w-full bg-emerald-600 text-white py-2 rounded font-medium text-sm hover:bg-emerald-700 disabled:opacity-50"
                                                            >
                                                                Deploy Selected
                                                            </button>
                                                        </div>

                                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-center text-center">
                                                            <div className="font-bold text-slate-800 dark:text-white mb-2 flex items-center justify-center gap-2"><DollarSign size={16}/> No Stock?</div>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Send to Finance for purchase approval.</p>
                                                            <button 
                                                                onClick={() => updateStatus('Pending Finance', 'No stock available. Sent for Finance Approval.')}
                                                                disabled={isProcessing}
                                                                className="w-full bg-amber-500 text-white py-2 rounded font-medium text-sm hover:bg-amber-600"
                                                            >
                                                                Request Finance Approval
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 3. Pending Finance -> Approve/Reject */}
                                            {selectedRequest.status === 'Pending Finance' && (
                                                <div className="space-y-3">
                                                    <div className="bg-amber-50 dark:bg-amber-900/30 p-3 rounded text-amber-800 dark:text-amber-300 text-sm mb-2 flex items-start gap-2 border border-amber-100 dark:border-amber-900/50">
                                                        <AlertCircle size={16} className="mt-0.5 shrink-0"/> 
                                                        Waiting for budget/finance approval. Update status once decision is made.
                                                    </div>
                                                    <textarea 
                                                        className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white rounded text-sm mb-2" 
                                                        placeholder="Finance notes / Budget code..."
                                                        value={notes}
                                                        onChange={e => setNotes(e.target.value)}
                                                    />
                                                    <div className="flex gap-3">
                                                        <button onClick={() => updateStatus('Approved', 'Finance Approved.')} disabled={isProcessing} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700">
                                                            Approve Purchase
                                                        </button>
                                                        <button onClick={() => updateStatus('Rejected', 'Finance Rejected.')} disabled={isProcessing} className="px-4 py-2 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-lg font-bold hover:bg-red-50 dark:hover:bg-red-900/20">
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 4. Approved -> Deploy */}
                                            {selectedRequest.status === 'Approved' && (
                                                <div className="space-y-3">
                                                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded text-indigo-800 dark:text-indigo-300 text-sm mb-2 border border-indigo-100 dark:border-indigo-900/50">
                                                        <span className="font-bold">Approved!</span> Once the item is purchased and received, add it to the system (via Invoices or Asset Registry), then select it below to deploy.
                                                    </div>
                                                    
                                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Select Received Asset</label>
                                                    <select className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded text-sm mb-2 bg-white dark:bg-slate-950 dark:text-white" value={selectedAssetId} onChange={e => setSelectedAssetId(e.target.value)}>
                                                        <option value="">Select Asset to Deploy...</option>
                                                        {inventoryAssets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.serialNumber})</option>)}
                                                    </select>
                                                    <textarea 
                                                        className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded text-sm mb-2 bg-white dark:bg-slate-950 dark:text-white" 
                                                        placeholder="Deployment notes..."
                                                        value={notes}
                                                        onChange={e => setNotes(e.target.value)}
                                                    />
                                                    <button 
                                                        onClick={handleDeploy}
                                                        disabled={!selectedAssetId || isProcessing}
                                                        className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        <Send size={16} /> Deploy Asset
                                                    </button>
                                                </div>
                                            )}

                                            {/* 5. Deployed / Rejected (Final States) */}
                                            {(selectedRequest.status === 'Deployed' || selectedRequest.status === 'Rejected') && (
                                                <div className={`p-4 rounded-lg border ${selectedRequest.status === 'Deployed' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-900/50' : 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-900/50'}`}>
                                                    <div className={`font-bold flex items-center gap-2 mb-1 ${selectedRequest.status === 'Deployed' ? 'text-emerald-800 dark:text-emerald-400' : 'text-red-800 dark:text-red-400'}`}>
                                                        {selectedRequest.status === 'Deployed' ? <CheckCircle size={18}/> : <XCircle size={18}/>}
                                                        {selectedRequest.status === 'Deployed' ? 'Request Completed' : 'Request Rejected'}
                                                    </div>
                                                    <p className="text-sm opacity-90 text-slate-700 dark:text-slate-300">{selectedRequest.resolutionNotes}</p>
                                                    {selectedRequest.linkedAssetId && (
                                                         <div className="mt-3 pt-3 border-t border-emerald-200/50 dark:border-emerald-800/50 flex items-center gap-2 text-sm">
                                                             <Box size={14} className="text-emerald-700 dark:text-emerald-400"/> 
                                                             <span className="text-emerald-900 dark:text-emerald-300">Deployed Asset: </span>
                                                             <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 font-bold">{assets.find(a => a.id === selectedRequest.linkedAssetId)?.name}</span>
                                                         </div>
                                                     )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                                    <ShoppingBag size={48} className="mb-4 opacity-20"/>
                                    <p>Select a request to view details</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssetRequests;