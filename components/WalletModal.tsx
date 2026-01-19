
import React, { useState } from 'react';
import { UserProfile, WalletTransaction } from '../types';

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
    
    if (activeTab === 'withdraw' && val > user.balance) {
      alert("Insufficient real money balance!");
      return;
    }

    setProcessing(true);
    setTimeout(() => {
      const newTransaction: WalletTransaction = {
        id: Math.random().toString(36).substr(2, 9),
        type: activeTab === 'deposit' ? 'DEPOSIT' : 'WITHDRAW',
        amount: val,
        date: new Date().toISOString(),
        status: 'COMPLETED'
      };

      const newBalance = activeTab === 'deposit' 
        ? user.balance + val 
        : user.balance - val;

      onUpdateUser({
        ...user,
        balance: newBalance,
        transactions: [newTransaction, ...user.transactions]
      });

      setProcessing(false);
      setAmount('');
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-[#fff9e6] rounded-[36px] w-full max-w-md overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.6)] border-[8px] border-[#8b4513] relative animate-in zoom-in duration-300">
        
        {/* Banner with 3D look */}
        <div className="bg-[#8b4513] p-5 text-center border-b-4 border-[#65320e] relative shadow-lg">
          <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10"></div>
          <h2 className="text-3xl font-black text-yellow-100 uppercase tracking-widest drop-shadow-lg italic">
             {activeTab === 'deposit' ? '🪙 BANK RECHARGE 🪙' : '🏦 CASH WITHDRAW 🏦'}
          </h2>
          <button onClick={onClose} className="absolute top-2 right-4 text-yellow-200 hover:text-white font-black text-3xl z-20">✕</button>
        </div>

        {/* Categories Bar */}
        <div className="flex p-3 gap-3 bg-[#e6d0a1]">
          <button 
            className={`flex-1 py-4 rounded-2xl font-black uppercase text-[11px] border-b-8 transition-all shadow-xl active:translate-y-1 active:border-b-4 ${activeTab === 'deposit' ? 'bg-green-500 border-green-800 text-white' : 'bg-[#dcb980] border-[#b08d55] text-[#6b4c2e]'}`}
            onClick={() => setActiveTab('deposit')}
          >
            Deposit Money
          </button>
          <button 
            className={`flex-1 py-4 rounded-2xl font-black uppercase text-[11px] border-b-8 transition-all shadow-xl active:translate-y-1 active:border-b-4 ${activeTab === 'withdraw' ? 'bg-orange-500 border-orange-800 text-white' : 'bg-[#dcb980] border-[#b08d55] text-[#6b4c2e]'}`}
            onClick={() => setActiveTab('withdraw')}
          >
            Instant Cashout
          </button>
        </div>

        <div className="p-6">
          <div className="bg-white/80 rounded-3xl p-6 text-center mb-8 border-4 border-[#dcb980] shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)]">
            <p className="text-[#8b4513] text-[11px] font-black uppercase tracking-widest mb-1 opacity-60">Wallet Balance</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl">৳</span>
              <h2 className="text-6xl font-black text-[#8b4513] drop-shadow-sm tracking-tighter">{user.balance.toLocaleString()}</h2>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-[11px] font-black mb-2 text-[#8b4513] uppercase px-2">Amount to {activeTab === 'deposit' ? 'add' : 'withdraw'}</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-6 text-4xl font-black border-4 border-[#dcb980] rounded-[30px] focus:border-green-500 focus:outline-none bg-white text-[#8b4513] placeholder-gray-300 text-center shadow-xl transition-all"
                  placeholder="0"
                />
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl opacity-20 font-black">৳</div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black mb-2 text-[#8b4513] uppercase px-2">Choose Trusted Gateway</label>
              <div className="grid grid-cols-3 gap-4">
                {['bkash', 'nagad', 'rocket'].map(m => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`py-4 px-1 border-b-8 rounded-2xl uppercase font-black text-[11px] transition-all shadow-lg active:translate-y-1 active:border-b-4 ${method === m ? 'bg-blue-600 border-blue-900 text-white scale-105' : 'bg-[#dcb980] border-[#b08d55] text-[#6b4c2e]'}`}
                  >
                    <div className="mb-1 text-lg">
                      {m === 'bkash' ? '👛' : m === 'nagad' ? '💸' : '🚀'}
                    </div>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={handleTransaction}
              disabled={processing}
              className={`w-full py-6 mt-6 rounded-[30px] font-black text-2xl text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)] border-b-[10px] transition-all active:scale-95 active:border-b-0 active:translate-y-2 ${activeTab === 'deposit' ? 'bg-gradient-to-b from-green-400 to-green-600 border-green-900' : 'bg-gradient-to-b from-blue-500 to-blue-700 border-blue-900'} ${processing ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              {processing ? 'Processing...' : activeTab === 'deposit' ? 'DEPOSIT NOW' : 'CASH OUT NOW'}
            </button>
          </div>
          
          <div className="mt-8 flex items-center justify-center gap-2 opacity-50">
            <span className="text-xl">🛡️</span>
            <p className="text-[10px] font-bold text-[#8b4513] uppercase tracking-tighter">100% Secure & Trusted SSL Encryption</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
