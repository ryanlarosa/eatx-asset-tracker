
import React, { useEffect, useState } from 'react';
import { Asset, AssetStats, IncidentReport, AssetRequest, Task } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DollarSign, Box, Activity, Wrench, LifeBuoy, FileInput, CheckSquare, Users } from 'lucide-react';
import { listenToIncidents, listenToRequests, listenToTasks, getAllUsers } from '../services/storageService';

interface DashboardProps {
  stats: AssetStats;
  allAssets: Asset[];
}

const Dashboard: React.FC<DashboardProps> = ({ stats, allAssets }) => {
  const [tickets, setTickets] = useState<IncidentReport[]>([]);
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    const unsub1 = listenToIncidents(setTickets);
    const unsub2 = listenToRequests(setRequests);
    const unsub3 = listenToTasks(setTasks);
    getAllUsers().then(u => setUserCount(u.length));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const openTickets = tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Rejected').length;
  const criticalTickets = tickets.filter(t => (t.status !== 'Resolved' && t.status !== 'Rejected') && t.priority === 'Critical').length;
  const pendingRequests = requests.filter(r => ['New', 'Acknowledged', 'Pending Finance', 'Approved'].includes(r.status)).length;
  const pendingTasks = tasks.filter(t => t.status !== 'Completed').length;

  // Data prep for charts
  const statusData = [
    { name: 'Active', value: stats.activeAssets, color: '#10b981' }, // emerald-500
    { name: 'In Storage', value: stats.totalAssets - stats.activeAssets - stats.repairAssets, color: '#64748b' }, // slate-500
    { name: 'Repair', value: stats.repairAssets, color: '#f59e0b' }, // amber-500
  ].filter(d => d.value > 0);

  // Group by location for value chart
  const locationMap = new Map<string, number>();
  allAssets.forEach(a => {
      const val = a.purchaseCost || 0;
      locationMap.set(a.location, (locationMap.get(a.location) || 0) + val);
  });
  const valueByLocation = Array.from(locationMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Safe check for category data
  const categoryData = stats.byCategory && stats.byCategory.length > 0 ? stats.byCategory : [{ name: 'No Data', value: 1 }];
  
  const chartColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

  // Helper component for Stat Cards
  const StatCard = ({ title, value, icon: Icon, colorClass, subtext, alert }: any) => (
    <div className={`bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border ${alert ? 'border-red-500 dark:border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-slate-800'} flex items-start justify-between relative overflow-hidden`}>
      {alert && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-bl-lg"></div>}
      <div>
        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{value}</h3>
        {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-lg ${colorClass}`}>
        <Icon size={24} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">IT Hub Overview</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">System status and operational metrics.</p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-slate-600 dark:text-slate-300">
            <Users size={16} className="text-blue-500"/>
            <span className="font-bold">{userCount}</span> Users
        </div>
      </div>
      
      {/* Operational Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            title="Help Desk Tickets" 
            value={openTickets} 
            icon={LifeBuoy} 
            colorClass="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
            subtext={criticalTickets > 0 ? `${criticalTickets} Critical` : "Open Issues"}
            alert={criticalTickets > 0}
        />
        <StatCard 
            title="Pending Requests" 
            value={pendingRequests} 
            icon={FileInput} 
            colorClass="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
            subtext="Procurement & Deploy"
        />
        <StatCard 
            title="Active Tasks" 
            value={pendingTasks} 
            icon={CheckSquare} 
            colorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            subtext="To Do & In Progress"
        />
        <StatCard 
            title="Total Assets" 
            value={stats.totalAssets} 
            icon={Box} 
            colorClass="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            subtext={`AED ${stats.totalValue.toLocaleString()}`}
        />
      </div>

      {/* Asset Health Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 p-5 rounded-xl flex items-center gap-4">
             <div className="bg-white dark:bg-emerald-900/30 p-3 rounded-full text-emerald-600 dark:text-emerald-400 shadow-sm"><Activity size={24}/></div>
             <div>
                 <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">{stats.activeAssets}</div>
                 <div className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-500">Active Fleet</div>
             </div>
         </div>
         <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-5 rounded-xl flex items-center gap-4">
             <div className="bg-white dark:bg-amber-900/30 p-3 rounded-full text-amber-600 dark:text-amber-400 shadow-sm"><Wrench size={24}/></div>
             <div>
                 <div className="text-2xl font-bold text-amber-900 dark:text-amber-300">{stats.repairAssets}</div>
                 <div className="text-xs font-bold uppercase text-amber-700 dark:text-amber-500">In Repair</div>
             </div>
         </div>
         <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-5 rounded-xl flex items-center gap-4">
             <div className="bg-white dark:bg-indigo-900/30 p-3 rounded-full text-indigo-600 dark:text-indigo-400 shadow-sm"><DollarSign size={24}/></div>
             <div>
                 <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-300">{(stats.activeAssets / (stats.totalAssets || 1) * 100).toFixed(0)}%</div>
                 <div className="text-xs font-bold uppercase text-indigo-700 dark:text-indigo-500">Utilization Rate</div>
             </div>
         </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Asset Status Doughnut */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col min-w-0">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Fleet Status</h3>
            <div className="h-64 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#f8fafc', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                            itemStyle={{ color: '#f8fafc' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Cost by Category Pie */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col min-w-0">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Cost Distribution</h3>
            <div className="h-64 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                        >
                            {categoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} strokeWidth={0} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#f8fafc', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                            itemStyle={{ color: '#f8fafc' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="text-xs text-center text-slate-400 dark:text-slate-500 mt-2">Breakdown by Category</div>
        </div>

        {/* Value by Location Bar */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col min-w-0">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Capital by Location</h3>
            <div className="h-64 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={valueByLocation} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={80} 
                            tick={{fontSize: 11, fill: '#94a3b8'}} 
                            interval={0} 
                        />
                        <Tooltip 
                            cursor={{fill: 'transparent'}}
                            contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#f8fafc', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                            itemStyle={{ color: '#f8fafc' }}
                            formatter={(value: number) => `AED ${value.toLocaleString()}`}
                        />
                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
