
import React, { useState, useEffect } from 'react';
import { Asset, AssetRequest } from '../types';
import { getAssetRequests, getAssets, updateAssetRequest, fulfillAssetRequest } from '../services/storageService';
import { ShoppingBag, Clock, CheckCircle, XCircle, ChevronRight, User, AlertCircle, Link as LinkIcon, Box, Loader2, ArrowRight } from 'lucide-react';

const AssetRequests: React.FC = () => {
    const [requests, setRequests] = useState<AssetRequest[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [selectedRequest, setSelectedRequest] = useState<AssetRequest | null>(null);
    
    // Fulfillment
    const [fulfillmentType, setFulfillmentType] = useState<'stock' | 'buy' | 'reject'>('stock');
    const [selectedAssetId, setSelectedAssetId] = useState('');
    const [notes, setNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [r, a] = await Promise.all([getAssetRequests(), getAssets()]);
        setRequests(r);
        setAssets(a);
        setLoading(false);
    };

    const handleProcess = async () => {
        if (!selectedRequest) return;
        setIsProcessing(true);
        try {
            if (fulfillmentType === 'reject') {
                await updateAssetRequest(selectedRequest.id, {
                    status: 'Rejected',
                    resolvedAt: new Date().toISOString(),
                    resolutionNotes: notes
                });
            } else if (fulfillmentType === 'buy') {
                await updateAssetRequest(selectedRequest.id, {
                    status: 'Approved',
                    resolutionNotes: notes || 'Approved for purchase.'
                });
            } else if (fulfillmentType === 'stock') {
                if (!selectedAssetId) {
                    alert("Please select an asset from storage.");
                    setIsProcessing(false);
                    return;
                }
                await fulfillAssetRequest(selectedRequest.id, selectedAssetId, notes);
            }
            await loadData();
            setSelectedRequest(null);
            setNotes('');
            setSelectedAssetId('');
        } catch (e) {
            alert("Operation failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredRequests = requests.filter(r => {
        if (activeTab === 'new') return r.status === 'New' || r.status === 'Approved';
        return r.status === 'Fulfilled' || r.status === 'Rejected';
    });

    const inventoryAssets = assets.filter(a => a.status === 'In Storage' && (!selectedRequest || a.category === selectedRequest.category));
    
    const getUrgencyColor = (u: string) => {
        switch(u) {
            case 'High': return 'text-red-600 bg-red-50 border-red-100';
            case 'Medium': return 'text-amber-600 bg-amber-50 border-amber-100';
            default: return 'text-slate-600 bg-slate-50 border-slate-100';
        }
    };

    const publicLink = `${window.location.origin}/#/request-asset`;

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ShoppingBag className="text-slate-900"/> Asset Requests
                    </h1>
                    <p className="text-slate-500 text-sm">Manage incoming equipment requests from staff.</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(publicLink)} className="bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm font-medium w-fit">
                    <LinkIcon size={16} /> Copy Request Link
                </button>
            </header>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
                <div className="flex border-b border-slate-200">
                     <button onClick={() => setActiveTab('new')} className={`flex-1 py-3 text-sm font-medium border-b-2 flex items-center justify-center gap-2 ${activeTab === 'new' ? 'border-emerald-600 text-emerald-700 bg-emerald-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        Open Requests 
                        {requests.filter(r => r.status === 'New').length > 0 && <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{requests.filter(r => r.status === 'New').length}</span>}
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'history' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        History
                    </button>
                </div>

                {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div> : (
                    <div className="flex flex-1 overflow-hidden">
                        {/* List */}
                        <div className={`${selectedRequest ? 'hidden md:block w-1/3' : 'w-full'} border-r border-slate-200 overflow-y-auto`}>
                            {filteredRequests.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">No requests found.</div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {filteredRequests.map(r => (
                                        <div 
                                            key={r.id} 
                                            onClick={() => setSelectedRequest(r)}
                                            className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedRequest?.id === r.id ? 'bg-slate-50 border-l-4 border-l-slate-900' : 'border-l-4 border-l-transparent'}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-mono text-xs text-slate-400">{r.requestNumber}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold ${getUrgencyColor(r.urgency)}`}>{r.urgency}</span>
                                            </div>
                                            <h4 className="font-semibold text-slate-800 mb-1">{r.category}</h4>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                                                <User size={12}/> {r.requesterName}
                                            </div>
                                            <div className="flex items-center justify-between mt-2">
                                                 <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'New' ? 'bg-blue-100 text-blue-700' : r.status === 'Approved' ? 'bg-amber-100 text-amber-700' : r.status === 'Fulfilled' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {r.status}
                                                 </span>
                                                 <ChevronRight size={14} className="text-slate-300"/>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Detail View */}
                        <div className={`${selectedRequest ? 'w-full md:w-2/3' : 'hidden'} bg-white overflow-y-auto flex flex-col`}>
                            {selectedRequest ? (
                                <div className="h-full flex flex-col">
                                    <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 mb-1">{selectedRequest.category} Request</h2>
                                            <div className="text-sm text-slate-500 flex items-center gap-2">
                                                <Clock size={14}/> {new Date(selectedRequest.createdAt).toLocaleDateString()} 
                                                <span className="text-slate-300">|</span> 
                                                {selectedRequest.department}
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedRequest(null)} className="md:hidden p-2 bg-white border border-slate-200 rounded-lg shadow-sm">Back</button>
                                    </div>
                                    
                                    <div className="p-6 flex-1">
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Justification</h4>
                                            <p className="text-slate-700">{selectedRequest.reason}</p>
                                        </div>

                                        {selectedRequest.status === 'New' || selectedRequest.status === 'Approved' ? (
                                            <div className="border-t border-slate-100 pt-6">
                                                <h3 className="font-bold text-slate-900 mb-4">Process Request</h3>
                                                
                                                <div className="flex gap-2 mb-4">
                                                    <button onClick={() => setFulfillmentType('stock')} className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2 ${fulfillmentType === 'stock' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                                                        <Box size={16}/> From Stock
                                                    </button>
                                                    <button onClick={() => setFulfillmentType('buy')} className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2 ${fulfillmentType === 'buy' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                                                        <ShoppingBag size={16}/> Purchase
                                                    </button>
                                                    <button onClick={() => setFulfillmentType('reject')} className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2 ${fulfillmentType === 'reject' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                                                        <XCircle size={16}/> Reject
                                                    </button>
                                                </div>

                                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                                                    {fulfillmentType === 'stock' && (
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-700 mb-1">Select Available Asset ({inventoryAssets.length})</label>
                                                            <select 
                                                                className="w-full p-2 border border-slate-300 rounded bg-white text-sm mb-2"
                                                                value={selectedAssetId}
                                                                onChange={e => setSelectedAssetId(e.target.value)}
                                                            >
                                                                <option value="">-- Choose Asset --</option>
                                                                {inventoryAssets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.serialNumber})</option>)}
                                                            </select>
                                                            {inventoryAssets.length === 0 && <p className="text-xs text-amber-600"><AlertCircle size={12} className="inline"/> No matching assets in storage.</p>}
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Reason</label>
                                                        <textarea 
                                                            className="w-full p-2 border border-slate-300 rounded bg-white text-sm" 
                                                            rows={2}
                                                            placeholder={fulfillmentType === 'reject' ? "Reason for rejection..." : "Additional notes..."}
                                                            value={notes}
                                                            onChange={e => setNotes(e.target.value)}
                                                        />
                                                    </div>

                                                    <button 
                                                        onClick={handleProcess}
                                                        disabled={isProcessing || (fulfillmentType === 'stock' && !selectedAssetId)}
                                                        className={`w-full py-2.5 rounded-lg text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 ${fulfillmentType === 'reject' ? 'bg-red-600 hover:bg-red-700' : fulfillmentType === 'buy' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                                    >
                                                        {isProcessing ? <Loader2 className="animate-spin"/> : fulfillmentType === 'reject' ? 'Confirm Rejection' : fulfillmentType === 'buy' ? 'Approve for Purchase' : 'Assign & Fulfill'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="border-t border-slate-100 pt-6">
                                                 <h3 className="font-bold text-slate-900 mb-2">Resolution</h3>
                                                 <div className={`p-4 rounded-lg border ${selectedRequest.status === 'Fulfilled' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                                                     <div className="font-bold flex items-center gap-2 mb-1">
                                                         {selectedRequest.status === 'Fulfilled' ? <CheckCircle size={18}/> : <XCircle size={18}/>}
                                                         {selectedRequest.status}
                                                     </div>
                                                     <p className="text-sm opacity-90">{selectedRequest.resolutionNotes}</p>
                                                     {selectedRequest.linkedAssetId && (
                                                         <div className="mt-3 pt-3 border-t border-emerald-200/50 flex items-center gap-2 text-sm">
                                                             <Box size={14}/> Asset Assigned: 
                                                             <span className="font-mono bg-white px-1 rounded">{assets.find(a => a.id === selectedRequest.linkedAssetId)?.name}</span>
                                                         </div>
                                                     )}
                                                 </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
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