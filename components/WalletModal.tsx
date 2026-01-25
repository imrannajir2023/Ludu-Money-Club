
import React, { useState, useEffect } from 'react';
import { UserProfile, PendingTransaction } from '../types';
import { soundManager } from '../services/soundService';
import { databaseService } from '../services/database';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSubmitTransaction: (tx: PendingTransaction) => void;
}

const METHODS = [
  { id: 'bkash', name: 'bKash', color: '#D12053', logo: 'https://raw.githubusercontent.com/tushar-asif/bd-payment-gateways/main/logos/bkash.png' },
  { id: 'nagad', name: 'Nagad', color: '#F7941D', logo: 'https://raw.githubusercontent.com/tushar-asif/bd-payment-gateways/main/logos/nagad.png' },
  { id: 'rocket', name: 'Rocket', color: '#8C3494', logo: 'https://raw.githubusercontent.com/tushar-asif/bd-payment-gateways/main/logos/rocket.png' }
];

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, user, onSubmitTransaction }) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<string>('bkash');
  const [trxId, setTrxId] = useState<string>('');
  const [phone, setPhone] = useState<string>(user.phone || '');
  const [processing, setProcessing] = useState(false);
  const [paymentNumbers, setPaymentNumbers] = useState<any>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user.phone && !phone) setPhone(user.phone);
    
    const fetchSettings = async () => {
        const settings = await databaseService.getSettings();
        setPaymentNumbers(settings);
    };
    if (isOpen) fetchSettings();
  }, [user.phone, isOpen]);

  if (!isOpen) return null;

  const handleTransaction = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val < 50) return alert("সর্বনিম্ন ৫০ টাকা লেনদেন করা যাবে।");
    if (activeTab === 'withdraw' && val > user.balance) return alert("আপনার ব্যালেন্স পর্যাপ্ত নয়!");
    if (!phone) return alert("আপনার মোবাইল নম্বর দিন।");
    if (activeTab === 'deposit' && !trxId) return alert("বিকাশ/নগদ/রকেট ট্রানজেকশন আইডি (TrxID) দিন।");

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
      alert(activeTab === 'deposit' ? "ডিপোজিট রিকোয়েস্ট পাঠানো হয়েছে! এডমিন ভেরিফাই করলে ব্যালেন্স যোগ হবে।" : "উইথড্র রিকোয়েস্ট পাঠানো হয়েছে! অনুগ্রহ করে অপেক্ষা করুন।");
    }, 800);
  };

  const selectedMethod = METHODS.find(m => m.id === method);
  const adminNumber = paymentNumbers[`${method}_number`] || "Not Set";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    soundManager.play('click');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#1e293b] rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl border border-white/10 relative">
        <div className="p-6 text-center bg-gradient-to-r from-blue-700 to-indigo-900 border-b border-white/10">
          <h2 className="text-2xl font-black uppercase tracking-tighter italic text-white flex items-center justify-center gap-3">
             <span className="bg-yellow-500 text-black w-8 h-8 rounded-full flex items-center justify-center not-italic">৳</span>
             Wallet
          </h2>
          <button onClick={onClose} className="absolute top-4 right-6 text-white/50 text-2xl hover:text-white transition-colors">✕</button>
        </div>

        <div className="flex p-4 gap-2 bg-slate-900/50">
           <button onClick={() => setActiveTab('deposit')} className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'deposit' ? 'bg-yellow-400 text-black shadow-lg scale-[1.02]' : 'bg-white/5 text-white/40'}`}>
              📥 Deposit
           </button>
           <button onClick={() => setActiveTab('withdraw')} className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'withdraw' ? 'bg-yellow-400 text-black shadow-lg scale-[1.02]' : 'bg-white/5 text-white/40'}`}>
              📤 Withdraw
           </button>
        </div>

        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
          <div className="bg-white/5 p-6 rounded-[30px] text-center border border-white/5 shadow-inner">
             <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 opacity-60">Available Balance</p>
             <h2 className="text-4xl font-black text-white italic tracking-tighter">৳ {user.balance.toLocaleString()}</h2>
          </div>

          <div className="space-y-4">
             <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Select Payment Method</label>
                <div className="grid grid-cols-3 gap-3">
                    {METHODS.map(m => (
                      <button 
                        key={m.id} 
                        onClick={() => { soundManager.play('click'); setMethod(m.id); }} 
                        className={`relative h-20 rounded-2xl overflow-hidden border-2 transition-all flex items-center justify-center p-2 bg-white ${method === m.id ? 'border-yellow-500 ring-2 ring-yellow-500/50 shadow-lg' : 'border-white/5 opacity-60 hover:opacity-100'}`}
                      >
                         <img 
                            src={m.logo} 
                            className="h-full w-full object-contain pointer-events-none" 
                            alt={m.name}
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                if ((e.target as HTMLImageElement).parentElement) {
                                  (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-[10px] font-black uppercase text-black">${m.name}</span>`;
                                }
                            }}
                         />
                      </button>
                    ))}
                </div>
             </div>

             {activeTab === 'deposit' && (
                <div className="bg-yellow-400/10 border border-yellow-400/20 p-5 rounded-[30px] flex items-center justify-between group animate-in slide-in-from-left-4">
                    <div>
                        <p className="text-[9px] font-black text-yellow-500 uppercase tracking-widest mb-1">{selectedMethod?.name} (Personal)</p>
                        <p className="text-xl font-black text-white tracking-tighter">{adminNumber}</p>
                    </div>
                    <button onClick={() => copyToClipboard(adminNumber)} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg transition-all active:scale-95 ${copied ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black'}`}>
                        {copied ? '✓ Copied' : 'Copy'}
                    </button>
                </div>
             )}

             <div className="space-y-4">
                <div className="relative group">
                   <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-white/20 group-focus-within:text-yellow-500 transition-colors">৳</span>
                   <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-white/5 border border-white/10 p-6 pl-12 rounded-3xl text-2xl font-black text-yellow-400 focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/5 transition-all placeholder:text-white/10" />
                </div>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={`${selectedMethod?.name} Mobile Number`} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-lg font-bold text-white focus:outline-none focus:border-sky-500 transition-all" />
                {activeTab === 'deposit' && (
                  <input type="text" value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder="Transaction ID (TrxID)" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-lg font-bold text-white focus:outline-none focus:border-sky-500 transition-all uppercase" />
                )}
             </div>

             <button onClick={handleTransaction} disabled={processing} className={`w-full py-6 rounded-3xl font-black text-xl text-black bg-yellow-400 border-b-8 border-yellow-600 active:translate-y-2 active:border-b-0 transition-all flex items-center justify-center gap-3 mt-4 ${processing ? 'opacity-50' : 'shadow-2xl shadow-yellow-500/20'}`}>
                {processing ? <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin"></div> : (activeTab === 'deposit' ? 'DEPOSIT NOW' : 'WITHDRAW NOW')}
             </button>
             
             <p className="text-[9px] text-center text-white/20 font-black uppercase tracking-widest mt-4">Safe & Secure Transactions</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
