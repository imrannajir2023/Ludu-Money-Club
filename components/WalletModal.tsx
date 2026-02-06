
import React, { useState, useEffect } from 'react';
import { UserProfile, PendingTransaction, CurrencyCode } from '../types';
import { soundManager } from '../services/soundService';
import { databaseService } from '../services/database';
import { CURRENCY_CONFIG } from '../constants';

const REAL_LOGOS = {
  bkash: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23D12053' rx='20'/%3E%3Cpath d='M25 55 L40 70 L75 35' stroke='white' stroke-width='10' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ctext x='50' y='90' text-anchor='middle' fill='white' font-family='Arial, sans-serif' font-weight='900' font-size='12' text-transform='uppercase'%3EbKash%3C/text%3E%3C/svg%3E",
  nagad: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23F7941D' rx='20'/%3E%3Ccircle cx='50' cy='45' r='22' fill='white'/%3E%3Ctext x='50' y='52' text-anchor='middle' fill='%23F7941D' font-family='Arial, sans-serif' font-weight='900' font-size='24'%3EN%3C/text%3E%3Ctext x='50' y='90' text-anchor='middle' fill='white' font-family='Arial, sans-serif' font-weight='900' font-size='12' text-transform='uppercase'%3ENagad%3C/text%3E%3C/svg%3E",
  rocket: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%238C3494' rx='20'/%3E%3Cpath d='M30 75 L50 20 L70 75 L50 60 Z' fill='white'/%3E%3Ctext x='50' y='90' text-anchor='middle' fill='white' font-family='Arial, sans-serif' font-weight='900' font-size='12' text-transform='uppercase'%3ERocket%3C/text%3E%3C/svg%3E",
  binance: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23F3BA2F' rx='20'/%3E%3Cpath d='M50 20 L30 40 L50 60 L70 40 Z' fill='black'/%3E%3Cpath d='M50 80 L30 60 L50 40 L70 60 Z' fill='black'/%3E%3Ctext x='50' y='90' text-anchor='middle' fill='black' font-family='Arial, sans-serif' font-weight='900' font-size='10' text-transform='uppercase'%3EBinance USDT%3C/text%3E%3C/svg%3E"
};

const WalletModal: React.FC<{ isOpen: boolean, onClose: () => void, user: UserProfile, onSubmitTransaction: (tx: PendingTransaction) => void }> = ({ isOpen, onClose, user, onSubmitTransaction }) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [currency, setCurrency] = useState<CurrencyCode>(user.preferredCurrency || 'BDT');
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<string>('bkash');
  const [trxId, setTrxId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [paymentNumbers, setPaymentNumbers] = useState<any>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (currency === 'USD') setMethod('binance');
    else setMethod('bkash');
  }, [currency]);

  useEffect(() => {
    const fetchSettings = async () => {
        const settings = await databaseService.getSettings();
        setPaymentNumbers(settings);
    };
    if (isOpen) fetchSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const currentConfig = CURRENCY_CONFIG[currency];

  const handleTransaction = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return alert("সঠিক পরিমাণ দিন।");
    
    // Check min limits based on currency
    if (currency === 'BDT' && val < 50) return alert("সর্বনিম্ন ৫০ টাকা লেনদেন করা যাবে।");
    if (currency === 'USD' && val < 1) return alert("Minimum 1 USDT required.");
    
    const baseBalance = user.balance;
    const requestedBaseAmount = val * currentConfig.rate;

    if (activeTab === 'withdraw' && requestedBaseAmount > baseBalance) {
        return alert("আপনার ব্যালেন্স পর্যাপ্ত নয়!");
    }

    setProcessing(true);
    soundManager.play('click');
    
    const newTx: PendingTransaction = {
      id: Math.random().toString(36).substr(2, 9),
      userName: user.name,
      userPhone: user.phone, 
      type: activeTab === 'deposit' ? 'DEPOSIT' : 'WITHDRAW',
      method: method.toUpperCase(),
      amount: val,
      currency: currency,
      phone, 
      trxId: activeTab === 'deposit' ? trxId : null,
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };

    setTimeout(async () => {
      try {
        await onSubmitTransaction(newTx);
      } catch (err) {
        alert("লেনদেন সফল হয়নি।");
      } finally {
        setProcessing(false);
      }
    }, 800);
  };

  const copyToClipboard = (text: string) => {
    if (!text || text === "Not Set") return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const adminNumber = paymentNumbers[`${method}_number`] || "Not Set";

  const availableMethods = currency === 'USD' 
    ? [{ id: 'binance', name: 'USDT (TRC20)', logo: REAL_LOGOS.binance }]
    : [
        { id: 'bkash', name: 'bKash', logo: REAL_LOGOS.bkash },
        { id: 'nagad', name: 'Nagad', logo: REAL_LOGOS.nagad },
        { id: 'rocket', name: 'Rocket', logo: REAL_LOGOS.rocket }
      ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#1e293b] rounded-[40px] w-full max-md:max-h-[90vh] max-w-md overflow-hidden shadow-2xl border border-white/10 relative flex flex-col">
        <div className="p-6 text-center bg-gradient-to-r from-blue-700 to-indigo-900 border-b border-white/10 shrink-0">
          <h2 className="text-3xl font-black uppercase tracking-tighter italic text-white">Wallet</h2>
          <button onClick={onClose} className="absolute top-4 right-6 text-white/50 text-2xl">✕</button>
        </div>
        
        {/* Currency Tab */}
        <div className="flex p-2 bg-slate-900/50 justify-center gap-2 border-b border-white/5">
           {Object.keys(CURRENCY_CONFIG).map((c) => (
             <button 
               key={c} 
               onClick={() => setCurrency(c as CurrencyCode)}
               className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${currency === c ? 'bg-sky-500 text-white shadow-lg' : 'text-white/20 hover:text-white/40'}`}
             >
               {c} ({CURRENCY_CONFIG[c as CurrencyCode].symbol})
             </button>
           ))}
        </div>

        <div className="flex p-4 gap-2 bg-slate-900/50 shrink-0">
           <button onClick={() => setActiveTab('deposit')} className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase transition-all ${activeTab === 'deposit' ? 'bg-yellow-400 text-black shadow-lg' : 'bg-white/5 text-white/40'}`}>📥 Deposit</button>
           <button onClick={() => setActiveTab('withdraw')} className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase transition-all ${activeTab === 'withdraw' ? 'bg-yellow-400 text-black shadow-lg' : 'bg-white/5 text-white/40'}`}>📤 Withdraw</button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto no-scrollbar">
          <div className="bg-slate-900/40 p-6 rounded-[30px] text-center border border-white/5">
             <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Balance</p>
             <h2 className="text-4xl font-black text-white">{currentConfig.symbol}{(user.balance / currentConfig.rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
              {availableMethods.map(m => (
                <button key={m.id} onClick={() => setMethod(m.id)} className={`relative h-16 rounded-2xl transition-all flex items-center justify-center p-2 bg-white border-2 ${method === m.id ? 'border-yellow-500 scale-105 shadow-xl' : 'border-white/5 opacity-70'}`}>
                   <img src={m.logo} className="h-full w-full object-contain" />
                </button>
              ))}
          </div>

          {activeTab === 'deposit' && (
            <div className="bg-slate-800/80 border border-white/5 p-4 rounded-2xl flex justify-between items-center">
                <div className="overflow-hidden">
                  <p className="text-[9px] font-black text-yellow-500 uppercase">{method} ({currency === 'USD' ? 'Network: TRC20' : 'Personal'})</p>
                  <p className="text-xl font-black text-white truncate">{adminNumber}</p>
                </div>
                <button onClick={() => copyToClipboard(adminNumber)} className="bg-yellow-400 text-black px-4 py-2 rounded-xl text-[10px] font-black shrink-0 ml-2">{copied ? 'Copied' : 'Copy'}</button>
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Amount in ${currency}`} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-xl font-black text-yellow-400 outline-none pr-14" />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 font-black">{currentConfig.symbol}</span>
            </div>
            
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={activeTab === 'deposit' ? "Sender Account/Wallet" : "Withdrawal Account/Wallet"} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none" />
            
            {activeTab === 'deposit' && <input type="text" value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder="TrxID / Hash ID" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none uppercase" />}
          </div>

          <button onClick={handleTransaction} disabled={processing} className="w-full py-5 rounded-[30px] font-black text-xl bg-gradient-to-r from-yellow-400 to-amber-600 text-black shadow-xl active:translate-y-1 transition-all disabled:opacity-50">
              {processing ? 'Processing...' : (activeTab === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
