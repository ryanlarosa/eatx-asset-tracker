
import React, { useState, useEffect } from 'react';
import { Asset } from '../types';
import { getAppConfig, getAssets, createIncidentReport, getSandboxStatus } from '../services/storageService';
import { AlertTriangle, Send, Loader2, CheckCircle, MonitorSmartphone, MapPin, Search, Camera, Image as ImageIcon, X, Database, Mail } from 'lucide-react';

const PublicReportIssue: React.FC = () => {
    const [locations, setLocations] = useState<string[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form
    const [location, setLocation] = useState('');
    const [assetId, setAssetId] = useState('');
    const [assetName, setAssetName] = useState('');
    const [deviceType, setDeviceType] = useState('');
    const [reportedSerial, setReportedSerial] = useState('');
    const [imageBase64, setImageBase64] = useState('');
    const [description, setDescription] = useState('');
    const [reportedBy, setReportedBy] = useState('');
    const [reporterEmail, setReporterEmail] = useState('');
    const [priority, setPriority] = useState('Medium');

    const isSandbox = getSandboxStatus();

    useEffect(() => {
        const init = async () => {
            const [c, a] = await Promise.all([getAppConfig(), getAssets()]);
            setLocations(c.locations);
            setCategories(c.categories);
            setAssets(a);
            setLoading(false);
        };
        init();
    }, []);

    const filteredAssets = location ? assets.filter(a => a.location === location) : [];

    const handleAssetChange = (id: string) => {
        setAssetId(id);
        if (id) {
            const asset = assets.find(a => a.id === id);
            if (asset) {
                setAssetName(asset.name);
                setDeviceType(asset.category);
                setReportedSerial(asset.serialNumber);
            }
        } else {
            setAssetName('');
            setDeviceType('');
            setReportedSerial('');
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Compress image
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
                    setImageBase64(canvas.toDataURL('image/jpeg', 0.7)); // 70% quality JPEG
                };
            };
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await createIncidentReport({
                location,
                assetId: assetId || undefined,
                assetName: assetName,
                deviceType,
                reportedSerial,
                imageBase64,
                description,
                reportedBy,
                reporterEmail,
                priority: priority as any,
            });
            setSubmitted(true);
        } catch (e) {
            alert("Error submitting report. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass = "w-full p-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600";
    const labelClass = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1";

    if (loading) return <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-slate-400"/></div>;

    if (submitted) return (
        <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 text-center max-w-md w-full animate-in fade-in zoom-in">
                <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-full text-emerald-600 dark:text-emerald-400 w-fit mx-auto mb-4"><CheckCircle size={32}/></div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Report Submitted</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Thank you. The IT team has been notified and will review your issue shortly.</p>
                <button onClick={() => window.location.reload()} className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline">Submit another report</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 relative">
            {isSandbox && (
                <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-xs font-bold text-center py-1 z-50 flex items-center justify-center gap-2 shadow-sm">
                    <Database size={12} /> SANDBOX MODE - TEST DATA ONLY
                </div>
            )}
            <div className={`max-w-lg w-full bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 ${isSandbox ? 'mt-8' : ''}`}>
                <div className="bg-slate-900 dark:bg-blue-600 p-6 text-white text-center">
                    <div className="flex justify-center mb-3"><AlertTriangle size={32} className="text-amber-400" /></div>
                    <h1 className="text-xl font-bold">Report an Issue</h1>
                    <p className="text-slate-300 dark:text-blue-100 text-sm mt-1">EatX IT Support Portal</p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Your Name</label>
                            <input required placeholder="e.g. John (Bar Manager)" className={inputClass} value={reportedBy} onChange={e => setReportedBy(e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Email (For Updates)</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input required type="email" placeholder="your.email@eatx.com" className={`pl-9 ${inputClass}`} value={reporterEmail} onChange={e => setReporterEmail(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Location</label>
                        <select required className={inputClass} value={location} onChange={e => { setLocation(e.target.value); handleAssetChange(''); }}>
                            <option value="">Select Location...</option>
                            {locations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>

                    {location && (
                        <div className="animate-in slide-in-from-top-2 space-y-4">
                             <div>
                                <label className={labelClass}>Select Device (Optional)</label>
                                <select className={inputClass} value={assetId} onChange={e => handleAssetChange(e.target.value)}>
                                    <option value="">-- I don't see my device / Not listed --</option>
                                    {filteredAssets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.serialNumber})</option>)}
                                </select>
                             </div>

                             {/* Manual Fields if Asset Not Selected */}
                             <div className={`space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 ${assetId ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div>
                                    <label className={labelClass}>Device Name / Description</label>
                                    <input required={!assetId} placeholder="e.g. Broken Coffee Machine" className={inputClass.replace('p-3', 'p-2 text-sm')} value={assetName} onChange={e => setAssetName(e.target.value)} disabled={!!assetId}/>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelClass}>Device Type</label>
                                        <select required={!assetId} className={inputClass.replace('p-3', 'p-2 text-sm')} value={deviceType} onChange={e => setDeviceType(e.target.value)} disabled={!!assetId}>
                                            <option value="">Select...</option>
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Serial No. (Optional)</label>
                                        <input placeholder="e.g. SN123456" className={inputClass.replace('p-3', 'p-2 text-sm')} value={reportedSerial} onChange={e => setReportedSerial(e.target.value)} disabled={!!assetId}/>
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}

                    <div>
                        <label className={labelClass}>What is the problem?</label>
                        <textarea required rows={3} placeholder="Describe the issue..." className={inputClass} value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label className={labelClass}>Upload Photo (Clarification)</label>
                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer relative">
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            {imageBase64 ? (
                                <div className="relative w-full">
                                    <img src={imageBase64} alt="Preview" className="h-40 w-full object-contain rounded-md" />
                                    <button type="button" onClick={(e) => { e.preventDefault(); setImageBase64(''); }} className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-full shadow-md m-1 hover:bg-red-600"><X size={14}/></button>
                                </div>
                            ) : (
                                <div className="text-center text-slate-400 dark:text-slate-500">
                                    <Camera size={24} className="mx-auto mb-2" />
                                    <p className="text-xs">Tap to take photo or upload</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Urgency</label>
                        <div className="flex gap-2">
                            {['Low', 'Medium', 'High', 'Critical'].map(p => (
                                <button type="button" key={p} onClick={() => setPriority(p)} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${priority === p ? 'bg-slate-800 dark:bg-blue-600 text-white border-slate-800 dark:border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button type="submit" disabled={submitting} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 flex justify-center items-center gap-2">
                        {submitting ? <Loader2 className="animate-spin" /> : <>Submit Report <Send size={18}/></>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PublicReportIssue;
