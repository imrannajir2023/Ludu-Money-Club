
import React, { useState, useEffect, useMemo } from 'react';
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
  const [adjustCurrency, setAdjustCurrency] = useState<CurrencyCode>('BDT');
  
  const [allTxs, setAllTxs] = useState<PendingTransaction[]>([]);
  const [bkashNum, setBkashNum] = useState('');
  const [nagadNum, setNagadNum] = useState('');
  const [rocketNum, setRocketNum] = useState('');
  const [binanceNum, setBinanceNum] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
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
      }
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
    const totalBaseBalance = allUsers.reduce((acc, u) => acc + (u.balance || 0), 0);
    
    // Categorize by currency
    const txByCurrency: Record<string, { deposits: number, withdraws: number }> = {
        BDT: { deposits: 0, withdraws: 0 },
        USD: { deposits: 0, withdraws: 0 },
        INR: { deposits: 0, withdraws: 0 }
    };

    allTxs.filter(t => t.status === 'APPROVED').forEach(t => {
        if (!txByCurrency[t.currency]) txByCurrency[t.currency] = { deposits: 0, withdraws: 0 };
        if (t.type === 'DEPOSIT') txByCurrency[t.currency].deposits += t.amount;
        else txByCurrency[t.currency].withdraws += t.amount;
    });

    return { totalBaseBalance, txByCurrency };
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
    <div className="min-h-screen w-full bg-[#020617] flex flex-col text-white overflow-hidden relative font-sans">
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-sky-400 font-black uppercase tracking-widest text-sm animate-pulse">Syncing Global Data...</p>
        </div>
      )}

      <div className="p-6 bg-slate-900 border-b border-white/5 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-sky-500/10 p-2.5 rounded-xl border border-sky-500/20 text-sky-400">🛡️</div>
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-sky-400">Multi-Currency Admin</h1>
            <p className="text-[9px] font-black opacity-30 uppercase tracking-widest">Global Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="p-2 text-white/20 hover:text-white transition-colors">🔄</button>
          <button onClick={onExit} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl font-black uppercase text-xs">Logout</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-slate-900/50 border-r border-white/5 p-4 flex flex-col gap-2 shrink-0">
           {[
             { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: '📊' },
             { id: 'users', label: 'ইউজার লিস্ট', icon: '👥' },
             { id: 'transactions', label: 'লেনদেন', icon: '💸', badge: pendingTransactions.length },
             { id: 'settings', label: 'পেমেন্ট সেটিং', icon: '⚙️' }
           ].map(tab => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-full p-4 rounded-2xl flex items-center justify-between font-black text-sm transition-all ${activeTab === tab.id ? 'bg-sky-500 text-white shadow-lg' : 'text-white/30 hover:bg-white/5'}`}>
               <div className="flex items-center gap-3"><span className="text-lg">{tab.icon}</span> <span>{tab.label}</span></div>
               {tab.badge ? <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px]">{tab.badge}</span> : null}
             </button>
           ))}
        </div>

        <div className="flex-1 p-8 overflow-y-auto no-scrollbar bg-slate-950/40">
          
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-800/20 border border-white/5 p-6 rounded-[32px]">
                      <p className="text-[10px] font-black uppercase text-white/30 mb-1">Total Users</p>
                      <p className="text-4xl font-black text-white">{allUsers.length}</p>
                  </div>
                  <div className="bg-slate-800/20 border border-white/5 p-6 rounded-[32px]">
                      <p className="text-[10px] font-black uppercase text-white/30 mb-1">Total BDT Vault</p>
                      <p className="text-4xl font-black text-yellow-400">৳{stats.totalBaseBalance.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-800/20 border border-white/5 p-6 rounded-[32px]">
                      <p className="text-[10px] font-black uppercase text-white/30 mb-1">Pending Requests</p>
                      <p className="text-4xl font-black text-sky-400">{pendingTransactions.length}</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                  {Object.entries(stats.txByCurrency).map(([curr, data]) => {
                    const config = CURRENCY_CONFIG[curr as CurrencyCode] || CURRENCY_CONFIG['BDT'];
                    return (
                      <div key={curr} className="bg-slate-900 border border-white/5 p-6 rounded-[32px] relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-4 opacity-5 text-6xl font-black">{config.symbol}</div>
                         <h4 className="font-black text-sky-400 mb-4">{curr} Flow</h4>
                         <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase">
                               <span className="text-green-500">Deposit:</span>
                               <span>{config.symbol}{data.deposits.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-black uppercase">
                               <span className="text-red-500">Withdraw:</span>
                               <span>{config.symbol}{data.withdraws.toLocaleString()}</span>
                            </div>
                         </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
               <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black uppercase italic">ইউজার ডাটাবেস</h3>
                  <input 
                    type="text" 
                    placeholder="Search name/phone..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-slate-900 border border-white/10 p-4 rounded-2xl outline-none focus:border-sky-500 w-80 font-bold text-sm"
                  />
               </div>

               <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-8 bg-slate-900/50 rounded-[32px] border border-white/5 overflow-hidden">
                     <table className="w-full text-left">
                        <thead className="bg-slate-900 border-b border-white/10">
                           <tr className="text-[10px] font-black uppercase text-white/30">
                              <th className="p-5">ইউজার প্রোফাইল</th>
                              <th className="p-5">ব্যালেন্স (Base)</th>
                              <th className="p-5">অবস্থা</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                           {filteredUsers.map(u => (
                             <tr key={u.phone} onClick={() => setSelectedUser(u)} className={`cursor-pointer transition-all ${selectedUser?.phone === u.phone ? 'bg-sky-500/20' : 'hover:bg-white/5'}`}>
                                <td className="p-5">
                                   <div className="flex items-center gap-3">
                                      <img src={u.avatar} className="w-10 h-10 rounded-xl bg-slate-700" />
                                      <div>
                                         <p className="text-sm font-black uppercase">{u.name}</p>
                                         <p className="text-[9px] font-bold text-sky-400/60">{u.phone}</p>
                                      </div>
                                   </div>
                                </td>
                                <td className="p-5 font-black text-yellow-400">৳{u.balance.toLocaleString()}</td>
                                <td className="p-5">
                                   <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${u.isBlocked ? 'bg-red-500' : 'bg-green-500 text-black'}`}>
                                      {u.isBlocked ? 'Blocked' : 'Active'}
                                   </span>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>

                  <div className="col-span-4 space-y-4">
                     {selectedUser ? (
                       <div className="bg-slate-800/40 rounded-[32px] border border-sky-500/30 p-6 animate-in zoom-in-95">
                          <img src={selectedUser.avatar} className="w-16 h-16 rounded-2xl mx-auto mb-3 border-4 border-sky-500" />
                          <h4 className="text-center text-xl font-black uppercase mb-6">{selectedUser.name}</h4>
                          
                          <div className="space-y-4">
                             <div className="flex gap-2 bg-black/20 p-1 rounded-xl">
                                {Object.keys(CURRENCY_CONFIG).map(c => (
                                  <button key={c} onClick={() => setAdjustCurrency(c as CurrencyCode)} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${adjustCurrency === c ? 'bg-sky-500 text-white' : 'text-white/20'}`}>{c}</button>
                                ))}
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => setAdjustType('add')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase ${adjustType === 'add' ? 'bg-green-500 text-black' : 'bg-white/5 text-white/40'}`}>+ Add</button>
                                <button onClick={() => setAdjustType('subtract')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase ${adjustType === 'subtract' ? 'bg-red-500 text-white' : 'bg-white/5 text-white/40'}`}>- Sub</button>
                             </div>
                             <input 
                               type="number" 
                               placeholder={`Amount in ${adjustCurrency}`} 
                               value={adjustAmount}
                               onChange={e => setAdjustAmount(e.target.value)}
                               className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl font-black text-center text-xl text-yellow-400" 
                             />
                             <button onClick={handleAdjustBalance} className="w-full bg-sky-500 py-4 rounded-2xl font-black uppercase text-xs">Execute Adjustment</button>
                             <button onClick={handleToggleBlock} className="w-full py-4 text-red-500 text-[10px] font-black uppercase border border-red-500/20 rounded-2xl">{selectedUser.isBlocked ? 'Unblock User' : 'Block User'}</button>
                          </div>
                       </div>
                     ) : <div className="h-64 border-2 border-dashed border-white/5 rounded-[32px] flex items-center justify-center opacity-20">ইউজার সিলেক্ট করুন</div>}
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-6">
               <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black uppercase italic">লেনদেন রিকোয়েস্ট</h3>
                  <div className="flex gap-2 bg-slate-900 p-1.5 rounded-2xl border border-white/10">
                     {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(f => (
                       <button key={f} onClick={() => setTxFilter(f as any)} className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase ${txFilter === f ? 'bg-sky-500 text-white' : 'text-white/30'}`}>{f}</button>
                     ))}
                  </div>
               </div>

               <div className="space-y-3">
                  {filteredTxs.map(tx => {
                    const config = CURRENCY_CONFIG[tx.currency] || CURRENCY_CONFIG['BDT'];
                    return (
                      <div key={tx.id} className="bg-slate-900 border border-white/5 p-5 rounded-3xl flex items-center justify-between group hover:border-sky-500/40 transition-all">
                         <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 shadow-lg">
                               <img src={REAL_LOGOS[tx.method.toLowerCase()]} className="w-full h-full object-contain" />
                            </div>
                            <div>
                               <div className="flex items-center gap-2">
                                  <span className="font-black text-white uppercase">{tx.userName}</span>
                                  <span className={`text-[7px] font-black px-2 py-0.5 rounded-full uppercase ${tx.type === 'DEPOSIT' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>{tx.type === 'DEPOSIT' ? 'DEP' : 'WIT'}</span>
                                  <span className="bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full text-[7px] font-black">{tx.currency}</span>
                               </div>
                               <div className="flex gap-x-4 mt-0.5 text-[9px] font-bold text-white/30 uppercase">
                                  <span>📞 {tx.phone}</span>
                                  {tx.trxId && <span>Trx: <span className="text-sky-400 font-black">{tx.trxId}</span></span>}
                                  <span>{formatTimeAgo(tx.timestamp)}</span>
                               </div>
                            </div>
                         </div>
                         
                         <div className="flex items-center gap-6">
                            <div className="text-right">
                               <p className="text-2xl font-black text-yellow-500">{config.symbol}{tx.amount.toLocaleString()}</p>
                            </div>
                            {tx.status === 'PENDING' ? (
                              <div className="flex gap-2">
                                 <button onClick={() => onApproveTransaction(tx)} className="bg-green-500 text-black px-4 py-2 rounded-xl font-black uppercase text-[9px]">Approve</button>
                                 <button onClick={() => onRejectTransaction(tx.id)} className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl font-black uppercase text-[9px]">Reject</button>
                              </div>
                            ) : <span className={`text-[10px] font-black uppercase ${tx.status === 'APPROVED' ? 'text-green-500' : 'text-red-500'}`}>{tx.status}</span>}
                         </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-xl">
                <h3 className="text-2xl font-black uppercase italic">পেমেন্ট গেটওয়ে</h3>
                <div className="bg-slate-900/60 rounded-[40px] border border-white/5 p-8 space-y-6">
                    {['bkash', 'nagad', 'rocket', 'binance'].map(m => (
                        <div key={m} className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-white/30 ml-2">{m} {m === 'binance' ? 'USDT (TRC20) Wallet' : 'Personal Number'}</label>
                            <input 
                                type="text" 
                                value={m === 'bkash' ? bkashNum : m === 'nagad' ? nagadNum : m === 'rocket' ? rocketNum : binanceNum} 
                                onChange={e => m === 'bkash' ? setBkashNum(e.target.value) : m === 'nagad' ? setNagadNum(e.target.value) : m === 'rocket' ? setRocketNum(e.target.value) : setBinanceNum(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl font-bold text-white outline-none focus:border-sky-500 transition-all" 
                            />
                        </div>
                    ))}
                    <button onClick={handleSaveSettings} disabled={isSaving} className="w-full py-5 bg-sky-500 rounded-[24px] font-black text-xl uppercase italic text-white shadow-xl active:translate-y-1 transition-all">
                        {isSaving ? "সংরক্ষণ হচ্ছে..." : "সেটিংস আপডেট করুন"}
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
