import React, { useState, useEffect } from "react";
import {
  getAppConfig,
  createAssetRequest,
  getSandboxStatus,
} from "../services/storageService";
import {
  ShoppingBag,
  Send,
  Loader2,
  CheckCircle,
  Plus,
  Trash2,
  User,
  Users,
  Database,
  Mail,
  Building2,
} from "lucide-react";

const PublicAssetRequest: React.FC = () => {
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [requestType, setRequestType] = useState<"individual" | "department">(
    "individual"
  );
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");

  // Multiple Items State
  const [requestItems, setRequestItems] = useState<
    { id: number; itemName: string }[]
  >([{ id: Date.now(), itemName: "" }]);

  const [urgency, setUrgency] = useState("Medium");
  const [reason, setReason] = useState("");

  const isSandbox = getSandboxStatus();

  useEffect(() => {
    const init = async () => {
      const [c] = await Promise.all([getAppConfig()]);
      setDepartments(c.departments || []);
      setLoading(false);
    };
    init();
  }, []);

  const addItem = () => {
    setRequestItems([...requestItems, { id: Date.now(), itemName: "" }]);
  };

  const removeItem = (id: number) => {
    if (requestItems.length === 1) return;
    setRequestItems(requestItems.filter((i) => i.id !== id));
  };

  const updateItem = (id: number, value: string) => {
    setRequestItems(
      requestItems.map((i) => (i.id === id ? { ...i, itemName: value } : i))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (requestItems.some((i) => !i.itemName.trim())) {
      alert("Please specify the item name for all requests.");
      return;
    }

    setSubmitting(true);
    try {
      const beneficiaryInfo =
        requestType === "individual"
          ? `For Employee: ${employeeName}`
          : `For Department: ${department} (General Office/Outlet Use)`;

      await Promise.all(
        requestItems.map((item) =>
          createAssetRequest({
            requesterName: submitterName,
            requesterEmail: submitterEmail,
            department,
            category: item.itemName,
            urgency: urgency as any,
            reason: `${beneficiaryInfo}\n\nJustification: ${reason}`,
          })
        )
      );
      setSubmitted(true);
    } catch (e) {
      alert("Error submitting request. Please try again.");
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full p-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600 transition-all";
  const labelClass =
    "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1";

  if (loading)
    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );

  if (submitted)
    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 text-center max-w-md w-full animate-in fade-in zoom-in">
          <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-full text-emerald-600 dark:text-emerald-400 w-fit mx-auto mb-4">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            Request Submitted
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Your procurement request has been logged. The IT Hub team will
            review it and notify you at <strong>{submitterEmail}</strong>.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline"
          >
            Submit another request
          </button>
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
      <div
        className={`max-w-lg w-full bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 ${
          isSandbox ? "mt-8" : ""
        }`}
      >
        <div className="bg-slate-900 dark:bg-blue-600 p-6 text-white text-center">
          <div className="flex justify-center mb-3">
            <ShoppingBag size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold">IT Hub Procurement</h1>
          <p className="text-slate-300 dark:text-blue-100 text-sm mt-1">
            EatX Unified Asset Request Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {/* Submitter Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Your Name</label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  required
                  placeholder="Manager Name"
                  className={`pl-9 ${inputClass}`}
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Work Email</label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  required
                  type="email"
                  placeholder="your.email@eatx.com"
                  className={`pl-9 ${inputClass}`}
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Department & Request Type */}
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Target Department / Outlet</label>
              <select
                required
                className={inputClass}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">Select Department...</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Who is this for?</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRequestType("individual")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-bold transition-all ${
                    requestType === "individual"
                      ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <User size={14} /> Specific Staff
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType("department")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-bold transition-all ${
                    requestType === "department"
                      ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <Building2 size={14} /> Office / Outlet Use
                </button>
              </div>
            </div>

            {requestType === "individual" && (
              <div className="animate-in slide-in-from-top-2">
                <label className={labelClass}>Employee Name</label>
                <div className="relative">
                  <Users
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    required
                    placeholder="Staff Member Name"
                    className={`pl-9 ${inputClass}`}
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Items List */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-3">
              <label className={labelClass}>Equipment Needed</label>
              <button
                type="button"
                onClick={addItem}
                className="text-[10px] flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-2 py-1 rounded transition-colors uppercase"
              >
                <Plus size={12} /> Add Another
              </button>
            </div>

            <div className="space-y-3">
              {requestItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex gap-2 items-center animate-in slide-in-from-left-2 fade-in"
                >
                  <div className="flex-1">
                    <input
                      required
                      type="text"
                      placeholder="Item (e.g. Printer, iPad, Laptop)"
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm"
                      value={item.itemName}
                      onChange={(e) => updateItem(item.id, e.target.value)}
                    />
                  </div>
                  {requestItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Reason / Justification</label>
            <textarea
              required
              rows={3}
              placeholder="Why is this needed? e.g. New joiner, expansion, replacement for damaged unit..."
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Urgency</label>
            <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              {["Low", "Medium", "High"].map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setUrgency(p)}
                  className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                    urgency === p
                      ? "bg-slate-900 dark:bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 flex justify-center items-center gap-3 shadow-lg shadow-emerald-900/10"
          >
            {submitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                Submit Request ({requestItems.length}) <Send size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PublicAssetRequest;
