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
      alert("Insufficient balance!");
      return;
    }

    setProcessing(true);

    // Simulate API delay
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-white text-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex bg-gray-100 p-2">
          <button 
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'deposit' ? 'bg-green-500 text-white shadow-lg' : 'text-gray-500'}`}
            onClick={() => setActiveTab('deposit')}
          >
            Deposit (+)
          </button>
          <button 
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'withdraw' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-500'}`}
            onClick={() => setActiveTab('withdraw')}
          >
            Withdraw (-)
          </button>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Current Balance</p>
            <h2 className="text-4xl font-black text-gray-800">৳{user.balance.toFixed(2)}</h2>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-2 text-gray-700">Amount (৳)</label>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-4 text-xl font-bold border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none bg-gray-50"
              placeholder="0.00"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold mb-2 text-gray-700">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {['bkash', 'nagad', 'rocket'].map(m => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`p-3 border-2 rounded-xl uppercase font-bold text-sm ${method === m ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleTransaction}
            disabled={processing}
            className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-transform active:scale-95 ${activeTab === 'deposit' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {processing ? 'Processing...' : activeTab === 'deposit' ? 'ADD MONEY' : 'WITHDRAW CASH'}
          </button>
        </div>
        
        <div className="bg-gray-50 p-4 border-t text-center">
            <button onClick={onClose} className="text-gray-500 font-semibold hover:text-gray-800">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;