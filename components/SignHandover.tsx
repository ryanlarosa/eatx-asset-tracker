
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPendingHandover, completePendingHandover, getSandboxStatus } from '../services/storageService';
import { PendingHandover } from '../types';
import { MonitorSmartphone, CheckCircle, AlertTriangle, PenTool, Loader2, Database } from 'lucide-react';

const SignHandover: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [pending, setPending] = useState<PendingHandover | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Canvas
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    const isSandbox = getSandboxStatus();

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            try {
                const data = await getPendingHandover(id);
                if (data && data.status === 'Pending') {
                    setPending(data);
                } else {
                    setError("This link is invalid, expired, or the assets have already been assigned.");
                }
            } catch (e) {
                setError("Failed to load handover details.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    useEffect(() => {
        if (!loading && pending && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#000000';
            }
        }
    }, [loading, pending]);

    // Drawing Logic (Same as Modal)
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setIsDrawing(true);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
      };
    
      const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasSignature(true);
      };
    
      const stopDrawing = () => setIsDrawing(false);
      const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasSignature(false);
          }
        }
      };

    const handleSubmit = async () => {
        if (!id || !canvasRef.current) return;
        setIsSubmitting(true);
        try {
            await completePendingHandover(id, canvasRef.current.toDataURL());
            setSuccess(true);
        } catch (e) {
            alert("Failed to submit. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-slate-900 dark:text-white" size={32} /></div>;

    if (error) return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 text-center max-w-md">
                <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded-full text-red-600 dark:text-red-400 w-fit mx-auto mb-4"><AlertTriangle size={32}/></div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Link Unavailable</h2>
                <p className="text-slate-500 dark:text-slate-400">{error}</p>
            </div>
        </div>
    );

    if (success) return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 text-center max-w-md animate-in fade-in zoom-in">
                <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-full text-emerald-600 dark:text-emerald-400 w-fit mx-auto mb-4"><CheckCircle size={32}/></div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Asset Handover Completed</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Thank you, {pending?.employeeName}. The assets have been successfully assigned to your profile.</p>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-slate-400 dark:text-slate-500">You may close this window.</div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 relative">
            {isSandbox && (
                <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-xs font-bold text-center py-1 z-50 flex items-center justify-center gap-2 shadow-sm">
                    <Database size={12} /> SANDBOX MODE - TEST DATA ONLY
                </div>
            )}
            <div className={`max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden ${isSandbox ? 'mt-4' : ''}`}>
                <div className="bg-slate-900 dark:bg-blue-600 p-6 text-white text-center">
                    <div className="flex justify-center mb-3"><MonitorSmartphone size={32} /></div>
                    <h1 className="text-xl font-bold">EatX Asset Handover</h1>
                    <p className="text-slate-300 dark:text-blue-100 text-sm mt-1">Official Digital Handover Form</p>
                </div>

                <div className="p-6 md:p-8">
                    <div className="mb-6">
                        <p className="text-slate-600 dark:text-slate-300">
                            Hello <span className="font-bold text-slate-900 dark:text-white">{pending?.employeeName}</span>,
                        </p>
                        <p className="text-slate-600 dark:text-slate-300 mt-2">
                            Please review the list of company assets below. By signing this document, you acknowledge receipt and agree to maintain them in good condition.
                        </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-8">
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Assets to be assigned</h3>
                        <table className="w-full text-sm text-left">
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {pending?.assetsSnapshot.map(a => (
                                    <tr key={a.id}>
                                        <td className="py-3 font-medium text-slate-800 dark:text-slate-200">{a.name}</td>
                                        <td className="py-3 text-slate-500 dark:text-slate-400 font-mono text-right">{a.serialNumber || 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mb-6">
                        <div className="flex justify-between items-end mb-2">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300"><PenTool size={16} className="inline mr-1"/> Your Signature</label>
                            <button onClick={clearCanvas} className="text-xs text-red-600 dark:text-red-400 hover:underline">Clear Signature</button>
                        </div>
                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-200 touch-none">
                            {/* Canvas background kept light for ink visibility */}
                            <canvas
                                ref={canvasRef}
                                width={600}
                                height={200}
                                className="w-full h-[200px] cursor-crosshair rounded-xl"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                        </div>
                        <p className="text-xs text-slate-400 mt-2 text-center">Sign using your mouse or finger.</p>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={!hasSignature || isSubmitting}
                        className="w-full bg-slate-900 dark:bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 transition-all flex justify-center items-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirm & Sign'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignHandover;
