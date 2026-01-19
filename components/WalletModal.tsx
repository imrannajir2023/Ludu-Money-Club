
import React, { useState } from 'react';
import { UserProfile, WalletTransaction } from '../types';
import { soundManager } from '../services/soundService';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateUser: (u: UserProfile) => void;
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, user, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<string>('bkash');
  const [processing, setProcessing] = useState(false);

  if (!isOpen) return null;

  const handleTransaction = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    if (activeTab === 'withdraw' && val > user.balance) return alert("Insufficient Balance!");

    setProcessing(true);
    soundManager.play('click');
    
    setTimeout(() => {
      const newBalance = activeTab === 'deposit' ? user.balance + val : user.balance - val;
      onUpdateUser({ ...user, balance: newBalance });
      soundManager.play('six');
      setProcessing(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#1e293b] rounded-[40px] w-full max-w-sm overflow-hidden shadow-2xl border border-white/10 relative">
        <div className="p-6 text-center bg-gradient-to-b from-blue-600 to-indigo-800 border-b border-white/10">
          <h2 className="text-2xl font-black uppercase tracking-tighter italic text-white">Premium Wallet</h2>
          <button onClick={onClose} className="absolute top-4 right-6 text-white/50 text-2xl hover:text-white transition-colors">✕</button>
        </div>

        <div className="flex p-4 gap-2">
           <button onClick={() => setActiveTab('deposit')} className={`flex-1 py-3 rounded-2xl font-bold text-xs uppercase transition-all ${activeTab === 'deposit' ? 'bg-yellow-500 text-black' : 'bg-white/5 text-white'}`}>Deposit</button>
           <button onClick={() => setActiveTab('withdraw')} className={`flex-1 py-3 rounded-2xl font-bold text-xs uppercase transition-all ${activeTab === 'withdraw' ? 'bg-yellow-500 text-black' : 'bg-white/5 text-white'}`}>Withdraw</button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-white/5 p-8 rounded-[30px] text-center border border-white/5">
             <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">Total Balance</p>
             <h2 className="text-5xl font-black text-white italic tracking-tighter">৳ {user.balance.toLocaleString()}</h2>
          </div>

          <div className="space-y-4">
             <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter Amount" className="w-full bg-white/5 border border-white/10 p-6 rounded-3xl text-3xl font-black text-center text-yellow-500 focus:outline-none focus:border-yellow-500 transition-all" />
             
             <div className="flex gap-2">
                {['bkash', 'nagad', 'rocket'].map(m => (
                  <button key={m} onClick={() => setMethod(m)} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase border transition-all ${method === m ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}>{m}</button>
                ))}
             </div>

             <button onClick={handleTransaction} disabled={processing} className={`w-full py-6 rounded-3xl font-black text-xl text-black bg-yellow-500 border-b-8 border-yellow-700 active:translate-y-2 active:border-b-0 transition-all ${processing ? 'opacity-50' : ''}`}>
                {processing ? 'Processing...' : 'Confirm Transaction'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
