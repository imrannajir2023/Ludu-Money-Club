
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
        camel.balance = Number(u.balance) || 0;
        camel.stats = {
           totalGames: Number(u.total_games) || 0,
           wins: Number(u.wins) || 0,
           totalWinnings: Number(u.total_winnings) || 0
        };
        return camel;
      });
    } catch (error: any) {
      console.error("getUsers Error:", error);
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
      camel.balance = Number(data.balance) || 0;
      camel.stats = {
        totalGames: Number(data.total_games) || 0,
        wins: Number(data.wins) || 0,
        totalWinnings: Number(data.total_winnings) || 0
      };
      return camel;
    } catch (e) {
      console.error("getUserByPhone Error:", e);
      return null;
    }
  },

  async updateUser(user: UserProfile): Promise<{success: boolean, message?: string}> {
    try {
      const normalizedPhone = normalizePhone(user.phone);
      const cleanBalance = Number(user.balance) || 0;
      
      const dbReadyData: any = {
        phone: normalizedPhone,
        name: user.name,
        password: user.password,
        balance: cleanBalance,
        avatar: user.avatar,
        last_login: new Date().toISOString()
      };
      
      if (user.isBlocked !== undefined) dbReadyData.is_blocked = user.isBlocked;
      if (user.stats) {
        dbReadyData.total_games = Number(user.stats.totalGames) || 0;
        dbReadyData.wins = Number(user.stats.wins) || 0;
        dbReadyData.total_winnings = Number(user.stats.totalWinnings) || 0;
      }

      const { error } = await supabase.from('users').upsert(dbReadyData, { onConflict: 'phone' });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error("updateUser Error:", error);
      return { success: false, message: error.message };
    }
  },

  async getPendingTransactions(): Promise<PendingTransaction[]> {
    try {
      const { data, error } = await supabase.from('transactions').select('*').eq('status', 'PENDING').order('timestamp', { ascending: false });
      if (error) throw error;
      return (data || []).map(t => {
        const camel = toCamelCase(t);
        camel.amount = Number(t.amount) || 0;
        return camel;
      });
    } catch (error: any) {
      return [];
    }
  },

  async getAllTransactions(): Promise<PendingTransaction[]> {
    try {
      const { data, error } = await supabase.from('transactions').select('*').order('timestamp', { ascending: false });
      if (error) throw error;
      return (data || []).map(t => {
        const camel = toCamelCase(t);
        camel.amount = Number(t.amount) || 0;
        return camel;
      });
    } catch (error: any) {
      return [];
    }
  },

  async createTransaction(tx: PendingTransaction): Promise<{success: boolean, message?: string}> {
    try {
      const dbData = {
        id: tx.id,
        user_name: tx.userName,
        user_phone: normalizePhone(tx.userPhone),
        type: tx.type,
        method: tx.method,
        amount: Number(tx.amount) || 0,
        phone: normalizePhone(tx.phone),
        trx_id: tx.trxId,
        status: tx.status,
        timestamp: tx.timestamp
      };
      
      const { error } = await supabase.from('transactions').insert([dbData]);
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error("createTransaction Error:", error);
      return { success: false, message: error.message };
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
