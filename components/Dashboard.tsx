
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

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; textColor: string }> = ({ title, value, icon, color, textColor }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
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

  useEffect(() => {
    const loadConfig = async () => {
      const config = await getAppConfig();
      setCategories(config.categories);
      setLocations(config.locations);
    };
    loadConfig();
  }, []);

  const filteredAssets = allAssets.filter(a => {
      const matchLoc = locationFilter === 'All' || a.location === locationFilter;
      const matchCat = categoryFilter === 'All' || a.category === categoryFilter;
      return matchLoc && matchCat;
  });

  const displayStats = getStats(filteredAssets);

  return (
    <div className="space-y-6">
      
      {/* Report Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex items-center gap-2 text-slate-700 font-semibold mr-2">
            <Filter size={20} /> Report Filters:
        </div>
        <select 
            value={locationFilter} 
            onChange={e => setLocationFilter(e.target.value)}
            className="p-2 border border-slate-300 rounded-lg text-sm min-w-[200px] focus:ring-2 focus:ring-slate-900"
        >
            <option value="All">All Locations</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
         <select 
            value={categoryFilter} 
            onChange={e => setCategoryFilter(e.target.value)}
            className="p-2 border border-slate-300 rounded-lg text-sm min-w-[200px] focus:ring-2 focus:ring-slate-900"
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
          color="bg-slate-900"
          textColor="text-white"
        />
        <StatCard 
          title="Total Devices" 
          value={displayStats.totalAssets} 
          icon={<Server size={24} />} 
          color="bg-slate-100"
          textColor="text-slate-700"
        />
        <StatCard 
          title="In Repair" 
          value={displayStats.repairAssets} 
          icon={<AlertTriangle size={24} />} 
          color="bg-amber-50"
          textColor="text-amber-600"
        />
        <StatCard 
          title="In Storage" 
          value={displayStats.totalAssets - displayStats.activeAssets - displayStats.repairAssets} 
          icon={<Box size={24} />} 
          color="bg-slate-50"
          textColor="text-slate-500"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Cost Distribution by Category</h3>
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
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    </Pie>
                    <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#1e293b' }}
                    />
                </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400">No data for selected filters</div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
             {displayStats.byCategory.map((entry, index) => (
                <div key={entry.name} className="flex items-center text-xs text-slate-600">
                  <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  {entry.name} ({entry.value})
                </div>
             ))}
          </div>
        </div>

        {/* Inventory Breakdown */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Inventory Breakdown</h3>
           {displayStats.byCategory.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayStats.byCategory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
           ) : (
             <div className="h-64 flex items-center justify-center text-slate-400">No data for selected filters</div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
