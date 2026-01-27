
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
      n[k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)] = toSnakeCase(obj[k]);
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
      n[k.replace(/(_\w)/g, m => m[1].toUpperCase())] = toCamelCase(obj[k]);
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
      const users = (data || []).map(u => toCamelCase(u));
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      return users;
    } catch (error: any) {
      console.warn("DB Users Error, using cache:", error.message);
      return JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
    }
  },

  async getUserByPhone(phone: string): Promise<UserProfile | null> {
    try {
      const normalizedInput = normalizePhone(phone);
      // Try direct match first
      let { data, error } = await supabase.from('users').select('*').eq('phone', normalizedInput).maybeSingle();
      
      if (!data) {
        // Broad search and manual normalization match
        const { data: all } = await supabase.from('users').select('*');
        data = all?.find(u => normalizePhone(u.phone) === normalizedInput) || null;
      }
      
      if (!data) return null;
      return toCamelCase(data);
    } catch (e) {
      console.warn("getUserByPhone Fallback triggered:", e);
      const db = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
      const normalizedTarget = normalizePhone(phone);
      return db.find((u: any) => normalizePhone(u.phone) === normalizedTarget) || null;
    }
  },

  async updateUser(user: UserProfile): Promise<boolean> {
    try {
      const snakeData = toSnakeCase(user);
      const { error } = await supabase.from('users').upsert(snakeData);
      if (error) throw error;
      
      // Update local cache on success
      const db = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
      const idx = db.findIndex((u: any) => normalizePhone(u.phone) === normalizePhone(user.phone));
      if (idx !== -1) db[idx] = user; else db.push(user);
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(db));
      
      return true;
    } catch (error: any) {
      console.error("Update User DB Error:", error);
      // Still update local storage so game continues
      const db = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
      const idx = db.findIndex((u: any) => normalizePhone(u.phone) === normalizePhone(user.phone));
      if (idx !== -1) db[idx] = user; else db.push(user);
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(db));
      return false;
    }
  },

  async createTransaction(tx: PendingTransaction) {
    try {
      const snakeData = toSnakeCase(tx);
      const { error } = await supabase.from('transactions').insert(snakeData);
      if (error) throw error;
      
      const allTx = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
      allTx.push(tx);
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(allTx));
    } catch (e: any) {
      console.error("Create Transaction Error:", e.message);
      const allTx = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
      allTx.push(tx);
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(allTx));
    }
  },

  async updateTransactionStatus(txId: string, status: 'APPROVED' | 'REJECTED') {
    try {
      const { error } = await supabase.from('transactions').update({ status }).eq('id', txId);
      if (error) throw error;
      
      const allTx = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
      const idx = allTx.findIndex((t: any) => t.id === txId);
      if (idx !== -1) {
        allTx[idx].status = status;
        localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(allTx));
      }
    } catch (e) {
      console.error("Update Transaction Status Error:", e);
    }
  },

  async getPendingTransactions(): Promise<PendingTransaction[]> {
    try {
      const { data, error } = await supabase.from('transactions').select('*').eq('status', 'PENDING');
      if (error) throw error;
      return (data || []).map(t => toCamelCase(t));
    } catch (error: any) {
      console.warn("DB Transactions Error, using cache:", error.message);
      const allTx = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
      return allTx.filter((t: any) => t.status === 'PENDING');
    }
  },

  async getSettings(): Promise<any> {
    const localBackup = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
    try {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      const settingsMap: any = { ...localBackup };
      data?.forEach(s => { settingsMap[s.key] = s.value; });
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsMap));
      return settingsMap;
    } catch (error: any) { return localBackup; }
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
