
import { createClient } from '@supabase/supabase-js';
import { UserProfile, PendingTransaction, LiveMatch, PlayerColor, GameState } from '../types';

const supabaseUrl = 'https://ipvfupwcckkigyxeqazg.supabase.co';
const supabaseKey = 'sb_publishable_IymvinlNRCFKhicLAUXqFw_cc_xiOm6';

const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_KEY_SETTINGS = "LUDO_SETTINGS_BACKUP";
const STORAGE_KEY_TRANSACTIONS = "LUDO_GLOBAL_TRANSACTIONS";
const STORAGE_KEY_USERS = "LUDO_USERS_DATABASE";

const normalizePhone = (p: string | undefined): string => {
  if (!p) return "";
  const cleaned = p.replace(/\D/g, ''); 
  return cleaned.length > 10 ? cleaned.slice(-10) : cleaned;
};

const toSnakeCase = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj !== null && typeof obj === 'object') {
    const n: any = {};
    Object.keys(obj).forEach(k => {
      const key = k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
      n[key] = obj[k];
    });
    return n;
  }
  return obj;
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

const prepareUserForDB = (user: UserProfile) => {
  const { stats, ...rest } = user;
  const snakeData = toSnakeCase(rest);
  
  // Create a clean object for DB
  const dbData: any = {
    ...snakeData,
    total_games: stats?.totalGames || 0,
    wins: stats?.wins || 0,
    total_winnings: stats?.totalWinnings || 0,
    history: JSON.stringify(user.history || [])
  };

  // If created_at is null or undefined, don't send it to let DB handle default
  if (!dbData.created_at) delete dbData.created_at;
  
  return dbData;
};

export const databaseService = {
  isOnline: () => !!supabase,
  normalizePhone,

  async getUsers(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase.from('users').select('*').order('phone');
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
      console.warn("DB Users Fetch Warning:", error.message);
      return JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
    }
  },

  async getUserByPhone(phone: string): Promise<UserProfile | null> {
    try {
      const normalizedInput = normalizePhone(phone);
      const { data, error } = await supabase.from('users').select('*').eq('phone', normalizedInput).maybeSingle();
      
      if (!data) {
        // Fallback to local cache if DB fails or user not found
        const db = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
        return db.find((u: any) => normalizePhone(u.phone) === normalizedInput) || null;
      }
      
      const camel = toCamelCase(data);
      camel.stats = {
        totalGames: data.total_games || 0,
        wins: data.wins || 0,
        totalWinnings: data.total_winnings || 0
      };
      return camel;
    } catch (e) {
      const db = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
      return db.find((u: any) => normalizePhone(u.phone) === normalizePhone(phone)) || null;
    }
  },

  async updateUser(user: UserProfile): Promise<boolean> {
    // Always update local cache first for immediate UI response
    const db = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
    const idx = db.findIndex((u: any) => normalizePhone(u.phone) === normalizePhone(user.phone));
    if (idx !== -1) db[idx] = user; else db.push(user);
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(db));

    try {
      const dbReadyData = prepareUserForDB(user);
      const { error } = await supabase.from('users').upsert(dbReadyData, { onConflict: 'phone' });
      
      if (error) {
        console.error("Supabase Sync Error:", error.message);
        // If it's just a schema error, we return true anyway to let the user play locally
        if (error.code === '42703' || error.code === 'P0001') return true; 
        return false;
      }
      
      return true;
    } catch (error: any) {
      console.error("Local-Only Mode Active:", error.message);
      return true; // Return true to allow user to continue in offline/cached mode
    }
  },

  async createTransaction(tx: PendingTransaction) {
    try {
      const snakeData = toSnakeCase(tx);
      await supabase.from('transactions').insert(snakeData);
    } catch (e: any) {
      console.error("Transaction Sync Error:", e.message);
    }
  },

  async updateTransactionStatus(txId: string, status: 'APPROVED' | 'REJECTED') {
    try {
      await supabase.from('transactions').update({ status }).eq('id', txId);
    } catch (e) {
      console.error("Status Sync Error:", e);
    }
  },

  async getPendingTransactions(): Promise<PendingTransaction[]> {
    try {
      const { data, error } = await supabase.from('transactions').select('*').eq('status', 'PENDING');
      if (error) throw error;
      return (data || []).map(t => toCamelCase(t));
    } catch (error: any) {
      return [];
    }
  },

  async getSettings(): Promise<any> {
    try {
      const { data } = await supabase.from('settings').select('*');
      const settingsMap: any = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
      data?.forEach(s => { settingsMap[s.key] = s.value; });
      return settingsMap;
    } catch (error: any) { 
      return JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}'); 
    }
  },

  async updateSetting(key: string, value: string) {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
    local[key] = value;
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(local));
    try {
      await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
    } catch (error: any) {}
  }
};
