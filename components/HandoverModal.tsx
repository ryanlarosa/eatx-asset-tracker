import React, { useRef, useState, useEffect } from 'react';
import { X, Check, PenTool } from 'lucide-react';

interface HandoverModalProps {
  isOpen: boolean;
  employeeName: string;
  assets: { id: string; name: string; serialNumber: string }[];
  type: 'Handover' | 'Return' | 'Transfer';
  targetName?: string;
  onConfirm: (signature: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const HandoverModal: React.FC<HandoverModalProps> = ({ isOpen, employeeName, assets, type, targetName, onConfirm, onCancel, isProcessing }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setHasSignature(false);
    }
  }, [isOpen]);

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

  const handleSave = () => {
    if (canvasRef.current) onConfirm(canvasRef.current.toDataURL());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
           <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><PenTool size={18}/> {type} Acknowledgement</h3>
           <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={20}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
           <div className="mb-6">
              <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-1">
                 {type === 'Return' ? 'Asset Return Form' : type === 'Transfer' ? 'Asset Transfer Form' : 'Asset Handover Form'}
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {type === 'Return' ? (
                   <>I, <span className="font-bold text-slate-900 dark:text-white">{employeeName}</span>, confirm the return of the following company assets. I declare that these items are being returned in the condition they were issued, subject to normal wear and tear.</>
                ) : type === 'Transfer' ? (
                   <>I, <span className="font-bold text-slate-900 dark:text-white">{employeeName}</span>, acknowledge the transfer of ownership of the following assets to <span className="font-bold text-slate-900 dark:text-white">{targetName}</span>.</>
                ) : (
                   <>I, <span className="font-bold text-slate-900 dark:text-white">{employeeName}</span>, acknowledge receipt of the following company assets.</>
                )}
              </p>
           </div>

           <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-6">
              <table className="w-full text-sm text-left">
                 <thead>
                    <tr className="text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                       <th className="pb-2">Asset Name</th>
                       <th className="pb-2">Serial Number</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {assets.map(a => (
                       <tr key={a.id}>
                          <td className="py-2 font-medium text-slate-800 dark:text-slate-200">{a.name}</td>
                          <td className="py-2 text-slate-500 dark:text-slate-400 font-mono">{a.serialNumber || 'N/A'}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>

           <div className="mb-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Signature of {employeeName}</label>
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-200 touch-none relative overflow-hidden">
                 {/* Canvas background kept light for contrast with ink */}
                 <canvas ref={canvasRef} width={600} height={200} className="w-full h-[200px] cursor-crosshair rounded-xl relative z-10" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                 <button onClick={clearCanvas} className="absolute top-2 right-2 p-2 bg-white shadow-sm border border-slate-200 rounded-lg text-slate-500 hover:text-red-600 text-xs font-medium z-20">Clear</button>
                 {!hasSignature && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-sm z-0">Sign here</div>}
              </div>
           </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
           <button onClick={onCancel} className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">Cancel</button>
           <button onClick={handleSave} disabled={!hasSignature || isProcessing} className="px-6 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2">{isProcessing ? 'Saving...' : <>Confirm <Check size={16}/></>}</button>
        </div>
      </div>
    </div>
  );
};

export default HandoverModal;