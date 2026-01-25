
import React, { useState, useEffect } from 'react';
import { UserProfile, PendingTransaction } from './types';
import AdminPortal from './components/AdminPortal';
import { databaseService } from './services/database';
import { soundManager } from './services/soundService';

const App: React.FC = () => {
  // State for view navigation
  const [view, setView] = useState<'LOBBY' | 'ADMIN'>('LOBBY');
  // Current user state
  const [user, setUser] = useState<UserProfile | null>(null);
  // All users from database
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  // Global pending transactions
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);

  // Initialize application data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const users = await databaseService.getUsers();
        setAllUsers(users);
        const pending = await databaseService.getPendingTransactions();
        setPendingTransactions(pending);
        
        // Setup a demo user if none exists in the DB
        if (users.length > 0) {
          setUser(users[0]);
        } else {
          const demoUser: UserProfile = {
            name: "Ludo Admin",
            phone: "01700000000",
            balance: 5000,
            avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
            stats: { totalGames: 0, wins: 0, totalWinnings: 0 },
            history: []
          };
          setUser(demoUser);
        }
      } catch (error) {
        console.error("Failed to load initial data", error);
      }
    };
    loadInitialData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-sky-500 selection:text-white">
      {/* Simple Lobby View */}
      {view === 'LOBBY' && (
        <div className="flex flex-col items-center justify-center h-screen space-y-12 px-4">
          <div className="text-center space-y-2">
            <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-sky-400 to-indigo-600 uppercase drop-shadow-2xl">
              Ludo Pro
            </h1>
            <p className="text-sky-500/50 font-black tracking-[0.3em] uppercase text-sm">Elite Tournament Edition</p>
          </div>
          
          <div className="bg-slate-900/40 p-10 rounded-[50px] border border-white/5 backdrop-blur-xl shadow-2xl text-center space-y-8 max-w-sm w-full">
            <div className="space-y-2">
              <p className="text-white/40 text-xs font-black uppercase tracking-widest">Administrative Access</p>
              <h2 className="text-xl font-bold">Welcome, {user?.name || 'Guest'}</h2>
            </div>
            
            <button 
              onClick={() => {
                soundManager.unlock();
                setView('ADMIN');
              }}
              className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:brightness-110 text-white px-10 py-5 rounded-[25px] font-black uppercase tracking-tighter transition-all shadow-[0_10px_30px_rgba(14,165,233,0.3)] active:scale-95 group"
            >
              Enter Dashboard <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>
      )}

      {/* Admin Portal View */}
      {view === 'ADMIN' && user && (
        <AdminPortal 
          user={user} 
          allUsers={allUsers} 
          onUpdateUsersDB={setAllUsers} 
          pendingTransactions={pendingTransactions} 
          liveMatches={[]} 
          onUpdateUser={async (u) => { 
            const updated = allUsers.map(usr => usr.phone === u.phone ? u : usr); 
            setAllUsers(updated); 
            await databaseService.updateUser(u); 
          }} 
          onApproveTransaction={async (tx) => { 
            try {
              // 1. Fetch the latest user data directly from DB to avoid stale closure or mismatch
              const lookupPhone = tx.accountPhone || tx.phone; // Fallback to tx.phone if old transaction
              const u = await databaseService.getUserByPhone(lookupPhone);
              
              if (u) { 
                const updatedUser = { 
                  ...u, 
                  balance: tx.type === 'DEPOSIT' ? u.balance + tx.amount : u.balance - tx.amount, 
                  history: (u.history || []).map(h => h.id === tx.id ? { ...h, status: 'APPROVED' as const } : h) 
                }; 
                
                // 2. Update Database (User Balance and History)
                await databaseService.updateUser(updatedUser); 
                
                // 3. Update Transaction Status in DB
                await databaseService.updateTransactionStatus(tx.id, 'APPROVED');
                
                // 4. Update Local States immediately
                setAllUsers(prev => prev.map(usr => usr.phone === updatedUser.phone ? updatedUser : usr)); 
                setPendingTransactions(prev => prev.filter(p => p.id !== tx.id)); 
                
                soundManager.play('win');
                alert(`${tx.userName} এর ${tx.type} অ্যাপ্রুভ হয়েছে।`);
              } else {
                alert(`সিস্টেমে ইউজারকে খুঁজে পাওয়া যায়নি। একাউন্ট নম্বর: ${lookupPhone}`);
              }
            } catch (err) {
              console.error("Approval error:", err);
              alert("অ্যাপ্রুভ করার সময় সার্ভারে ত্রুটি হয়েছে।");
            }
          }} 
          onRejectTransaction={async (txId) => { 
            try {
              await databaseService.updateTransactionStatus(txId, 'REJECTED'); 
              setPendingTransactions(prev => prev.filter(p => p.id !== txId)); 
              soundManager.play('kill');
              alert("রিকোয়েস্টটি রিজেক্ট করা হয়েছে।");
            } catch (err) {
              alert("সমস্যা হয়েছে!");
            }
          }} 
          onExit={() => setView('LOBBY')} 
        />
      )}
    </div>
  );
};

export default App;
