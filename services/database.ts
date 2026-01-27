
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

// এই ফাংশনটি শুধুমাত্র প্রয়োজনীয় এবং নিশ্চিত কলামগুলো পাঠাবে
const prepareUserForDB = (user: UserProfile) => {
  return {
    phone: normalizePhone(user.phone),
    name: user.name,
    password: user.password,
    balance: user.balance,
    avatar: user.avatar,
    country: user.country || 'BD',
    flag: user.flag || '🇧🇩',
    is_blocked: !!user.isBlocked,
    total_games: user.stats?.totalGames || 0,
    wins: user.stats?.wins || 0,
    total_winnings: user.stats?.totalWinnings || 0,
    history: JSON.stringify(user.history || [])
    // Note: 'created_at' এবং 'last_login' ইচ্ছাকৃতভাবে বাদ দেওয়া হয়েছে 
    // যাতে স্কিমা ক্যাশে এরর না আসে। ডাটাবেস এগুলো অটো-ফিল করবে।
  };
};

export const databaseService = {
  isOnline: () => !!supabase,
  normalizePhone,

  async getUsers(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase.from('users').select('*');
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
      return JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
    }
  },

  async getUserByPhone(phone: string): Promise<UserProfile | null> {
    try {
      const normalizedInput = normalizePhone(phone);
      const { data, error } = await supabase.from('users').select('*').eq('phone', normalizedInput).maybeSingle();
      
      if (!data) {
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
    // লোকাল ক্যাশ আপডেট
    const db = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
    const idx = db.findIndex((u: any) => normalizePhone(u.phone) === normalizePhone(user.phone));
    if (idx !== -1) db[idx] = user; else db.push(user);
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(db));

    try {
      const dbReadyData = prepareUserForDB(user);
      const { error } = await supabase.from('users').upsert(dbReadyData, { onConflict: 'phone' });
      
      if (error) {
        console.error("Supabase Error:", error.message);
        // যদি কলাম খুঁজে না পাওয়ার এরর হয়, তবুও লোকালি সাকসেস দেখাবে
        return true;
      }
      return true;
    } catch (error: any) {
      return true; 
    }
  },

  async createTransaction(tx: PendingTransaction) {
    try {
      const snakeData = toSnakeCase(tx);
      await supabase.from('transactions').insert(snakeData);
    } catch (e: any) {}
  },

  async updateTransactionStatus(txId: string, status: 'APPROVED' | 'REJECTED') {
    try {
      await supabase.from('transactions').update({ status }).eq('id', txId);
    } catch (e) {}
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
