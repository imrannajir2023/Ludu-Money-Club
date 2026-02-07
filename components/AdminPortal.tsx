
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfile, PendingTransaction, LiveMatch, PlayerColor, CurrencyCode } from '../types';
import { soundManager } from '../services/soundService';
import { databaseService } from '../services/database';
import { CURRENCY_CONFIG } from '../constants';

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
  rocket: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%238C3494' rx='20'/%3E%3Cpath d='M30 75 L50 20 L70 75 L50 60 Z' fill='white'/%3E%3Ctext x='50' y='90' text-anchor='middle' fill='white' font-family='Arial, sans-serif' font-weight='900' font-size='12' text-transform='uppercase'%3ERocket%3C/text%3E%3C/svg%3E",
  binance: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23F3BA2F' rx='20'/%3E%3Cpath d='M50 20 L30 40 L50 60 L70 40 Z' fill='black'/%3E%3Cpath d='M50 80 L30 60 L50 40 L70 60 Z' fill='black'/%3E%3Ctext x='50' y='90' text-anchor='middle' fill='black' font-family='Arial, sans-serif' font-weight='900' font-size='10' text-transform='uppercase'%3EBinance USDT%3C/text%3E%3C/svg%3E"
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
    return new Date(isoStr).toLocaleDateString();
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
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [adjustCurrency, setAdjustCurrency] = useState<CurrencyCode>('BDT');
  const [newPassword, setNewPassword] = useState<string>('');
  
  const [allTxs, setAllTxs] = useState<PendingTransaction[]>([]);
  const [bkashNum, setBkashNum] = useState('');
  const [nagadNum, setNagadNum] = useState('');
  const [rocketNum, setRocketNum] = useState('');
  const [binanceNum, setBinanceNum] = useState('');
  const [adminCommission, setAdminCommission] = useState("0");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
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
        setBinanceNum(settings.binance_number || '');
        setAdminCommission(settings.admin_commission || "0");
      }
    } catch (e) {
      console.error("fetchData Error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const totalBaseBalance = allUsers.reduce((acc, u) => acc + (u.balance || 0), 0);
    
    const flow: Record<CurrencyCode, { deposit: number, withdraw: number }> = {
      BDT: { deposit: 0, withdraw: 0 },
      USD: { deposit: 0, withdraw: 0 },
      INR: { deposit: 0, withdraw: 0 }
    };

    allTxs.forEach(t => {
      if (t.status === 'APPROVED' && flow[t.currency]) {
        if (t.type === 'DEPOSIT') flow[t.currency].deposit += t.amount;
        else flow[t.currency].withdraw += t.amount;
      }
    });

    return { totalBaseBalance, flow };
  }, [allUsers, allTxs]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.phone?.includes(searchTerm)
    );
  }, [allUsers, searchTerm]);

  const filteredTxs = useMemo(() => {
    return allTxs.filter(t => txFilter === 'ALL' || t.status === txFilter);
  }, [allTxs, txFilter]);

  const handleAdjustBalance = async () => {
    if (!selectedUser || !adjustAmount) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) return alert("সঠিক সংখ্যা লিখুন।");

    const config = CURRENCY_CONFIG[adjustCurrency] || CURRENCY_CONFIG['BDT'];
    const baseAmount = amount * config.rate;
    const newBalance = adjustType === 'add' ? selectedUser.balance + baseAmount : selectedUser.balance - baseAmount;
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

  const handleUpdatePassword = async () => {
    if (!selectedUser || !newPassword) return alert("নতুন পাসওয়ার্ড দিন।");
    const updatedUser = { ...selectedUser, password: newPassword };
    try {
      await databaseService.updateUser(updatedUser);
      onUpdateUsersDB(allUsers.map(u => u.phone === updatedUser.phone ? updatedUser : u));
      setSelectedUser(updatedUser);
      setNewPassword('');
      alert("পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!");
    } catch (e) {
      alert("ব্যর্থ হয়েছে।");
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
        alert(blockState ? "ইউজার ব্লক করা হয়েছে!" : "ইউজার আনব্লক করা হয়েছে!");
    } catch (e) {
        alert("ব্যর্থ হয়েছে।");
    }
  };

  const handleSaveSettings = async () => {
      setIsSaving(true);
      try {
          await Promise.all([
              databaseService.updateSetting('bkash_number', bkashNum),
              databaseService.updateSetting('nagad_number', nagadNum),
              databaseService.updateSetting('rocket_number', rocketNum),
              databaseService.updateSetting('binance_number', binanceNum)
          ]);
          alert("সেটিংস আপডেট করা হয়েছে!");
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="h-screen w-full bg-[#050a18] flex flex-col text-white font-sans overflow-hidden">
      
      {/* Top Header Section */}
      <div className="h-20 bg-[#0f172a] border-b border-white/5 flex items-center justify-between px-8 shrink-0 z-50">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-white rounded-xl overflow-hidden p-1">
               <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ef4444'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'/%3E%3C/svg%3E" alt="Shield Icon" />
            </div>
            <div>
               <h1 className="text-xl font-black italic text-[#42dbff] uppercase leading-none">MULTI-CURRENCY ADMIN</h1>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mt-1">GLOBAL DASHBOARD</p>
            </div>
         </div>
         <div className="flex items-center gap-6">
            <button onClick={fetchData} className="text-white/20 hover:text-[#42dbff] transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button onClick={onExit} className="bg-[#ef4444] text-white px-8 py-2.5 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">LOGOUT</button>
         </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Menu */}
        <div className="w-64 bg-[#0a1124] border-r border-white/5 flex flex-col p-4 shrink-0">
           {[
             { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: '📊' },
             { id: 'users', label: 'ইউজার লিস্ট', icon: '👥' },
             { id: 'transactions', label: 'লেনদেন', icon: '💸' },
             { id: 'settings', label: 'পেমেন্ট সেটিং', icon: '⚙️' }
           ].map(tab => (
             <button 
               key={tab.id} 
               onClick={() => setActiveTab(tab.id as any)} 
               className={`w-full py-5 px-6 rounded-2xl flex items-center gap-4 font-black text-sm transition-all mb-2 ${activeTab === tab.id ? 'bg-[#20bdff] text-white shadow-xl' : 'text-white/30 hover:bg-white/5'}`}
             >
               <span className="text-2xl">{tab.icon}</span> 
               <span>{tab.label}</span>
             </button>
           ))}
        </div>

        {/* Main Content Scrollable Area */}
        <div className="flex-1 p-10 overflow-y-auto no-scrollbar bg-[#050a18]">
          
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in">
               
               {/* Primary Counter Cards */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-[#111827]/40 p-10 rounded-[40px] border border-white/5 flex flex-col shadow-xl">
                      <p className="text-[10px] font-black uppercase text-white/20 mb-3">TOTAL USERS</p>
                      <p className="text-6xl font-black">{allUsers.length}</p>
                  </div>
                  <div className="bg-[#111827]/40 p-10 rounded-[40px] border border-white/5 flex flex-col shadow-xl relative overflow-hidden group">
                      <p className="text-[10px] font-black uppercase text-white/20 mb-3">TOTAL BDT VAULT</p>
                      <p className="text-5xl font-black text-[#fbbf24] truncate">৳{stats.totalBaseBalance.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#111827]/40 p-10 rounded-[40px] border border-white/5 flex flex-col shadow-xl">
                      <p className="text-[10px] font-black uppercase text-white/20 mb-3">PENDING REQUESTS</p>
                      <p className="text-6xl font-black text-[#42dbff]">{pendingTransactions.length}</p>
                  </div>
               </div>

               {/* Currency Flow Cards */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {['BDT', 'USD', 'INR'].map(curr => {
                    const data = stats.flow[curr as CurrencyCode] || { deposit: 0, withdraw: 0 };
                    const config = CURRENCY_CONFIG[curr as CurrencyCode] || CURRENCY_CONFIG['BDT'];
                    return (
                      <div key={curr} className="bg-[#111827]/40 p-10 rounded-[40px] border border-white/5 relative overflow-hidden group">
                         <div className="absolute top-8 right-8 text-7xl opacity-5 font-black text-white">{config.symbol}</div>
                         <h4 className="text-xl font-black italic text-[#42dbff] mb-6 uppercase">{curr} Flow</h4>
                         <div className="space-y-4">
                            <div className="flex justify-between items-center">
                               <span className="text-[10px] font-black uppercase text-green-500">DEPOSIT:</span>
                               <span className="text-xl font-black">{config.symbol}{data.deposit.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                               <span className="text-[10px] font-black uppercase text-red-500">WITHDRAW:</span>
                               <span className="text-xl font-black">{config.symbol}{data.withdraw.toLocaleString()}</span>
                            </div>
                         </div>
                      </div>
                    );
                  })}
               </div>

               {/* Commission Stat (Added below) */}
               <div className="bg-[#064e3b]/10 p-10 rounded-[40px] border border-[#059669]/20 flex flex-col">
                  <p className="text-[10px] font-black uppercase text-[#10b981] mb-2">PLATFORM COMMISSION COLLECTED (BASE)</p>
                  <p className="text-5xl font-black text-[#10b981]">৳{parseFloat(adminCommission).toLocaleString()}</p>
               </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in">
               <div className="flex bg-[#0f172a] border border-white/5 p-4 rounded-2xl mb-4">
                  <input 
                    type="text" 
                    placeholder="Search Users by Phone or Name..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-transparent p-1 outline-none font-bold text-sm"
                  />
               </div>
               
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-8 bg-[#0f172a]/40 rounded-[40px] border border-white/5 overflow-hidden">
                     <table className="w-full text-left">
                        <thead className="bg-[#0f172a] border-b border-white/5">
                           <tr className="text-[10px] font-black uppercase text-white/20">
                              <th className="p-6">User Profile</th>
                              <th className="p-6">Balance (Base)</th>
                              <th className="p-6">Status</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                           {filteredUsers.map(u => (
                             <tr key={u.phone} onClick={() => setSelectedUser(u)} className={`cursor-pointer transition-all ${selectedUser?.phone === u.phone ? 'bg-[#20bdff]/10' : 'hover:bg-white/5'}`}>
                                <td className="p-6">
                                   <div className="flex items-center gap-4">
                                      <img src={u.avatar} className="w-12 h-12 rounded-2xl bg-[#1e293b] border border-white/5" />
                                      <div><p className="text-sm font-black uppercase">{u.name}</p><p className="text-[10px] text-[#42dbff] font-bold mt-1">{u.phone}</p></div>
                                   </div>
                                </td>
                                <td className="p-6 font-black text-[#fbbf24]">৳{u.balance.toLocaleString()}</td>
                                <td className="p-6">
                                   <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase ${u.isBlocked ? 'bg-red-500 text-white' : 'bg-green-500 text-black'}`}>{u.isBlocked ? 'Blocked' : 'Active'}</span>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>

                  <div className="lg:col-span-4">
                     {selectedUser ? (
                       <div className="bg-[#0f172a] p-10 rounded-[50px] border border-[#20bdff]/20 sticky top-4 space-y-8 shadow-2xl">
                          <div className="text-center">
                            <img src={selectedUser.avatar} className="w-24 h-24 rounded-3xl mx-auto mb-4 border-4 border-[#20bdff]/10" />
                            <h4 className="text-2xl font-black uppercase italic tracking-tight">{selectedUser.name}</h4>
                            <p className="text-[11px] font-black text-white/20 uppercase mt-2">Password: <span className="text-[#42dbff]">{selectedUser.password || 'N/A'}</span></p>
                          </div>
                          
                          <div className="space-y-4">
                             <p className="text-[10px] font-black uppercase text-white/20 ml-2">ADJUST BALANCE</p>
                             <div className="flex bg-[#050a18] p-1.5 rounded-2xl border border-white/5">
                                {Object.keys(CURRENCY_CONFIG).map(c => (
                                  <button key={c} onClick={() => setAdjustCurrency(c as CurrencyCode)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${adjustCurrency === c ? 'bg-[#20bdff] text-white' : 'text-white/20'}`}>{c}</button>
                                ))}
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => setAdjustType('add')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase ${adjustType === 'add' ? 'bg-green-500 text-black' : 'bg-[#050a18] text-white/30'}`}>+ ADD</button>
                                <button onClick={() => setAdjustType('subtract')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase ${adjustType === 'subtract' ? 'bg-red-500 text-white' : 'bg-[#050a18] text-white/30'}`}>- SUB</button>
                             </div>
                             <input type="number" placeholder={`Amount in ${adjustCurrency}`} value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} className="w-full bg-[#050a18] border border-white/5 p-5 rounded-3xl font-black text-center text-2xl text-[#fbbf24] outline-none" />
                             <button onClick={handleAdjustBalance} className="w-full py-5 bg-[#20bdff] rounded-3xl font-black uppercase text-sm shadow-xl hover:translate-y-[-2px] transition-all">SUBMIT UPDATE</button>
                          </div>

                          <div className="pt-8 border-t border-white/5 space-y-6">
                             <div>
                                <p className="text-[10px] font-black uppercase text-white/20 ml-2 mb-2">NEW PASSWORD</p>
                                <input 
                                  type="text" 
                                  placeholder="Enter new pwd" 
                                  value={newPassword}
                                  onChange={e => setNewPassword(e.target.value)}
                                  className="w-full bg-[#050a18] border border-white/5 p-5 rounded-3xl font-black text-center text-sm outline-none"
                                />
                                <button onClick={handleUpdatePassword} className="w-full mt-3 py-4 bg-white/5 rounded-2xl font-black uppercase text-[10px] hover:bg-white/10 transition-all">CHANGE PASSWORD</button>
                             </div>
                             <button 
                               onClick={handleToggleBlock} 
                               className={`w-full py-6 font-black uppercase text-sm rounded-3xl transition-all shadow-xl ${selectedUser.isBlocked ? 'bg-green-500 text-black' : 'bg-red-600 text-white'}`}
                             >
                               {selectedUser.isBlocked ? 'UNBLOCK ACCOUNT' : 'BLOCK ACCOUNT'}
                             </button>
                          </div>
                       </div>
                     ) : <div className="p-32 text-center border-4 border-dashed border-white/5 rounded-[50px] opacity-10 italic font-black uppercase">Select User to Manage</div>}
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-6 animate-in fade-in">
               <div className="flex gap-4 bg-[#0f172a] p-2 rounded-2xl border border-white/5 w-fit mb-8">
                {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(f => (
                  <button key={f} onClick={() => setTxFilter(f as any)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase ${txFilter === f ? 'bg-[#20bdff] text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}>{f}</button>
                ))}
               </div>

               <div className="space-y-4">
                {filteredTxs.length === 0 ? (
                  <div className="py-32 text-center opacity-10 italic uppercase font-black">No transaction records found</div>
                ) : filteredTxs.map(tx => (
                  <div key={tx.id} className="bg-[#0f172a]/40 border border-white/5 p-6 rounded-[35px] flex items-center justify-between group hover:bg-[#0f172a] transition-all">
                     <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center p-2.5 shadow-xl"><img src={REAL_LOGOS[tx.method.toLowerCase()] || REAL_LOGOS.bkash} className="w-full h-full object-contain" /></div>
                        <div>
                           <div className="flex items-center gap-3">
                              <span className="font-black uppercase text-lg">{tx.userName}</span>
                              <span className={`text-[8px] font-black px-2.5 py-1 rounded-lg uppercase ${tx.type === 'DEPOSIT' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>{tx.type}</span>
                              <span className="text-[8px] font-black bg-[#20bdff]/20 text-[#20bdff] px-2.5 py-1 rounded-lg uppercase">{tx.currency}</span>
                           </div>
                           <p className="text-[10px] font-bold text-white/30 mt-1.5 uppercase">📞 {tx.userPhone} | {formatTimeAgo(tx.timestamp)} {tx.trxId && `| Trx: ${tx.trxId}`}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-10">
                        <p className="text-3xl font-black text-[#fbbf24]">{(CURRENCY_CONFIG[tx.currency]||CURRENCY_CONFIG['BDT']).symbol}{tx.amount.toLocaleString()}</p>
                        {tx.status === 'PENDING' ? (
                          <div className="flex gap-3">
                             <button onClick={() => onApproveTransaction(tx)} className="bg-green-500 text-black px-6 py-3.5 rounded-2xl font-black uppercase text-[11px] shadow-lg">APPROVE</button>
                             <button onClick={() => onRejectTransaction(tx.id)} className="bg-red-500/20 text-red-500 px-6 py-3.5 rounded-2xl font-black uppercase text-[11px] border border-red-500/10">REJECT</button>
                          </div>
                        ) : <span className={`text-sm font-black uppercase tracking-widest ${tx.status === 'APPROVED' ? 'text-green-500' : 'text-red-500'}`}>{tx.status}</span>}
                     </div>
                  </div>
                ))}
               </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in py-10">
               <div className="bg-[#0f172a] p-12 rounded-[60px] border border-white/5 space-y-8 shadow-2xl">
                  <h3 className="text-3xl font-black italic uppercase text-center text-[#42dbff]">Gateway Configuration</h3>
                  {['bkash', 'nagad', 'rocket', 'binance'].map(m => (
                    <div key={m} className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-white/20 ml-4">{m} Number / Hash Address</label>
                        <input 
                          type="text" 
                          value={m === 'bkash' ? bkashNum : m === 'nagad' ? nagadNum : m === 'rocket' ? rocketNum : binanceNum} 
                          onChange={e => m === 'bkash' ? setBkashNum(e.target.value) : m === 'nagad' ? setNagadNum(e.target.value) : m === 'rocket' ? setRocketNum(e.target.value) : setBinanceNum(e.target.value)}
                          className="w-full bg-[#050a18] border border-white/5 p-5 rounded-[25px] font-black text-white outline-none focus:border-[#20bdff]/50 transition-all text-lg" 
                        />
                    </div>
                  ))}
                  <button onClick={handleSaveSettings} disabled={isSaving} className="w-full py-6 bg-gradient-to-r from-[#20bdff] to-[#4c66f5] rounded-[30px] font-black text-xl uppercase italic text-white shadow-2xl active:translate-y-1 transition-all mt-6">
                     {isSaving ? "UPDATING..." : "SAVE CONFIGURATION"}
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
