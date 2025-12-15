
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, MonitorSmartphone, Sun, Moon, Bell, XCircle, CheckCircle, Info, User as UserIcon, ChevronDown, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { AppNotification, UserProfile } from '../types';
import { markNotificationRead, markAllNotificationsRead } from '../services/storageService';

const NotificationPanel = ({ notifications, onClose, onRead }: { notifications: AppNotification[], onClose: () => void, onRead: (id: string) => void }) => {
    const unread = notifications.filter(n => !n.read);
    const navigate = useNavigate();
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleClick = (n: AppNotification) => {
        onRead(n.id);
        if (n.link) navigate(n.link);
        onClose();
    };

    return (
        <div ref={panelRef} className="absolute top-12 right-0 w-80 md:w-96 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[500px] animate-in fade-in zoom-in-95 origin-top-right">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50 rounded-t-xl backdrop-blur-sm">
                <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    Notifications
                    {unread.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm">{unread.length}</span>}
                </div>
                {notifications.length > 0 && (
                    <button onClick={markAllNotificationsRead} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">Mark all read</button>
                )}
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {notifications.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center">
                        <Bell size={32} className="opacity-20 mb-3"/>
                        <p className="text-sm font-medium">No new notifications</p>
                        <p className="text-xs opacity-70 mt-1">You're all caught up!</p>
                    </div>
                ) : (
                    notifications.map(n => (
                        <div key={n.id} onClick={() => handleClick(n)} className={`p-3 rounded-xl cursor-pointer transition-all relative group ${n.read ? 'hover:bg-slate-50 dark:hover:bg-slate-800' : 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>
                            {!n.read && <div className="absolute right-3 top-4 w-2 h-2 bg-blue-500 rounded-full shadow-sm"></div>}
                            <div className="flex items-start gap-3 pr-4">
                                <div className={`mt-1 p-1.5 rounded-full shrink-0 ${n.type === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : n.type === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                    {n.type === 'error' ? <XCircle size={16}/> : n.type === 'success' ? <CheckCircle size={16}/> : <Info size={16}/>}
                                </div>
                                <div>
                                    <h4 className={`text-sm font-bold ${n.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>{n.title}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                                    <div className="text-[10px] text-slate-400 mt-2 font-medium">{new Date(n.timestamp).toLocaleString()}</div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const UserDropdown = ({ user, onLogout }: { user: UserProfile | null, onLogout: () => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 p-1 pr-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    {user?.email?.[0]?.toUpperCase() || <UserIcon size={14}/>}
                </div>
                <div className="hidden md:block text-left">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none">{user?.displayName || 'User'}</div>
                    <div className="text-[10px] text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</div>
                </div>
                <ChevronDown size={14} className="text-slate-400 hidden md:block"/>
            </button>

            {isOpen && (
                <div className="absolute top-12 right-0 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 animate-in fade-in zoom-in-95 origin-top-right z-50">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 mb-2 md:hidden">
                        <div className="text-sm font-bold text-slate-800 dark:text-white truncate">{user?.email}</div>
                        <div className="text-xs text-slate-500 capitalize">{user?.role?.replace('_', ' ')}</div>
                    </div>
                    <div className="px-2">
                        <Link to="/settings" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <SettingsIcon size={16} /> Settings
                        </Link>
                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                        <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors">
                            <LogOut size={16} /> Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const TopBar = ({ onToggleSidebar, isDarkMode, toggleTheme, user, notifications, onLogout }: any) => {
    const [showNotif, setShowNotif] = useState(false);
    const unreadCount = notifications.filter((n: AppNotification) => !n.read).length;

    return (
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
            <div className="flex items-center gap-4">
                <button onClick={onToggleSidebar} className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                    <Menu size={24} />
                </button>
                <div className="md:hidden flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <div className="bg-slate-900 dark:bg-blue-600 text-white p-1 rounded-md"><MonitorSmartphone size={18} /></div>
                    <span>EatX IT</span>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <button onClick={toggleTheme} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <div className="relative">
                    <button onClick={() => setShowNotif(!showNotif)} className={`p-2 rounded-full transition-colors relative ${showNotif ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <Bell size={20} />
                        {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>}
                    </button>
                    {showNotif && <NotificationPanel notifications={notifications} onClose={() => setShowNotif(false)} onRead={markNotificationRead} />}
                </div>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
                <UserDropdown user={user} onLogout={onLogout} />
            </div>
        </header>
    );
};

export default TopBar;
