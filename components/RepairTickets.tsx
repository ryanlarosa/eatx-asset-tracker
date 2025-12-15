
import React, { useState, useEffect } from 'react';
import { Asset, IncidentReport, UserRole } from '../types';
import { listenToIncidents, listenToAssets, createIncidentReport, updateIncidentReport, getAppConfig, getCurrentUserProfile, processAssetReplacement, getSandboxStatus } from '../services/storageService';
import { AlertCircle, CheckCircle, Clock, Search, Filter, Plus, PenTool, Wrench, X, MessageSquare, ArrowRight, Loader2, Link as LinkIcon, ThumbsUp, ThumbsDown, MonitorSmartphone, RefreshCw, AlertTriangle, Image as ImageIcon, Download } from 'lucide-react';

const RepairTickets: React.FC = () => {
    const [tickets, setTickets] = useState<IncidentReport[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [locations, setLocations] = useState<string[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [activeTab, setActiveTab] = useState<'inbox' | 'active' | 'resolved'>('active');
    
    // View Ticket Detail
    const [selectedTicket, setSelectedTicket] = useState<IncidentReport | null>(null);

    // Form State
    const [newTicket, setNewTicket] = useState({
        location: '',
        assetId: '',
        assetName: '',
        deviceType: '',
        reportedSerial: '',
        imageBase64: '',
        description: '',
        priority: 'Medium' as IncidentReport['priority']
    });

    // Resolve State
    const [resolutionType, setResolutionType] = useState<'repair' | 'replace'>('repair');
    const [resolveNotes, setResolveNotes] = useState('');
    const [autoFixAsset, setAutoFixAsset] = useState(true);
    const [replacementAssetId, setReplacementAssetId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const currentUser = getCurrentUserProfile();
    const canManage = currentUser?.role === 'admin' || currentUser?.role === 'technician';

    useEffect(() => {
        setLoading(true);
        const unsubIncidents = listenToIncidents((data) => {
            setTickets(data);
            // If selected ticket exists, update its local data
            setSelectedTicket(prev => prev ? data.find(t => t.id === prev.id) || null : null);
        });
        const unsubAssets = listenToAssets((data) => setAssets(data));
        
        const loadConfig = async () => {
            const c = await getAppConfig();
            setLocations(c.locations);
            setCategories(c.categories);
            setLoading(false);
        }
        loadConfig();

        return () => {
            unsubIncidents();
            unsubAssets();
        }
    }, []);

    const handleAssetChange = (id: string) => {
        setNewTicket(prev => {
            if (id) {
                const asset = assets.find(a => a.id === id);
                return {
                    ...prev,
                    assetId: id,
                    assetName: asset ? asset.name : '',
                    deviceType: asset ? asset.category : '',
                    reportedSerial: asset ? asset.serialNumber : ''
                };
            } else {
                return {
                    ...prev,
                    assetId: '',
                    assetName: '',
                    deviceType: '',
                    reportedSerial: ''
                };
            }
        });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;
            
                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    setNewTicket(prev => ({ ...prev, imageBase64: canvas.toDataURL('image/jpeg', 0.7) }));
                };
            };
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        await createIncidentReport({
            location: newTicket.location,
            assetId: newTicket.assetId || undefined,
            assetName: newTicket.assetName,
            deviceType: newTicket.deviceType,
            reportedSerial: newTicket.reportedSerial,
            imageBase64: newTicket.imageBase64,
            description: newTicket.description,
            priority: newTicket.priority,
            reportedBy: currentUser?.email || 'Unknown'
        });

        setIsCreating(false);
        setNewTicket({ location: '', assetId: '', assetName: '', deviceType: '', reportedSerial: '', imageBase64: '', description: '', priority: 'Medium' });
    };

    const handleResolve = async () => {
        if (!selectedTicket) return;
        setIsProcessing(true);
        try {
            if (resolutionType === 'replace') {
                if (!selectedTicket.assetId) {
                    alert("Cannot replace: Original ticket has no linked asset.");
                    return;
                }
                if (!replacementAssetId) {
                    alert("Please select a replacement asset.");
                    return;
                }
                await processAssetReplacement(selectedTicket.id, selectedTicket.assetId, replacementAssetId, resolveNotes);
            } else {
                await updateIncidentReport(selectedTicket.id, {
                    status: 'Resolved',
                    resolvedAt: new Date().toISOString(),
                    resolutionNotes: resolveNotes
                }, autoFixAsset);
            }
            
            setSelectedTicket(null);
            setResolveNotes('');
            setReplacementAssetId('');
            setResolutionType('repair');
        } catch (e) {
            alert("Error resolving ticket. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleStatusUpdate = async (status: IncidentReport['status']) => {
        if (!selectedTicket) return;
        await updateIncidentReport(selectedTicket.id, { status });
    };

    const handleApprove = async () => {
        if (!selectedTicket) return;
        await updateIncidentReport(selectedTicket.id, { status: 'Open' });
        setSelectedTicket(null);
    };

    const filteredTickets = tickets.filter(t => {
        if (activeTab === 'inbox') return t.status === 'New';
        if (activeTab === 'active') return t.status !== 'Resolved' && t.status !== 'New' && t.status !== 'Rejected';
        return t.status === 'Resolved' || t.status === 'Rejected';
    });

    const availableAssets = newTicket.location 
        ? assets.filter(a => a.location === newTicket.location)
        : [];
        
    const spareAssets = assets.filter(a => a.status === 'In Storage');

    const getPriorityColor = (p: string) => {
        switch(p) {
            case 'Critical': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-900/50';
            case 'High': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-900/50';
            case 'Medium': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-900/50';
            default: return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
        }
    };

    const getStatusColor = (s: string) => {
        switch(s) {
            case 'New': return 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-900/50';
            case 'Open': return 'bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300';
            case 'In Progress': return 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300';
            case 'Waiting for Parts': return 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300';
            case 'Resolved': return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300';
            default: return 'bg-slate-100 dark:bg-slate-800';
        }
    };

    const inputClass = "w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600";
    const labelClass = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1";

    // Embed env param
    const isSandbox = getSandboxStatus();
    const publicLink = `${window.location.origin}/#/report-issue${isSandbox ? '?env=sandbox' : ''}`;

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Wrench className="text-slate-900 dark:text-white"/> Maintenance & Repairs
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Report broken devices and track repair progress.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => navigator.clipboard.writeText(publicLink)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-sm font-medium">
                        <LinkIcon size={16} /> Copy Staff Link
                    </button>
                    <button onClick={() => setIsCreating(true)} className="bg-slate-900 dark:bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-black dark:hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm transition-all">
                        <Plus size={20} /> Internal Report
                    </button>
                </div>
            </header>

            {/* Create Modal */}
             {isCreating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">New Incident Report</h3>
                            <button onClick={() => setIsCreating(false)}><X size={20} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"/></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className={labelClass}>1. Location</label>
                                <select 
                                    required 
                                    className={inputClass}
                                    value={newTicket.location}
                                    onChange={e => { 
                                        const newLoc = e.target.value;
                                        setNewTicket(prev => ({
                                            ...prev, 
                                            location: newLoc,
                                            // Reset asset fields when location changes
                                            assetId: '',
                                            assetName: '',
                                            deviceType: '',
                                            reportedSerial: ''
                                        }));
                                    }}
                                >
                                    <option value="">Select Location...</option>
                                    {locations.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>

                            {newTicket.location && (
                                <div className="animate-in slide-in-from-top-2 space-y-4">
                                    <div>
                                        <label className={labelClass}>2. Asset (Optional)</label>
                                        <select 
                                            className={inputClass}
                                            value={newTicket.assetId}
                                            onChange={e => handleAssetChange(e.target.value)}
                                        >
                                            <option value="">Select Asset (or leave blank if generic)</option>
                                            {availableAssets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.serialNumber})</option>)}
                                        </select>
                                    </div>
                                    
                                    {/* Manual Fields if Asset Not Selected */}
                                    <div className={`space-y-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 ${newTicket.assetId ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <div>
                                            <label className={labelClass}>Device Name / Desc</label>
                                            <input 
                                                required={!newTicket.assetId}
                                                placeholder="e.g. Broken Coffee Machine"
                                                className={inputClass}
                                                value={newTicket.assetName}
                                                onChange={e => setNewTicket(prev => ({...prev, assetName: e.target.value}))}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={labelClass}>Device Type</label>
                                                <select required={!newTicket.assetId} className={inputClass} value={newTicket.deviceType} onChange={e => setNewTicket(prev => ({...prev, deviceType: e.target.value}))}>
                                                    <option value="">Select...</option>
                                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelClass}>Serial No.</label>
                                                <input placeholder="Optional" className={inputClass} value={newTicket.reportedSerial} onChange={e => setNewTicket(prev => ({...prev, reportedSerial: e.target.value}))}/>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className={labelClass}>3. Issue Description</label>
                                <textarea 
                                    required
                                    rows={3}
                                    className={inputClass}
                                    placeholder="Describe the problem..."
                                    value={newTicket.description}
                                    onChange={e => setNewTicket(prev => ({...prev, description: e.target.value}))}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Upload Image (Optional)</label>
                                <div className="flex items-center gap-3">
                                    <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-700"/>
                                    {newTicket.imageBase64 && <div className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={12}/> Attached</div>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Priority</label>
                                    <select 
                                        className={inputClass}
                                        value={newTicket.priority}
                                        onChange={e => setNewTicket(prev => ({...prev, priority: e.target.value as any}))}
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Critical">Critical</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                                <button type="submit" className="flex-1 py-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg font-bold hover:bg-black dark:hover:bg-blue-700">Submit Report</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Ticket Detail Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                                    {selectedTicket.ticketNumber} 
                                    <span className={`text-xs px-2 py-0.5 rounded border ${getPriorityColor(selectedTicket.priority)}`}>{selectedTicket.priority}</span>
                                </h3>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Reported by {selectedTicket.reportedBy} on {new Date(selectedTicket.createdAt).toLocaleDateString()}</div>
                            </div>
                            <button onClick={() => setSelectedTicket(null)}><X size={20} className="text-slate-400 hover:text-slate-300"/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {selectedTicket.status === 'New' && (
                                <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg border border-purple-100 dark:border-purple-900/50 mb-4">
                                    <h4 className="font-bold text-purple-900 dark:text-purple-300 mb-2">New Public Report</h4>
                                    <p className="text-purple-800 dark:text-purple-200 text-sm mb-4">This issue was reported by staff. Approve it to create an official ticket and mark asset as 'Under Repair'.</p>
                                    <div className="flex gap-3">
                                        <button onClick={handleApprove} className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-bold hover:bg-purple-700 flex items-center justify-center gap-2"><ThumbsUp size={16}/> Approve & Open Ticket</button>
                                        <button onClick={() => handleStatusUpdate('Rejected')} className="px-4 py-2 border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 rounded-lg font-bold hover:bg-purple-100 dark:hover:bg-purple-900/50 flex items-center gap-2"><ThumbsDown size={16}/> Reject</button>
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                <h4 className="font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2"><AlertCircle size={18} className="text-slate-500 dark:text-slate-400"/> Issue Details</h4>
                                <p className="text-slate-700 dark:text-slate-300 mb-3">{selectedTicket.description}</p>
                                
                                {selectedTicket.imageBase64 && (
                                    <div className="mb-4">
                                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Attached Image</div>
                                        <div className="relative group w-fit">
                                            <img src={selectedTicket.imageBase64} alt="Evidence" className="h-48 rounded-lg border border-slate-300 dark:border-slate-600 shadow-sm" />
                                            <a href={selectedTicket.imageBase64} download={`ticket-${selectedTicket.ticketNumber}.jpg`} className="absolute bottom-2 right-2 bg-black/70 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"><Download size={16}/></a>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-3">
                                    <div className="flex items-center gap-1"><ArrowRight size={14}/> <strong>Location:</strong> {selectedTicket.location}</div>
                                    <div className="flex items-center gap-1"><MonitorSmartphone size={14}/> <strong>Asset:</strong> {selectedTicket.assetName}</div>
                                    {selectedTicket.deviceType && <div className="flex items-center gap-1"><strong>Type:</strong> {selectedTicket.deviceType}</div>}
                                    {selectedTicket.reportedSerial && <div className="flex items-center gap-1"><strong>SN:</strong> {selectedTicket.reportedSerial}</div>}
                                </div>
                            </div>

                            {selectedTicket.status !== 'Resolved' && selectedTicket.status !== 'New' && selectedTicket.status !== 'Rejected' ? (
                                canManage && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Update Status:</span>
                                        {['Open', 'In Progress', 'Waiting for Parts'].map(s => (
                                            <button 
                                                key={s}
                                                onClick={() => handleStatusUpdate(s as any)}
                                                className={`px-3 py-1 rounded text-xs font-medium border ${selectedTicket.status === s ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-bold text-slate-800 dark:text-white">Resolution & Closure</h4>
                                            {selectedTicket.assetId && (
                                                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                                                    <button onClick={() => setResolutionType('repair')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${resolutionType === 'repair' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Fix Device</button>
                                                    <button onClick={() => setResolutionType('replace')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${resolutionType === 'replace' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Replace Device</button>
                                                </div>
                                            )}
                                        </div>

                                        {resolutionType === 'replace' ? (
                                            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-900/50 rounded-lg p-4 mb-3 animate-in fade-in zoom-in">
                                                <div className="flex items-start gap-3 mb-3">
                                                    <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-full text-amber-600 dark:text-amber-400"><RefreshCw size={18} /></div>
                                                    <div>
                                                        <h5 className="font-bold text-amber-900 dark:text-amber-300 text-sm">Asset Replacement</h5>
                                                        <p className="text-xs text-amber-800 dark:text-amber-400 mt-1">
                                                            This will mark <span className="font-semibold">{selectedTicket.assetName}</span> as <span className="font-bold uppercase">Retired</span>. 
                                                            The new asset will be assigned to its location.
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <label className="block text-xs font-bold text-amber-800 dark:text-amber-400 uppercase mb-1">Select Replacement (from Storage)</label>
                                                <select 
                                                    className="w-full p-2 border border-amber-200 dark:border-amber-800 rounded bg-white dark:bg-slate-950 text-sm mb-3 dark:text-white"
                                                    value={replacementAssetId}
                                                    onChange={(e) => setReplacementAssetId(e.target.value)}
                                                >
                                                    <option value="">-- Choose Asset --</option>
                                                    {spareAssets.map(a => (
                                                        <option key={a.id} value={a.id}>{a.name} (SN: {a.serialNumber})</option>
                                                    ))}
                                                </select>
                                                {spareAssets.length === 0 && <p className="text-xs text-red-500 mb-2">No assets available in storage.</p>}
                                                
                                                <textarea 
                                                    className="w-full p-2 border border-amber-200 dark:border-amber-800 rounded text-sm bg-white dark:bg-slate-950 dark:text-white"
                                                    rows={2}
                                                    placeholder="Reason for replacement..."
                                                    value={resolveNotes}
                                                    onChange={e => setResolveNotes(e.target.value)}
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <textarea 
                                                    className="w-full p-3 border border-slate-300 dark:border-slate-700 rounded-lg mb-3 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                                                    rows={2}
                                                    placeholder="Describe how the issue was resolved..."
                                                    value={resolveNotes}
                                                    onChange={e => setResolveNotes(e.target.value)}
                                                />
                                                {selectedTicket.assetId && (
                                                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 mb-4 cursor-pointer">
                                                        <input type="checkbox" checked={autoFixAsset} onChange={e => setAutoFixAsset(e.target.checked)} className="rounded border-slate-300 dark:border-slate-600 text-slate-900 dark:text-blue-600 bg-white dark:bg-slate-950 focus:ring-slate-900 dark:focus:ring-blue-600" />
                                                        Set Asset Status back to "Active"?
                                                    </label>
                                                )}
                                            </>
                                        )}
                                        
                                        <button 
                                            onClick={handleResolve}
                                            disabled={!resolveNotes || isProcessing || (resolutionType === 'replace' && !replacementAssetId)}
                                            className={`w-full text-white py-2 rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors ${resolutionType === 'replace' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                        >
                                            {isProcessing ? <Loader2 className="animate-spin" size={18} /> : 
                                                resolutionType === 'replace' ? <><RefreshCw size={18}/> Process Replacement & Close</> : 
                                                <><CheckCircle size={18}/> Mark as Resolved</>
                                            }
                                        </button>
                                    </div>
                                </div>
                                )
                            ) : null}
                            
                            {selectedTicket.status === 'Resolved' && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900/50 p-4 rounded-lg">
                                    <h4 className="font-bold text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-2"><CheckCircle size={16}/> Resolved</h4>
                                    <p className="text-emerald-700 dark:text-emerald-400 text-sm">{selectedTicket.resolutionNotes}</p>
                                    <div className="text-xs text-emerald-600 dark:text-emerald-500 mt-2">Closed on {new Date(selectedTicket.resolvedAt!).toLocaleDateString()}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="flex border-b border-slate-200 dark:border-slate-800">
                     <button onClick={() => setActiveTab('inbox')} className={`flex-1 py-3 text-sm font-medium border-b-2 flex items-center justify-center gap-2 ${activeTab === 'inbox' ? 'border-purple-600 text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        Inbox (New Reports) 
                        {tickets.filter(t => t.status === 'New').length > 0 && <span className="bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{tickets.filter(t => t.status === 'New').length}</span>}
                    </button>
                    <button onClick={() => setActiveTab('active')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'active' ? 'border-slate-900 dark:border-blue-600 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        Active Tickets ({tickets.filter(t => t.status !== 'Resolved' && t.status !== 'New' && t.status !== 'Rejected').length})
                    </button>
                    <button onClick={() => setActiveTab('resolved')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'resolved' ? 'border-slate-900 dark:border-blue-600 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        History
                    </button>
                </div>
                
                {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-slate-400"/></div> : (
                    filteredTickets.length === 0 ? <div className="p-12 text-center text-slate-400 dark:text-slate-500">No tickets found.</div> : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredTickets.map(t => (
                                <div key={t.id} onClick={() => setSelectedTicket(t)} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors flex items-center justify-between group">
                                    <div className="flex items-start gap-4">
                                        <div className={`mt-1 w-2 h-2 rounded-full ${t.status === 'New' ? 'bg-purple-500' : t.priority === 'Critical' || t.priority === 'High' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-xs text-slate-400">{t.ticketNumber}</span>
                                                <span className="font-semibold text-slate-800 dark:text-slate-200">{t.assetName}</span>
                                                {t.imageBase64 && <ImageIcon size={12} className="text-slate-400"/>}
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1 group-hover:text-slate-900 dark:group-hover:text-white">{t.description}</p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 dark:text-slate-500">
                                                <span className="flex items-center gap-1"><ArrowRight size={12}/> {t.location}</span>
                                                <span className="flex items-center gap-1"><Clock size={12}/> {new Date(t.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(t.status)}`}>{t.status}</span>
                                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${getPriorityColor(t.priority)}`}>{t.priority}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default RepairTickets;
