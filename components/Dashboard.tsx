import React, { useState, useEffect } from 'react';
import { Asset, AssetStats } from '../types';
import { getStats, getAppConfig } from '../services/storageService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DollarSign, Server, AlertTriangle, Box, Filter } from 'lucide-react';

interface DashboardProps {
  stats: AssetStats;
  allAssets: Asset[];
}

const COLORS = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#000000'];
const DARK_COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#cbd5e1', '#94a3b8', '#64748b', '#475569'];

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; textColor: string }> = ({ title, value, icon, color, textColor }) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors">
    <div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
    </div>
    <div className={`p-3 rounded-full ${color} ${textColor}`}>
      {icon}
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ allAssets }) => {
  const [locationFilter, setLocationFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      const config = await getAppConfig();
      setCategories(config.categories);
      setLocations(config.locations);
    };
    loadConfig();
    
    // Check dark mode
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    // Observer for class changes on html element
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const filteredAssets = allAssets.filter(a => {
      const matchLoc = locationFilter === 'All' || a.location === locationFilter;
      const matchCat = categoryFilter === 'All' || a.category === categoryFilter;
      return matchLoc && matchCat;
  });

  const displayStats = getStats(filteredAssets);

  // Dynamic Chart Colors
  const chartColors = isDark ? DARK_COLORS : COLORS;

  return (
    <div className="space-y-6">
      
      {/* Report Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center shadow-sm">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold mr-2">
            <Filter size={20} /> Report Filters:
        </div>
        <select 
            value={locationFilter} 
            onChange={e => setLocationFilter(e.target.value)}
            className="p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 rounded-lg text-sm min-w-[200px] focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600 outline-none"
        >
            <option value="All">All Locations</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
         <select 
            value={categoryFilter} 
            onChange={e => setCategoryFilter(e.target.value)}
            className="p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 rounded-lg text-sm min-w-[200px] focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-600 outline-none"
        >
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Asset Value" 
          value={`AED ${displayStats.totalValue.toLocaleString()}`} 
          icon={<DollarSign size={24} />} 
          color="bg-slate-900 dark:bg-blue-900/40"
          textColor="text-white dark:text-blue-200"
        />
        <StatCard 
          title="Total Devices" 
          value={displayStats.totalAssets} 
          icon={<Server size={24} />} 
          color="bg-slate-100 dark:bg-slate-800"
          textColor="text-slate-700 dark:text-slate-300"
        />
        <StatCard 
          title="In Repair" 
          value={displayStats.repairAssets} 
          icon={<AlertTriangle size={24} />} 
          color="bg-amber-50 dark:bg-amber-900/30"
          textColor="text-amber-600 dark:text-amber-400"
        />
        <StatCard 
          title="In Storage" 
          value={displayStats.totalAssets - displayStats.activeAssets - displayStats.repairAssets} 
          icon={<Box size={24} />} 
          color="bg-slate-50 dark:bg-slate-800/50"
          textColor="text-slate-500 dark:text-slate-400"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Cost Distribution by Category</h3>
          <div className="h-64 w-full">
            {displayStats.byCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                    data={displayStats.byCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    >
                    {displayStats.byCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} stroke={isDark ? '#0f172a' : '#fff'} />
                    ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: isDark ? '#1e293b' : '#fff', 
                            borderRadius: '8px', 
                            border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', 
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            color: isDark ? '#f1f5f9' : '#1e293b'
                        }}
                        itemStyle={{ color: isDark ? '#f1f5f9' : '#1e293b' }}
                    />
                </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-600">No data for selected filters</div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
             {displayStats.byCategory.map((entry, index) => (
                <div key={entry.name} className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                  <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: chartColors[index % chartColors.length] }}></span>
                  {entry.name} ({entry.value})
                </div>
             ))}
          </div>
        </div>

        {/* Inventory Breakdown */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Inventory Breakdown</h3>
           {displayStats.byCategory.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayStats.byCategory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="name" hide />
                <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: isDark ? '#334155' : '#f8fafc' }}
                  contentStyle={{ 
                    backgroundColor: isDark ? '#1e293b' : '#fff', 
                    borderRadius: '8px', 
                    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    color: isDark ? '#f1f5f9' : '#1e293b'
                  }}
                  itemStyle={{ color: isDark ? '#f1f5f9' : '#1e293b' }}
                />
                <Bar dataKey="value" fill={isDark ? '#3b82f6' : '#0f172a'} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
           ) : (
             <div className="h-64 flex items-center justify-center text-slate-400 dark:text-slate-600">No data for selected filters</div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;