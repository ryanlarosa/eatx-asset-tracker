
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MonitorSmartphone, Database, Shield, LayoutDashboard, List, ShoppingBag, Wrench, Receipt, CalendarCheck, Users, Settings as SettingsIcon, X } from 'lucide-react';
import { getSandboxStatus, getCurrentUserProfile } from '../services/storageService';

interface SidebarProps {
  notificationCount: number;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ notificationCount, isOpen, onClose }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const user = getCurrentUserProfile();
  const canEdit = user?.role === 'admin' || user?.role === 'technician';
  const isSandbox = getSandboxStatus();
  
  const linkClass = (path: string) => `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium text-sm my-1 ${isActive(path) ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 dark:bg-blue-600 dark:text-white dark:shadow-blue-900/30' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`;

  return (
    <>
      {isOpen && (
        <div 
            className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
            onClick={onClose}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 
        transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
      `}>
        <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 text-slate-900 dark:text-white font-bold text-xl tracking-tight">
            <div className="bg-slate-900 dark:bg-blue-600 text-white p-1.5 rounded-lg shadow-sm">
                <MonitorSmartphone size={20} />
            </div>
            <span>EatX IT</span>
          </div>
          <button onClick={onClose} className="md:hidden ml-auto text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Environment</p>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                        {isSandbox ? <Database size={14} className="text-amber-500"/> : <Shield size={14} className="text-emerald-500"/>}
                        {isSandbox ? 'Sandbox Mode' : 'Live System'}
                    </div>
                    {isSandbox && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>}
                </div>
            </div>
        </div>

        <nav className="flex-1 px-4 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2 mt-2">Menu</div>
          
          <Link to="/" className={linkClass('/')} onClick={onClose}><LayoutDashboard size={18} /> Dashboard</Link>
          <Link to="/assets" className={linkClass('/assets')} onClick={onClose}><List size={18} /> Asset Registry</Link>
          <Link to="/requests" className={linkClass('/requests')} onClick={onClose}><ShoppingBag size={18} /> Requests</Link>
          <Link to="/repairs" className={linkClass('/repairs')} onClick={onClose}><Wrench size={18} /> Repairs</Link>
          <Link to="/invoices" className={linkClass('/invoices')} onClick={onClose}><Receipt size={18} /> Invoices</Link>
          
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2 mt-6">Management</div>
          
          <Link to="/planner" className={linkClass('/planner')} onClick={onClose}>
             <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3"><CalendarCheck size={18} /> Planner</div>
              {notificationCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">{notificationCount}</span>}
             </div>
          </Link>
          
          {canEdit && <Link to="/staff" className={linkClass('/staff')} onClick={onClose}><Users size={18} /> Staff & Audit</Link>}
          <Link to="/settings" className={linkClass('/settings')} onClick={onClose}><SettingsIcon size={18} /> Settings</Link>
        </nav>
        
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[10px] text-slate-400">v1.3.1 • EatX Internal Tool</p>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
