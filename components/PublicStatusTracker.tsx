
import React, { useState } from 'react';
import { getPublicItemStatus, PublicStatusResult, getSandboxStatus } from '../services/storageService';
import { Search, Loader2, Clock, CheckCircle, AlertCircle, Calendar, MessageSquare, Database, ArrowRight, Activity, ChevronRight } from 'lucide-react';

const PublicStatusTracker: React.FC = () => {
    const [refId, setRefId] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PublicStatusResult | null>(null);
    const [error, setError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);

    const isSandbox = getSandboxStatus();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!refId.trim()) return;
        
        setLoading(true);
        setError('');
        setResult(null);
        setHasSearched(true);

        try {
            const data = await getPublicItemStatus(refId);
            if (data) {
                setResult(data);
            } else {
                setError("Reference number not found. Please check your Ticket (TKT) or Request (REQ) ID.");
            }
        } catch (err) {
            setError("Unable to search at this time. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        if (['Resolved', 'Deployed', 'Completed', 'Approved'].includes(status)) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
        if (['Rejected', 'Cancelled'].includes(status)) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
        if (['New', 'Pending'].includes(status)) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    };

    const getSteps = (type: string, status: string) => {
        if (type === 'Request') {
            return [
                { l: 'Request Sent', done: true },
                { l: 'Acknowledged', done: ['Acknowledged', 'Pending Finance', 'Approved', 'Deployed'].includes(status) },
                { l: 'Processing', done: ['Pending Finance', 'Approved', 'Deployed'].includes(status) },
                { l: 'Deployed', done: status === 'Deployed' }
            ];
        } else {
            // Ticket
            return [
                { l: 'Reported', done: true },
                { l: 'In Progress', done: ['Open', 'In Progress', 'Waiting for Parts', 'Resolved'].includes(status) },
                { l: 'Resolved', done: status === 'Resolved' }
            ];
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative">
            {isSandbox && (
                <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-xs font-bold text-center py-1 z-50 flex items-center justify-center gap-2 shadow-sm">
                    <Database size={12} /> SANDBOX MODE - TEST DATA ONLY
                </div>
            )}

            <div className={`max-w-md w-full transition-all duration-500 ${hasSearched ? 'mt-8' : ''} ${isSandbox ? 'mt-8' : ''}`}>
                <div className="text-center mb-8">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Activity size={32} className="text-slate-900 dark:text-blue-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Track Request Status</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Enter your Ticket (TKT) or Request (REQ) number below.</p>
                </div>

                <form onSubmit={handleSearch} className="relative mb-8">
                    <input 
                        className="w-full p-4 pl-5 pr-14 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600 outline-none text-lg font-medium transition-all"
                        placeholder="e.g. TKT-2024-1234"
                        value={refId}
                        onChange={(e) => setRefId(e.target.value)}
                        autoFocus
                    />
                    <button 
                        type="submit" 
                        disabled={loading || !refId.trim()}
                        className="absolute right-2 top-2 bottom-2 bg-slate-900 dark:bg-blue-600 text-white px-3 rounded-lg hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Search />}
                    </button>
                </form>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center gap-3 border border-red-100 dark:border-red-900/30 animate-in fade-in slide-in-from-bottom-4">
                        <AlertCircle className="shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                {result && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{result.type} ID</div>
                                <div className="text-xl font-mono font-bold text-slate-900 dark:text-white">{result.id}</div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusColor(result.status)}`}>
                                {result.status}
                            </div>
                        </div>

                        {/* Progress Stepper */}
                        {result.status !== 'Rejected' && result.status !== 'Cancelled' && (
                            <div className="px-6 py-6 bg-slate-50/50 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center justify-between relative">
                                    {getSteps(result.type, result.status).map((step, idx, arr) => (
                                        <div key={idx} className="flex flex-col items-center relative z-10 w-full">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mb-2 transition-colors ${step.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-300'}`}>
                                                {step.done ? <CheckCircle size={16} /> : <span className="text-xs">{idx + 1}</span>}
                                            </div>
                                            <div className={`text-[10px] font-bold uppercase text-center ${step.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>{step.l}</div>
                                            
                                            {/* Connector Line */}
                                            {idx < arr.length - 1 && (
                                                <div className={`absolute top-4 left-[50%] w-full h-0.5 -z-10 ${step.done && arr[idx+1].done ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="p-6 space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Subject / Item</h3>
                                <p className="text-slate-800 dark:text-white font-medium">{result.subject}</p>
                            </div>
                            
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Description</h3>
                                <p className="text-slate-600 dark:text-slate-300 text-sm bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                    {result.details}
                                </p>
                            </div>

                            {result.notes && (
                                <div>
                                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Latest Updates</h3>
                                    <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                        <MessageSquare size={16} className="text-blue-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-blue-800 dark:text-blue-300">{result.notes}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
                                <div className="flex items-center gap-1">
                                    <Calendar size={12} /> Created: {new Date(result.created).toLocaleDateString()}
                                </div>
                                {result.updated && (
                                    <div className="flex items-center gap-1">
                                        <Clock size={12} /> Last Update: {new Date(result.updated).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicStatusTracker;
