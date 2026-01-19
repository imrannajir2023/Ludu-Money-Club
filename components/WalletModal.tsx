
import React, { useState } from 'react';
import { UserProfile, PendingTransaction } from '../types';
import { soundManager } from '../services/soundService';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSubmitTransaction: (tx: PendingTransaction) => void;
}

const METHODS = [
  { id: 'bkash', name: 'bKash', color: '#D12053', logo: 'https://download.logo.wine/logo/BKash/BKash-Logo.wine.png' },
  { id: 'nagad', name: 'Nagad', color: '#F7941D', logo: 'https://download.logo.wine/logo/Nagad/Nagad-Logo.wine.png' },
  { id: 'rocket', name: 'Rocket', color: '#8C3494', logo: 'https://www.findlogovector.com/wp-content/uploads/2019/03/dutch-bangla-bank-rocket-logo-vector.png' }
];

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, user, onSubmitTransaction }) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<string>('bkash');
  const [trxId, setTrxId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  if (!isOpen) return null;

  const handleTransaction = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val < 50) return alert("Minimum amount is ৳50");
    if (activeTab === 'withdraw' && val > user.balance) return alert("Insufficient Balance!");
    if (!phone) return alert("Enter your mobile number");
    if (activeTab === 'deposit' && !trxId) return alert("Enter Transaction ID");

    setProcessing(true);
    soundManager.play('click');
    
    const newTx: PendingTransaction = {
      id: Math.random().toString(36).substr(2, 9),
      userName: user.name,
      type: activeTab === 'deposit' ? 'DEPOSIT' : 'WITHDRAW',
      method,
      amount: val,
      phone,
      trxId: activeTab === 'deposit' ? trxId : undefined,
      status: 'PENDING',
      timestamp: new Date().toLocaleTimeString()
    };

    setTimeout(() => {
      onSubmitTransaction(newTx);
      soundManager.play('six');
      setProcessing(false);
      onClose();
      alert(activeTab === 'deposit' ? "Deposit request sent! Admin will verify TrxID." : "Withdrawal request sent! Wait for admin approval.");
    }, 1500);
  };

  const selectedMethod = METHODS.find(m => m.id === method);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#1e293b] rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl border border-white/10 relative">
        <div className="p-6 text-center bg-gradient-to-r from-blue-700 to-indigo-900 border-b border-white/10">
          <h2 className="text-2xl font-black uppercase tracking-tighter italic text-white flex items-center justify-center gap-3">
             <span className="bg-yellow-500 text-black w-8 h-8 rounded-full flex items-center justify-center not-italic">৳</span>
             Cashier
          </h2>
          <button onClick={onClose} className="absolute top-4 right-6 text-white/50 text-2xl hover:text-white transition-colors">✕</button>
        </div>

        <div className="flex p-4 gap-2 bg-slate-900/50">
           <button onClick={() => setActiveTab('deposit')} className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'deposit' ? 'bg-yellow-500 text-black' : 'bg-white/5 text-white/40'}`}>
              📥 Deposit
           </button>
           <button onClick={() => setActiveTab('withdraw')} className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'withdraw' ? 'bg-yellow-500 text-black' : 'bg-white/5 text-white/40'}`}>
              📤 Withdraw
           </button>
        </div>

        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
          <div className="bg-white/5 p-6 rounded-[30px] text-center border border-white/5">
             <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 opacity-60">Current Balance</p>
             <h2 className="text-4xl font-black text-white italic tracking-tighter">৳ {user.balance.toLocaleString()}</h2>
          </div>

          <div className="space-y-4">
             <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Select Method</label>
                <div className="grid grid-cols-3 gap-3">
                    {METHODS.map(m => (
                      <button 
                        key={m.id} 
                        onClick={() => setMethod(m.id)} 
                        className={`relative h-16 rounded-2xl overflow-hidden border-2 transition-all flex items-center justify-center p-2 ${method === m.id ? 'border-yellow-500 ring-2 ring-yellow-500/20 shadow-lg' : 'border-white/5 bg-white/5 opacity-40 hover:opacity-100'}`}
                      >
                         <img src={m.logo} className="h-full w-full object-contain" alt={m.name} />
                         {method === m.id && <div className="absolute top-1 right-1 bg-yellow-500 text-black rounded-full w-4 h-4 flex items-center justify-center text-[10px]">✓</div>}
                      </button>
                    ))}
                </div>
             </div>

             <div className="space-y-4">
                <div className="relative">
                   <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-white/20">৳</span>
                   <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="w-full bg-white/5 border border-white/10 p-6 pl-12 rounded-3xl text-2xl font-black text-yellow-500 focus:outline-none focus:border-yellow-500 transition-all placeholder:text-white/10" />
                </div>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={`${selectedMethod?.name} Number`} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-lg font-bold text-white focus:outline-none focus:border-sky-500 transition-all" />
                {activeTab === 'deposit' && (
                  <input type="text" value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder="Transaction ID (TrxID)" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-lg font-bold text-white focus:outline-none focus:border-sky-500 transition-all uppercase" />
                )}
             </div>

             <button onClick={handleTransaction} disabled={processing} className={`w-full py-6 rounded-3xl font-black text-xl text-black bg-yellow-500 border-b-8 border-yellow-700 active:translate-y-2 active:border-b-0 transition-all flex items-center justify-center gap-3 ${processing ? 'opacity-50' : ''}`}>
                {processing ? <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin"></div> : (activeTab === 'deposit' ? 'DEPOSIT NOW' : 'WITHDRAW NOW')}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
