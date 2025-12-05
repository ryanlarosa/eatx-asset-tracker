
import React, { useRef, useState, useEffect } from 'react';
import { X, Check, Trash2, PenTool } from 'lucide-react';

interface HandoverModalProps {
  isOpen: boolean;
  employeeName: string;
  assets: { id: string; name: string; serialNumber: string }[];
  onConfirm: (signature: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const HandoverModal: React.FC<HandoverModalProps> = ({ isOpen, employeeName, assets, onConfirm, onCancel, isProcessing }) => {
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

  const stopDrawing = () => {
    setIsDrawing(false);
  };

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
    if (canvasRef.current) {
      onConfirm(canvasRef.current.toDataURL());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
           <h3 className="font-bold text-slate-800 flex items-center gap-2"><PenTool size={18}/> Asset Handover Form</h3>
           <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
           <div className="mb-6">
              <h4 className="font-bold text-lg text-slate-900 mb-1">Asset Handover Acknowledgment</h4>
              <p className="text-sm text-slate-500">
                I, <span className="font-bold text-slate-900">{employeeName}</span>, acknowledge receipt of the following company assets. 
                I agree to maintain them in good condition and return them upon request or termination of employment.
              </p>
           </div>

           <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
              <table className="w-full text-sm text-left">
                 <thead>
                    <tr className="text-xs uppercase text-slate-500 border-b border-slate-200">
                       <th className="pb-2">Asset Name</th>
                       <th className="pb-2">Serial Number</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-200">
                    {assets.map(a => (
                       <tr key={a.id}>
                          <td className="py-2 font-medium text-slate-800">{a.name}</td>
                          <td className="py-2 text-slate-500 font-mono">{a.serialNumber || 'N/A'}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>

           <div className="mb-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">Employee Signature</label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 touch-none relative">
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
                 <button 
                    onClick={clearCanvas}
                    className="absolute top-2 right-2 p-2 bg-white shadow-sm border border-slate-200 rounded-lg text-slate-500 hover:text-red-600 text-xs font-medium"
                 >
                    Clear
                 </button>
                 {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-sm">
                       Sign here
                    </div>
                 )}
              </div>
           </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
           <button onClick={onCancel} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 font-medium">Cancel</button>
           <button 
              onClick={handleSave} 
              disabled={!hasSignature || isProcessing}
              className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-black disabled:opacity-50 font-medium flex items-center gap-2"
           >
              {isProcessing ? 'Saving...' : <>Confirm & Assign <Check size={16}/></>}
           </button>
        </div>
      </div>
    </div>
  );
};

export default HandoverModal;
