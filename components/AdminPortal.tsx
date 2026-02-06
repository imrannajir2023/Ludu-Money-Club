
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
  allUsers = [], 
  onUpdateUsersDB, 
  pendingTransactions = [], 
  onApproveTransaction, 
  onRejectTransaction, 
  onExit,
  onRefreshData
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'transactions' | 'settings'>('dashboard');
  const [txFilter, setTxFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  
  const [allTxs, setAllTxs] = useState<PendingTransaction[]>([]);
  const [bkashNum, setBkashNum] = useState('');
  const [nagadNum, setNagadNum] = useState('');
  const [rocketNum, setRocketNum] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'ONLINE' | 'SYNCING'>('ONLINE');

  const fetchData = async () => {
    setIsLoading(true);
    setDbStatus('SYNCING');
    try {
      const [txs, settings] = await Promise.all([
        databaseService.getAllTransactions(),
        databaseService.getSettings()
      ]);
      setAllTxs(txs);
      if (settings) {
        setBkashNum(settings.bkash_number || '');
        setNagadNum(settings.nagad_number || '');
        setRocketNum(settings.rocket_number || '');
      }
      setDbStatus('ONLINE');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const stats = useMemo(() => {
    const totalBalance = allUsers.reduce((acc, u) => acc + (u.balance || 0), 0);
    const approvedDeposits = allTxs.filter(t => t.type === 'DEPOSIT' && t.status === 'APPROVED').reduce((acc, t) => acc + t.amount, 0);
    const approvedWithdraws = allTxs.filter(t => t.type === 'WITHDRAW' && t.status === 'APPROVED').reduce((acc, t) => acc + t.amount, 0);
    return { totalBalance, approvedDeposits, approvedWithdraws };
  }, [allUsers, allTxs]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.phone?.includes(searchTerm)
    ).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [allUsers, searchTerm]);

  const filteredTxs = useMemo(() => {
    return allTxs.filter(t => {
      const matchStatus = txFilter === 'ALL' || t.status === txFilter;
      const matchSearch = t.userName.toLowerCase().includes(txSearchTerm.toLowerCase()) || 
                          t.userPhone.includes(txSearchTerm) || 
                          (t.trxId || '').includes(txSearchTerm);
      return matchStatus && matchSearch;
    });
  }, [allTxs, txFilter, txSearchTerm]);

  const handleAdjustBalance = async () => {
    if (!selectedUser || !adjustAmount) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) return alert("সঠিক সংখ্যা লিখুন।");

    const newBalance = adjustType === 'add' ? selectedUser.balance + amount : selectedUser.balance - amount;
    const updatedUser = { ...selectedUser, balance: Math.max(0, newBalance) };

    try {
        await databaseService.updateUser(updatedUser);
        onUpdateUsersDB(allUsers.map(u => u.phone === updatedUser.phone ? updatedUser : u));
        setSelectedUser(updatedUser);
        setAdjustAmount('');
        soundManager.play('win');
        alert("ব্যালেন্স আপডেট সফল হয়েছে!");
    } catch (e) {
        alert("ব্যালেন্স আপডেট ব্যর্থ হয়েছে।");
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
        alert("ব্যর্থ হয়েছে।");
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
          alert("পেমেন্ট গেটওয়ে নম্বর আপডেট করা হয়েছে!");
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="min-h-screen w-full bg-[#020617] flex flex-col text-white overflow-hidden relative font-sans">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-sky-400 font-black uppercase tracking-widest text-sm animate-pulse">Connecting to Database...</p>
        </div>
      )}

      {/* Top Header */}
      <div className="p-4 md:p-6 bg-slate-900 border-b border-white/5 flex justify-between items-center shadow-2xl shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-sky-500/10 p-2.5 rounded-xl border border-sky-500/20 text-sky-400">🛡️</div>
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-sky-400">Admin Control</h1>
            <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'ONLINE' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                <span className="text-[9px] font-black opacity-30 uppercase tracking-widest">{dbStatus}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="p-2 text-white/20 hover:text-white transition-colors">🔄</button>
          <button onClick={onExit} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">Logout</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar Nav */}
        <div className="w-20 md:w-64 bg-slate-900/50 border-r border-white/5 p-4 flex flex-col gap-2 shrink-0 overflow-y-auto no-scrollbar">
           {[
             { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: '📊' },
             { id: 'users', label: 'ইউজার লিস্ট', icon: '👥' },
             { id: 'transactions', label: 'পেমেন্ট রিকুয়েস্ট', icon: '💸', badge: pendingTransactions.length },
             { id: 'settings', label: 'পেমেন্ট সেটিং', icon: '⚙️' }
           ].map(tab => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-full p-4 rounded-2xl flex items-center justify-between font-black text-sm transition-all ${activeTab === tab.id ? 'bg-sky-500 text-white shadow-lg' : 'text-white/30 hover:bg-white/5'}`}>
               <div className="flex items-center gap-3"><span className="text-lg">{tab.icon}</span> <span className="hidden md:inline">{tab.label}</span></div>
               {tab.badge ? <span className="hidden md:flex bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] animate-pulse">{tab.badge}</span> : null}
             </button>
           ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto no-scrollbar bg-slate-950/40">
          
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-800/20 border border-white/5 p-6 rounded-[32px] shadow-xl">
                      <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-1">মোট ইউজার</p>
                      <p className="text-4xl font-black text-white">{allUsers.length}</p>
                  </div>
                  <div className="bg-slate-800/20 border border-white/5 p-6 rounded-[32px] shadow-xl">
                      <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-1">সবার মোট ব্যালেন্স</p>
                      <p className="text-4xl font-black text-yellow-400">৳{stats.totalBalance.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-800/20 border border-white/5 p-6 rounded-[32px] shadow-xl">
                      <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-1">নেট প্রফিট (Est)</p>
                      <p className="text-4xl font-black text-green-500">৳{(stats.approvedDeposits - stats.approvedWithdraws).toLocaleString()}</p>
                  </div>
               </div>

               <div className="bg-slate-900 p-8 rounded-[40px] border border-white/5">
                  <h3 className="text-xl font-black uppercase italic text-sky-400 mb-6">সার্ভার স্ট্যাটাস</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-50 text-[10px] font-black uppercase">
                      <div className="p-4 bg-black/20 rounded-2xl border border-white/5">Database: Live</div>
                      <div className="p-4 bg-black/20 rounded-2xl border border-white/5">Latency: 24ms</div>
                      <div className="p-4 bg-black/20 rounded-2xl border border-white/5">Uptime: 99.9%</div>
                      <div className="p-4 bg-black/20 rounded-2xl border border-white/5">Admin: Master</div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">ইউজার ডাটাবেস</h3>
                  <div className="relative w-full md:w-80">
                     <input 
                       type="text" 
                       placeholder="নাম বা মোবাইল দিয়ে খুঁজুন..." 
                       value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)}
                       className="w-full bg-slate-900 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-sky-500 transition-all font-bold text-sm text-white"
                     />
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8 bg-slate-900/50 rounded-[32px] border border-white/5 overflow-hidden shadow-2xl h-[60vh] flex flex-col">
                     <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                           <thead className="bg-slate-900/90 sticky top-0 border-b border-white/10 z-10">
                              <tr className="text-[10px] font-black uppercase text-white/30 tracking-widest">
                                 <th className="p-5">ইউজার প্রোফাইল</th>
                                 <th className="p-5">ব্যালেন্স</th>
                                 <th className="p-5">অবস্থা</th>
                                 <th className="p-5 text-right">তারিখ</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-white/5">
                              {filteredUsers.length === 0 ? (
                                <tr><td colSpan={4} className="p-20 text-center opacity-20">কোনো ইউজার পাওয়া যায়নি</td></tr>
                              ) : filteredUsers.map(u => (
                                <tr key={u.phone} onClick={() => setSelectedUser(u)} className={`cursor-pointer transition-all ${selectedUser?.phone === u.phone ? 'bg-sky-500/20' : 'hover:bg-white/5'}`}>
                                   <td className="p-5">
                                      <div className="flex items-center gap-3">
                                         <img src={u.avatar} className="w-10 h-10 rounded-xl bg-slate-700 border border-white/10" />
                                         <div>
                                            <p className="text-sm font-black uppercase text-white truncate max-w-[120px]">{u.name}</p>
                                            <p className="text-[9px] font-bold text-sky-400/60">{u.phone}</p>
                                         </div>
                                      </div>
                                   </td>
                                   <td className="p-5 font-black text-yellow-400">৳{u.balance.toLocaleString()}</td>
                                   <td className="p-5">
                                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${u.isBlocked ? 'bg-red-500 text-white' : 'bg-green-500 text-black'}`}>
                                         {u.isBlocked ? 'Blocked' : 'Active'}
                                      </span>
                                   </td>
                                   <td className="p-5 text-right text-[10px] font-bold text-white/20">{formatDate(u.createdAt)}</td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>

                  <div className="lg:col-span-4 h-fit">
                     {selectedUser ? (
                       <div className="bg-slate-800/40 rounded-[32px] border border-sky-500/30 p-6 shadow-2xl animate-in zoom-in-95">
                          <div className="text-center mb-6">
                             <img src={selectedUser.avatar} className="w-16 h-16 rounded-2xl mx-auto mb-3 border-4 border-sky-500 shadow-xl" />
                             <h4 className="text-xl font-black uppercase italic text-white tracking-tighter leading-none">{selectedUser.name}</h4>
                             <p className="text-sky-400 font-bold mt-1 text-[10px]">{selectedUser.phone}</p>
                          </div>
                          
                          <div className="space-y-4">
                             <div className="flex gap-2">
                                <button onClick={() => setAdjustType('add')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${adjustType === 'add' ? 'bg-green-500 text-black shadow-lg scale-105' : 'bg-white/5 text-white/40'}`}>+ টাকা যোগ</button>
                                <button onClick={() => setAdjustType('subtract')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${adjustType === 'subtract' ? 'bg-red-500 text-white shadow-lg scale-105' : 'bg-white/5 text-white/40'}`}>- টাকা বিয়োগ</button>
                             </div>
                             <input 
                               type="number" 
                               placeholder="টাকার পরিমাণ লিখুন" 
                               value={adjustAmount}
                               onChange={e => setAdjustAmount(e.target.value)}
                               className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl font-black text-center text-xl text-yellow-400 outline-none" 
                             />
                             <button onClick={handleAdjustBalance} className="w-full bg-sky-500 py-4 rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">কনফার্ম আপডেট</button>
                             
                             <button onClick={handleToggleBlock} className={`w-full py-4 mt-2 rounded-2xl font-black uppercase text-[10px] border transition-all ${selectedUser.isBlocked ? 'bg-white text-black' : 'border-red-500/20 text-red-500 hover:bg-red-500/10'}`}>
                                {selectedUser.isBlocked ? '🔓 ইউজার আনব্লক করুন' : '🚫 ইউজার ব্লক করুন'}
                             </button>
                          </div>
                       </div>
                     ) : (
                       <div className="h-64 border-2 border-dashed border-white/5 rounded-[32px] flex items-center justify-center p-10 text-center opacity-20 italic text-sm">
                          ম্যানেজ করার জন্য যেকোনো একজন ইউজার সিলেক্ট করুন
                       </div>
                     )}
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-6 animate-in fade-in">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">লেনদেন অনুরোধ</h3>
                  <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-white/10">
                     {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(f => (
                       <button key={f} onClick={() => setTxFilter(f as any)} className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase transition-all ${txFilter === f ? 'bg-sky-500 text-white shadow-md' : 'text-white/30'}`}>{f}</button>
                     ))}
                  </div>
               </div>

               <div className="space-y-3">
                  {filteredTxs.length === 0 ? (
                    <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[40px] opacity-10 italic">কোনো লেনদেন রেকর্ড নেই</div>
                  ) : filteredTxs.map(tx => (
                    <div key={tx.id} className="bg-slate-900 border border-white/5 p-5 rounded-3xl flex flex-wrap md:flex-nowrap items-center justify-between gap-6 group hover:border-sky-500/40 transition-all">
                       <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 shadow-lg shrink-0">
                             <img src={REAL_LOGOS[tx.method.toLowerCase()]} className="w-full h-full object-contain" />
                          </div>
                          <div>
                             <div className="flex items-center gap-2">
                                <span className="font-black text-white uppercase italic">{tx.userName}</span>
                                <span className={`text-[7px] font-black px-2 py-0.5 rounded-full uppercase ${tx.type === 'DEPOSIT' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>{tx.type === 'DEPOSIT' ? 'ডেপোজিট' : 'উইথড্র'}</span>
                             </div>
                             <div className="flex flex-wrap gap-x-4 mt-0.5 text-[9px] font-bold text-white/30 uppercase">
                                <span>📞 {tx.phone}</span>
                                {tx.trxId && <span>Trx: <span className="text-sky-400 font-black">{tx.trxId}</span></span>}
                                <span>{formatTimeAgo(tx.timestamp)}</span>
                             </div>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-6 ml-auto">
                          <div className="text-right">
                             <p className="text-[8px] font-black text-white/10 uppercase tracking-widest leading-none mb-1">পরিমাণ</p>
                             <p className="text-2xl font-black text-yellow-500">৳{tx.amount.toLocaleString()}</p>
                          </div>
                          {tx.status === 'PENDING' ? (
                            <div className="flex gap-2">
                               <button onClick={() => onApproveTransaction(tx)} className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-xl font-black uppercase text-[9px] shadow-lg active:scale-95 transition-all">Approve</button>
                               <button onClick={() => onRejectTransaction(tx.id)} className="bg-red-600/10 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl font-black uppercase text-[9px] active:scale-95 transition-all">Reject</button>
                            </div>
                          ) : (
                            <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${tx.status === 'APPROVED' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{tx.status}</span>
                          )}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6 animate-in fade-in max-w-xl">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">পেমেন্ট গেটওয়ে সেটআপ</h3>
                <div className="bg-slate-900/60 rounded-[40px] border border-white/5 p-8 space-y-8 shadow-2xl">
                    <div className="space-y-4">
                        {['bkash', 'nagad', 'rocket'].map(m => (
                            <div key={m} className="flex items-center gap-4 bg-slate-800/40 p-4 rounded-3xl border border-white/5">
                                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center p-2.5 shrink-0 shadow-lg">
                                    <img src={REAL_LOGOS[m]} className="h-full w-full object-contain" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[8px] font-black uppercase text-white/30 tracking-widest mb-1 block">{m} Personal Number</label>
                                    <input 
                                        type="tel" 
                                        value={m === 'bkash' ? bkashNum : m === 'nagad' ? nagadNum : rocketNum} 
                                        onChange={e => m === 'bkash' ? setBkashNum(e.target.value) : m === 'nagad' ? setNagadNum(e.target.value) : setRocketNum(e.target.value)}
                                        placeholder="01XXXXXXXXX"
                                        className="w-full bg-black/40 border border-white/5 p-3 rounded-xl font-black text-white text-lg outline-none focus:border-sky-500 transition-all" 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleSaveSettings} disabled={isSaving} className="w-full py-5 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-[24px] font-black text-xl uppercase italic text-white shadow-xl active:translate-y-1 transition-all">
                        {isSaving ? "সংরক্ষণ হচ্ছে..." : "গেটওয়ে নম্বর আপডেট করুন"}
                    </button>
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
