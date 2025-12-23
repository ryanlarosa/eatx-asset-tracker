import React, { useRef, useState, useEffect } from "react";
import {
  X,
  Check,
  PenTool,
  ArrowRight,
  User,
  Shield,
  Save,
} from "lucide-react";

interface HandoverModalProps {
  isOpen: boolean;
  employeeName: string;
  currentItName?: string;
  assets: { id: string; name: string; serialNumber: string }[];
  type: "Handover" | "Return" | "Transfer";
  targetName?: string;
  initialData?: { employeeSig?: string; itSig?: string };
  onConfirm: (data: {
    employeeSig: string;
    itSig?: string;
    status: "Pending" | "Completed";
  }) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const HandoverModal: React.FC<HandoverModalProps> = ({
  isOpen,
  employeeName,
  currentItName,
  assets,
  type,
  targetName,
  initialData,
  onConfirm,
  onCancel,
  isProcessing,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [step, setStep] = useState(0); // 0: Employee, 1: IT
  const [signatures, setSignatures] = useState<{
    employee: string;
    it: string;
  }>({ employee: "", it: "" });

  const isReturn = type === "Return";
  const totalSteps = isReturn ? 2 : 1;

  useEffect(() => {
    if (isOpen) {
      const initialSigs = {
        employee: initialData?.employeeSig || "",
        it: initialData?.itSig || "",
      };
      setSignatures(initialSigs);

      if (isReturn) {
        if (initialSigs.employee && initialSigs.it) setStep(1);
        else if (initialSigs.employee) setStep(1);
        else setStep(0);
      } else {
        setStep(0);
      }
    }
  }, [isOpen, initialData, isReturn]);

  // Handle Canvas Scaling - Sync buffer to visual size
  const resizeCanvas = () => {
    if (isOpen && containerRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();

      // Clear only if size actually changed to avoid losing drawing on minor layout shifts
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = "#000000";
        }
        setHasSignature(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(resizeCanvas, 150); // Allow modal animation to finish
      window.addEventListener("resize", resizeCanvas);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", resizeCanvas);
      };
    }
  }, [step, isOpen]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // Precise coordinates matching buffer resolution
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    if ("touches" in e && e.cancelable) e.preventDefault(); // Prevent scroll while drawing
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
  };

  const handleNext = () => {
    const sig = canvasRef.current?.toDataURL();
    const newSigs = { ...signatures };
    if (sig && hasSignature) {
      if (step === 0) newSigs.employee = sig;
      if (step === 1) newSigs.it = sig;
    }
    setSignatures(newSigs);

    if (isReturn && step < totalSteps - 1) {
      setStep((prev) => prev + 1);
    } else {
      onConfirm({
        employeeSig: newSigs.employee,
        itSig: newSigs.it,
        status: "Completed",
      });
    }
  };

  const handleSaveProgress = () => {
    const sig = canvasRef.current?.toDataURL();
    const newSigs = { ...signatures };
    if (sig && hasSignature) {
      if (step === 0) newSigs.employee = sig;
      if (step === 1) newSigs.it = sig;
    }
    setSignatures(newSigs);
    onConfirm({
      employeeSig: newSigs.employee,
      itSig: newSigs.it,
      status: "Pending",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 mx-auto">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <PenTool size={18} className="text-slate-400" />{" "}
            {isReturn
              ? step === 0
                ? "Employee Signature"
                : "IT Verification"
              : `${type} Form`}
          </h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
          {isReturn && (
            <div className="flex gap-4 mb-6">
              <div
                className={`flex-1 p-3 rounded-2xl border transition-all ${
                  step === 0
                    ? "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700 ring-4 ring-blue-100 dark:ring-blue-900/10"
                    : signatures.employee
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
                    : "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 opacity-60"
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  1. Employee
                </div>
                {signatures.employee ? (
                  <img
                    src={signatures.employee}
                    className="h-10 opacity-90 mix-blend-multiply dark:mix-blend-normal invert-0 dark:invert"
                  />
                ) : (
                  <div className="h-10 flex items-center text-[10px] text-slate-400 italic">
                    Awaiting Sign...
                  </div>
                )}
              </div>
              <div
                className={`flex-1 p-3 rounded-2xl border transition-all ${
                  step === 1
                    ? "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700 ring-4 ring-blue-100 dark:ring-blue-900/10"
                    : signatures.it
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
                    : "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 opacity-60"
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  2. IT Dept
                </div>
                {signatures.it ? (
                  <img
                    src={signatures.it}
                    className="h-10 opacity-90 mix-blend-multiply dark:mix-blend-normal invert-0 dark:invert"
                  />
                ) : (
                  <div className="h-10 flex items-center text-[10px] text-slate-400 italic">
                    Awaiting Sign...
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-6 text-center md:text-left">
            <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-2">
              {type === "Return"
                ? "Asset Return Declaration"
                : "Acknowledgement of Receipt"}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {type === "Return" ? (
                <>
                  I,{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {employeeName}
                  </span>
                  , certify that the listed items are being returned to IT
                  inventory.
                </>
              ) : type === "Transfer" ? (
                <>
                  I,{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {employeeName}
                  </span>
                  , acknowledge transfer to{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {targetName}
                  </span>
                  .
                </>
              ) : (
                <>
                  I,{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {employeeName}
                  </span>
                  , acknowledge receipt of company property.
                </>
              )}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 mb-8 border border-slate-100 dark:border-slate-700">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Line Items
            </div>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {assets.map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between items-center text-sm border-b border-slate-200/50 dark:border-slate-700/50 pb-2 last:border-0 last:pb-0"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {a.name}
                  </span>
                  <span className="text-xs font-mono text-slate-400 opacity-60">
                    {a.serialNumber || "N/A"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full">
            <div className="flex justify-between items-end mb-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {step === 0
                  ? `Signature: ${employeeName}`
                  : `Verified by: ${currentItName}`}
              </label>
              <button
                onClick={resetCanvas}
                className="text-[10px] text-red-500 font-bold uppercase hover:underline"
              >
                Clear Canvas
              </button>
            </div>
            <div
              ref={containerRef}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-200 touch-none h-[200px] shadow-inner relative w-full overflow-hidden"
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair rounded-3xl z-10 relative touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-300 dark:text-slate-400 text-sm font-medium z-0">
                  Sign inside this box
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center gap-4">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            {isReturn && step === 1 && (
              <button
                onClick={handleSaveProgress}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 font-bold text-sm flex items-center gap-2 shadow-sm"
              >
                <Save size={16} /> Draft
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!hasSignature || isProcessing}
              className="px-8 py-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-xl hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 font-bold text-sm flex items-center gap-2 shadow-xl shadow-slate-900/20"
            >
              {isProcessing ? (
                "Processing..."
              ) : step === totalSteps - 1 ? (
                <>
                  Complete <Check size={18} />
                </>
              ) : (
                <>
                  Next Step <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HandoverModal;
