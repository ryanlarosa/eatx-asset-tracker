
import React, { useRef, useState, useEffect } from 'react';
import { X, Check, PenTool, ArrowRight, User, Shield, Briefcase, Save } from 'lucide-react';

interface HandoverModalProps {
  isOpen: boolean;
  employeeName: string;
  currentItName?: string;
  assets: { id: string; name: string; serialNumber: string }[];
  type: 'Handover' | 'Return' | 'Transfer';
  targetName?: string;
  initialData?: { employeeSig?: string, itSig?: string, headSig?: string, headName?: string };
  onConfirm: (data: { employeeSig: string, itSig?: string, headSig?: string, headName?: string, status: 'Pending' | 'Completed' }) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const HandoverModal: React.FC<HandoverModalProps> = ({ isOpen, employeeName, currentItName, assets, type, targetName, initialData, onConfirm, onCancel, isProcessing }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  
  // Multi-step state for Returns
  const [step, setStep] = useState(0); // 0: Employee, 1: IT, 2: Head
  const [signatures, setSignatures] = useState<{ employee: string, it: string, head: string }>({ employee: '', it: '', head: '' });
  const [headName, setHeadName] = useState('');

  const isReturn = type === 'Return';
  const totalSteps = isReturn ? 3 : 1;

  useEffect(() => {
    if (isOpen) {
      // Initialize state from props or defaults
      const initialSigs = {
          employee: initialData?.employeeSig || '',
          it: initialData?.itSig || '',
          head: initialData?.headSig || ''
      };
      setSignatures(initialSigs);
      setHeadName(initialData?.headName || '');

      // Determine starting step
      if (isReturn) {
          if (initialSigs.employee && initialSigs.it) {
              setStep(2); // Go to Head
          } else if (initialSigs.employee) {
              setStep(1); // Go to IT
          } else {
              setStep(0); // Go to Employee
          }
      } else {
          setStep(0);
      }
      
      resetCanvas();
    }
  }, [isOpen, initialData, isReturn]);

  useEffect(() => {
      if (isOpen) {
          setTimeout(resetCanvas, 50);
      }
  }, [step, isOpen]);

  const resetCanvas = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#000000';
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      setHasSignature(false);
  };

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

  const getUpdatedSignatures = () => {
      const sig = canvasRef.current?.toDataURL();
      if (!sig) return signatures;
      const newSigs = { ...signatures };
      if (step === 0) newSigs.employee = sig;
      if (step === 1) newSigs.it = sig;
      if (step === 2) newSigs.head = sig;
      return newSigs;
  };

  const handleNext = () => {
      const newSigs = getUpdatedSignatures();
      setSignatures(newSigs);

      if (isReturn && step < totalSteps - 1) {
          setStep(prev => prev + 1);
      } else {
          // Finish
          onConfirm({
              employeeSig: newSigs.employee,
              itSig: newSigs.it,
              headSig: newSigs.head,
              headName: headName,
              status: 'Completed'
          });
      }
  };

  const handleSaveProgress = () => {
      const newSigs = getUpdatedSignatures();
      setSignatures(newSigs);
      onConfirm({
          employeeSig: newSigs.employee,
          itSig: newSigs.it,
          headSig: newSigs.head,
          headName: headName,
          status: 'Pending'
      });
  };

  if (!isOpen) return null;

  const getStepTitle = () => {
      if (!isReturn) return `${type} Acknowledgement`;
      if (step === 0) return "Step 1: Employee Return";
      if (step === 1) return "Step 2: IT Verification";
      if (step === 2) return "Step 3: Dept Head Approval";
      return "";
  };

  const getSignerLabel = () => {
      if (!isReturn) return `Signature of ${employeeName}`;
      if (step === 0) return `Signature of ${employeeName} (Employee)`;
      if (step === 1) return `Signature of ${currentItName || 'IT Staff'}`;
      if (step === 2) return `Signature of Department Head`;
      return "";
  };

  // Check if we are displaying a previous signature (Read Only Mode for this step)
  const existingSigForStep = step === 0 ? signatures.employee : step === 1 ? signatures.it : signatures.head;
  // Logic: If we loaded an initial sig for this step, and user hasn't cleared it (though we don't have clear logic for prev steps yet, assuming strictly sequential)
  // Actually, allow re-signing if needed, but show image if present. 
  // For simplicity, if we have a signature from props for *previous* steps, show image. For *current* step, allow signing.
  
  const showPrevStep0 = isReturn && step > 0 && signatures.employee;
  const showPrevStep1 = isReturn && step > 1 && signatures.it;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
           <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
               <PenTool size={18}/> {getStepTitle()}
           </h3>
           <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={20}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
           {/* Previous Signatures Visualization */}
           {isReturn && (
               <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
                   {/* Step 0 Summary */}
                   <div className={`flex-1 min-w-[120px] p-2 rounded-lg border ${step === 0 ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : signatures.employee ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Step 1: Employee</div>
                        {signatures.employee ? <img src={signatures.employee} className="h-8 opacity-80"/> : <div className="h-8 flex items-center text-xs text-slate-400 italic">Pending</div>}
                   </div>
                   {/* Step 1 Summary */}
                   <div className={`flex-1 min-w-[120px] p-2 rounded-lg border ${step === 1 ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : signatures.it ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Step 2: IT Dept</div>
                        {signatures.it ? <img src={signatures.it} className="h-8 opacity-80"/> : <div className="h-8 flex items-center text-xs text-slate-400 italic">Pending</div>}
                   </div>
                   {/* Step 2 Summary */}
                   <div className={`flex-1 min-w-[120px] p-2 rounded-lg border ${step === 2 ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : signatures.head ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Step 3: Dept Head</div>
                        {signatures.head ? <img src={signatures.head} className="h-8 opacity-80"/> : <div className="h-8 flex items-center text-xs text-slate-400 italic">Pending</div>}
                   </div>
               </div>
           )}

           {step === 0 && (
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
           )}

           {isReturn && step > 0 && (
               <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30 flex items-center gap-3">
                   {step === 1 ? <Shield className="text-blue-600 dark:text-blue-400" size={24} /> : <Briefcase className="text-blue-600 dark:text-blue-400" size={24} />}
                   <div>
                       <h5 className="font-bold text-blue-800 dark:text-blue-300 text-sm">
                           {step === 1 ? 'IT Department Verification' : 'Department Head Approval'}
                       </h5>
                       <p className="text-xs text-blue-700 dark:text-blue-400">
                           {step === 1 ? 'Please verify all items are present and in good condition before signing.' : 'Please acknowledge the return of these assets from your department.'}
                       </p>
                   </div>
               </div>
           )}

           <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-6">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Assets Processed</div>
              <div className="max-h-32 overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
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
           </div>

           <div className="mb-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{getSignerLabel()}</label>
              
              {isReturn && step === 2 && (
                  <div className="mb-3">
                      <input 
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm"
                        placeholder="Enter Department Head Name"
                        value={headName}
                        onChange={e => setHeadName(e.target.value)}
                      />
                  </div>
              )}

              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-200 touch-none relative overflow-hidden">
                 <canvas ref={canvasRef} width={600} height={200} className="w-full h-[200px] cursor-crosshair rounded-xl relative z-10" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                 <button onClick={resetCanvas} className="absolute top-2 right-2 p-2 bg-white shadow-sm border border-slate-200 rounded-lg text-slate-500 hover:text-red-600 text-xs font-medium z-20">Clear</button>
                 {!hasSignature && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-sm z-0">Sign here</div>}
              </div>
           </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center gap-3">
           <div className="flex gap-1.5">
               {isReturn && [0, 1, 2].map(i => (
                   <div key={i} className={`w-2 h-2 rounded-full ${step >= i ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
               ))}
           </div>

           <div className="flex gap-2">
                <button onClick={onCancel} className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">Cancel</button>
                
                {/* Save Progress Button for IT Step */}
                {isReturn && step === 1 && (
                    <button 
                        onClick={handleSaveProgress}
                        disabled={!hasSignature || isProcessing}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium flex items-center gap-2"
                    >
                        Save Progress <Save size={16}/>
                    </button>
                )}

                <button 
                    onClick={handleNext} 
                    disabled={!hasSignature || isProcessing || (step === 2 && !headName.trim())} 
                    className="px-6 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
                >
                    {isProcessing ? 'Processing...' : step === totalSteps - 1 ? <>Finish <Check size={16}/></> : <>Next <ArrowRight size={16}/></>}
                </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default HandoverModal;
