
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, PendingTransaction, LiveMatch, PlayerColor } from '../types';
import { soundManager } from '../services/soundService';
import { databaseService } from '../services/database';

interface AdminPortalProps {
  user: UserProfile;
  allUsers: UserProfile[];
  onUpdateUsersDB: (users: UserProfile[]) => void;
  pendingTransactions: PendingTransaction[];
  liveMatches: LiveMatch[];
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

const AdminPortal: React.FC<AdminPortalProps> = ({ 
  user, 
  allUsers, 
  onUpdateUsersDB, 
  pendingTransactions, 
  liveMatches,
  onApproveTransaction, 
  onRejectTransaction, 
  onExit 
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'transactions' | 'arena' | 'settings'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  
  const [bkashNum, setBkashNum] = useState('');
  const [nagadNum, setNagadNum] = useState('');
  const [rocketNum, setRocketNum] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);

  const pendingCount = pendingTransactions.length;
  const arenaCount = liveMatches.length;

  useEffect(() => {
    if (pendingCount > 0) {
        soundManager.play('six');
    }
  }, [pendingCount]);

  useEffect(() => {
    const loadSettings = async () => {
        const settings = await databaseService.getSettings();
        if (settings) {
            setBkashNum(settings.bkash_number || '');
            setNagadNum(settings.nagad_number || '');
            setRocketNum(settings.rocket_number || '');
            setIsInitialLoaded(true);
        }
    };
    if (activeTab === 'settings' && !isInitialLoaded) {
        loadSettings();
    }
  }, [activeTab, isInitialLoaded]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.phone?.includes(searchTerm)
    );
  }, [allUsers, searchTerm]);

  const handleAdjustBalance = async () => {
    if (!selectedUser || !adjustAmount) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid positive amount.");

    const newBalance = adjustType === 'add' ? selectedUser.balance + amount : selectedUser.balance - amount;
    const updatedUser = { ...selectedUser, balance: Math.max(0, newBalance) };

    await databaseService.updateUser(updatedUser);
    onUpdateUsersDB(allUsers.map(u => u.phone === updatedUser.phone ? updatedUser : u));
    setSelectedUser(updatedUser);
    setAdjustAmount('');
    alert("Balance adjusted successfully!");
    soundManager.play('win');
  };

  const handleSaveSettings = async () => {
      setIsSaving(true);
      soundManager.play('click');
      try {
          await Promise.all([
              databaseService.updateSetting('bkash_number', bkashNum),
              databaseService.updateSetting('nagad_number', nagadNum),
              databaseService.updateSetting('rocket_number', rocketNum)
          ]);
          alert("Settings updated!");
          soundManager.play('win');
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="h-screen w-full bg-[#020617] flex flex-col text-white overflow-hidden">
      <div className="p-6 bg-slate-900 border-b border-white/5 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <div className="bg-sky-500/20 p-3 rounded-2xl border border-sky-500/30">
            <span className="text-2xl animate-pulse">🛡️</span>
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter italic text-sky-400">Admin Console</h1>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">System Online</p>
          </div>
        </div>
        <button onClick={onExit} className="bg-red-600/10 text-red-500 px-8 py-3 rounded-2xl font-black uppercase text-xs border border-red-500/20">Exit Console</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 bg-slate-900/50 border-r border-white/5 flex flex-col p-6 gap-3 shrink-0">
           {[
             { id: 'dashboard', label: 'Overview', icon: '📊' },
             { id: 'arena', label: 'Live Arena', icon: '🏟️', badge: arenaCount > 0 ? arenaCount : null },
             { id: 'users', label: 'Players', icon: '👥' },
             { id: 'transactions', label: 'Requests', icon: '💸', badge: pendingCount > 0 ? pendingCount : null },
             { id: 'settings', label: 'Gateway', icon: '⚙️' }
           ].map(tab => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-full p-5 rounded-3xl flex items-center justify-between font-black text-sm transition-all ${activeTab === tab.id ? 'bg-sky-500 text-white' : 'text-white/30 hover:bg-white/5'}`}>
               <div className="flex items-center gap-4"><span>{tab.icon}</span> {tab.label}</div>
               {tab.badge && <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] animate-bounce">{tab.badge}</span>}
             </button>
           ))}
        </div>

        <div className="flex-1 p-12 overflow-y-auto no-scrollbar">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-slate-800/40 p-10 rounded-[50px] border border-white/5">
                     <p className="text-[11px] font-black uppercase text-sky-400 mb-4 tracking-widest">User Balances</p>
                     <h2 className="text-5xl font-black text-yellow-500 tracking-tighter">৳ {allUsers.reduce((acc, u) => acc + u.balance, 0).toLocaleString()}</h2>
                  </div>
                  <div className="bg-slate-800/40 p-10 rounded-[50px] border border-white/5">
                     <p className="text-[11px] font-black uppercase text-green-400 mb-4 tracking-widest">Total Players</p>
                     <h2 className="text-5xl font-black text-white tracking-tighter">{allUsers.length}</h2>
                  </div>
                  <div className="bg-slate-800/40 p-10 rounded-[50px] border border-white/5">
                     <p className="text-[11px] font-black uppercase text-red-400 mb-4 tracking-widest">Arena Matches</p>
                     <h2 className="text-5xl font-black text-white tracking-tighter">{arenaCount}</h2>
                  </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-8 animate-in fade-in">
                <div className="flex justify-between items-center">
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Player Database</h3>
                    <input 
                      type="text" 
                      placeholder="Search by name or phone..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-900 border border-white/10 p-4 rounded-2xl w-80 text-sm font-bold focus:border-sky-500 outline-none transition-all"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-slate-800/30 rounded-[50px] border border-white/5 overflow-hidden">
                        <table className="w-full text-left">
                           <thead className="bg-slate-900 border-b border-white/5 text-[11px] font-black uppercase text-white/40">
                              <tr><th className="p-6">Player</th><th className="p-6">Contact</th><th className="p-6">Balance</th></tr>
                           </thead>
                           <tbody className="divide-y divide-white/5">
                              {filteredUsers.map((u) => (
                                 <tr key={u.phone} onClick={() => setSelectedUser(u)} className={`cursor-pointer transition-all ${selectedUser?.phone === u.phone ? 'bg-sky-500/10' : 'hover:bg-white/5'}`}>
                                    <td className="p-6">
                                       <div className="flex items-center gap-3">
                                          <img src={u.avatar} className="w-10 h-10 rounded-full border border-white/10" />
                                          <span className="font-black text-sm uppercase">{u.name}</span>
                                       </div>
                                    </td>
                                    <td className="p-6 font-bold text-white/60">{u.phone}</td>
                                    <td className="p-6 font-black text-yellow-500 text-lg">৳ {u.balance.toLocaleString()}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                    </div>

                    <div className="bg-slate-800/50 rounded-[50px] border border-sky-500/20 p-10 h-fit sticky top-0">
                        {selectedUser ? (
                           <div className="space-y-8 animate-in zoom-in-95">
                              <div className="text-center">
                                 <img src={selectedUser.avatar} className="w-24 h-24 rounded-full border-4 border-sky-500 mx-auto mb-4" />
                                 <h4 className="text-2xl font-black uppercase italic text-white leading-none">{selectedUser.name}</h4>
                                 <p className="text-sky-400 font-bold mt-2">{selectedUser.phone}</p>
                              </div>

                              <div className="bg-black/40 p-6 rounded-[30px] border border-white/5 text-center">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Current Balance</p>
                                 <p className="text-3xl font-black text-yellow-500">৳ {selectedUser.balance.toLocaleString()}</p>
                              </div>

                              <div className="space-y-4">
                                 <div className="flex gap-2">
                                    <button onClick={() => setAdjustType('add')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${adjustType === 'add' ? 'bg-green-500 text-black' : 'bg-white/5 text-white/40'}`}>+ Add</button>
                                    <button onClick={() => setAdjustType('subtract')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${adjustType === 'subtract' ? 'bg-red-500 text-white' : 'bg-white/5 text-white/40'}`}>- Remove</button>
                                 </div>
                                 <input 
                                   type="number" 
                                   placeholder="Amount" 
                                   value={adjustAmount}
                                   onChange={(e) => setAdjustAmount(e.target.value)}
                                   className="w-full bg-slate-900 border border-white/10 p-5 rounded-2xl font-black text-white outline-none" 
                                 />
                                 <button onClick={handleAdjustBalance} className="w-full bg-sky-500 py-5 rounded-2xl font-black text-sm uppercase shadow-xl active:scale-95 transition-all">Update Balance</button>
                              </div>
                           </div>
                        ) : (
                           <div className="text-center py-20 opacity-20">
                              <span className="text-6xl mb-4 block">👈</span>
                              <p className="font-black uppercase italic">Select a player to manage</p>
                           </div>
                        )}
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-8 animate-in fade-in">
               <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Pending Requests</h3>
               <div className="bg-slate-800/30 rounded-[60px] border border-white/5 overflow-hidden">
                  {pendingTransactions.length === 0 ? <div className="p-32 text-center opacity-10 font-black uppercase italic text-2xl">No Requests</div> : (
                    <table className="w-full text-left">
                       <thead className="bg-slate-900 border-b border-white/5 text-[11px] font-black uppercase text-white/40">
                          <tr><th className="p-8">Type</th><th className="p-8">User</th><th className="p-8">Amount</th><th className="p-8">Ref / Phone</th><th className="p-8">Action</th></tr>
                       </thead>
                       <tbody className="divide-y divide-white/5">
                          {pendingTransactions.map((tx) => (
                             <tr key={tx.id} className="hover:bg-white/5 transition-all animate-in slide-in-from-left-4">
                                <td className="p-8"><span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${tx.type === 'DEPOSIT' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>{tx.type}</span></td>
                                <td className="p-8 font-black text-white">{tx.userName}</td>
                                <td className="p-8 font-black text-yellow-500 italic text-2xl">৳ {tx.amount.toLocaleString()}</td>
                                <td className="p-8">
                                   <div className="text-[11px] font-black uppercase text-sky-400">{tx.trxId || 'N/A'}</div>
                                   <div className="text-xs font-bold text-white/40">{tx.phone}</div>
                                 </td>
                                <td className="p-8">
                                   <div className="flex gap-3">
                                      <button onClick={() => onApproveTransaction(tx)} className="bg-green-500 text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Approve</button>
                                      <button onClick={() => onRejectTransaction(tx.id)} className="bg-red-500/10 text-red-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-red-500/20">Reject</button>
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

          {activeTab === 'settings' && (
            <div className="space-y-8 animate-in fade-in">
                <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Payment Gateway</h3>
                <div className="bg-slate-800/30 rounded-[50px] border border-white/5 p-12 space-y-10 max-w-2xl">
                    <div className="space-y-8">
                        <div className="flex items-center gap-8">
                            <img src={METHOD_LOGOS['bkash']} className="h-14 w-14 object-contain" />
                            <div className="flex-1">
                                <label className="text-[10px] font-black uppercase text-white/40 mb-2 block">bKash Personal</label>
                                <input type="tel" value={bkashNum} onChange={(e) => setBkashNum(e.target.value)} className="w-full bg-slate-900 border border-white/10 p-5 rounded-2xl font-bold text-white outline-none" />
                            </div>
                        </div>
                        <div className="flex items-center gap-8">
                            <img src={METHOD_LOGOS['nagad']} className="h-14 w-14 object-contain" />
                            <div className="flex-1">
                                <label className="text-[10px] font-black uppercase text-white/40 mb-2 block">Nagad Personal</label>
                                <input type="tel" value={nagadNum} onChange={(e) => setNagadNum(e.target.value)} className="w-full bg-slate-900 border border-white/10 p-5 rounded-2xl font-bold text-white outline-none" />
                            </div>
                        </div>
                        <div className="flex items-center gap-8">
                            <img src={METHOD_LOGOS['rocket']} className="h-14 w-14 object-contain" />
                            <div className="flex-1">
                                <label className="text-[10px] font-black uppercase text-white/40 mb-2 block">Rocket Personal</label>
                                <input type="tel" value={rocketNum} onChange={(e) => setRocketNum(e.target.value)} className="w-full bg-slate-900 border border-white/10 p-5 rounded-2xl font-bold text-white outline-none" />
                            </div>
                        </div>
                    </div>
                    <button onClick={handleSaveSettings} disabled={isSaving} className="w-full bg-sky-500 py-6 rounded-3xl font-black text-lg uppercase shadow-2xl transition-all active:scale-95 disabled:opacity-50">
                        {isSaving ? "Syncing..." : "Update Official Numbers"}
                    </button>
               </div>
            </div>
          )}

          {activeTab === 'arena' && (
             <div className="text-center py-40 opacity-20">
                <span className="text-8xl mb-8 block">🏟️</span>
                <h3 className="text-4xl font-black uppercase italic">Arena Monitoring Coming Soon</h3>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
