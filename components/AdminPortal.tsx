
import React, { useState, useEffect } from 'react';
import { UserProfile, PendingTransaction } from '../types';
import { soundManager } from '../services/soundService';

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
  
  const pendingCount = pendingTransactions.length;

  useEffect(() => {
    if (pendingCount > 0) {
      soundManager.play('six');
    }
  }, [pendingCount]);

  return (
    <div className="h-screen w-full bg-[#020617] flex flex-col text-white font-fredoka overflow-hidden">
      <div className="p-6 bg-slate-900 border-b border-white/5 flex justify-between items-center shadow-2xl relative z-10">
        <div className="flex items-center gap-4">
          <div className="bg-sky-500/20 p-3 rounded-2xl border border-sky-500/30">
            <span className="text-2xl animate-pulse">🛡️</span>
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter italic">Ludo Money Admin Console</h1>
            <p className="text-[10px] font-black text-sky-400 uppercase tracking-[0.3em] flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                LIVE SERVER CONNECTED
            </p>
          </div>
        </div>
        <button onClick={onExit} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all">Close Dashboard</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 bg-slate-900 border-r border-white/5 flex flex-col p-6 gap-3">
           {[
             { id: 'dashboard', label: 'Dashboard', icon: '📊' },
             { id: 'users', label: 'User Management', icon: '👥' },
             { id: 'transactions', label: 'Live Requests', icon: '💸', badge: pendingCount > 0 ? pendingCount : null },
             { id: 'settings', label: 'Server Setup', icon: '⚙️' }
           ].map(tab => (
             <button 
               key={tab.id}
               onClick={() => { soundManager.play('click'); setActiveTab(tab.id as any); }}
               className={`w-full p-5 rounded-3xl flex items-center justify-between font-black text-sm transition-all ${activeTab === tab.id ? 'bg-sky-500 text-white shadow-2xl scale-105' : 'text-white/30 hover:bg-white/5 hover:text-white/60'}`}
             >
               <div className="flex items-center gap-4"><span>{tab.icon}</span> {tab.label}</div>
               {tab.badge && (
                 <span className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] animate-bounce shadow-lg shadow-red-500/40">
                   {tab.badge}
                 </span>
               )}
             </button>
           ))}
        </div>

        <div className="flex-1 p-12 overflow-y-auto no-scrollbar bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.05)_0,transparent_100%)]">
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-700">
               <div className="grid grid-cols-3 gap-8">
                  <div className="bg-slate-800/40 p-10 rounded-[50px] border border-white/5 shadow-2xl group hover:border-sky-500/20 transition-all">
                     <p className="text-[11px] font-black uppercase text-sky-400 mb-4 tracking-widest">Total Net Profit</p>
                     <h2 className="text-5xl font-black text-yellow-500 tracking-tighter">৳ 284,500</h2>
                  </div>
                  <div className="bg-slate-800/40 p-10 rounded-[50px] border border-white/5 shadow-2xl group hover:border-green-500/20 transition-all">
                     <p className="text-[11px] font-black uppercase text-green-400 mb-4 tracking-widest">Global Players</p>
                     <h2 className="text-5xl font-black text-white tracking-tighter">1,242</h2>
                  </div>
                  <div className="bg-slate-800/40 p-10 rounded-[50px] border border-white/5 shadow-2xl group hover:border-red-500/20 transition-all">
                     <p className="text-[11px] font-black uppercase text-red-400 mb-4 tracking-widest">Pending Syncs</p>
                     <h2 className={`text-5xl font-black tracking-tighter ${pendingCount > 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{pendingCount}</h2>
                  </div>
               </div>
               
               <div className="bg-slate-800/20 p-10 rounded-[60px] border border-white/5">
                   <h3 className="text-xl font-black mb-8 uppercase italic text-white/50 tracking-widest">Recent Activity Log</h3>
                   <div className="space-y-4">
                       {[1,2,3].map(i => (
                           <div key={i} className="flex items-center gap-4 text-xs font-bold text-white/20 border-b border-white/5 pb-4">
                               <span className="text-green-500">●</span> System verified user login from IP 103.22.XX.XX
                           </div>
                       ))}
                   </div>
               </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
               <div className="flex justify-between items-end mb-8">
                   <div>
                       <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Live Requests</h3>
                       <p className="text-xs font-bold text-white/30 uppercase mt-2">Manage all incoming deposits and withdrawals</p>
                   </div>
                   {pendingCount > 0 && <span className="bg-red-500 text-white text-[11px] px-6 py-2 rounded-full font-black animate-pulse shadow-xl shadow-red-500/20">WAITING FOR ACTION</span>}
               </div>

               <div className="bg-slate-800/30 rounded-[60px] border border-white/5 overflow-hidden shadow-2xl backdrop-blur-xl">
                  {pendingTransactions.length === 0 ? (
                    <div className="p-32 text-center opacity-10">
                       <span className="text-[100px] block mb-8">📭</span>
                       <p className="font-black uppercase tracking-[0.5em] italic text-2xl">Inbox Empty</p>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                       <thead className="bg-slate-900/80 border-b border-white/5 text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
                          <tr>
                             <th className="p-8">Player / Type</th>
                             <th className="p-8">Amount</th>
                             <th className="p-8">Gateway</th>
                             <th className="p-8">Reference/Phone</th>
                             <th className="p-8">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-white/5">
                          {pendingTransactions.map((tx) => (
                             <tr key={tx.id} className="hover:bg-white/5 transition-all">
                                <td className="p-8">
                                   <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase mb-2 block w-fit shadow-lg ${tx.type === 'DEPOSIT' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>{tx.type}</span>
                                   <div className="font-black text-lg tracking-tight text-white/80">{tx.userName}</div>
                                </td>
                                <td className="p-8 font-black text-yellow-500 italic text-2xl tracking-tighter">৳ {tx.amount.toLocaleString()}</td>
                                <td className="p-8"><img src={METHOD_LOGOS[tx.method]} className="h-10 object-contain drop-shadow-lg" alt={tx.method} /></td>
                                <td className="p-8">
                                   <div className="text-[11px] font-black uppercase text-sky-400 mb-1">{tx.trxId || 'WITHDRAWAL REQ'}</div>
                                   <div className="text-xs font-bold text-white/40">{tx.phone}</div>
                                </td>
                                <td className="p-8">
                                   <div className="flex gap-4">
                                       <button onClick={() => { soundManager.play('win'); onApproveTransaction(tx); }} className="bg-green-500 text-black px-8 py-3 rounded-2xl text-[11px] font-black uppercase shadow-2xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all">Verify & Approve</button>
                                       <button onClick={() => { soundManager.play('click'); onRejectTransaction(tx.id); }} className="bg-red-500/10 text-red-500 border border-red-500/20 px-8 py-3 rounded-2xl text-[11px] font-black uppercase hover:bg-red-500 hover:text-white transition-all">Reject</button>
                                   </div>
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
