
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { getRandomBotName } from '../services/botService';

interface AdminPortalProps {
  user: UserProfile;
  onUpdateUser: (u: UserProfile) => void;
  onExit: () => void;
}

const AdminPortal: React.FC<AdminPortalProps> = ({ user, onUpdateUser, onExit }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'transactions' | 'settings'>('dashboard');
  const [simulatedProfit, setSimulatedProfit] = useState(124500);
  const [botDifficulty, setBotDifficulty] = useState('Medium');

  const addBalance = (amt: number) => {
    onUpdateUser({ ...user, balance: user.balance + amt });
  };

  return (
    <div className="h-screen w-full bg-[#020617] flex flex-col text-white font-fredoka overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-slate-900 border-b border-white/5 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="bg-sky-500/20 p-3 rounded-2xl border border-sky-500/30">
            <span className="text-2xl">🛡️</span>
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter">Admin Control Panel</h1>
            <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">System Operational • Live</p>
          </div>
        </div>
        <button onClick={onExit} className="bg-red-600/20 text-red-500 px-6 py-3 rounded-2xl font-black uppercase text-xs border border-red-500/20 hover:bg-red-600/40 transition-all">Exit Dashboard</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-slate-900/50 border-r border-white/5 flex flex-col p-4 gap-2">
           {[
             { id: 'dashboard', label: 'Dashboard', icon: '📊' },
             { id: 'users', label: 'User Manager', icon: '👥' },
             { id: 'transactions', label: 'Transactions', icon: '💸' },
             { id: 'settings', label: 'System Settings', icon: '⚙️' }
           ].map(tab => (
             <button 
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`w-full p-4 rounded-2xl flex items-center gap-4 font-black text-sm transition-all ${activeTab === tab.id ? 'bg-sky-500 text-white shadow-lg' : 'text-white/40 hover:bg-white/5'}`}
             >
               <span>{tab.icon}</span> {tab.label}
             </button>
           ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-10 overflow-y-auto no-scrollbar">
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
               <div className="grid grid-cols-3 gap-6">
                  <div className="bg-slate-800/50 p-8 rounded-[40px] border border-white/5 shadow-xl">
                     <p className="text-[10px] font-black uppercase text-sky-400 mb-2">Total Net Profit</p>
                     <h2 className="text-4xl font-black text-yellow-500">৳ {simulatedProfit.toLocaleString()}</h2>
                  </div>
                  <div className="bg-slate-800/50 p-8 rounded-[40px] border border-white/5 shadow-xl">
                     <p className="text-[10px] font-black uppercase text-green-400 mb-2">Active Tables</p>
                     <h2 className="text-4xl font-black text-white">42</h2>
                  </div>
                  <div className="bg-slate-800/50 p-8 rounded-[40px] border border-white/5 shadow-xl">
                     <p className="text-[10px] font-black uppercase text-red-400 mb-2">Total Withdrawals</p>
                     <h2 className="text-4xl font-black text-white">৳ 84,200</h2>
                  </div>
               </div>

               <div className="bg-slate-800/50 rounded-[40px] p-10 border border-white/5 shadow-xl">
                  <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-3">
                     <span className="text-yellow-500">⚡</span> Quick Actions for You
                  </h3>
                  <div className="flex gap-4">
                     <button onClick={() => addBalance(1000)} className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-8 py-4 rounded-2xl font-black text-sm hover:bg-sky-500 hover:text-white transition-all">Add ৳1,000 to My Account</button>
                     <button onClick={() => addBalance(10000)} className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-8 py-4 rounded-2xl font-black text-sm hover:bg-yellow-500 hover:text-black transition-all">Add ৳10,000 to My Account</button>
                     <button onClick={() => setSimulatedProfit(p => p + 500)} className="bg-green-500/10 text-green-400 border border-green-500/20 px-8 py-4 rounded-2xl font-black text-sm hover:bg-green-500 hover:text-white transition-all">Simulate Bonus Profit</button>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black uppercase">Registered Users</h3>
                  <input type="text" placeholder="Search user ID..." className="bg-slate-800 border border-white/10 p-4 rounded-2xl w-64 focus:outline-none focus:border-sky-500" />
               </div>
               <div className="bg-slate-800/50 rounded-[40px] border border-white/5 overflow-hidden shadow-xl">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-slate-900/50 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-white/40">
                           <th className="p-6">User</th>
                           <th className="p-6">Current Balance</th>
                           <th className="p-6">Level</th>
                           <th className="p-6">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                        <tr className="hover:bg-white/5 transition-colors">
                           <td className="p-6 font-black">{user.name} (You)</td>
                           <td className="p-6 text-yellow-500 font-black">৳ {user.balance.toLocaleString()}</td>
                           <td className="p-6"><span className="bg-sky-500 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase">Admin</span></td>
                           <td className="p-6 flex gap-2">
                              <button className="text-sky-400 font-black text-xs">EDIT</button>
                           </td>
                        </tr>
                        {[...Array(5)].map((_, i) => (
                           <tr key={i} className="hover:bg-white/5 transition-colors">
                              <td className="p-6 font-black text-white/60">{getRandomBotName()}</td>
                              <td className="p-6 text-white/40 font-black">৳ {Math.floor(Math.random() * 50000).toLocaleString()}</td>
                              <td className="p-6 text-white/20 font-black text-xs">VETERAN</td>
                              <td className="p-6"><button className="text-red-500/60 font-black text-xs">FREEZE</button></td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
               <h3 className="text-2xl font-black uppercase mb-6">Pending Withdrawals</h3>
               <div className="bg-slate-800/50 rounded-[40px] border border-white/5 overflow-hidden shadow-xl">
                  <table className="w-full text-left">
                     <thead className="bg-slate-900/50 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-white/40">
                        <tr>
                           <th className="p-6">User</th>
                           <th className="p-6">Amount</th>
                           <th className="p-6">Method</th>
                           <th className="p-6">Decision</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                        {[...Array(3)].map((_, i) => (
                           <tr key={i} className="hover:bg-white/5">
                              <td className="p-6 font-black">{getRandomBotName()}</td>
                              <td className="p-6 font-black text-yellow-500">৳ {(i + 1) * 2500}</td>
                              <td className="p-6 uppercase text-xs font-black opacity-50">bKash</td>
                              <td className="p-6 flex gap-4">
                                 <button className="bg-green-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase">Approve</button>
                                 <button className="bg-red-500/20 text-red-500 border border-red-500/20 px-6 py-2 rounded-xl text-[10px] font-black uppercase">Reject</button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 max-w-2xl">
               <h3 className="text-2xl font-black uppercase mb-6">Platform Settings</h3>
               
               <div className="bg-slate-800/50 p-8 rounded-[40px] border border-white/5 space-y-6">
                  <div>
                     <p className="text-xs font-black uppercase text-white/40 mb-4">Bot Difficulty Level</p>
                     <div className="flex gap-3">
                        {['Easy', 'Medium', 'Hard', 'God Mode'].map(l => (
                           <button 
                             key={l}
                             onClick={() => setBotDifficulty(l)}
                             className={`px-6 py-4 rounded-2xl font-black text-xs uppercase border transition-all ${botDifficulty === l ? 'bg-sky-500 border-sky-400' : 'bg-white/5 border-white/5 text-white/40'}`}
                           >
                              {l}
                           </button>
                        ))}
                     </div>
                  </div>

                  <div>
                     <p className="text-xs font-black uppercase text-white/40 mb-4">Maintenance Mode</p>
                     <button className="w-full bg-red-600/10 text-red-500 border border-red-500/20 py-6 rounded-3xl font-black uppercase italic tracking-widest text-sm hover:bg-red-600 hover:text-white transition-all">Enable Maintenance Shutdown</button>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
