
import React, { useState } from 'react';
import { UserProfile, PendingTransaction } from '../types';
import { getRandomBotName } from '../services/botService';

interface AdminPortalProps {
  user: UserProfile;
  pendingTransactions: PendingTransaction[];
  onUpdateUser: (u: UserProfile) => void;
  onApproveTransaction: (tx: PendingTransaction) => void;
  onRejectTransaction: (txId: string) => void;
  onExit: () => void;
}

const METHOD_LOGOS: Record<string, string> = {
  'bkash': 'https://download.logo.wine/logo/BKash/BKash-Logo.wine.png',
  'nagad': 'https://download.logo.wine/logo/Nagad/Nagad-Logo.wine.png',
  'rocket': 'https://www.findlogovector.com/wp-content/uploads/2019/03/dutch-bangla-bank-rocket-logo-vector.png'
};

const AdminPortal: React.FC<AdminPortalProps> = ({ user, pendingTransactions, onUpdateUser, onApproveTransaction, onRejectTransaction, onExit }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'transactions' | 'settings'>('dashboard');
  const [simulatedProfit, setSimulatedProfit] = useState(124500);

  const pendingCount = pendingTransactions.length;

  return (
    <div className="h-screen w-full bg-[#020617] flex flex-col text-white font-fredoka overflow-hidden">
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
        <div className="w-64 bg-slate-900/50 border-r border-white/5 flex flex-col p-4 gap-2">
           {[
             { id: 'dashboard', label: 'Dashboard', icon: '📊' },
             { id: 'users', label: 'User Manager', icon: '👥' },
             { id: 'transactions', label: 'Transactions', icon: '💸', badge: pendingCount > 0 ? pendingCount : null },
             { id: 'settings', label: 'System Settings', icon: '⚙️' }
           ].map(tab => (
             <button 
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`w-full p-4 rounded-2xl flex items-center justify-between font-black text-sm transition-all ${activeTab === tab.id ? 'bg-sky-500 text-white shadow-lg' : 'text-white/40 hover:bg-white/5'}`}
             >
               <div className="flex items-center gap-4"><span>{tab.icon}</span> {tab.label}</div>
               {tab.badge && <span className="bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] animate-pulse">{tab.badge}</span>}
             </button>
           ))}
        </div>

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
                     <p className="text-[10px] font-black uppercase text-red-400 mb-2">Pending Requests</p>
                     <h2 className={`text-4xl font-black ${pendingCount > 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{pendingCount}</h2>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
               <h3 className="text-2xl font-black uppercase mb-6 flex items-center gap-3">
                  Pending Transactions {pendingCount > 0 && <span className="bg-red-500 text-white text-[10px] px-3 py-1 rounded-full">{pendingCount} NEW</span>}
               </h3>
               <div className="bg-slate-800/50 rounded-[40px] border border-white/5 overflow-hidden shadow-xl">
                  {pendingTransactions.length === 0 ? (
                    <div className="p-20 text-center opacity-20">
                       <span className="text-6xl block mb-4">💤</span>
                       <p className="font-black uppercase tracking-widest italic">No pending requests at the moment</p>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                       <thead className="bg-slate-900/50 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-white/40">
                          <tr>
                             <th className="p-6">Type / User</th>
                             <th className="p-6">Amount</th>
                             <th className="p-6">Method</th>
                             <th className="p-6">TrxID / Phone</th>
                             <th className="p-6">Action</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-white/5">
                          {pendingTransactions.map((tx) => (
                             <tr key={tx.id} className="hover:bg-white/5">
                                <td className="p-6">
                                   <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase mb-1 block w-fit ${tx.type === 'DEPOSIT' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>{tx.type}</span>
                                   <div className="font-black text-sm">{tx.userName}</div>
                                </td>
                                <td className="p-6 font-black text-yellow-500 italic text-lg">৳ {tx.amount}</td>
                                <td className="p-6"><img src={METHOD_LOGOS[tx.method]} className="h-6 object-contain" alt={tx.method} /></td>
                                <td className="p-6">
                                   <div className="text-[10px] font-black uppercase text-sky-400">{tx.trxId || 'WITHDRAWAL'}</div>
                                   <div className="text-[10px] opacity-40 font-bold">{tx.phone}</div>
                                </td>
                                <td className="p-6 flex gap-3">
                                   <button onClick={() => onApproveTransaction(tx)} className="bg-green-500 text-black px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg border-b-4 border-green-700 active:border-b-0 transition-all">Approve</button>
                                   <button onClick={() => onRejectTransaction(tx.id)} className="bg-red-500/20 text-red-500 border border-red-500/20 px-5 py-2 rounded-xl text-[10px] font-black uppercase">Reject</button>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  )}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
