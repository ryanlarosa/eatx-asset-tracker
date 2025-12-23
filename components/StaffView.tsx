import React, { useState, useEffect } from "react";
import {
  Asset,
  UserProfile,
  HandoverDocument,
  PendingHandover,
} from "../types";
import {
  listenToAssets,
  bulkAssignAssets,
  bulkReturnAssets,
  bulkTransferAssets,
  getCurrentUserProfile,
  saveHandoverDocument,
  getHandoverDocuments,
  createPendingHandover,
  getSandboxStatus,
  listenToPendingHandovers,
  deletePendingHandover,
} from "../services/storageService";
import {
  Briefcase,
  Archive,
  ArrowRight,
  CheckCircle,
  Search,
  Laptop,
  Smartphone,
  Monitor,
  User as UserIcon,
  AlertTriangle,
  X,
  FileText,
  Download,
  Link as LinkIcon,
  Mail,
  Printer,
  Clock,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import HandoverModal from "./HandoverModal";

const StaffView: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pendingLinks, setPendingLinks] = useState<PendingHandover[]>([]);
  const [mode, setMode] = useState<"onboard" | "offboard">("offboard");
  const [view, setView] = useState<"manage" | "documents" | "pending">(
    "manage"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    new Set()
  );
  const [targetEmployee, setTargetEmployee] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [linkModal, setLinkModal] = useState<{
    open: boolean;
    link: string;
    name: string;
  }>({ open: false, link: "", name: "" });

  // Signature Modal State
  const [signModal, setSignModal] = useState<{
    isOpen: boolean;
    type: "Handover" | "Return" | "Transfer";
    employeeName: string;
    targetName?: string;
    assets: Asset[];
    assetsSnapshot?: { id: string; name: string; serialNumber: string }[];
    docId?: string;
    initialData?: { employeeSig?: string; itSig?: string };
  }>({ isOpen: false, type: "Handover", employeeName: "", assets: [] });

  const currentUser = getCurrentUserProfile();
  const canEdit =
    currentUser?.role === "admin" || currentUser?.role === "technician";

  useEffect(() => {
    const unsubscribe = listenToAssets((data) => {
      setAssets(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (view === "pending") {
      const unsub = listenToPendingHandovers((data) => setPendingLinks(data));
      return () => unsub();
    }
  }, [view]);

  useEffect(() => {
    setSelectedAssetIds((prev) => {
      const newSet = new Set<string>();
      prev.forEach((id) => {
        const asset = assets.find((a) => a.id === id);
        if (!asset) return;
        if (mode === "offboard") {
          if (asset.assignedEmployee === selectedEmployee) newSet.add(id);
        } else {
          if (asset.status === "In Storage") newSet.add(id);
        }
      });
      return newSet;
    });
  }, [assets, mode, selectedEmployee]);

  const [documents, setDocuments] = useState<HandoverDocument[]>([]);
  useEffect(() => {
    if (view === "documents") {
      loadDocuments();
    }
  }, [view]);

  const loadDocuments = async () => {
    const docs = await getHandoverDocuments();
    setDocuments(docs);
  };

  const uniqueEmployees = Array.from(
    new Set(assets.map((a) => a.assignedEmployee).filter(Boolean) as string[])
  ).sort();
  const matchedEmployees = searchTerm
    ? uniqueEmployees.filter((e) =>
        e.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : uniqueEmployees;

  const filteredAssets = assets.filter((asset) => {
    if (mode === "offboard") {
      if (!selectedEmployee) return false;
      return asset.assignedEmployee === selectedEmployee;
    } else {
      // Assignment only allows assets currently in Storage
      const isInStorage = asset.status === "In Storage";
      const matchesSearch =
        !searchTerm ||
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.category.toLowerCase().includes(searchTerm.toLowerCase());
      return isInStorage && matchesSearch;
    }
  });

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedAssetIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedAssetIds(newSet);
  };

  const selectAll = () => {
    if (selectedAssetIds.size === filteredAssets.length) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(filteredAssets.map((a) => a.id)));
    }
  };

  const handleGenerateLink = async (linkType: "Handover" | "Return") => {
    const empName = linkType === "Handover" ? targetEmployee : selectedEmployee;
    if (!empName || selectedAssetIds.size === 0) return;

    setIsProcessing(true);
    try {
      const selectedAssetsList = assets.filter((a) =>
        selectedAssetIds.has(a.id)
      );
      const pendingId = await createPendingHandover(
        empName,
        selectedAssetsList,
        linkType
      );
      const isSandbox = getSandboxStatus();
      const link = `${window.location.origin}/#/sign/${pendingId}${
        isSandbox ? "?env=sandbox" : ""
      }`;
      setLinkModal({ open: true, link, name: empName });
      setSelectedAssetIds(new Set());
      setTargetEmployee("");
    } catch (e) {
      alert("Failed to generate link");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePending = async (id: string) => {
    if (confirm("Revoke this sign link?")) {
      await deletePendingHandover(id);
      setSuccessMsg("Sign link revoked.");
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  const handleReturnClick = () => {
    if (selectedAssetIds.size === 0 || !selectedEmployee) return;
    setSignModal({
      isOpen: true,
      type: "Return",
      employeeName: selectedEmployee,
      assets: assets.filter((a) => selectedAssetIds.has(a.id)),
    });
  };

  const handleTransferClick = () => {
    if (selectedAssetIds.size === 0 || !selectedEmployee || !targetEmployee)
      return;
    setSignModal({
      isOpen: true,
      type: "Transfer",
      employeeName: selectedEmployee,
      targetName: targetEmployee,
      assets: assets.filter((a) => selectedAssetIds.has(a.id)),
    });
  };

  const handleResumeSign = (doc: HandoverDocument) => {
    setSignModal({
      isOpen: true,
      type: doc.type,
      employeeName: doc.employeeName,
      assets: [],
      assetsSnapshot: doc.assets,
      docId: doc.id,
      initialData: {
        employeeSig: doc.signatureBase64,
        itSig: doc.itSignatureBase64,
      },
    });
  };

  const handleSignatureConfirm = async (sigs: {
    employeeSig: string;
    itSig?: string;
    status: "Pending" | "Completed";
  }) => {
    setIsProcessing(true);
    try {
      const docId =
        signModal.docId || "doc-" + Math.random().toString(36).substr(2, 9);
      const docData: HandoverDocument = {
        id: docId,
        employeeName: signModal.employeeName,
        assets:
          signModal.assetsSnapshot ||
          signModal.assets.map((a) => ({
            id: a.id,
            name: a.name,
            serialNumber: a.serialNumber,
          })),
        signatureBase64: sigs.employeeSig,
        itSignatureBase64: sigs.itSig,
        date: new Date().toISOString(),
        type: signModal.type,
        status: sigs.status,
      };
      await saveHandoverDocument(docData);
      const assetIds = signModal.assetsSnapshot
        ? signModal.assetsSnapshot.map((a) => a.id)
        : signModal.assets.map((a) => a.id);
      if (signModal.type === "Return") {
        if (sigs.itSig) await bulkReturnAssets(assetIds, docId);
        setSuccessMsg(
          sigs.status === "Completed" ? "Return Completed." : "Progress Saved."
        );
      } else if (signModal.type === "Transfer" && signModal.targetName) {
        await bulkTransferAssets(assetIds, signModal.targetName, docId);
        setSuccessMsg(
          `Successfully transferred assets to ${signModal.targetName}`
        );
      }
      setSignModal({ ...signModal, isOpen: false });
      setSelectedAssetIds(new Set());
      setTargetEmployee("");
      if (!signModal.docId && selectedAssetIds.size === filteredAssets.length)
        setSelectedEmployee(null);
      if (view === "documents") loadDocuments();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e) {
      alert("Error processing handover.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintDocument = (doc: HandoverDocument) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const dateStr = new Date(doc.date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const docTitle =
      doc.type === "Return"
        ? "ASSET RETURN FORM"
        : doc.type === "Transfer"
        ? "ASSET TRANSFER ACKNOWLEDGEMENT"
        : "ASSET HANDOVER FORM";

    const declaration =
      doc.type === "Return"
        ? `I, <b>${doc.employeeName}</b>, confirm the return of the following company assets. I declare that these items are being returned in the condition they were issued, subject to normal wear and tear.`
        : `I, <b>${doc.employeeName}</b>, acknowledge receipt/transfer of the following company assets. I agree to use them for company business and maintain them in good condition.`;

    let signatureBlock = "";
    if (doc.type === "Return") {
      const empSig = doc.signatureBase64
        ? `<img src="${doc.signatureBase64}" class="signature-img" />`
        : '<div style="height:60px; color:#ccc; line-height:60px;">Pending Signature</div>';
      const itSig = doc.itSignatureBase64
        ? `<img src="${doc.itSignatureBase64}" class="signature-img" />`
        : '<div style="height:60px; color:#ccc; line-height:60px;">Awaiting IT Verification</div>';
      signatureBlock = `
            <div class="sig-section">
                <div class="sig-box">
                    ${empSig}
                    <div class="sig-label"><strong>Employee:</strong> ${doc.employeeName}</div>
                    <div class="timestamp">Date: ${dateStr}</div>
                </div>
                <div class="sig-box">
                    ${itSig}
                    <div class="sig-label"><strong>Verified By:</strong> IT Department</div>
                    <div class="timestamp">Date: ${dateStr}</div>
                </div>
            </div>
          `;
    } else {
      signatureBlock = `
            <div class="sig-section">
                <div class="sig-box">
                    <img src="${
                      doc.signatureBase64
                    }" class="signature-img" alt="Digital Signature" />
                    <div class="sig-label"><strong>Acknowledged by:</strong> ${
                      doc.employeeName
                    }</div>
                    <div class="timestamp">Digitally Signed: ${new Date(
                      doc.date
                    ).toLocaleString()}</div>
                </div>
            </div>
          `;
    }

    const isCompleted = doc.status === "Completed";
    const statusLabel = isCompleted ? "COMPLETED" : "PENDING IT VERIFICATION";
    const statusColor = isCompleted ? "#059669" : "#d97706";

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${docTitle} - ${doc.employeeName}</title>
            <style>
                @page { margin: 15mm; size: A4; }
                body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; padding: 0; color: #111; line-height: 1.4; font-size: 11pt; }
                
                .page-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 25px; border-bottom: 1px solid #ddd; margin-bottom: 40px; }
                .logo-container { flex: 1; }
                .eatx-logo { font-size: 48px; font-weight: 900; letter-spacing: -2px; line-height: 0.8; margin-bottom: 8px; color: #000; }
                .eatx-tagline { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: #333; text-transform: uppercase; }
                
                .company-info { flex: 1.2; text-align: right; font-size: 8.5pt; color: #444; line-height: 1.6; }
                .company-name { font-weight: 800; color: #000; margin-bottom: 3px; font-size: 10.5pt; }
                
                .doc-identity { margin-bottom: 35px; }
                .doc-title { font-size: 22pt; font-weight: 900; color: #000; margin-bottom: 12px; border-bottom: 4px solid #000; padding-bottom: 5px; display: inline-block; letter-spacing: -0.5px; }
                
                .meta-table { width: 100%; margin-bottom: 25px; font-size: 10.5pt; border-collapse: collapse; }
                .meta-table td { padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
                
                .declaration { margin-bottom: 35px; background: #f8fafc; padding: 25px; border-radius: 12px; border-left: 6px solid #000; font-style: italic; font-size: 10.5pt; color: #334155; }
                
                table.items-table { width: 100%; border-collapse: collapse; margin-bottom: 50px; border-radius: 8px; overflow: hidden; }
                table.items-table th { background: #f1f5f9; text-align: left; padding: 14px; border: 1px solid #e2e8f0; font-size: 9.5pt; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; }
                table.items-table td { padding: 14px; border: 1px solid #e2e8f0; font-size: 10.5pt; }
                
                .sig-section { display: flex; gap: 60px; margin-top: 60px; page-break-inside: avoid; }
                .sig-box { flex: 1; border-top: 2px solid #333; padding-top: 15px; }
                .signature-img { max-height: 60px; display: block; margin-bottom: 10px; filter: grayscale(1) contrast(1.2); }
                .sig-label { font-size: 9.5pt; font-weight: 700; color: #1e293b; }
                .timestamp { font-size: 8.5pt; color: #64748b; font-family: 'Courier New', Courier, monospace; margin-top: 4px; }

                .page-footer { position: fixed; bottom: 0; left: 0; right: 0; border-top: 1px solid #eee; padding-top: 10px; text-align: center; font-size: 8pt; color: #94a3b8; font-style: italic; }

                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="page-header">
                <div class="logo-container">
                    <div class="eatx-logo">eatx.</div>
                    <div class="eatx-tagline">Creating Concepts of the Future</div>
                </div>
                <div class="company-info">
                    <div class="company-name">EatX Facilities Management LLC</div>
                    Office No. 2005-06, Burj Al Salam Building No. 2735391504,<br>
                    Sheikh Zayed Road, Trade Centre First,<br>
                    Dubai, United Arab Emirates, 122500<br>
                    Tel: +971 4229 5775 • TRN: 100558980700003
                </div>
            </div>

            <div class="doc-identity">
                <div class="doc-title">${docTitle}</div>
                <table class="meta-table">
                    <tr>
                        <td width="160"><strong>Employee Name:</strong></td>
                        <td style="color: #000; font-weight: 600;">${
                          doc.employeeName
                        }</td>
                        <td width="100" align="right"><strong>Date:</strong></td>
                        <td width="140" align="right">${dateStr}</td>
                    </tr>
                    <tr>
                        <td><strong>Document ID:</strong></td>
                        <td style="font-family: monospace; font-size: 9pt;">${
                          doc.id
                        }</td>
                        <td align="right"><strong>Status:</strong></td>
                        <td align="right" style="font-weight: 800; color: ${statusColor};">${statusLabel}</td>
                    </tr>
                </table>
            </div>

            <div class="declaration">
                ${declaration}
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th width="45">#</th>
                        <th>Asset Name / Description</th>
                        <th width="200">Serial Number</th>
                    </tr>
                </thead>
                <tbody>
                    ${doc.assets
                      .map(
                        (a, i) => `
                        <tr>
                            <td align="center" style="color: #94a3b8;">${
                              i + 1
                            }</td>
                            <td style="font-weight: 600; color: #0f172a;">${
                              a.name
                            }</td>
                            <td style="font-family: monospace; font-size: 10pt; color: #334155;">${
                              a.serialNumber || "N/A"
                            }</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>

            <div class="footer-spacer" style="height: 100px;"></div>

            ${signatureBlock}

            <div class="page-footer">
                This document is generated through Eatx Asset Tracker
            </div>
            
            <script>
                window.onload = function() { 
                    setTimeout(() => { window.print(); }, 500);
                }
            </script>
        </body>
        </html>
      `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!canEdit) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        You do not have permission to manage staff assets.
      </div>
    );
  }

  const inputClass =
    "w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600 bg-white dark:bg-slate-950 text-slate-900 dark:text-white";

  return (
    <div className="space-y-6 relative">
      <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Staff & Audit
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Assign assets or offboard staff equipment.
          </p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start">
          <button
            onClick={() => setView("manage")}
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${
              view === "manage"
                ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <UserIcon size={16} /> Asset Management
          </button>
          <button
            onClick={() => setView("pending")}
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${
              view === "pending"
                ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <LinkIcon size={16} /> Pending Links
          </button>
          <button
            onClick={() => setView("documents")}
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${
              view === "documents"
                ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <FileText size={16} /> Signed Documents
          </button>
        </div>
      </header>

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 p-4 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2 border border-emerald-100 dark:border-emerald-900/30">
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      {view === "manage" ? (
        <>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit mb-4">
            <button
              onClick={() => {
                setMode("onboard");
                setSearchTerm("");
                setSelectedAssetIds(new Set());
                setSelectedEmployee(null);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                mode === "onboard"
                  ? "bg-slate-900 dark:bg-blue-600 text-white shadow"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Briefcase size={16} /> Assign Asset
            </button>
            <button
              onClick={() => {
                setMode("offboard");
                setSearchTerm("");
                setSelectedAssetIds(new Set());
                setSelectedEmployee(null);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                mode === "offboard"
                  ? "bg-slate-900 dark:bg-blue-600 text-white shadow"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Archive size={16} /> Offboard Asset
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-fit">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                {mode === "onboard" ? "1. Select Assets" : "1. Find Employee"}
              </h2>

              {mode === "offboard" && selectedEmployee ? (
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-6">
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">
                    Selected Employee
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <div className="bg-slate-200 dark:bg-slate-700 p-1.5 rounded-full">
                        <UserIcon size={16} />
                      </div>
                      {selectedEmployee}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedEmployee(null);
                        setSelectedAssetIds(new Set());
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative mb-6">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder={
                      mode === "onboard"
                        ? "Filter available assets..."
                        : "Search Employee Name..."
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />

                  {mode === "offboard" && searchTerm && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 shadow-sm custom-scrollbar">
                      {matchedEmployees.length > 0 ? (
                        matchedEmployees.map((emp) => (
                          <div
                            key={emp}
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setSearchTerm("");
                            }}
                            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2"
                          >
                            <UserIcon size={14} className="text-slate-400" />{" "}
                            {emp}
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-xs text-slate-400 text-center">
                          No matching employees found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                <h2 className="font-bold text-slate-800 dark:text-white mb-4">
                  2. Actions
                </h2>

                {mode === "onboard" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase">
                        Assign To (User Name)
                      </label>
                      <input
                        value={targetEmployee}
                        onChange={(e) => setTargetEmployee(e.target.value)}
                        placeholder="Enter Name..."
                        className={inputClass}
                      />
                    </div>
                    <button
                      onClick={() => handleGenerateLink("Handover")}
                      disabled={
                        selectedAssetIds.size === 0 ||
                        !targetEmployee ||
                        isProcessing
                      }
                      className="w-full bg-slate-900 dark:bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                      {isProcessing ? (
                        "Generating..."
                      ) : (
                        <>
                          Generate Sign Link <LinkIcon size={16} />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div
                      className={`transition-opacity ${
                        !selectedEmployee
                          ? "opacity-50 pointer-events-none"
                          : ""
                      }`}
                    >
                      <button
                        onClick={() => handleGenerateLink("Return")}
                        disabled={selectedAssetIds.size === 0 || isProcessing}
                        className="w-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 py-2 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 flex justify-center items-center gap-2 border border-slate-200 dark:border-slate-700"
                      >
                        {isProcessing ? (
                          "Generating..."
                        ) : (
                          <>
                            Generate Return Link <LinkIcon size={16} />
                          </>
                        )}
                      </button>

                      <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                        <span className="flex-shrink mx-2 text-slate-400 text-[10px] uppercase font-bold">
                          OR Direct Sign
                        </span>
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                      </div>

                      <button
                        onClick={handleReturnClick}
                        disabled={selectedAssetIds.size === 0 || isProcessing}
                        className="w-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 flex justify-center items-center gap-2 border border-slate-200 dark:border-slate-700"
                      >
                        <Archive size={16} /> Sign & Return Now
                      </button>

                      <div>
                        <input
                          value={targetEmployee}
                          onChange={(e) => setTargetEmployee(e.target.value)}
                          placeholder="Transfer to..."
                          className={`mt-4 mb-2 text-sm ${inputClass}`}
                        />
                        <button
                          onClick={handleTransferClick}
                          disabled={
                            selectedAssetIds.size === 0 ||
                            !targetEmployee ||
                            isProcessing
                          }
                          className="w-full bg-slate-800 dark:bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-slate-900 dark:hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                          Sign & Transfer <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div className="font-semibold text-slate-700 dark:text-slate-200">
                  {mode === "onboard"
                    ? "Assets in Storage (Ready to Assign)"
                    : selectedEmployee
                    ? `Assets assigned to ${selectedEmployee}`
                    : "Select an employee to view assets"}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedAssetIds.size} selected
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[600px] p-0 bg-white dark:bg-slate-900">
                {filteredAssets.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                    {mode === "onboard" ? (
                      "No assets available in storage."
                    ) : selectedEmployee ? (
                      "No assets assigned to this user."
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Search size={32} className="opacity-20" />
                        <span>Search and select an employee on the left.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                      <tr className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                        <th className="p-4 w-10">
                          <input
                            type="checkbox"
                            onChange={selectAll}
                            checked={
                              filteredAssets.length > 0 &&
                              selectedAssetIds.size === filteredAssets.length
                            }
                            className="rounded border-slate-300 dark:border-slate-600 text-slate-900 dark:text-blue-600 bg-white dark:bg-slate-950 focus:ring-slate-900 dark:focus:ring-blue-600"
                          />
                        </th>
                        <th className="p-4">Asset Name</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Status</th>
                        {mode === "onboard" && (
                          <th className="p-4">Location</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {filteredAssets.map((asset) => (
                        <tr
                          key={asset.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer ${
                            selectedAssetIds.has(asset.id)
                              ? "bg-slate-50 dark:bg-slate-800/50"
                              : ""
                          }`}
                          onClick={() => toggleSelection(asset.id)}
                        >
                          <td
                            className="p-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedAssetIds.has(asset.id)}
                              onChange={() => toggleSelection(asset.id)}
                              className="rounded border-slate-300 dark:border-slate-600 text-slate-900 dark:text-blue-600 bg-white dark:bg-slate-950 focus:ring-slate-900 dark:focus:ring-blue-600"
                            />
                          </td>
                          <td className="p-4 font-medium text-slate-800 dark:text-slate-200">
                            {asset.name}
                            <div className="text-xs text-slate-400">
                              {asset.serialNumber}
                            </div>
                          </td>
                          <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-2">
                              {asset.category.includes("Laptop") ? (
                                <Laptop size={14} />
                              ) : asset.category.includes("Phone") ? (
                                <Smartphone size={14} />
                              ) : (
                                <Monitor size={14} />
                              )}
                              {asset.category}
                            </div>
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                asset.status === "Active"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {asset.status}
                            </span>
                          </td>
                          {mode === "onboard" && (
                            <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                              {asset.location}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      ) : view === "pending" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingLinks.length > 0 ? (
            pendingLinks.map((link) => (
              <div
                key={link.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden hover:shadow-md transition-all"
              >
                <div className="p-4 border-b bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 flex justify-between items-start">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white">
                      {link.employeeName}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                      Pending {link.type || "Signature"}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePending(link.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Revoke Link"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="p-4">
                  <div className="space-y-1 mb-4">
                    <div className="text-xs text-slate-400 font-bold mb-1">
                      Items to {link.type === "Return" ? "Return" : "Assign"}:
                    </div>
                    {link.assetsSnapshot.map((a) => (
                      <div
                        key={a.id}
                        className="text-xs text-slate-600 dark:text-slate-400 flex justify-between"
                      >
                        <span className="truncate flex-1">{a.name}</span>
                        <span className="font-mono opacity-60 ml-2">
                          {a.serialNumber}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-50 dark:border-slate-800 pt-3 flex items-center justify-between text-[10px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock size={10} /> Sent{" "}
                      {new Date(link.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const isSandbox = getSandboxStatus();
                          const url = `${window.location.origin}/#/sign/${
                            link.id
                          }${isSandbox ? "?env=sandbox" : ""}`;
                          navigator.clipboard.writeText(url);
                          setSuccessMsg("Link copied to clipboard");
                          setTimeout(() => setSuccessMsg(""), 2000);
                        }}
                        className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                      >
                        <LinkIcon size={10} /> Copy URL
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
              <LinkIcon size={48} className="mx-auto mb-2 opacity-20" />
              No active pending sign links.
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.length > 0 ? (
            documents.map((doc) => {
              const isPendingReturn =
                doc.type === "Return" && doc.status !== "Completed";
              return (
                <div
                  key={doc.id}
                  className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-all ${
                    isPendingReturn
                      ? "border-amber-200 dark:border-amber-800"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div
                    className={`p-4 border-b flex justify-between items-start ${
                      isPendingReturn
                        ? "bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">
                        {doc.employeeName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(doc.date).toLocaleDateString()} at{" "}
                        {new Date(doc.date).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-xs px-2 py-1 rounded-md font-medium ${
                          doc.type === "Return"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}
                      >
                        {doc.type}
                      </span>
                      {isPendingReturn && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 animate-pulse bg-amber-50 dark:bg-amber-900/30 px-1.5 rounded border border-amber-200 dark:border-amber-800">
                          Action Required
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-xs text-slate-400 uppercase font-bold mb-2">
                      Assets{" "}
                      {doc.type === "Return" ? "Returned" : "Handed Over"}
                    </div>
                    <div className="space-y-1 mb-4">
                      {doc.assets.slice(0, 3).map((a) => (
                        <div
                          key={a.id}
                          className="text-sm text-slate-700 dark:text-slate-300 flex justify-between"
                        >
                          <span>{a.name}</span>
                          <span className="text-slate-400 text-xs font-mono">
                            {a.serialNumber}
                          </span>
                        </div>
                      ))}
                      {doc.assets.length > 3 && (
                        <div className="text-xs text-slate-400 italic">
                          +{doc.assets.length - 3} more items
                        </div>
                      )}
                    </div>
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-xs text-slate-400 mb-1">
                            Signed By
                          </div>
                          <div className="flex gap-2">
                            <div className="bg-white p-1 rounded border border-slate-100 dark:border-slate-800 w-fit">
                              {doc.signatureBase64 ? (
                                <img
                                  src={doc.signatureBase64}
                                  alt="Sig"
                                  className="h-6 opacity-90"
                                />
                              ) : (
                                <div className="h-6 w-12 flex items-center justify-center text-[10px] text-slate-300">
                                  ...
                                </div>
                              )}
                            </div>
                            {doc.type === "Return" && (
                              <>
                                <div
                                  className="bg-white p-1 rounded border border-slate-100 dark:border-slate-800 w-fit"
                                  title="IT Verified"
                                >
                                  {doc.itSignatureBase64 ? (
                                    <img
                                      src={doc.itSignatureBase64}
                                      alt="IT"
                                      className="h-6 opacity-90"
                                    />
                                  ) : (
                                    <div className="h-6 w-12 flex items-center justify-center text-[10px] text-slate-300 italic">
                                      IT
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePrintDocument(doc)}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 rounded-lg"
                          >
                            <Printer size={16} />
                          </button>
                          {isPendingReturn && (
                            <button
                              onClick={() => handleResumeSign(doc)}
                              className="px-3 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 shadow-sm flex items-center gap-1"
                            >
                              Sign (IT)
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-12 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
              <FileText size={48} className="mx-auto mb-2 opacity-20" />
              No signed documents found.
            </div>
          )}
        </div>
      )}

      {/* Signature Modal */}
      <HandoverModal
        isOpen={signModal.isOpen}
        employeeName={signModal.employeeName}
        currentItName={currentUser?.email?.split("@")[0] || "IT Staff"}
        assets={signModal.assetsSnapshot || signModal.assets}
        type={signModal.type}
        targetName={signModal.targetName}
        initialData={signModal.initialData}
        onConfirm={handleSignatureConfirm}
        onCancel={() => setSignModal((prev) => ({ ...prev, isOpen: false }))}
        isProcessing={isProcessing}
      />

      {/* Link Generated Modal */}
      {linkModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Sign Link Generated
              </h3>
              <button
                onClick={() => setLinkModal({ ...linkModal, open: false })}
              >
                <X size={20} className="text-slate-400 hover:text-slate-300" />
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              A digital form has been created for{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {linkModal.name}
              </span>
              . Send this link to the employee to collect their signature.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 break-all text-xs font-mono text-slate-600 dark:text-slate-300 mb-4 select-all">
              {linkModal.link}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(linkModal.link);
                  setSuccessMsg("Copied to clipboard");
                  setTimeout(() => setSuccessMsg(""), 2000);
                }}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
              >
                Copy Link
              </button>
              <a
                href={`mailto:?subject=Asset Handover Signature Required&body=Hello ${linkModal.name},%0D%0A%0D%0APlease review and sign the asset form at the following link:%0D%0A%0D%0A${linkModal.link}%0D%0A%0D%0AThank you.`}
                className="flex-1 py-2.5 bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2"
              >
                Send Email <Mail size={16} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffView;
