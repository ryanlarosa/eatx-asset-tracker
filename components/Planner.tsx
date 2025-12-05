
import React, { useState, useEffect } from 'react';
import { Project, ProjectItem } from '../types';
import { getProjects, saveProject, deleteProject, getAppConfig, getCurrentUserProfile } from '../services/storageService';
import { PlusCircle, Calendar, CheckSquare, Trash2, ChevronRight, ChevronDown, ShoppingBag, Lock } from 'lucide-react';

const Planner: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Forms
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDate, setNewProjectDate] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemCost, setNewItemCost] = useState(0);
  const [newItemDate, setNewItemDate] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Roles
  const user = getCurrentUserProfile();
  const canEdit = user?.role === 'admin' || user?.role === 'technician';
  const canDelete = user?.role === 'admin';

  useEffect(() => {
    loadProjects();
    const loadConfig = async () => {
       const config = await getAppConfig();
       setCategories(config.categories);
       if (config.categories.length > 0) setNewItemCategory(config.categories[0]);
    }
    loadConfig();
  }, []);

  const loadProjects = async () => setProjects(await getProjects());

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
    await loadProjects();
    setIsCreating(false);
    setNewProjectName('');
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !activeProjectId) return;
    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;

    const newItem: ProjectItem = {
      id: 'itm-' + Math.random().toString(36).substr(2, 9),
      name: newItemName,
      category: newItemCategory || 'Other',
      estimatedCost: newItemCost,
      status: 'Pending',
      dueDate: newItemDate
    };
    await saveProject({ ...project, items: [...project.items, newItem] });
    await loadProjects();
    setNewItemName('');
    setNewItemCost(0);
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
    await loadProjects();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-700';
      case 'Ordered': return 'bg-blue-100 text-blue-700';
      case 'Received': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">Planner</h1>
           <p className="text-slate-500 text-sm mt-1">Shop openings and requirements.</p>
        </div>
        {canEdit && (
            <button onClick={() => setIsCreating(!isCreating)} className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-black flex items-center gap-2 text-sm font-medium">
            <PlusCircle size={18} /> New Project
            </button>
        )}
      </div>

      {isCreating && canEdit && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
          <h3 className="font-semibold text-slate-800 mb-4">Create Project</h3>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required placeholder="Project Name" className="p-2 border border-slate-300 rounded-lg w-full" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} />
              <input required type="date" className="p-2 border border-slate-300 rounded-lg w-full" value={newProjectDate} onChange={e => setNewProjectDate(e.target.value)} />
            </div>
            <textarea placeholder="Description..." className="p-2 border border-slate-300 rounded-lg w-full" rows={2} value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsCreating(false)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button type="submit" className="px-3 py-1.5 bg-slate-900 text-white rounded-lg">Create</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-6">
        {projects.map(project => (
          <div key={project.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50" onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}>
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${project.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-900'}`}>{project.status === 'Completed' ? <CheckSquare size={20} /> : <ShoppingBag size={20} />}</div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{project.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Calendar size={14} /> {project.targetDate}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100">{project.items.length} Items</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {canDelete && <button onClick={(e) => { e.stopPropagation(); deleteProject(project.id).then(loadProjects); }} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={18} /></button>}
                {expandedProject === project.id ? <ChevronDown size={20} className="text-slate-400"/> : <ChevronRight size={20} className="text-slate-400"/>}
              </div>
            </div>

            {expandedProject === project.id && (
              <div className="border-t border-slate-100 bg-slate-50/30 p-5">
                <div className="space-y-3 mb-6">
                    {project.items.map(item => (
                    <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
                        <div className="flex-1">
                            <div className="flex items-center gap-2"><span className="font-medium text-slate-800">{item.name}</span><span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(item.status)}`}>{item.status}</span></div>
                            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1"><span>{item.category}</span><span className="font-medium">AED {item.estimatedCost}</span></div>
                        </div>
                        {canEdit && (
                            <div className="flex gap-1 border-l pl-3 border-slate-100">
                                <button onClick={() => updateItemStatus(project.id, item.id, 'Ordered')} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">Ord</button>
                                <button onClick={() => updateItemStatus(project.id, item.id, 'Received')} className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded">Rec</button>
                            </div>
                        )}
                    </div>
                    ))}
                </div>
                
                {canEdit ? (
                    <div className="bg-slate-100 p-4 rounded-lg border border-slate-200">
                        <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Add Item</p>
                        <form onSubmit={(e) => { setActiveProjectId(project.id); handleAddItem(e); }} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                            <input required placeholder="Item Name" className="md:col-span-4 p-2 text-sm rounded border" value={activeProjectId === project.id ? newItemName : ''} onChange={e => { setActiveProjectId(project.id); setNewItemName(e.target.value); }} />
                            <select className="md:col-span-3 p-2 text-sm rounded border" value={activeProjectId === project.id ? newItemCategory : categories[0]} onChange={e => { setActiveProjectId(project.id); setNewItemCategory(e.target.value); }}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                            <input type="number" placeholder="Cost" className="md:col-span-2 p-2 text-sm rounded border" value={activeProjectId === project.id ? (newItemCost || '') : ''} onChange={e => { setActiveProjectId(project.id); setNewItemCost(parseFloat(e.target.value)); }} />
                            <input required type="date" className="md:col-span-2 p-2 text-sm rounded border" value={activeProjectId === project.id ? newItemDate : ''} onChange={e => { setActiveProjectId(project.id); setNewItemDate(e.target.value); }} />
                            <button type="submit" className="md:col-span-1 bg-slate-800 text-white rounded hover:bg-slate-900 flex items-center justify-center"><PlusCircle size={18} /></button>
                        </form>
                    </div>
                ) : (
                    <div className="flex items-center justify-center p-4 text-slate-400 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                        <Lock size={16} className="mr-2" /> Editing Restricted
                    </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Planner;
