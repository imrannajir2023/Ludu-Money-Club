
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

// Map DB row to Transaction without requiring 'currency' column in DB
const mapDbRowToTransaction = (row: any): PendingTransaction => {
  return {
    id: row.id?.toString() || '',
    userName: row.user_name || 'Unknown',
    userPhone: row.user_phone || '',
    type: row.type as 'DEPOSIT' | 'WITHDRAW',
    method: row.method || '',
    amount: Number(row.amount) || 0,
    currency: (row.currency as any) || 'BDT', // Fallback to BDT if column is missing
    phone: row.phone || '',
    trxId: row.trx_id || null,
    status: row.status as 'PENDING' | 'APPROVED' | 'REJECTED',
    timestamp: row.timestamp || row.created_at || new Date().toISOString()
  };
};

export const databaseService = {
  isOnline: () => !!supabase,
  normalizePhone,

  async getUsers(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(u => ({
        ...u,
        name: u.name,
        phone: u.phone,
        balance: Number(u.balance) || 0,
        avatar: u.avatar,
        isBlocked: u.is_blocked,
        preferredCurrency: u.preferred_currency,
        stats: {
           totalGames: Number(u.total_games) || 0,
           wins: Number(u.wins) || 0,
           totalWinnings: Number(u.total_winnings) || 0
        },
        history: []
      }));
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
      
      return {
        ...data,
        balance: Number(data.balance) || 0,
        isBlocked: data.is_blocked,
        preferredCurrency: data.preferred_currency,
        stats: {
          totalGames: Number(data.total_games) || 0,
          wins: Number(data.wins) || 0,
          totalWinnings: Number(data.total_winnings) || 0
        },
        history: []
      };
    } catch (e) {
      console.error("getUserByPhone Error:", e);
      return null;
    }
  },

  async updateUser(user: UserProfile): Promise<{success: boolean, message?: string}> {
    try {
      const normalizedPhone = normalizePhone(user.phone);
      const dbReadyData: any = {
        phone: normalizedPhone,
        name: user.name,
        password: user.password,
        balance: Number(user.balance) || 0,
        avatar: user.avatar,
        preferred_currency: user.preferredCurrency,
        is_blocked: user.isBlocked,
        last_login: new Date().toISOString()
      };
      
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
      if (error) {
        console.error("getPendingTransactions Error:", error);
        throw error;
      }
      return (data || []).map(mapDbRowToTransaction);
    } catch (error: any) {
      return [];
    }
  },

  async getTransactionById(txId: string): Promise<PendingTransaction | null> {
    try {
      const { data, error } = await supabase.from('transactions').select('*').eq('id', txId).maybeSingle();
      if (error) throw error;
      return data ? mapDbRowToTransaction(data) : null;
    } catch (e) {
      return null;
    }
  },

  async getAllTransactions(): Promise<PendingTransaction[]> {
    try {
      const { data, error } = await supabase.from('transactions').select('*').order('timestamp', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapDbRowToTransaction);
    } catch (error: any) {
      console.error("getAllTransactions Error:", error);
      return [];
    }
  },

  async createTransaction(tx: PendingTransaction): Promise<{success: boolean, message?: string}> {
    try {
      // Omitting 'currency' field to prevent errors with incomplete DB schemas
      const dbData: any = {
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
      if (error) {
        console.error("Insert Transaction Error:", error);
        throw error;
      }
      return { success: true };
    } catch (error: any) {
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
