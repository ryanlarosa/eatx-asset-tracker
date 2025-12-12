import React, { useState, useEffect } from 'react';
import { Asset, AssetStats, AssetLog } from '../types';
import { getStats, getAppConfig, getRecentLogs } from '../services/storageService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import { DollarSign, Server, AlertTriangle, Box, Filter, Activity, TrendingUp, MapPin, Clock, ArrowUpRight } from 'lucide-react';

interface DashboardProps {
  stats: AssetStats;
  allAssets: Asset[];
}

const COLORS = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#000000'];
const DARK_COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#cbd5e1', '#94a3b8', '#64748b', '#475569'];
const STATUS_COLORS: Record<string, string> = {
    'Active': '#10b981', // Emerald
    'In Storage': '#64748b', // Slate
    'Under Repair': '#f59e0b', // Amber
    'Retired': '#ef4444', // Red
    'Lost/Stolen': '#000000' // Black
};

const StatCard: React.FC<{ title: string; value: string | number; subtext?: string; icon: React.ReactNode; color: string; textColor: string }> = ({ title, value, subtext, icon, color, textColor }) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-start justify-between transition-colors relative overflow-hidden group">
    <div className="relative z-10">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{value}</h3>
      {subtext && <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{subtext}</p>}
    </div>
    <div className={`p-3 rounded-xl ${color} ${textColor} relative z-10`}>
      {icon}
    </div>
    <div className={`absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity ${textColor} transform rotate-12 scale-150`}>
        {icon}
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ allAssets }) => {
  const [locationFilter, setLocationFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [recentLogs, setRecentLogs] = useState<AssetLog[]>([]);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      const config = await getAppConfig();
      setCategories(config.categories);
      setLocations(config.locations);
      
      const logs = await getRecentLogs(5);
      setRecentLogs(logs);
    };
    loadConfig();
    
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [allAssets]); // Reload logs when assets change (actions might have happened)

  const filteredAssets = allAssets.filter(a => {
      const matchLoc = locationFilter === 'All' || a.location === locationFilter;
      const matchCat = categoryFilter === 'All' || a.category === categoryFilter;
      return matchLoc && matchCat;
  });

  const displayStats = getStats(filteredAssets);
  
  // Calculate Status Breakdown
  const statusData = [
      { name: 'Active', value: filteredAssets.filter(a => a.status === 'Active').length, color: STATUS_COLORS['Active'] },
      { name: 'Storage', value: filteredAssets.filter(a => a.status === 'In Storage').length, color: STATUS_COLORS['In Storage'] },
      { name: 'Repair', value: filteredAssets.filter(a => a.status === 'Under Repair').length, color: STATUS_COLORS['Under Repair'] },
      { name: 'Retired', value: filteredAssets.filter(a => a.status === 'Retired' || a.status === 'Lost/Stolen').length, color: STATUS_COLORS['Retired'] },
  ].filter(d => d.value > 0);

  // Calculate Value by Location
  const valueByLocation = locations.map(loc => ({
      name: loc,
      value: filteredAssets.filter(a => a.location === loc).reduce((sum, a) => sum + (a.purchaseCost || 0), 0)
  })).sort((a, b) => b.value - a.value).slice(0, 6); // Top 6 locations

  // Top 5 Expensive Assets
  const topAssets = [...filteredAssets]
    .sort((a, b) => (b.purchaseCost || 0) - (a.purchaseCost || 0))
    .slice(0, 5);

  const utilizationRate = displayStats.totalAssets > 0 
    ? Math.round((displayStats.activeAssets / displayStats.totalAssets) * 100) 
    : 0;

  const chartColors = isDark ? DARK_COLORS : COLORS;

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Executive Dashboard</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Real-time overview of IT assets and fleet health.</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 flex gap-2 shadow-sm self-stretch md:self-auto">
            <select 
                value={locationFilter} 
                onChange={e => setLocationFilter(e.target.value)}
                className="flex-1 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600"
            >
                <option value="All">All Locations</option>
                {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select 
                value={categoryFilter} 
                onChange={e => setCategoryFilter(e.target.value)}
                className="flex-1 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600"
            >
                <option value="All">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Valuation" 
          value={`AED ${displayStats.totalValue.toLocaleString()}`} 
          subtext={`${displayStats.totalAssets} total assets tracked`}
          icon={<DollarSign size={24} />} 
          color="bg-slate-900 dark:bg-blue-600"
          textColor="text-white"
        />
        <StatCard 
          title="Utilization Rate" 
          value={`${utilizationRate}%`} 
          subtext={`${displayStats.activeAssets} active / ${displayStats.totalAssets} total`}
          icon={<Activity size={24} />} 
          color="bg-emerald-100 dark:bg-emerald-900/30"
          textColor="text-emerald-700 dark:text-emerald-400"
        />
        <StatCard 
          title="Maintenance Queue" 
          value={displayStats.repairAssets} 
          subtext={displayStats.repairAssets > 0 ? "Action required" : "All systems operational"}
          icon={<AlertTriangle size={24} />} 
          color={displayStats.repairAssets > 0 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-slate-100 dark:bg-slate-800"}
          textColor={displayStats.repairAssets > 0 ? "text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}
        />
        <StatCard 
          title="Stock Availability" 
          value={displayStats.totalAssets - displayStats.activeAssets - displayStats.repairAssets} 
          subtext="Available for deployment"
          icon={<Box size={24} />} 
          color="bg-indigo-100 dark:bg-indigo-900/30"
          textColor="text-indigo-700 dark:text-indigo-400"
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asset Status Doughnut */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Fleet Health</h3>
            <div className="flex-1 min-h-[250px]">
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
                            contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                            itemStyle={{ color: isDark ? '#f8fafc' : '#1e293b' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Cost by Category Pie */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Cost Distribution</h3>
            <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={displayStats.byCategory}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                        >
                            {displayStats.byCategory.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} strokeWidth={0} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                            itemStyle={{ color: isDark ? '#f8fafc' : '#1e293b' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="text-xs text-center text-slate-400 dark:text-slate-500 mt-2">Breakdown by Asset Category</div>
        </div>

        {/* Value by Location Bar */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Capital by Location</h3>
            <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={valueByLocation} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b'}} interval={0} />
                        <Tooltip 
                            cursor={{fill: 'transparent'}}
                            contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                            itemStyle={{ color: isDark ? '#f8fafc' : '#1e293b' }}
                            formatter={(value: number) => `AED ${value.toLocaleString()}`}
                        />
                        <Bar dataKey="value" fill={isDark ? '#3b82f6' : '#0f172a'} radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Logs */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Clock size={20}/> Recent System Activity</h3>
              <div className="space-y-4">
                  {recentLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                          <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                              log.action === 'Created' ? 'bg-emerald-500' : 
                              log.action === 'Ticket' ? 'bg-amber-500' : 
                              log.action === 'Retired' ? 'bg-red-500' : 'bg-blue-500'
                          }`}></div>
                          <div className="flex-1">
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{log.details}</p>
                              <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{log.action}</span>
                                  <span className="text-xs text-slate-400 dark:text-slate-500">• {new Date(log.timestamp).toLocaleString()}</span>
                                  <span className="text-xs text-slate-400 dark:text-slate-500">• by {log.performedBy}</span>
                              </div>
                          </div>
                      </div>
                  ))}
                  {recentLogs.length === 0 && <div className="text-slate-400 text-sm py-4">No recent activity logged.</div>}
              </div>
          </div>

          {/* Top Assets */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><TrendingUp size={20}/> Top High Value Assets</h3>
              <div className="space-y-3">
                  {topAssets.map((asset, i) => (
                      <div key={asset.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                          <div className="min-w-0 pr-2">
                              <div className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{asset.name}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1"><MapPin size={10}/> {asset.location}</div>
                          </div>
                          <div className="text-right whitespace-nowrap">
                              <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">AED {(asset.purchaseCost || 0).toLocaleString()}</div>
                              <div className="text-[10px] text-slate-400 uppercase">{asset.category}</div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;