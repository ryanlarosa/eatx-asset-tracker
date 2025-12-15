
import React from 'react';
import { Asset, AssetStats } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DollarSign, Box, Activity, Wrench } from 'lucide-react';

interface DashboardProps {
  stats: AssetStats;
  allAssets: Asset[];
}

const Dashboard: React.FC<DashboardProps> = ({ stats, allAssets }) => {
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
  const StatCard = ({ title, value, icon: Icon, colorClass, subtext }: any) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-start justify-between">
      <div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{title}</p>
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
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard Overview</h2>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            title="Total Assets" 
            value={stats.totalAssets} 
            icon={Box} 
            colorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
        />
        <StatCard 
            title="Total Value" 
            value={`AED ${stats.totalValue.toLocaleString()}`} 
            icon={DollarSign} 
            colorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
        />
        <StatCard 
            title="Active Utilization" 
            value={`${Math.round((stats.activeAssets / (stats.totalAssets || 1)) * 100)}%`} 
            icon={Activity} 
            colorClass="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
            subtext={`${stats.activeAssets} deployed`}
        />
        <StatCard 
            title="Maintenance" 
            value={stats.repairAssets} 
            icon={Wrench} 
            colorClass="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
            subtext="Items under repair"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Asset Status Doughnut */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col min-w-0">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Fleet Health</h3>
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
            <div className="text-xs text-center text-slate-400 dark:text-slate-500 mt-2">Breakdown by Asset Category</div>
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
