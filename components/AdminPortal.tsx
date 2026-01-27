
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
  onRefreshData?: () => void;
}

// Ultra-reliable embedded SVG Data URIs
const REAL_LOGOS: Record<string, string> = {
  bkash: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23D12053' rx='20'/%3E%3Cpath d='M25 55 L40 70 L75 35' stroke='white' stroke-width='10' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ctext x='50' y='90' text-anchor='middle' fill='white' font-family='Arial, sans-serif' font-weight='900' font-size='12' text-transform='uppercase'%3EbKash%3C/text%3E%3C/svg%3E",
  nagad: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23F7941D' rx='20'/%3E%3Ccircle cx='50' cy='45' r='22' fill='white'/%3E%3Ctext x='50' y='52' text-anchor='middle' fill='%23F7941D' font-family='Arial, sans-serif' font-weight='900' font-size='24'%3EN%3C/text%3E%3Ctext x='50' y='90' text-anchor='middle' fill='white' font-family='Arial, sans-serif' font-weight='900' font-size='12' text-transform='uppercase'%3ENagad%3C/text%3E%3C/svg%3E",
  rocket: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%238C3494' rx='20'/%3E%3Cpath d='M30 75 L50 20 L70 75 L50 60 Z' fill='white'/%3E%3Ctext x='50' y='90' text-anchor='middle' fill='white' font-family='Arial, sans-serif' font-weight='900' font-size='12' text-transform='uppercase'%3ERocket%3C/text%3E%3C/svg%3E"
};

const AdminPortal: React.FC<AdminPortalProps> = ({ 
  user, 
  allUsers, 
  onUpdateUsersDB, 
  pendingTransactions, 
  liveMatches,
  onApproveTransaction, 
  onRejectTransaction, 
  onExit,
  onRefreshData
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
  const [dbStatus, setDbStatus] = useState<'CONNECTING' | 'ONLINE' | 'OFFLINE'>('ONLINE');

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
    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid amount.");

    const newBalance = adjustType === 'add' ? selectedUser.balance + amount : selectedUser.balance - amount;
    const updatedUser = { ...selectedUser, balance: Math.max(0, newBalance) };

    try {
        await databaseService.updateUser(updatedUser);
        onUpdateUsersDB(allUsers.map(u => u.phone === updatedUser.phone ? updatedUser : u));
        setSelectedUser(updatedUser);
        setAdjustAmount('');
        alert("Updated!");
    } catch (e) {
        alert("Failed to update user.");
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedUser) return;
    const blockState = !selectedUser.isBlocked;
    const updatedUser = { ...selectedUser, isBlocked: blockState };
    
    try {
        await databaseService.updateUser(updatedUser);
        onUpdateUsersDB(allUsers.map(u => u.phone === updatedUser.phone ? updatedUser : u));
        setSelectedUser(updatedUser);
        soundManager.play(blockState ? 'kill' : 'win');
        alert(blockState ? "ইউজার ব্লক করা হয়েছে!" : "ইউজার আনব্লক করা হয়েছে!");
    } catch (e) {
        alert("Failed to update status.");
    }
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
      } finally {
          setIsSaving(false);
      }
  };

  const handleManualRefresh = () => {
    setDbStatus('CONNECTING');
    soundManager.play('click');
    onRefreshData?.();
    setTimeout(() => setDbStatus('ONLINE'), 1000);
  };

  return (
    <div className="h-screen w-full bg-[#020617] flex flex-col text-white overflow-hidden">
      <div className="p-6 bg-slate-900 border-b border-white/5 flex justify-between items-center z-10 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="bg-sky-500/20 p-3 rounded-2xl border border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.2)]">🛡️</div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter italic text-sky-400">Admin Portal</h1>
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dbStatus === 'ONLINE' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                <p className="text-[10px] font-black text-white/20 uppercase">{dbStatus === 'ONLINE' ? 'Live Connection' : 'Syncing...'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleManualRefresh} className="bg-white/5 hover:bg-white/10 p-2.5 rounded-xl border border-white/10 transition-all flex items-center gap-2">
              <span className="text-xs">🔄</span>
              <span className="text-[10px] font-bold uppercase hidden md:inline">Sync DB</span>
          </button>
          <button onClick={onExit} className="bg-red-600/20 text-red-500 px-6 py-2 rounded-xl font-black uppercase text-xs border border-red-500/30">Exit</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-slate-900/50 border-r border-white/5 flex flex-col p-4 gap-2 shadow-inner">
           {[
             { id: 'dashboard', label: 'Overview', icon: '📊' },
             { id: 'arena', label: 'Arena', icon: '🏟️' },
             { id: 'users', label: 'Users', icon: '👥' },
             { id: 'transactions', label: 'Requests', icon: '💸', badge: pendingCount },
             { id: 'settings', label: 'Gateway', icon: '⚙️' }
           ].map(tab => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-full p-4 rounded-2xl flex items-center justify-between font-black text-sm transition-all ${activeTab === tab.id ? 'bg-sky-500 text-white shadow-lg scale-[1.02]' : 'text-white/30 hover:bg-white/5'}`}>
               <div className="flex items-center gap-3"><span>{tab.icon}</span> {tab.label}</div>
               {tab.badge ? <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] animate-pulse">{tab.badge}</span> : null}
             </button>
           ))}
        </div>

        <div className="flex-1 p-10 overflow-y-auto no-scrollbar">
          {activeTab === 'transactions' && (
            <div className="space-y-8 animate-in fade-in">
                <div className="flex justify-between items-center">
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Pending Requests</h3>
                    <div className="bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-full flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                        <span className="text-[10px] font-black uppercase text-red-500 tracking-widest">{pendingCount} Waiting</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {pendingTransactions.length === 0 ? (
                        <div className="py-20 text-center opacity-20 flex flex-col items-center">
                            <span className="text-6xl mb-4">💤</span>
                            <p className="font-black uppercase italic text-xl">No pending requests found</p>
                        </div>
                    ) : (
                        pendingTransactions.map((tx) => (
                            <div key={tx.id} className="bg-slate-800/40 border border-white/5 rounded-[30px] p-6 flex items-center justify-between group hover:border-sky-500/30 transition-all shadow-xl">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center p-3 shadow-lg shrink-0">
                                        <img src={REAL_LOGOS[tx.method.toLowerCase()]} className="h-full w-full object-contain" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-xl text-white uppercase italic">{tx.userName}</span>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${tx.type === 'DEPOSIT' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>{tx.type}</span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-white/40 font-bold text-xs uppercase tracking-tight">
                                            <span>📞 {tx.phone}</span>
                                            {tx.trxId && <span>🆔 Trx: <span className="text-sky-400">{tx.trxId}</span></span>}
                                            <span className="opacity-50">⏰ {new Date(tx.timestamp).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8">
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Amount</p>
                                        <p className="text-3xl font-black text-yellow-500">৳{tx.amount.toLocaleString()}</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button onClick={() => onApproveTransaction(tx)} className="bg-green-500 hover:bg-green-400 text-black px-6 py-3 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">Approve</button>
                                        <button onClick={() => onRejectTransaction(tx.id)} className="bg-red-600/20 text-red-500 border border-red-500/20 px-6 py-3 rounded-xl font-black uppercase text-xs hover:bg-red-600 hover:text-white transition-all">Reject</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
          )}

          {activeTab === 'users' && (
             <div className="space-y-8 animate-in fade-in">
                <div className="flex justify-between items-center">
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Player Database</h3>
                    <input 
                      type="text" 
                      placeholder="Search name or phone..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-900 border border-white/10 p-4 rounded-2xl w-80 text-sm font-bold focus:border-sky-500 outline-none transition-all shadow-inner"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-slate-800/30 rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
                        <table className="w-full text-left">
                           <thead className="bg-slate-900 border-b border-white/5 text-[11px] font-black uppercase text-white/40">
                              <tr><th className="p-6">Player</th><th className="p-6">Status</th><th className="p-6">Balance</th></tr>
                           </thead>
                           <tbody className="divide-y divide-white/5">
                              {filteredUsers.length === 0 ? (
                                  <tr><td colSpan={3} className="p-20 text-center opacity-30 font-bold uppercase italic">No Users Found</td></tr>
                              ) : filteredUsers.map((u) => (
                                 <tr key={u.phone} onClick={() => setSelectedUser(u)} className={`cursor-pointer transition-all ${selectedUser?.phone === u.phone ? 'bg-sky-500/10' : 'hover:bg-white/5'}`}>
                                    <td className="p-6">
                                       <div className="flex items-center gap-3">
                                          <img src={u.avatar} className="w-10 h-10 rounded-full border border-white/10 bg-slate-700" />
                                          <div>
                                              <span className="font-black text-sm uppercase block">{u.name}</span>
                                              <span className="text-[9px] text-white/40">{u.phone}</span>
                                          </div>
                                       </div>
                                    </td>
                                    <td className="p-6">
                                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${u.isBlocked ? 'bg-red-500 text-white' : 'bg-green-500 text-black'}`}>
                                            {u.isBlocked ? 'Blocked' : 'Active'}
                                        </span>
                                    </td>
                                    <td className="p-6 font-black text-yellow-500 text-lg">৳ {u.balance.toLocaleString()}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                    </div>

                    <div className="bg-slate-800/50 rounded-[40px] border border-sky-500/20 p-10 h-fit sticky top-0 shadow-2xl">
                        {selectedUser ? (
                           <div className="space-y-8 animate-in zoom-in-95">
                              <div className="text-center">
                                 <img src={selectedUser.avatar} className="w-24 h-24 rounded-full border-4 border-sky-500 mx-auto mb-4 bg-slate-700" />
                                 <h4 className="text-2xl font-black uppercase italic text-white leading-none">{selectedUser.name}</h4>
                                 <p className="text-sky-400 font-bold mt-2">{selectedUser.phone}</p>
                              </div>

                              <div className="bg-black/40 p-6 rounded-[30px] border border-white/5 text-center shadow-inner">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Current Balance</p>
                                 <p className="text-3xl font-black text-yellow-500">৳ {selectedUser.balance.toLocaleString()}</p>
                              </div>

                              <div className="space-y-4">
                                 <div className="flex gap-2">
                                    <button onClick={() => setAdjustType('add')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${adjustType === 'add' ? 'bg-green-500 text-black shadow-lg' : 'bg-white/5 text-white/40'}`}>+ Add</button>
                                    <button onClick={() => setAdjustType('subtract')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${adjustType === 'subtract' ? 'bg-red-500 text-white shadow-lg' : 'bg-white/5 text-white/40'}`}>- Remove</button>
                                 </div>
                                 <input 
                                   type="number" 
                                   placeholder="Amount" 
                                   value={adjustAmount}
                                   onChange={(e) => setAdjustAmount(e.target.value)}
                                   className="w-full bg-slate-900 border border-white/10 p-5 rounded-2xl font-black text-white outline-none focus:border-sky-500" 
                                 />
                                 <button onClick={handleAdjustBalance} className="w-full bg-sky-500 py-5 rounded-2xl font-black text-sm uppercase shadow-xl active:scale-95 transition-all">Update Balance</button>
                                 
                                 <div className="pt-4 border-t border-white/5">
                                    <button 
                                        onClick={handleToggleBlock} 
                                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase shadow-xl active:scale-95 transition-all ${selectedUser.isBlocked ? 'bg-white text-black' : 'bg-red-600/20 text-red-500 border border-red-500/30 hover:bg-red-600 hover:text-white'}`}
                                    >
                                        {selectedUser.isBlocked ? 'Unblock Player' : 'Block Player Access'}
                                    </button>
                                 </div>
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

          {activeTab === 'settings' && (
            <div className="space-y-8 animate-in fade-in max-w-2xl">
                <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">PAYMENT GATEWAY</h3>
                <div className="bg-[#0f172a]/80 rounded-[40px] border border-white/5 p-10 space-y-8 shadow-2xl">
                    <div className="space-y-8">
                        {/* bKash */}
                        <div className="flex items-center gap-8 bg-slate-800/40 p-6 rounded-3xl border border-white/5">
                            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center p-3 shrink-0 shadow-xl">
                                <img src={REAL_LOGOS.bkash} className="h-full w-full object-contain" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em]">BKASH PERSONAL NUMBER</label>
                                <input type="tel" value={bkashNum} onChange={(e) => setBkashNum(e.target.value)} className="w-full bg-[#080c14] border border-white/5 p-5 rounded-2xl font-black text-white outline-none focus:border-pink-500 text-xl" />
                            </div>
                        </div>
                        {/* Nagad */}
                        <div className="flex items-center gap-8 bg-slate-800/40 p-6 rounded-3xl border border-white/5">
                            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center p-3 shrink-0 shadow-xl">
                                <img src={REAL_LOGOS.nagad} className="h-full w-full object-contain" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em]">NAGAD PERSONAL NUMBER</label>
                                <input type="tel" value={nagadNum} onChange={(e) => setNagadNum(e.target.value)} className="w-full bg-[#080c14] border border-white/5 p-5 rounded-2xl font-black text-white outline-none focus:border-orange-500 text-xl" />
                            </div>
                        </div>
                        {/* Rocket */}
                        <div className="flex items-center gap-8 bg-slate-800/40 p-6 rounded-3xl border border-white/5">
                            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center p-3 shrink-0 shadow-xl">
                                <img src={REAL_LOGOS.rocket} className="h-full w-full object-contain" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em]">ROCKET PERSONAL NUMBER</label>
                                <input type="tel" value={rocketNum} onChange={(e) => setRocketNum(e.target.value)} className="w-full bg-[#080c14] border border-white/5 p-5 rounded-2xl font-black text-white outline-none focus:border-purple-500 text-xl" />
                            </div>
                        </div>
                    </div>
                    <button onClick={handleSaveSettings} disabled={isSaving} className="w-full bg-[#0ea5e9] py-8 rounded-[30px] font-black text-2xl uppercase italic shadow-[0_10px_30px_rgba(14,165,233,0.3)] border-b-8 border-[#0369a1] active:translate-y-2 active:border-b-0 transition-all">
                        {isSaving ? "Updating..." : "UPDATE OFFICIAL NUMBERS"}
                    </button>
               </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
             <div className="space-y-10 animate-in fade-in">
                <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">System Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-800/40 border border-white/5 p-8 rounded-[40px] shadow-xl">
                        <p className="text-[10px] font-black uppercase text-white/20 tracking-widest mb-2">Total Users</p>
                        <p className="text-5xl font-black text-white">{allUsers.length}</p>
                    </div>
                    <div className="bg-slate-800/40 border border-white/5 p-8 rounded-[40px] shadow-xl">
                        <p className="text-[10px] font-black uppercase text-white/20 tracking-widest mb-2">Pending Tasks</p>
                        <p className="text-5xl font-black text-red-500">{pendingCount}</p>
                    </div>
                    <div className="bg-slate-800/40 border border-white/5 p-8 rounded-[40px] shadow-xl">
                        <p className="text-[10px] font-black uppercase text-white/20 tracking-widest mb-2">System Status</p>
                        <p className="text-5xl font-black text-green-500 italic uppercase">Live</p>
                    </div>
                </div>
             </div>
          )}
          {activeTab === 'arena' && (
             <div className="text-white/20 text-center py-20 font-black uppercase italic">Arena Control Center</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
