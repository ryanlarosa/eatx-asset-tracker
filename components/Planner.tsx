
import React, { useState, useEffect } from 'react';
import { Project, ProjectItem } from '../types';
import { listenToProjects, saveProject, deleteProject, getAppConfig, getCurrentUserProfile } from '../services/storageService';
import { PlusCircle, Calendar, CheckSquare, Trash2, ChevronRight, ChevronDown, ShoppingBag, Lock, Hash, Printer, Edit2, X, Save, DollarSign, AlertTriangle } from 'lucide-react';

const Planner: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Creation Forms
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDate, setNewProjectDate] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemCost, setNewItemCost] = useState(0);
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemDate, setNewItemDate] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Edit States
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingItem, setEditingItem] = useState<{ projectId: string, item: ProjectItem } | null>(null);

  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<{ projectId: string, itemId: string } | null>(null);

  // Roles
  const user = getCurrentUserProfile();
  const canEdit = user?.role === 'admin' || user?.role === 'technician';
  const canDelete = user?.role === 'admin';

  useEffect(() => {
    const unsub = listenToProjects((data) => setProjects(data));
    const loadConfig = async () => {
       const config = await getAppConfig();
       setCategories(config.categories);
       if (config.categories.length > 0) setNewItemCategory(config.categories[0]);
    }
    loadConfig();
    return () => unsub();
  }, []);

  // --- CRUD Operations ---

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const newProject: Project = {
      id: 'prj-' + Math.random().toString(36).substr(2, 9),
      name: newProjectName,
      description: newProjectDesc,
      targetDate: newProjectDate,
      status: 'Planning',
      items: []
    };
    await saveProject(newProject);
    setIsCreating(false);
    setNewProjectName('');
    setNewProjectDesc('');
    setNewProjectDate('');
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingProject) return;
      await saveProject(editingProject);
      setEditingProject(null);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !activeProjectId) return;
    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;

    const newItem: ProjectItem = {
      id: 'itm-' + Math.random().toString(36).substr(2, 9),
      name: newItemName,
      description: newItemDesc,
      category: newItemCategory || 'Other',
      estimatedCost: newItemCost,
      quantity: newItemQuantity,
      status: 'Pending',
      dueDate: newItemDate
    };
    await saveProject({ ...project, items: [...project.items, newItem] });
    setNewItemName('');
    setNewItemDesc('');
    setNewItemCost(0);
    setNewItemQuantity(1);
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingItem) return;
      
      const project = projects.find(p => p.id === editingItem.projectId);
      if (!project) return;

      const updatedItems = project.items.map(i => i.id === editingItem.item.id ? editingItem.item : i);
      await saveProject({ ...project, items: updatedItems });
      setEditingItem(null);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    const { projectId, itemId } = itemToDelete;
    
    const project = projects.find(p => p.id === projectId);
    if (project) {
        const updatedItems = project.items.filter(item => item.id !== itemId);
        await saveProject({ ...project, items: updatedItems });
    }
    setItemToDelete(null);
  };

  const updateItemStatus = async (projectId: string, itemId: string, status: 'Pending' | 'Ordered' | 'Received') => {
    if (!canEdit) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const updatedItems = project.items.map(item => item.id === itemId ? { ...item, status } : item);
    let updatedProject = { ...project, items: updatedItems };
    const allReceived = updatedItems.every(i => i.status === 'Received');
    if (allReceived && updatedProject.status !== 'Completed') updatedProject.status = 'Completed';
    await saveProject(updatedProject);
  };

  // --- Print Logic ---
  const handlePrintProject = (project: Project) => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const totalCost = project.items.reduce((sum, i) => sum + (i.estimatedCost * (i.quantity || 1)), 0);
      const totalItems = project.items.reduce((sum, i) => sum + (i.quantity || 1), 0);
      const dateStr = new Date().toLocaleDateString();

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Planner: ${project.name}</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 40px; max-width: 900px; margin: 0 auto; }
                .header { border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
                .title { font-size: 24px; font-weight: bold; margin: 0; }
                .subtitle { color: #64748b; margin-top: 5px; font-size: 14px; }
                .status-badge { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; uppercase; }
                
                .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; }
                .stat-box h4 { margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; color: #64748b; }
                .stat-box p { margin: 0; font-size: 18px; font-weight: bold; color: #0f172a; }

                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
                th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #e2e8f0; color: #64748b; text-transform: uppercase; font-size: 11px; }
                td { padding: 12px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
                tr:last-child td { border-bottom: none; }
                .text-right { text-align: right; }
                .font-mono { font-family: monospace; }
                .desc { font-size: 11px; color: #64748b; margin-top: 4px; font-style: italic; }
                
                .footer { margin-top: 50px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
                
                @media print {
                    body { padding: 0; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1 class="title">${project.name}</h1>
                    <div class="subtitle">Target Date: ${project.targetDate}</div>
                    <div class="subtitle" style="margin-top: 10px; font-style: italic;">${project.description || 'No description provided.'}</div>
                </div>
                <div class="status-badge">${project.status}</div>
            </div>

            <div class="summary-grid">
                <div class="stat-box">
                    <h4>Total Budget</h4>
                    <p>AED ${totalCost.toLocaleString()}</p>
                </div>
                <div class="stat-box">
                    <h4>Total Items</h4>
                    <p>${totalItems}</p>
                </div>
                 <div class="stat-box">
                    <h4>Items Count</h4>
                    <p>${project.items.length}</p>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th width="5%">#</th>
                        <th width="30%">Item Name</th>
                        <th width="15%">Category</th>
                        <th width="10%">Status</th>
                        <th width="10%" class="text-right">Qty</th>
                        <th width="15%" class="text-right">Unit Cost</th>
                        <th width="15%" class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${project.items.map((item, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>
                                <strong>${item.name}</strong>
                                ${item.description ? `<div class="desc">${item.description}</div>` : ''}
                                <div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">Due: ${item.dueDate || 'N/A'}</div>
                            </td>
                            <td>${item.category}</td>
                            <td>${item.status}</td>
                            <td class="text-right font-mono">${item.quantity || 1}</td>
                            <td class="text-right font-mono">${item.estimatedCost.toLocaleString()}</td>
                            <td class="text-right font-mono font-bold">${(item.estimatedCost * (item.quantity || 1)).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                    <tr>
                        <td colspan="6" class="text-right" style="padding-top: 20px; font-weight: bold; border-top: 2px solid #000; border-bottom: none;">GRAND TOTAL:</td>
                        <td class="text-right" style="padding-top: 20px; font-weight: bold; border-top: 2px solid #000; border-bottom: none;">AED ${totalCost.toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>

            <div class="footer">
                Generated from EatX IT Hub on ${dateStr}
            </div>

            <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>
      `;
      
      printWindow.document.write(html);
      printWindow.document.close();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Ordered': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Received': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      default: return 'bg-slate-100 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Planner</h1>
           <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Shop openings and requirements.</p>
        </div>
        {canEdit && (
            <button onClick={() => setIsCreating(!isCreating)} className="bg-slate-900 dark:bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-black dark:hover:bg-blue-700 flex items-center gap-2 text-sm font-medium shadow-sm transition-all">
            <PlusCircle size={18} /> New Project
            </button>
        )}
      </div>

      {isCreating && canEdit && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6 animate-in slide-in-from-top-2">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Create Project</h3>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required placeholder="Project Name" className="p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white rounded-lg w-full" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} />
              <input required type="date" className="p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white rounded-lg w-full" value={newProjectDate} onChange={e => setNewProjectDate(e.target.value)} />
            </div>
            <textarea placeholder="Description..." className="p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white rounded-lg w-full" rows={2} value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsCreating(false)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
              <button type="submit" className="px-3 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-black dark:hover:bg-blue-700">Create</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-6">
        {projects.map(project => (
          <div key={project.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}>
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${project.status === 'Completed' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-300'}`}>{project.status === 'Completed' ? <CheckSquare size={20} /> : <ShoppingBag size={20} />}</div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
                      {project.name}
                      <span className={`text-xs px-2 py-0.5 rounded border font-normal ${project.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>{project.status}</span>
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><Calendar size={14} /> {project.targetDate}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800">{project.items.length} Items</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">Total: AED {project.items.reduce((sum, i) => sum + (i.estimatedCost * (i.quantity || 1)), 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); handlePrintProject(project); }} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white" title="Print Plan"><Printer size={18} /></button>
                {canEdit && (
                    <button onClick={(e) => { e.stopPropagation(); setEditingProject(project); }} className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400" title="Edit Project Details"><Edit2 size={18} /></button>
                )}
                {canDelete && <button onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }} className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={18} /></button>}
                {expandedProject === project.id ? <ChevronDown size={20} className="text-slate-400 ml-2"/> : <ChevronRight size={20} className="text-slate-400 ml-2"/>}
              </div>
            </div>

            {expandedProject === project.id && (
              <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 p-5">
                <div className="space-y-3 mb-6">
                    {project.items.map(item => (
                    <div key={item.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm group">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-800 dark:text-white">{item.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(item.status)}`}>{item.status}</span>
                                {canEdit && (
                                    <button 
                                        onClick={() => setEditingItem({ projectId: project.id, item })} 
                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-opacity"
                                        title="Edit Item"
                                    >
                                        <Edit2 size={12}/>
                                    </button>
                                )}
                            </div>
                            {item.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.description}</p>}
                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                <span>{item.category}</span>
                                <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-1.5 rounded"><Hash size={10}/> Qty: {item.quantity || 1}</span>
                                <span>Unit: AED {item.estimatedCost.toLocaleString()}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">Total: AED {(item.estimatedCost * (item.quantity || 1)).toLocaleString()}</span>
                                <span className="flex items-center gap-1"><Calendar size={10}/> Due: {item.dueDate || 'N/A'}</span>
                            </div>
                        </div>
                        {canEdit && (
                            <div className="flex items-center gap-3 border-l pl-3 border-slate-100 dark:border-slate-700">
                                <div className="flex gap-1">
                                    {item.status !== 'Pending' && (
                                        <button onClick={() => updateItemStatus(project.id, item.id, 'Pending')} className="text-xs px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50">Pend</button>
                                    )}
                                    {item.status !== 'Ordered' && (
                                        <button onClick={() => updateItemStatus(project.id, item.id, 'Ordered')} className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50">Ord</button>
                                    )}
                                    {item.status !== 'Received' && (
                                        <button onClick={() => updateItemStatus(project.id, item.id, 'Received')} className="text-xs px-2 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50">Rec</button>
                                    )}
                                </div>
                                <button 
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setItemToDelete({ projectId: project.id, itemId: item.id }); }}
                                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                    title="Delete Item"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                    ))}
                    {project.items.length === 0 && <div className="text-center text-slate-400 dark:text-slate-500 text-sm py-4">No items added yet.</div>}
                </div>
                
                {canEdit ? (
                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Add New Item</p>
                        <form onSubmit={(e) => { setActiveProjectId(project.id); handleAddItem(e); }} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                            <input required placeholder="Item Name" className="md:col-span-3 p-2 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" value={activeProjectId === project.id ? newItemName : ''} onChange={e => { setActiveProjectId(project.id); setNewItemName(e.target.value); }} />
                            <select className="md:col-span-2 p-2 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" value={activeProjectId === project.id ? newItemCategory : categories[0]} onChange={e => { setActiveProjectId(project.id); setNewItemCategory(e.target.value); }}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                            
                            <input type="number" placeholder="Qty" min="1" className="md:col-span-1 p-2 text-sm rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-700 dark:text-white" value={activeProjectId === project.id ? newItemQuantity : 1} onChange={e => { setActiveProjectId(project.id); setNewItemQuantity(parseInt(e.target.value) || 1); }} />
                            
                            <input type="number" placeholder="Unit Cost" className="md:col-span-2 p-2 text-sm rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-700 dark:text-white" value={activeProjectId === project.id ? (newItemCost || '') : ''} onChange={e => { setActiveProjectId(project.id); setNewItemCost(parseFloat(e.target.value)); }} />
                            
                            <input required type="date" className="md:col-span-3 p-2 text-sm rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-700 dark:text-white" value={activeProjectId === project.id ? newItemDate : ''} onChange={e => { setActiveProjectId(project.id); setNewItemDate(e.target.value); }} />
                            
                            <input placeholder="Description (Optional)" className="md:col-span-11 p-2 text-sm rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-700 dark:text-white" value={activeProjectId === project.id ? newItemDesc : ''} onChange={e => { setActiveProjectId(project.id); setNewItemDesc(e.target.value); }} />

                            <button type="submit" className="md:col-span-1 bg-slate-800 dark:bg-blue-600 text-white rounded hover:bg-slate-900 dark:hover:bg-blue-700 flex items-center justify-center"><PlusCircle size={18} /></button>
                        </form>
                    </div>
                ) : (
                    <div className="flex items-center justify-center p-4 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 border-dashed">
                        <Lock size={16} className="mr-2" /> Editing Restricted
                    </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* EDIT PROJECT MODAL */}
      {editingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Project Details</h3>
                      <button onClick={() => setEditingProject(null)}><X size={20} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"/></button>
                  </div>
                  <form onSubmit={handleUpdateProject} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Project Name</label>
                          <input required className="w-full p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Target Date</label>
                            <input type="date" required className="w-full p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg" value={editingProject.targetDate} onChange={e => setEditingProject({...editingProject, targetDate: e.target.value})} />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                             <select className="w-full p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg" value={editingProject.status} onChange={e => setEditingProject({...editingProject, status: e.target.value as any})}>
                                 <option value="Planning">Planning</option>
                                 <option value="In Progress">In Progress</option>
                                 <option value="Completed">Completed</option>
                             </select>
                        </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Description</label>
                          <textarea className="w-full p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg" rows={3} value={editingProject.description} onChange={e => setEditingProject({...editingProject, description: e.target.value})} />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                          <button type="button" onClick={() => setEditingProject(null)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                          <button type="submit" className="px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-black dark:hover:bg-blue-700 flex items-center gap-2"><Save size={16}/> Save Changes</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* EDIT ITEM MODAL */}
      {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Item</h3>
                    <button onClick={() => setEditingItem(null)}><X size={20} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"/></button>
                </div>
                <form onSubmit={handleUpdateItem} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Item Name</label>
                        <input required className="w-full p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg" value={editingItem.item.name} onChange={e => setEditingItem({ ...editingItem, item: { ...editingItem.item, name: e.target.value } })} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Description</label>
                        <input className="w-full p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg" value={editingItem.item.description || ''} onChange={e => setEditingItem({ ...editingItem, item: { ...editingItem.item, description: e.target.value } })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Category</label>
                            <select className="w-full p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg" value={editingItem.item.category} onChange={e => setEditingItem({ ...editingItem, item: { ...editingItem.item, category: e.target.value } })}>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Due Date</label>
                            <input type="date" required className="w-full p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg" value={editingItem.item.dueDate} onChange={e => setEditingItem({ ...editingItem, item: { ...editingItem.item, dueDate: e.target.value } })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Quantity</label>
                            <input type="number" min="1" required className="w-full p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg" value={editingItem.item.quantity || 1} onChange={e => setEditingItem({ ...editingItem, item: { ...editingItem.item, quantity: parseInt(e.target.value) || 1 } })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Unit Cost</label>
                            <input type="number" min="0" step="0.01" className="w-full p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg" value={editingItem.item.estimatedCost} onChange={e => setEditingItem({ ...editingItem, item: { ...editingItem.item, estimatedCost: parseFloat(e.target.value) } })} />
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded text-sm text-right font-bold text-slate-700 dark:text-slate-300">
                        Total: AED {((editingItem.item.quantity || 1) * editingItem.item.estimatedCost).toLocaleString()}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-black dark:hover:bg-blue-700 flex items-center gap-2"><Save size={16}/> Update Item</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded-full text-red-600 dark:text-red-400"><AlertTriangle size={32} /></div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Delete Item?</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Are you sure you want to remove this item from the project?</p>
                    </div>
                    <div className="flex gap-3 w-full mt-4">
                        <button onClick={() => setItemToDelete(null)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                        <button onClick={confirmDeleteItem} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-red-900/30">Yes, Delete</button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default Planner;
