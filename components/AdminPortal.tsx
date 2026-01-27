
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

const formatDate = (isoStr?: string) => {
    if (!isoStr) return "Unknown";
    const date = new Date(isoStr);
    return date.toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTimeAgo = (isoStr?: string) => {
    if (!isoStr) return "Never";
    const now = new Date();
    const past = new Date(isoStr);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return formatDate(isoStr);
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
    ).sort((a, b) => {
        // Show most recent joined first
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
    });
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
      {/* Header */}
      <div className="p-4 md:p-6 bg-slate-900 border-b border-white/5 flex flex-wrap justify-between items-center z-10 shadow-2xl gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-sky-500/20 p-2 md:p-3 rounded-2xl border border-sky-500/30">🛡️</div>
          <div>
            <h1 className="text-lg md:text-xl font-black uppercase tracking-tighter italic text-sky-400 leading-none">Admin Panel</h1>
            <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${dbStatus === 'ONLINE' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">{dbStatus === 'ONLINE' ? 'Connection Live' : 'Syncing...'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={handleManualRefresh} className="bg-white/5 hover:bg-white/10 p-2 md:px-4 md:py-2.5 rounded-xl border border-white/10 transition-all flex items-center gap-2">
              <span className="text-xs">🔄</span>
              <span className="text-[10px] font-bold uppercase hidden sm:inline">Refresh Data</span>
          </button>
          <button onClick={onExit} className="bg-red-600/20 text-red-500 px-4 md:px-6 py-2 rounded-xl font-black uppercase text-[10px] md:text-xs border border-red-500/30 transition-all active:scale-95">Exit</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="hidden md:flex w-64 bg-slate-900/50 border-r border-white/5 flex-col p-4 gap-2 shadow-inner">
           {[
             { id: 'dashboard', label: 'Overview', icon: '📊' },
             { id: 'arena', label: 'Match Arena', icon: '🏟️' },
             { id: 'users', label: 'User Hub', icon: '👥' },
             { id: 'transactions', label: 'Requests', icon: '💸', badge: pendingCount },
             { id: 'settings', label: 'Gateways', icon: '⚙️' }
           ].map(tab => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-full p-4 rounded-2xl flex items-center justify-between font-black text-sm transition-all ${activeTab === tab.id ? 'bg-sky-500 text-white shadow-lg scale-[1.02]' : 'text-white/30 hover:bg-white/5'}`}>
               <div className="flex items-center gap-3"><span>{tab.icon}</span> {tab.label}</div>
               {tab.badge ? <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] animate-pulse">{tab.badge}</span> : null}
             </button>
           ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 md:p-10 overflow-y-auto no-scrollbar bg-[#020617]">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
             <div className="space-y-8 animate-in fade-in">
                <div className="flex items-center gap-4">
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">System Health</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-slate-800/30 border border-white/5 p-8 rounded-[40px] shadow-xl group hover:border-sky-500/20 transition-all">
                        <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-2">Registered Players</p>
                        <p className="text-6xl font-black text-white">{allUsers.length}</p>
                    </div>
                    <div className="bg-slate-800/30 border border-white/5 p-8 rounded-[40px] shadow-xl group hover:border-red-500/20 transition-all">
                        <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-2">Pending Requests</p>
                        <p className="text-6xl font-black text-red-500">{pendingCount}</p>
                    </div>
                    <div className="bg-slate-800/30 border border-white/5 p-8 rounded-[40px] shadow-xl group hover:border-green-500/20 transition-all">
                        <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-2">Server Status</p>
                        <p className="text-6xl font-black text-green-500 italic uppercase">Active</p>
                    </div>
                </div>
             </div>
          )}

          {/* User Hub Tab */}
          {activeTab === 'users' && (
             <div className="space-y-8 animate-in fade-in">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">User Hub</h3>
                    <div className="relative">
                        <input 
                          type="text" 
                          placeholder="Search phone or name..." 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="bg-slate-900 border border-white/10 p-4 pl-12 rounded-2xl w-full md:w-80 text-sm font-bold focus:border-sky-500 outline-none transition-all shadow-inner"
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">🔍</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* User Table */}
                    <div className="lg:col-span-8 bg-slate-800/20 rounded-[40px] border border-white/5 overflow-hidden shadow-2xl flex flex-col h-[70vh]">
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left border-collapse">
                               <thead className="sticky top-0 bg-slate-900/90 backdrop-blur-md border-b border-white/10 z-10">
                                  <tr className="text-[10px] font-black uppercase text-white/40 tracking-widest">
                                    <th className="p-6">Player</th>
                                    <th className="p-6">Joined</th>
                                    <th className="p-6">Activity</th>
                                    <th className="p-6">Balance</th>
                                    <th className="p-6 text-right">Winnings</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-white/5">
                                  {filteredUsers.length === 0 ? (
                                      <tr><td colSpan={5} className="p-20 text-center opacity-30 font-bold uppercase italic text-lg tracking-widest">No matching players found</td></tr>
                                  ) : filteredUsers.map((u) => (
                                     <tr key={u.phone} onClick={() => setSelectedUser(u)} className={`cursor-pointer transition-all ${selectedUser?.phone === u.phone ? 'bg-sky-500/20' : 'hover:bg-white/5'}`}>
                                        <td className="p-6">
                                           <div className="flex items-center gap-3">
                                              <img src={u.avatar} className="w-10 h-10 rounded-xl border border-white/10 bg-slate-700 shadow-md" />
                                              <div className="max-w-[120px]">
                                                  <span className="font-black text-xs md:text-sm uppercase block truncate text-white">{u.name}</span>
                                                  <span className="text-[9px] text-sky-400/70 font-bold truncate block">{u.phone}</span>
                                              </div>
                                           </div>
                                        </td>
                                        <td className="p-6">
                                            <p className="text-[10px] font-bold text-white/60">{formatDate(u.createdAt)}</p>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col">
                                                <span className={`text-[8px] w-fit font-black px-2 py-0.5 rounded-full uppercase mb-1 ${u.isBlocked ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                                                    {u.isBlocked ? 'Blocked' : 'Active'}
                                                </span>
                                                <span className="text-[9px] text-white/30 italic">{formatTimeAgo(u.lastLogin)}</span>
                                            </div>
                                        </td>
                                        <td className="p-6 font-black text-yellow-500 text-base">৳{u.balance.toLocaleString()}</td>
                                        <td className="p-6 text-right font-black text-white/20 text-xs">৳{(u.stats?.totalWinnings || 0).toLocaleString()}</td>
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Quick Edit Panel */}
                    <div className="lg:col-span-4 space-y-4 h-fit sticky top-0">
                        {selectedUser ? (
                           <div className="bg-slate-800/40 rounded-[40px] border border-sky-500/30 p-8 shadow-2xl animate-in zoom-in-95 overflow-hidden relative">
                              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none text-9xl">🛡️</div>
                              <div className="text-center relative z-10">
                                 <img src={selectedUser.avatar} className="w-24 h-24 rounded-2xl border-4 border-sky-500 mx-auto mb-4 bg-slate-700 shadow-xl" />
                                 <h4 className="text-2xl font-black uppercase italic text-white tracking-tighter leading-none">{selectedUser.name}</h4>
                                 <p className="text-sky-400 font-bold mt-2 text-sm">{selectedUser.phone}</p>
                              </div>

                              <div className="grid grid-cols-2 gap-4 mt-8">
                                 <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
                                    <p className="text-[9px] font-black uppercase text-white/30 tracking-widest">Total Games</p>
                                    <p className="text-xl font-black text-white">{selectedUser.stats?.totalGames || 0}</p>
                                 </div>
                                 <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
                                    <p className="text-[9px] font-black uppercase text-white/30 tracking-widest">Win Rate</p>
                                    <p className="text-xl font-black text-green-500">
                                        {selectedUser.stats?.totalGames ? Math.round((selectedUser.stats.wins / selectedUser.stats.totalGames) * 100) : 0}%
                                    </p>
                                 </div>
                              </div>

                              <div className="mt-8 space-y-4 relative z-10">
                                 <div className="flex gap-2">
                                    <button onClick={() => setAdjustType('add')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${adjustType === 'add' ? 'bg-green-500 text-black shadow-lg scale-105' : 'bg-white/5 text-white/40'}`}>+ Credit</button>
                                    <button onClick={() => setAdjustType('subtract')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${adjustType === 'subtract' ? 'bg-red-500 text-white shadow-lg scale-105' : 'bg-white/5 text-white/40'}`}>- Debit</button>
                                 </div>
                                 <div className="relative">
                                    <input 
                                      type="number" 
                                      placeholder="0.00" 
                                      value={adjustAmount}
                                      onChange={(e) => setAdjustAmount(e.target.value)}
                                      className="w-full bg-slate-900/90 border border-white/10 p-5 rounded-2xl font-black text-white outline-none focus:border-sky-500 text-center text-2xl" 
                                    />
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 font-black">৳</span>
                                 </div>
                                 <button onClick={handleAdjustBalance} className="w-full bg-sky-500 py-5 rounded-2xl font-black text-sm uppercase shadow-xl hover:shadow-sky-500/20 active:translate-y-1 transition-all">Update Balance</button>
                                 
                                 <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
                                    <button 
                                        onClick={handleToggleBlock} 
                                        className={`w-full py-4 rounded-xl font-black text-[10px] uppercase transition-all ${selectedUser.isBlocked ? 'bg-white text-black' : 'bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white'}`}
                                    >
                                        {selectedUser.isBlocked ? '✅ Unblock Player' : '🚫 Ban User'}
                                    </button>
                                    <button onClick={() => setSelectedUser(null)} className="w-full py-2 text-[10px] font-black text-white/20 uppercase">Close Panel</button>
                                 </div>
                              </div>
                           </div>
                        ) : (
                           <div className="bg-slate-800/20 rounded-[40px] border border-dashed border-white/10 p-20 text-center opacity-20">
                              <span className="text-6xl block mb-4">👆</span>
                              <p className="font-black uppercase italic text-sm tracking-widest leading-relaxed">Select a player from the list<br/>to perform management tasks</p>
                           </div>
                        )}
                    </div>
                </div>
             </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="space-y-8 animate-in fade-in">
                <div className="flex justify-between items-center">
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Pending Requests</h3>
                    <div className="bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-full flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                        <span className="text-[10px] font-black uppercase text-red-500 tracking-widest">{pendingTransactions.length} Tasks</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {pendingTransactions.length === 0 ? (
                        <div className="py-20 text-center opacity-20 flex flex-col items-center border border-dashed border-white/10 rounded-[40px]">
                            <span className="text-6xl mb-4">🧘</span>
                            <p className="font-black uppercase italic text-xl">Peaceful moment... No requests!</p>
                        </div>
                    ) : (
                        pendingTransactions.map((tx) => (
                            <div key={tx.id} className="bg-slate-800/40 border border-white/5 rounded-[30px] p-6 flex flex-wrap md:flex-nowrap items-center justify-between group hover:border-sky-500/30 transition-all shadow-xl gap-6">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center p-3 shadow-lg shrink-0">
                                        <img src={REAL_LOGOS[tx.method.toLowerCase()]} className="h-full w-full object-contain" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-xl text-white uppercase italic tracking-tighter">{tx.userName}</span>
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${tx.type === 'DEPOSIT' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>{tx.type}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-white/40 font-bold text-[10px] uppercase tracking-tight">
                                            <span>📞 {tx.phone}</span>
                                            {tx.trxId && <span>🆔 Trx: <span className="text-sky-400 font-black">{tx.trxId}</span></span>}
                                            <span className="opacity-50">⏰ {formatTimeAgo(tx.timestamp)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8 ml-auto">
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

          {/* Gateways Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-8 animate-in fade-in max-w-2xl">
                <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Payment Nodes</h3>
                <div className="bg-[#0f172a]/80 rounded-[40px] border border-white/5 p-6 md:p-10 space-y-8 shadow-2xl">
                    <div className="space-y-6">
                        {['bkash', 'nagad', 'rocket'].map(m => (
                            <div key={m} className="flex items-center gap-4 md:gap-8 bg-slate-800/40 p-4 md:p-6 rounded-3xl border border-white/5 group hover:border-white/10 transition-all">
                                <div className="w-16 h-16 md:w-24 md:h-24 bg-white rounded-2xl flex items-center justify-center p-3 shrink-0 shadow-xl">
                                    <img src={REAL_LOGOS[m]} className="h-full w-full object-contain" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <label className="text-[9px] font-black uppercase text-white/30 tracking-[0.2em]">{m} gateway number</label>
                                    <input 
                                        type="tel" 
                                        value={m === 'bkash' ? bkashNum : m === 'nagad' ? nagadNum : rocketNum} 
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (m === 'bkash') setBkashNum(v);
                                            else if (m === 'nagad') setNagadNum(v);
                                            else setRocketNum(v);
                                        }} 
                                        className="w-full bg-[#080c14] border border-white/5 p-4 md:p-5 rounded-2xl font-black text-white outline-none focus:border-sky-500 text-lg md:text-xl shadow-inner" 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleSaveSettings} disabled={isSaving} className="w-full bg-sky-500 py-6 md:py-8 rounded-[30px] font-black text-xl md:text-2xl uppercase italic shadow-[0_10px_30px_rgba(14,165,233,0.3)] border-b-8 border-sky-700 active:translate-y-2 active:border-b-0 transition-all">
                        {isSaving ? "Processing..." : "SYNC GATEWAY SETTINGS"}
                    </button>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex justify-around bg-slate-900 border-t border-white/5 p-4 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
         {[
           { id: 'dashboard', icon: '📊' },
           { id: 'arena', icon: '🏟️' },
           { id: 'users', icon: '👥' },
           { id: 'transactions', icon: '💸', badge: pendingCount },
           { id: 'settings', icon: '⚙️' }
         ].map(tab => (
           <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`relative p-2 text-2xl transition-all ${activeTab === tab.id ? 'scale-125 text-sky-400' : 'opacity-30'}`}>
             {tab.icon}
             {tab.badge ? <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">{tab.badge}</span> : null}
           </button>
         ))}
      </div>
    </div>
  );
};

export default AdminPortal;
