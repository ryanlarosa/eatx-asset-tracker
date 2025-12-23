import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getPendingHandover,
  completePendingHandover,
  getSandboxStatus,
} from "../services/storageService";
import { PendingHandover } from "../types";
import {
  MonitorSmartphone,
  CheckCircle,
  AlertTriangle,
  PenTool,
  Loader2,
  Database,
  X,
} from "lucide-react";

const SignHandover: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingHandover | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const isSandbox = getSandboxStatus();

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const data = await getPendingHandover(id);
        if (data && data.status === "Pending") {
          setPending(data);
        } else {
          setError(
            "This link is invalid, expired, or the assets have already been assigned."
          );
        }
      } catch (e) {
        setError("Failed to load handover details.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Robust Canvas Sizing Logic
  const resizeCanvas = () => {
    if (canvasRef.current && containerRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      // Sync the internal buffer to the actual display size
      canvas.width = rect.width;
      canvas.height = rect.height;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#000000";
      }
    }
  };

  useEffect(() => {
    if (!loading && pending) {
      // Initial resize
      resizeCanvas();
      // Watch for container size changes
      const observer = new ResizeObserver(resizeCanvas);
      if (containerRef.current) observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [loading, pending]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Calculate position relative to the element, matching the scale of the buffer
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
    if ("touches" in e) {
      // Prevent scrolling while signing
      if (e.cancelable) e.preventDefault();
    }
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  };

  const handleSubmit = async () => {
    if (!id || !canvasRef.current) return;
    setIsSubmitting(true);
    try {
      await completePendingHandover(
        id,
        canvasRef.current.toDataURL("image/png")
      );
      setSuccess(true);
    } catch (e) {
      alert("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2
          className="animate-spin text-slate-900 dark:text-white"
          size={32}
        />
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 text-center max-w-md w-full">
          <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-full text-red-600 dark:text-red-400 w-fit mx-auto mb-4">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            Link Unavailable
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );

  if (success)
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 text-center max-w-md w-full animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-full text-emerald-600 dark:text-emerald-400 w-fit mx-auto mb-6">
            <CheckCircle size={48} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
            Handover Completed!
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            Thank you, {pending?.employeeName}. Your digital acknowledgement has
            been recorded in the system.
          </p>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-medium text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700">
            You can safely close this browser window.
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-x-hidden">
      {isSandbox && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-[10px] font-bold text-center py-1 z-50 flex items-center justify-center gap-2 shadow-sm tracking-widest uppercase">
          <Database size={10} /> Testing Mode (Sandbox)
        </div>
      )}

      <div
        className={`w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-4 duration-500 mx-auto`}
      >
        <div className="bg-slate-900 dark:bg-blue-600 p-8 text-white text-center">
          <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20 shadow-lg">
            <MonitorSmartphone size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            EatX IT Asset Handover
          </h1>
          <p className="text-slate-300 dark:text-blue-100 text-sm mt-1">
            Digital Receipt & Acknowledgement
          </p>
        </div>

        <div className="p-6 md:p-10 flex flex-col items-center">
          <div className="w-full mb-8 text-center md:text-left">
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
              Hello{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {pending?.employeeName}
              </span>
              ,
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
              Please review the assets below. Your signature confirms you have
              received them in good working condition.
            </p>
          </div>

          <div className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mb-8">
            <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
              Assigned Assets
            </h3>
            <div className="space-y-3">
              {pending?.assetsSnapshot.map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between items-center gap-4 group"
                >
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">
                    {a.name}
                  </div>
                  <div className="text-xs text-slate-400 font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                    {a.serialNumber || "No Serial"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full mb-8">
            <div className="flex justify-between items-end mb-3">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <PenTool size={14} className="inline mr-1.5 text-slate-400" />{" "}
                Draw Signature
              </label>
              <button
                onClick={clearCanvas}
                className="text-xs text-red-600 dark:text-red-400 font-bold hover:underline transition-all"
              >
                Clear
              </button>
            </div>
            <div
              ref={containerRef}
              className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-200 touch-none relative overflow-hidden h-[200px] shadow-inner w-full"
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair relative z-10 touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 dark:text-slate-400 text-sm font-medium z-0">
                  Sign with finger or mouse
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!hasSignature || isSubmitting}
            className="w-full bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 transition-all flex justify-center items-center gap-3 shadow-xl shadow-slate-900/20 dark:shadow-blue-900/20"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              "Confirm & Complete"
            )}
          </button>

          <p className="text-[10px] text-slate-400 text-center mt-6 uppercase tracking-widest font-medium opacity-50">
            Handover Ref: {id}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignHandover;
