
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
  
  // Payment Settings State
  const [bkashNum, setBkashNum] = useState('');
  const [nagadNum, setNagadNum] = useState('');
  const [rocketNum, setRocketNum] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);

  const pendingCount = pendingTransactions.length;
  const arenaCount = liveMatches.length;

  useEffect(() => {
    if (pendingCount > 0) soundManager.play('six');
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

  const handleTerminateMatch = async (matchId: string) => {
    if(!confirm("Terminate this match? Players will be kicked to Lobby.")) return;
    const match = liveMatches.find(m => m.matchId === matchId);
    if (match) {
        await databaseService.syncMatch({ ...match, status: 'TERMINATED' });
        soundManager.play('click');
        alert("Match Terminated!");
    }
  };

  const handleOverrideRoll = async (matchId: string, val: number) => {
    const match = liveMatches.find(m => m.matchId === matchId);
    if (match) {
        await databaseService.syncMatch({ ...match, nextRollOverride: val });
        alert(`Next dice roll for match set to ${val}!`);
        soundManager.play('win');
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
          alert("Payment numbers updated successfully!");
          soundManager.play('win');
      } catch (err) {
          alert("Error saving settings. Please check your Supabase connection.");
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="h-screen w-full bg-[#020617] flex flex-col text-white font-fredoka overflow-hidden">
      <div className="p-6 bg-slate-900 border-b border-white/5 flex justify-between items-center shadow-2xl relative z-10">
        <div className="flex items-center gap-4">
          <div className="bg-sky-500/20 p-3 rounded-2xl border border-sky-500/30">
            <span className="text-2xl animate-pulse">🛡️</span>
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter italic text-sky-400">Ludo Club Admin</h1>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> SYSTEM ONLINE
            </p>
          </div>
        </div>
        <button onClick={onExit} className="bg-red-600/10 text-red-500 px-8 py-3 rounded-2xl font-black uppercase text-xs border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">Exit Console</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 bg-slate-900/50 border-r border-white/5 flex flex-col p-6 gap-3 shrink-0">
           {[
             { id: 'dashboard', label: 'Overview', icon: '📊' },
             { id: 'arena', label: 'Live Arena', icon: '🏟️', badge: arenaCount > 0 ? arenaCount : null },
             { id: 'users', label: 'Player Hub', icon: '👥' },
             { id: 'transactions', label: 'Requests', icon: '💸', badge: pendingCount > 0 ? pendingCount : null },
             { id: 'settings', label: 'Gateway Setup', icon: '⚙️' }
           ].map(tab => (
             <button 
               key={tab.id}
               onClick={() => { soundManager.play('click'); setActiveTab(tab.id as any); }}
               className={`w-full p-5 rounded-3xl flex items-center justify-between font-black text-sm transition-all ${activeTab === tab.id ? 'bg-sky-500 text-white shadow-2xl' : 'text-white/30 hover:bg-white/5 hover:text-white/60'}`}
             >
               <div className="flex items-center gap-4"><span>{tab.icon}</span> {tab.label}</div>
               {tab.badge && (
                 <span className="bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center justify-center text-[10px] animate-bounce shadow-lg shadow-red-500/40">
                   {tab.badge}
                 </span>
               )}
             </button>
           ))}
        </div>

        <div className="flex-1 p-12 overflow-y-auto no-scrollbar bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.05)_0,transparent_100%)]">
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
               <div className="grid grid-cols-3 gap-8">
                  <div className="bg-slate-800/40 p-10 rounded-[50px] border border-white/5 shadow-2xl group hover:border-yellow-500/20 transition-all">
                     <p className="text-[11px] font-black uppercase text-sky-400 mb-4 tracking-widest">Total User Balance</p>
                     <h2 className="text-5xl font-black text-yellow-500 tracking-tighter">৳ {allUsers.reduce((acc, u) => acc + u.balance, 0).toLocaleString()}</h2>
                  </div>
                  <div className="bg-slate-800/40 p-10 rounded-[50px] border border-white/5 shadow-2xl group hover:border-green-500/20 transition-all">
                     <p className="text-[11px] font-black uppercase text-green-400 mb-4 tracking-widest">Registered Players</p>
                     <h2 className="text-5xl font-black text-white tracking-tighter">{allUsers.length}</h2>
                  </div>
                  <div className="bg-slate-800/40 p-10 rounded-[50px] border border-white/5 shadow-2xl group hover:border-red-500/20 transition-all">
                     <p className="text-[11px] font-black uppercase text-red-400 mb-4 tracking-widest">Active Arena Battles</p>
                     <h2 className="text-5xl font-black text-white tracking-tighter">{arenaCount}</h2>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'arena' && (
            <div className="space-y-8 animate-in fade-in">
               <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Battle Monitoring</h3>
               <div className="grid grid-cols-2 gap-8">
                  {liveMatches.length === 0 ? (
                    <div className="col-span-2 p-32 text-center opacity-10">
                       <span className="text-8xl block mb-8">🏟️</span>
                       <p className="font-black uppercase tracking-[0.5em] italic text-2xl">Arena is Empty</p>
                    </div>
                  ) : (
                    liveMatches.filter(m => m.status === 'ACTIVE').map(match => (
                        <div key={match.matchId} className="bg-slate-800/40 rounded-[45px] border border-white/5 p-8 space-y-6 shadow-2xl relative overflow-hidden group">
                           <div className="flex justify-between items-start">
                               <div>
                                   <p className="text-[10px] font-black uppercase tracking-widest text-sky-400 mb-1">{match.matchId}</p>
                                   <h4 className="text-xl font-black text-white italic">Table Stake: ৳{match.stake}</h4>
                               </div>
                               <button onClick={() => handleTerminateMatch(match.matchId)} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-3 rounded-2xl transition-all font-black text-xs uppercase">KILL MATCH</button>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                               {match.players.map((p, idx) => (
                                   <div key={idx} className="bg-black/20 p-4 rounded-3xl flex items-center justify-between border border-white/5">
                                       <div className="flex items-center gap-3">
                                           <div className={`w-3 h-3 rounded-full ${p.color === PlayerColor.RED ? 'bg-red-500' : p.color === PlayerColor.GREEN ? 'bg-green-500' : p.color === PlayerColor.YELLOW ? 'bg-yellow-400' : 'bg-blue-500'}`}></div>
                                           <span className="text-sm font-black text-white/80">{p.name}</span>
                                       </div>
                                   </div>
                               ))}
                           </div>
                           <div className="pt-4 border-t border-white/5">
                               <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest text-center mb-4">Manual Override Dice</p>
                               <div className="flex gap-2 justify-center">
                                   {[1, 2, 3, 4, 5, 6].map(v => (
                                       <button key={v} onClick={() => handleOverrideRoll(match.matchId, v)} className="w-10 h-10 bg-white/5 hover:bg-yellow-500 hover:text-black rounded-xl font-black transition-all border border-white/10">{v}</button>
                                   ))}
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
               <div className="flex flex-col gap-4">
                   <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Player Database</h3>
                   <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search Name or Phone..." className="w-full bg-slate-900 border border-white/10 p-5 rounded-3xl outline-none focus:border-sky-500 transition-all font-bold placeholder:text-white/10 shadow-2xl" />
               </div>
               <div className="grid grid-cols-12 gap-8">
                   <div className="col-span-5 bg-slate-800/30 rounded-[40px] border border-white/5 overflow-hidden max-h-[600px] overflow-y-auto no-scrollbar shadow-2xl">
                       {filteredUsers.length === 0 ? <div className="p-20 text-center opacity-20">No users found</div> : filteredUsers.map(u => (
                           <div key={u.phone} onClick={() => setSelectedUser(u)} className={`p-6 border-b border-white/5 flex items-center gap-4 cursor-pointer transition-all hover:bg-white/5 ${selectedUser?.phone === u.phone ? 'bg-sky-500/10 border-l-4 border-l-sky-500' : ''}`}>
                               <img src={u.avatar} className="w-12 h-12 rounded-full border border-white/10" alt="" />
                               <div className="flex-1">
                                   <h4 className="font-black text-white tracking-tight">{u.name}</h4>
                                   <p className="text-xs font-bold text-white/30">{u.phone}</p>
                               </div>
                               <div className="text-right font-black text-yellow-500 italic">৳ {u.balance.toLocaleString()}</div>
                           </div>
                       ))}
                   </div>
                   <div className="col-span-7">
                       {selectedUser ? (
                           <div className="bg-slate-800/30 rounded-[50px] border border-white/5 p-10 space-y-8 shadow-2xl animate-in zoom-in-95">
                               <div className="flex items-center gap-6">
                                   <img src={selectedUser.avatar} className="w-24 h-24 rounded-full border-4 border-white/10 shadow-2xl" alt="" />
                                   <div>
                                       <h3 className="text-3xl font-black tracking-tighter uppercase text-white">{selectedUser.name}</h3>
                                       <p className="text-sm font-black text-sky-400 tracking-widest uppercase">{selectedUser.phone}</p>
                                   </div>
                               </div>
                               <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 space-y-6">
                                   <h4 className="font-black uppercase italic text-sky-400 text-sm">Update Balance</h4>
                                   <div className="flex gap-4">
                                       <button onClick={() => setAdjustType('add')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase transition-all ${adjustType === 'add' ? 'bg-sky-500 text-white' : 'bg-white/5 text-white/20'}`}>Deposit</button>
                                       <button onClick={() => setAdjustType('subtract')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase transition-all ${adjustType === 'subtract' ? 'bg-red-500 text-white' : 'bg-white/5 text-white/20'}`}>Withdraw</button>
                                   </div>
                                   <div className="flex gap-4">
                                       <input type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="0.00" className="flex-1 bg-slate-900 border border-white/10 p-5 rounded-2xl font-black text-2xl text-yellow-500" />
                                       <button onClick={handleAdjustBalance} className="px-10 bg-green-500 text-black rounded-2xl font-black text-sm uppercase shadow-lg shadow-green-500/20 active:scale-95 transition-all">Submit</button>
                                   </div>
                               </div>
                           </div>
                       ) : <div className="h-full flex items-center justify-center opacity-10 font-black uppercase tracking-widest">Select Player to Edit</div>}
                   </div>
               </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-8 animate-in fade-in">
               <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Withdraw & Deposit Requests</h3>
               <div className="bg-slate-800/30 rounded-[60px] border border-white/5 overflow-hidden shadow-2xl">
                  {pendingTransactions.length === 0 ? <div className="p-32 text-center opacity-10 font-black uppercase italic text-2xl">No Pending Requests</div> : (
                    <table className="w-full text-left">
                       <thead className="bg-slate-900 border-b border-white/5 text-[11px] font-black uppercase text-white/40">
                          <tr><th className="p-8">User Info</th><th className="p-8">Amount</th><th className="p-8">Method</th><th className="p-8">Ref / Phone</th><th className="p-8">Control</th></tr>
                       </thead>
                       <tbody className="divide-y divide-white/5">
                          {pendingTransactions.map((tx) => (
                             <tr key={tx.id} className="hover:bg-white/5 transition-all">
                                <td className="p-8">
                                   <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase mb-2 inline-block ${tx.type === 'DEPOSIT' ? 'bg-green-500' : 'bg-red-500'}`}>{tx.type}</span>
                                   <div className="font-black text-white">{tx.userName}</div>
                                </td>
                                <td className="p-8 font-black text-yellow-500 italic text-2xl">৳ {tx.amount.toLocaleString()}</td>
                                <td className="p-8"><img src={METHOD_LOGOS[tx.method]} className="h-10 object-contain" alt="" /></td>
                                <td className="p-8">
                                   <div className="text-[11px] font-black uppercase text-sky-400">{tx.trxId || 'WITHDRAWAL'}</div>
                                   <div className="text-xs font-bold text-white/40">{tx.phone}</div>
                                </td>
                                <td className="p-8">
                                   <div className="flex gap-3">
                                      <button onClick={() => onApproveTransaction(tx)} className="bg-green-500 text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-90 transition-all">Approve</button>
                                      <button onClick={() => onRejectTransaction(tx.id)} className="bg-red-500/10 text-red-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-red-500/20 active:scale-90 transition-all">Reject</button>
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
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col gap-4">
                   <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Official Gateway Numbers</h3>
                   <p className="text-xs font-bold text-white/30 uppercase tracking-widest">These numbers will be shown to users for manual deposits</p>
               </div>

               <div className="bg-slate-800/30 rounded-[50px] border border-white/5 p-12 space-y-10 max-w-2xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-3xl rounded-full"></div>
                    <div className="space-y-8 relative z-10">
                        <div className="flex items-center gap-8 group">
                            <div className="bg-white/5 p-4 rounded-3xl border border-white/10 group-focus-within:border-pink-500/50 transition-all">
                                <img src={METHOD_LOGOS['bkash']} className="h-14 w-14 object-contain" alt="bKash" />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-black uppercase text-white/40 mb-2 block tracking-widest">bKash (Personal)</label>
                                <input type="tel" value={bkashNum} onChange={(e) => setBkashNum(e.target.value)} placeholder="017XXXXXXXX" className="w-full bg-slate-900 border border-white/10 p-5 rounded-2xl font-bold text-white outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 transition-all" />
                            </div>
                        </div>

                        <div className="flex items-center gap-8 group">
                            <div className="bg-white/5 p-4 rounded-3xl border border-white/10 group-focus-within:border-orange-500/50 transition-all">
                                <img src={METHOD_LOGOS['nagad']} className="h-14 w-14 object-contain" alt="Nagad" />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-black uppercase text-white/40 mb-2 block tracking-widest">Nagad (Personal)</label>
                                <input type="tel" value={nagadNum} onChange={(e) => setNagadNum(e.target.value)} placeholder="018XXXXXXXX" className="w-full bg-slate-900 border border-white/10 p-5 rounded-2xl font-bold text-white outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all" />
                            </div>
                        </div>

                        <div className="flex items-center gap-8 group">
                            <div className="bg-white/5 p-4 rounded-3xl border border-white/10 group-focus-within:border-purple-500/50 transition-all">
                                <img src={METHOD_LOGOS['rocket']} className="h-14 w-14 object-contain" alt="Rocket" />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-black uppercase text-white/40 mb-2 block tracking-widest">Rocket (Personal)</label>
                                <input type="tel" value={rocketNum} onChange={(e) => setRocketNum(e.target.value)} placeholder="019XXXXXXXX" className="w-full bg-slate-900 border border-white/10 p-5 rounded-2xl font-bold text-white outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all" />
                            </div>
                        </div>
                    </div>

                    <button onClick={handleSaveSettings} disabled={isSaving} className="w-full bg-sky-500 hover:bg-sky-400 text-white py-6 rounded-3xl font-black text-lg uppercase tracking-widest shadow-2xl shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">
                        {isSaving ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div> : null}
                        {isSaving ? "Updating Database..." : "Update Official Numbers"}
                    </button>
                    
                    <p className="text-[9px] text-center text-white/10 font-black uppercase tracking-[0.3em]">Cloud Sync Status: {isSaving ? 'Synchronizing...' : 'Up to Date'}</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
