
import React, { useState, useEffect } from 'react';
import { Project, ProjectItem } from '../types';
import { getProjects, saveProject, deleteProject, getAppConfig } from '../services/storageService';
import { PlusCircle, Calendar, CheckSquare, Trash2, ChevronRight, ChevronDown, ShoppingBag, Clock, CheckCircle, Edit2, Save, X } from 'lucide-react';

const Planner: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  
  // New Project Form State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDate, setNewProjectDate] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  // Categories from config
  const [categories, setCategories] = useState<string[]>([]);

  // New Item Form State
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<string>('');
  const [newItemCost, setNewItemCost] = useState(0);
  const [newItemDate, setNewItemDate] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Edit Item State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemData, setEditItemData] = useState<Partial<ProjectItem>>({});

  useEffect(() => {
    loadProjects();
    const loadConfig = async () => {
       const config = await getAppConfig();
       setCategories(config.categories);
       if (config.categories.length > 0) {
         setNewItemCategory(config.categories[0]);
       }
    }
    loadConfig();
  }, []);

  const loadProjects = async () => {
    setProjects(await getProjects());
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
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
    setNewProjectDate('');
    setNewProjectDesc('');
    setExpandedProject(newProject.id);
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project plan?')) {
      await deleteProject(id);
      await loadProjects();
      if (expandedProject === id) setExpandedProject(null);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) return;
    
    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;

    // Use selected category or fallback to first available or 'Other'
    const categoryToUse = newItemCategory || (categories.length > 0 ? categories[0] : 'Other');

    const newItem: ProjectItem = {
      id: 'itm-' + Math.random().toString(36).substr(2, 9),
      name: newItemName,
      category: categoryToUse,
      estimatedCost: newItemCost,
      status: 'Pending',
      dueDate: newItemDate
    };

    const updatedProject = {
      ...project,
      items: [...project.items, newItem]
    };

    await saveProject(updatedProject);
    await loadProjects();
    
    // Reset item form
    setNewItemName('');
    setNewItemCost(0);
  };

  const updateItemStatus = async (projectId: string, itemId: string, status: 'Pending' | 'Ordered' | 'Received') => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedItems = project.items.map(item => 
      item.id === itemId ? { ...item, status } : item
    );

    const updatedProject = { ...project, items: updatedItems };
    
    // Auto-update project status if all complete
    const allReceived = updatedItems.every(i => i.status === 'Received');
    if (allReceived && updatedProject.status !== 'Completed') {
        updatedProject.status = 'Completed';
    }

    await saveProject(updatedProject);
    await loadProjects();
  };

  // --- Inline Edit Handlers ---

  const handleStartEdit = (item: ProjectItem) => {
    setEditingItemId(item.id);
    setEditItemData({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditItemData({});
  };

  const handleSaveEdit = async (projectId: string) => {
    if (!editingItemId) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedItems = project.items.map(item => {
        if (item.id === editingItemId) {
            return { ...item, ...editItemData } as ProjectItem;
        }
        return item;
    });

    const updatedProject = { ...project, items: updatedItems };
    await saveProject(updatedProject);
    await loadProjects();
    handleCancelEdit();
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
           <h1 className="text-2xl font-bold text-slate-800">Shop Opening Planner</h1>
           <p className="text-slate-500 text-sm mt-1">Plan purchases and requirements for new locations.</p>
        </div>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-black flex items-center gap-2 text-sm font-medium"
        >
          <PlusCircle size={18} /> New Project
        </button>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 animate-fade-in">
          <h3 className="font-semibold text-slate-800 mb-4">Create New Project Plan</h3>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                required
                placeholder="Project Name (e.g. Dubai Mall Branch)" 
                className="p-2 border border-slate-300 rounded-lg w-full focus:ring-2 focus:ring-slate-900"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
              />
              <input 
                required
                type="date"
                className="p-2 border border-slate-300 rounded-lg w-full focus:ring-2 focus:ring-slate-900"
                value={newProjectDate}
                onChange={e => setNewProjectDate(e.target.value)}
              />
            </div>
            <textarea 
              placeholder="Description or notes..." 
              className="p-2 border border-slate-300 rounded-lg w-full focus:ring-2 focus:ring-slate-900"
              rows={2}
              value={newProjectDesc}
              onChange={e => setNewProjectDesc(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsCreating(false)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button type="submit" className="px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-black">Create Plan</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-6">
        {projects.map(project => (
          <div key={project.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div 
              className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${project.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-900'}`}>
                  {project.status === 'Completed' ? <CheckSquare size={20} /> : <ShoppingBag size={20} />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{project.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Calendar size={14} /> Target: {project.targetDate}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${project.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {project.status}
                    </span>
                    <span>{project.items.length} Items</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={(e) => handleDeleteProject(project.id, e)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                {expandedProject === project.id ? <ChevronDown size={20} className="text-slate-400"/> : <ChevronRight size={20} className="text-slate-400"/>}
              </div>
            </div>

            {expandedProject === project.id && (
              <div className="border-t border-slate-100 bg-slate-50/30 p-5">
                <div className="mb-4">
                  <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wide mb-3">Required Assets Checklist</h4>
                  
                  {project.items.length === 0 ? (
                    <p className="text-slate-500 text-sm italic mb-4">No items added yet.</p>
                  ) : (
                    <div className="space-y-3 mb-6">
                      {project.items.map(item => (
                        <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
                          
                          {/* Inline Edit Mode */}
                          {editingItemId === item.id ? (
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 items-center w-full">
                                <input 
                                    className="md:col-span-4 p-1.5 text-sm border rounded focus:ring-1 focus:ring-slate-900" 
                                    value={editItemData.name} 
                                    onChange={e => setEditItemData({...editItemData, name: e.target.value})}
                                />
                                <select 
                                    className="md:col-span-3 p-1.5 text-sm border rounded focus:ring-1 focus:ring-slate-900"
                                    value={editItemData.category}
                                    onChange={e => setEditItemData({...editItemData, category: e.target.value})}
                                >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <div className="md:col-span-2 flex items-center">
                                    <span className="text-xs text-slate-400 mr-1">AED</span>
                                    <input 
                                        type="number"
                                        className="w-full p-1.5 text-sm border rounded focus:ring-1 focus:ring-slate-900" 
                                        value={editItemData.estimatedCost} 
                                        onChange={e => setEditItemData({...editItemData, estimatedCost: parseFloat(e.target.value)})}
                                    />
                                </div>
                                <input 
                                    type="date"
                                    className="md:col-span-2 p-1.5 text-sm border rounded focus:ring-1 focus:ring-slate-900" 
                                    value={editItemData.dueDate} 
                                    onChange={e => setEditItemData({...editItemData, dueDate: e.target.value})}
                                />
                                <div className="md:col-span-1 flex gap-1 justify-end">
                                    <button onClick={() => handleSaveEdit(project.id)} className="p-1.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"><Save size={14}/></button>
                                    <button onClick={handleCancelEdit} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><X size={14}/></button>
                                </div>
                            </div>
                          ) : (
                          // View Mode
                            <>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-800">{item.name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(item.status)}`}>{item.status}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                                    <span>{item.category}</span>
                                    <span className="flex items-center gap-1"><Clock size={12}/> Due: {item.dueDate}</span>
                                    <span className="font-medium text-slate-600">Est: AED {item.estimatedCost.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    {/* Status Actions */}
                                    <div className="flex gap-1 mr-2 border-r border-slate-200 pr-2">
                                        {item.status !== 'Pending' && (
                                            <button onClick={() => updateItemStatus(project.id, item.id, 'Pending')} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded">Pending</button>
                                        )}
                                        {item.status !== 'Ordered' && (
                                            <button onClick={() => updateItemStatus(project.id, item.id, 'Ordered')} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded">Ordered</button>
                                        )}
                                        {item.status !== 'Received' && (
                                            <button onClick={() => updateItemStatus(project.id, item.id, 'Received')} className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded flex items-center gap-1"><CheckCircle size={12}/> Received</button>
                                        )}
                                    </div>
                                    {/* Edit Button */}
                                    <button 
                                        onClick={() => handleStartEdit(item)}
                                        className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Item Form inline */}
                  <div className="bg-slate-100 p-4 rounded-lg border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Add New Requirement</p>
                    <form 
                      onSubmit={(e) => { setActiveProjectId(project.id); handleAddItem(e); }} 
                      className="grid grid-cols-1 md:grid-cols-12 gap-2"
                    >
                      <input 
                        required 
                        placeholder="Item Name" 
                        className="md:col-span-4 p-2 text-sm rounded border border-slate-300"
                        value={activeProjectId === project.id ? newItemName : ''}
                        onChange={e => { setActiveProjectId(project.id); setNewItemName(e.target.value); }}
                      />
                      <select 
                        className="md:col-span-3 p-2 text-sm rounded border border-slate-300"
                        value={activeProjectId === project.id ? newItemCategory : (categories[0] || '')}
                        onChange={e => { setActiveProjectId(project.id); setNewItemCategory(e.target.value); }}
                      >
                         {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input 
                        type="number" 
                        placeholder="Est. AED" 
                        className="md:col-span-2 p-2 text-sm rounded border border-slate-300"
                        value={activeProjectId === project.id ? (newItemCost || '') : ''}
                        onChange={e => { setActiveProjectId(project.id); setNewItemCost(parseFloat(e.target.value)); }}
                      />
                      <input 
                        required
                        type="date" 
                        className="md:col-span-2 p-2 text-sm rounded border border-slate-300"
                        value={activeProjectId === project.id ? newItemDate : ''}
                        onChange={e => { setActiveProjectId(project.id); setNewItemDate(e.target.value); }}
                      />
                      <button type="submit" className="md:col-span-1 bg-slate-800 text-white rounded hover:bg-slate-900 flex items-center justify-center">
                        <PlusCircle size={18} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {projects.length === 0 && (
          <div className="text-center p-12 bg-white rounded-xl border border-slate-200 border-dashed">
            <ShoppingBag className="mx-auto text-slate-300 mb-3" size={48} />
            <h3 className="text-lg font-medium text-slate-700">No active projects</h3>
            <p className="text-slate-500 mb-4">Create a new project to start tracking opening requirements.</p>
            <button onClick={() => setIsCreating(true)} className="text-indigo-600 font-medium hover:underline">Create First Project</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Planner;
