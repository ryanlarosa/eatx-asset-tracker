import React, { useState, useEffect } from "react";
import { getAppConfig, createAssetRequest } from "../services/storageService";
import {
  ShoppingBag,
  Send,
  Loader2,
  CheckCircle,
  Plus,
  Trash2,
  User,
  Users,
} from "lucide-react";

const PublicAssetRequest: React.FC = () => {
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [submitterName, setSubmitterName] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");

  // Multiple Items State (now using 'itemName' instead of 'category' for clarity in UI, though we map to category in DB)
  const [requestItems, setRequestItems] = useState<
    { id: number; itemName: string }[]
  >([{ id: Date.now(), itemName: "" }]);

  const [urgency, setUrgency] = useState("Medium");
  const [reason, setReason] = useState("");

  useEffect(() => {
    const init = async () => {
      const c = await getAppConfig();
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

    // Validate items
    if (requestItems.some((i) => !i.itemName.trim())) {
      alert("Please specify the item name for all requests.");
      return;
    }

    setSubmitting(true);
    try {
      // Create individual request for each item
      await Promise.all(
        requestItems.map((item) =>
          createAssetRequest({
            requesterName: submitterName,
            department,
            category: item.itemName, // Storing free text item name in category field
            urgency: urgency as any,
            reason: `For Employee: ${employeeName}\n\n${reason}`, // Append beneficiary info to reason
          })
        )
      );
      setSubmitted(true);
    } catch (e) {
      alert("Error submitting request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );

  if (submitted)
    return (
      <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 text-center max-w-md w-full animate-in fade-in zoom-in">
          <div className="bg-emerald-50 p-3 rounded-full text-emerald-600 w-fit mx-auto mb-4">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Request Submitted
          </h2>
          <p className="text-slate-500 mb-6">
            Your request for {requestItems.length} asset
            {requestItems.length > 1 ? "s" : ""} for{" "}
            <strong>{employeeName}</strong> has been logged. The IT team will
            review it shortly.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-slate-600 hover:text-slate-900 underline"
          >
            Submit another request
          </button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-8 w-full">
        <div className="bg-slate-900 p-6 text-white text-center">
          <div className="flex justify-center mb-3">
            <ShoppingBag size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold">Request Asset</h1>
          <p className="text-slate-300 text-sm mt-1">EatX IT Procurement</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 md:p-8 space-y-5 flex flex-col items-center justify-center w-full"
        >
          {/* Requester Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <div className="w-full">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Submitted By (You)
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  required
                  placeholder="Manager Name"
                  className="w-full pl-9 p-3 border border-slate-300 rounded-lg"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                />
              </div>
            </div>

            <div className="w-full">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                For Employee (User)
              </label>
              <div className="relative">
                <Users
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  required
                  placeholder="New Joiner / Staff Name"
                  className="w-full pl-9 p-3 border border-slate-300 rounded-lg"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="w-full">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Department
            </label>
            <select
              required
              className="w-full p-3 border border-slate-300 rounded-lg bg-white"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">Select...</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Multiple Assets Section */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 w-full">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-xs font-bold text-slate-500 uppercase">
                Items Needed
              </label>
              <button
                type="button"
                onClick={addItem}
                className="text-xs flex items-center gap-1 text-emerald-600 font-bold hover:text-emerald-700"
              >
                <Plus size={14} /> Add Item
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
                      placeholder="Item Name (e.g. Laptop, iPhone 15, SIM Card)"
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm"
                      value={item.itemName}
                      onChange={(e) => updateItem(item.id, e.target.value)}
                    />
                  </div>
                  {requestItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove Item"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="w-full">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Reason / Justification
            </label>
            <textarea
              required
              rows={3}
              placeholder="Why is this asset needed? e.g. New joiner starting next week..."
              className="w-full p-3 border border-slate-300 rounded-lg"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="w-full">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Urgency
            </label>
            <div className="flex gap-2">
              {["Low", "Medium", "High"].map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setUrgency(p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                    urgency === p
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200"
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
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 flex justify-center items-center gap-2"
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
