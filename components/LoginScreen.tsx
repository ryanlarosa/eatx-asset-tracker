
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MonitorSmartphone, CheckCircle, XCircle, Lock, Loader2, Search } from 'lucide-react';
import { checkEnvStatus, loginUser } from '../services/storageService';

const LoginScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const envStatus = checkEnvStatus();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await loginUser(email, password);
        } catch (err: any) {
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                setError("Invalid email or password.");
            } else {
                setError("Login failed. Check your credentials.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-md w-full">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-slate-900 dark:bg-blue-600 p-4 rounded-2xl mb-4 shadow-lg shadow-slate-900/20 dark:shadow-blue-900/20">
                        <MonitorSmartphone size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">EatX Asset Manager</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Cloud Access • Role Protected</p>
                </div>

                <div className={`mb-6 p-3 rounded-lg text-xs font-mono border flex items-center gap-2 ${envStatus.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30' : 'bg-red-50 text-red-700 border-red-100'}`}>
                    {envStatus.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    <span>{envStatus.message}</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                        <input type="email" required className="w-full p-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500 outline-none transition-all" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                        <input type="password" required className="w-full p-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500 outline-none transition-all" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg flex items-center gap-2"><Lock size={14} /> {error}</div>}
                    
                    <button type="submit" disabled={loading || !envStatus.ok} className="w-full bg-slate-900 dark:bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-black dark:hover:bg-blue-700 transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin" /> : 'Login'}
                    </button>
                    
                    <div className="flex flex-col items-center gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <Link to="/track" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                            <Search size={14} /> Check Ticket Status
                        </Link>
                        <div className="text-center text-xs text-slate-400">
                            Authorized Personnel Only
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginScreen;
