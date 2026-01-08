
import React, { useState, useEffect } from 'react';
import { getAppConfig, createAssetRequest, getSandboxStatus } from '../services/storageService';
import { ShoppingBag, Send, Loader2, CheckCircle, Plus, Trash2, User, Users, Database, Mail, Building2, ChevronRight, Info } from 'lucide-react';

const PublicAssetRequest: React.FC = () => {
    const [departments, setDepartments] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitProgress, setSubmitProgress] = useState(0);

    // Form
    const [requestType, setRequestType] = useState<'individual' | 'department'>('individual');
    const [submitterName, setSubmitterName] = useState('');
    const [submitterEmail, setSubmitterEmail] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [department, setDepartment] = useState('');
    
    // Multiple Items State
    const [requestItems, setRequestItems] = useState<{id: number, itemName: string}[]>([{ id: Date.now(), itemName: '' }]);

    const [urgency, setUrgency] = useState('Medium');
    const [reason, setReason] = useState('');

    const isSandbox = getSandboxStatus();

    useEffect(() => {
        const init = async () => {
            const config = await getAppConfig();
            setDepartments(config.departments || []);
            setLoading(false);
        };
        init();
    }, []);

    const addItem = () => {
        setRequestItems([...requestItems, { id: Date.now(), itemName: '' }]);
    };

    const removeItem = (id: number) => {
        if (requestItems.length === 1) return;
        setRequestItems(requestItems.filter(i => i.id !== id));
    };

    const updateItem = (id: number, value: string) => {
        setRequestItems(requestItems.map(i => i.id === id ? { ...i, itemName: value } : i));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        
        const validItems = requestItems.filter(i => i.itemName.trim());
        if (validItems.length === 0) {
            alert("Please specify at least one item.");
            return;
        }

        setSubmitting(true);
        setSubmitProgress(0);
        try {
            const beneficiaryInfo = requestType === 'individual' 
                ? `For Employee: ${employeeName}` 
                : `For Department: ${department} (General Office/Outlet Use)`;

            // Execute sequentially to avoid overwhelming browser firestore instance 
            // and ensure robust behavior even if background email fails for one
            for (let i = 0; i < validItems.length; i++) {
                const item = validItems[i];
                await createAssetRequest({
                    requesterName: submitterName,
                    requesterEmail: submitterEmail,
                    department,
                    category: item.itemName,
                    urgency: urgency as any,
                    reason: `${beneficiaryInfo}\n\nJustification: ${reason}`,
                });
                setSubmitProgress(Math.round(((i + 1) / validItems.length) * 100));
            }
            setSubmitted(true);
        } catch (e) {
            console.error("Submission error:", e);
            alert("Submission failed. Your data might be partially saved. Please check with IT before retrying.");
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass = "w-full p-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600 transition-all shadow-sm";
    const labelClass = "block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 tracking-widest";

    if (loading) return <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32}/></div>;

    if (submitted) return (
        <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 text-center max-w-md w-full animate-in fade-in zoom-in duration-300">
                <div className="bg-emerald-50 dark:bg-emerald-900/30 p-5 rounded-full text-emerald-600 dark:text-emerald-400 w-fit mx-auto mb-6 shadow-sm border border-emerald-100 dark:border-emerald-800"><CheckCircle size={48}/></div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Request Confirmed</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                    We've received your request for <strong>{requestItems.filter(i => i.itemName.trim()).length}</strong> item(s). The IT Hub team has been notified and will reach out to <strong>{submitterEmail}</strong>.
                </p>
                <div className="flex flex-col gap-3">
                    <button onClick={() => window.location.reload()} className="w-full py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-bold hover:bg-black dark:hover:bg-blue-700 shadow-xl shadow-slate-900/10">Submit Another Request</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center p-4 md:p-8 relative">
            {isSandbox && (
                <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-[10px] font-bold text-center py-1 z-50 flex items-center justify-center gap-2 shadow-sm uppercase tracking-widest">
                    <Database size={12} /> Sandbox Mode (Test Environment)
                </div>
            )}
            
            <div className={`max-w-xl w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 ${isSandbox ? 'mt-10' : ''}`}>
                <div className="bg-slate-900 dark:bg-blue-600 p-8 text-white">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
                            <ShoppingBag size={28} className="text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">IT Hub Procurement</h1>
                            <p className="text-slate-300 dark:text-blue-100 text-sm font-medium opacity-80 uppercase tracking-widest text-[10px] mt-1">Unified Asset Request Portal</p>
                        </div>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-8">
                   
                   {/* Submitter Info */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       <div className="group">
                            <label className={labelClass}>Submitter Name</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input required placeholder="Your Name" className={`pl-11 ${inputClass}`} value={submitterName} onChange={e => setSubmitterName(e.target.value)} />
                            </div>
                        </div>
                        <div className="group">
                             <label className={labelClass}>Work Email</label>
                             <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input required type="email" placeholder="email@eatx.com" className={`pl-11 ${inputClass}`} value={submitterEmail} onChange={e => setSubmitterEmail(e.target.value)} />
                             </div>
                        </div>
                   </div>

                   {/* Department & Request Type */}
                   <div className="space-y-6 bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                        <div>
                            <label className={labelClass}>Location / Outlet</label>
                            <select required className={inputClass} value={department} onChange={e => setDepartment(e.target.value)}>
                                <option value="">Select Target Location...</option>
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>Beneficiary Type</label>
                            <div className="grid grid-cols-2 gap-3 p-1.5 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
                                <button 
                                    type="button" 
                                    onClick={() => setRequestType('individual')}
                                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${requestType === 'individual' ? 'bg-slate-900 dark:bg-blue-600 shadow-lg text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                >
                                    <User size={14}/> Specific Staff
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setRequestType('department')}
                                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${requestType === 'department' ? 'bg-slate-900 dark:bg-blue-600 shadow-lg text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                >
                                    <Building2 size={14}/> General Use
                                </button>
                            </div>
                        </div>

                        {requestType === 'individual' && (
                            <div className="animate-in slide-in-from-top-2 duration-300">
                                <label className={labelClass}>Employee Full Name</label>
                                <div className="relative">
                                    <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                    <input required placeholder="Staff member receiving asset" className={`pl-11 ${inputClass}`} value={employeeName} onChange={e => setEmployeeName(e.target.value)} />
                                </div>
                            </div>
                        )}
                        
                        {requestType === 'department' && (
                             <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-relaxed border border-blue-100 dark:border-blue-900/30">
                                 <Info size={18} className="shrink-0"/>
                                 <span>The asset will be linked to the general outlet/office area instead of a specific user.</span>
                             </div>
                        )}
                   </div>

                    {/* Items List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                             <label className={labelClass}>Equipment Needed</label>
                             <button type="button" onClick={addItem} className="text-[10px] flex items-center gap-1 text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-full transition-all border border-blue-100 dark:border-blue-900/30">
                                <Plus size={14}/> Add Item
                             </button>
                        </div>
                        
                        <div className="space-y-3">
                            {requestItems.map((item, index) => (
                                <div key={item.id} className="flex gap-3 items-center animate-in slide-in-from-left-2 fade-in group">
                                    <div className="flex-1 relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 dark:text-slate-700">{index + 1}</div>
                                        <input 
                                            required 
                                            type="text"
                                            placeholder="e.g. Printer, iPad, Laptop..."
                                            className={`pl-10 ${inputClass}`}
                                            value={item.itemName} 
                                            onChange={e => updateItem(item.id, e.target.value)}
                                        />
                                    </div>
                                    {requestItems.length > 1 && (
                                        <button 
                                            type="button" 
                                            onClick={() => removeItem(item.id)}
                                            className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/50 shadow-sm"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Business Justification</label>
                        <textarea required rows={3} placeholder="Why is this needed? (e.g. New joiner, equipment failure, outlet expansion)" className={inputClass} value={reason} onChange={e => setReason(e.target.value)} />
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                        <label className={labelClass}>Urgency Level</label>
                        <div className="flex gap-2 p-1 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
                            {['Low', 'Medium', 'High'].map(p => (
                                <button type="button" key={p} onClick={() => setUrgency(p)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${urgency === p ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button type="submit" disabled={submitting} className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-emerald-700 disabled:opacity-50 flex justify-center items-center gap-3 shadow-2xl shadow-emerald-900/20 transition-all active:scale-95 group">
                        {submitting ? (
                            <div className="flex items-center gap-3">
                                <Loader2 className="animate-spin" />
                                <span>Registering Item {Math.min(requestItems.filter(i=>i.itemName.trim()).length, Math.ceil((submitProgress / 100) * requestItems.filter(i=>i.itemName.trim()).length))}...</span>
                            </div>
                        ) : (
                            <>Submit Request Form <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform"/></>
                        )}
                    </button>
                </form>
            </div>
            
            <p className="mt-8 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">System Powered by EatX IT Hub</p>
        </div>
    );
};

export default PublicAssetRequest;
