
import { createClient } from '@supabase/supabase-js';
import { UserProfile, PendingTransaction } from '../types';

const supabaseUrl = 'https://ipvfupwcckkigyxeqazg.supabase.co';
const supabaseKey = 'sb_publishable_IymvinlNRCFKhicLAUXqFw_cc_xiOm6';

const supabase = createClient(supabaseUrl, supabaseKey);

const normalizePhone = (p: string | undefined): string => {
  if (!p) return "";
  const cleaned = p.replace(/\D/g, ''); 
  return cleaned.length > 10 ? cleaned.slice(-10) : cleaned;
};

const toCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj !== null && typeof obj === 'object') {
    const n: any = {};
    Object.keys(obj).forEach(k => {
      const key = k.replace(/(_\w)/g, m => m[1].toUpperCase());
      n[key] = obj[k];
    });
    return n;
  }
  return obj;
};

export const databaseService = {
  isOnline: () => !!supabase,
  normalizePhone,

  async getUsers(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(u => {
        const camel = toCamelCase(u);
        camel.stats = {
           totalGames: u.total_games || 0,
           wins: u.wins || 0,
           totalWinnings: u.total_winnings || 0
        };
        return camel;
      });
    } catch (error: any) {
      console.error("Fetch Users Error:", error.message);
      return [];
    }
  },

  async getUserByPhone(phone: string): Promise<UserProfile | null> {
    try {
      const normalizedInput = normalizePhone(phone);
      const { data, error } = await supabase.from('users').select('*').eq('phone', normalizedInput).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      
      const camel = toCamelCase(data);
      camel.stats = {
        totalGames: data.total_games || 0,
        wins: data.wins || 0,
        totalWinnings: data.total_winnings || 0
      };
      return camel;
    } catch (e) {
      return null;
    }
  },

  async updateUser(user: UserProfile): Promise<{success: boolean, message?: string}> {
    try {
      const normalizedPhone = normalizePhone(user.phone);
      
      // বডি অবজেক্ট যা ডাটাবেসে পাঠানো হবে
      const dbReadyData: any = {
        phone: normalizedPhone,
        name: user.name,
        password: user.password,
        balance: user.balance,
        avatar: user.avatar,
        last_login: new Date().toISOString()
      };

      // শুধুমাত্র যদি ভ্যালু থাকে তবেই কলামগুলো যোগ করা হবে
      if (user.country) dbReadyData.country = user.country;
      if (user.flag) dbReadyData.flag = user.flag;
      if (user.isBlocked !== undefined) dbReadyData.is_blocked = user.isBlocked;
      
      if (user.stats) {
        dbReadyData.total_games = user.stats.totalGames || 0;
        dbReadyData.wins = user.stats.wins || 0;
        dbReadyData.total_winnings = user.stats.totalWinnings || 0;
      }

      const { error } = await supabase.from('users').upsert(dbReadyData, { onConflict: 'phone' });
      
      if (error) {
        console.error("Supabase Save Error:", error);
        if (error.message.includes("column")) {
          return { 
            success: false, 
            message: "আপনার ডাটাবেসে কলাম মিসিং আছে। অনুগ্রহ করে SQL Editor এ গিয়ে ALTER TABLE কমান্ডটি রান করুন।" 
          };
        }
        return { success: false, message: error.message };
      }
      return { success: true };
    } catch (error: any) {
      console.error("Update User Exception:", error);
      return { success: false, message: error.message };
    }
  },

  async getPendingTransactions(): Promise<PendingTransaction[]> {
    try {
      const { data, error } = await supabase.from('transactions').select('*').eq('status', 'PENDING').order('timestamp', { ascending: false });
      if (error) throw error;
      return (data || []).map(t => toCamelCase(t));
    } catch (error: any) {
      return [];
    }
  },

  async createTransaction(tx: PendingTransaction): Promise<boolean> {
    try {
      const dbTx = {
        id: tx.id,
        user_name: tx.userName,
        account_phone: tx.accountPhone,
        type: tx.type,
        method: tx.method,
        amount: tx.amount,
        phone: tx.phone,
        trx_id: tx.trxId,
        status: tx.status,
        timestamp: tx.timestamp
      };
      const { error } = await supabase.from('transactions').insert(dbTx);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Create Transaction Error:", error);
      return false;
    }
  },

  async updateTransactionStatus(txId: string, status: 'APPROVED' | 'REJECTED') {
    try {
      const { error } = await supabase.from('transactions').update({ status }).eq('id', txId);
      if (error) throw error;
      return true;
    } catch (e) {
      return false;
    }
  },

  async getSettings(): Promise<any> {
    try {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      const settingsMap: any = {};
      data?.forEach(s => { settingsMap[s.key] = s.value; });
      return settingsMap;
    } catch (error: any) { 
      return {}; 
    }
  },

  async updateSetting(key: string, value: string) {
    try {
      const { error } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
      return true;
    } catch (error: any) {
      return false;
    }
  }
};
