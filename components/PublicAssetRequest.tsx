
import React, { useState, useEffect } from 'react';
import { getAppConfig, createAssetRequest } from '../services/storageService';
import { ShoppingBag, Send, Loader2, CheckCircle } from 'lucide-react';

const PublicAssetRequest: React.FC = () => {
    const [departments, setDepartments] = useState<string[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form
    const [requesterName, setRequesterName] = useState('');
    const [department, setDepartment] = useState('');
    const [category, setCategory] = useState('');
    const [urgency, setUrgency] = useState('Medium');
    const [reason, setReason] = useState('');

    useEffect(() => {
        const init = async () => {
            const c = await getAppConfig();
            setDepartments(c.departments || []);
            setCategories(c.categories);
            setLoading(false);
        };
        init();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await createAssetRequest({
                requesterName,
                department,
                category,
                urgency: urgency as any,
                reason,
            });
            setSubmitted(true);
        } catch (e) {
            alert("Error submitting request. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-slate-400"/></div>;

    if (submitted) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 text-center max-w-md w-full animate-in fade-in zoom-in">
                <div className="bg-emerald-50 p-3 rounded-full text-emerald-600 w-fit mx-auto mb-4"><CheckCircle size={32}/></div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Request Submitted</h2>
                <p className="text-slate-500 mb-6">Your asset request has been logged. The IT team will review it shortly.</p>
                <button onClick={() => window.location.reload()} className="text-sm text-slate-600 hover:text-slate-900 underline">Submit another request</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4">
            <div className="max-w-lg mx-auto bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 p-6 text-white text-center">
                    <div className="flex justify-center mb-3"><ShoppingBag size={32} className="text-emerald-400" /></div>
                    <h1 className="text-xl font-bold">Request Asset</h1>
                    <p className="text-slate-300 text-sm mt-1">EatX IT Procurement</p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Your Name</label>
                        <input required placeholder="e.g. Sarah Jones" className="w-full p-3 border border-slate-300 rounded-lg" value={requesterName} onChange={e => setRequesterName(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Department</label>
                            <select required className="w-full p-3 border border-slate-300 rounded-lg bg-white" value={department} onChange={e => setDepartment(e.target.value)}>
                                <option value="">Select...</option>
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Asset Category</label>
                            <select required className="w-full p-3 border border-slate-300 rounded-lg bg-white" value={category} onChange={e => setCategory(e.target.value)}>
                                <option value="">Select...</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason / Justification</label>
                        <textarea required rows={4} placeholder="Why is this asset needed? e.g. New joiner starting next week..." className="w-full p-3 border border-slate-300 rounded-lg" value={reason} onChange={e => setReason(e.target.value)} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Urgency</label>
                        <div className="flex gap-2">
                            {['Low', 'Medium', 'High'].map(p => (
                                <button type="button" key={p} onClick={() => setUrgency(p)} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${urgency === p ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button type="submit" disabled={submitting} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 flex justify-center items-center gap-2">
                        {submitting ? <Loader2 className="animate-spin" /> : <>Submit Request <Send size={18}/></>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PublicAssetRequest;