
import { createClient } from '@supabase/supabase-js';
import { UserProfile, PendingTransaction, LiveMatch, PlayerColor } from '../types';

const supabaseUrl = 'https://ipvfupwcckkigyxeqazg.supabase.co';
const supabaseKey = 'sb_publishable_IymvinlNRCFKhicLAUXqFw_cc_xiOm6';

const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_KEY_SETTINGS = "LUDO_SETTINGS_BACKUP";

const toSnakeCase = (obj: any) => {
  const snakeObj: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    snakeObj[snakeKey] = obj[key];
  }
  return snakeObj;
};

const toCamelCase = (obj: any) => {
  if (!obj) return obj;
  const camelObj: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/(_\w)/g, m => m[1].toUpperCase());
    camelObj[camelKey] = obj[key];
  }
  return camelObj;
};

export const databaseService = {
  isOnline: () => !!supabase,

  async getUsers(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return (data || []).map(u => toCamelCase(u));
    } catch (error: any) {
      return JSON.parse(localStorage.getItem("LUDO_USERS_DATABASE") || '[]');
    }
  },

  async updateUser(user: UserProfile) {
    try {
      await supabase.from('users').upsert(toSnakeCase(user));
    } catch (error: any) {
      const db = JSON.parse(localStorage.getItem("LUDO_USERS_DATABASE") || '[]');
      const idx = db.findIndex((u: any) => u.phone === user.phone);
      if (idx !== -1) db[idx] = user; else db.push(user);
      localStorage.setItem("LUDO_USERS_DATABASE", JSON.stringify(db));
    }
  },

  async getLiveMatches(): Promise<LiveMatch[]> {
    try {
      const { data, error } = await supabase.from('matches').select('*');
      if (error) throw error;
      return (data || []).map(m => toCamelCase(m));
    } catch (error: any) {
      return JSON.parse(localStorage.getItem("LUDO_LIVE_MATCHES") || '[]');
    }
  },

  async findWaitingMatch(stake: number, requiredPlayers: number): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'WAITING')
        .eq('stake', stake)
        .eq('is_private', false)
        .order('start_time', { ascending: true });
      
      if (error || !data || data.length === 0) return null;
      const availableMatch = data.find(m => m.players.length < requiredPlayers);
      return availableMatch ? toCamelCase(availableMatch) : null;
    } catch {
      return null;
    }
  },

  async findMatchByCode(code: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('invite_code', code)
        .eq('status', 'WAITING')
        .single();
      
      if (error || !data) return null;
      return toCamelCase(data);
    } catch {
      return null;
    }
  },

  async createMatch(match: any) {
    try {
      await supabase.from('matches').insert(toSnakeCase(match));
    } catch (e) { console.error("Create Match Error:", e); }
  },

  async syncMatch(match: LiveMatch) {
    try {
      const dbMatch = toSnakeCase(match);
      await supabase.from('matches').upsert(dbMatch, { onConflict: 'match_id' });
    } catch (error: any) {
      console.error("Sync Match Error:", error);
    }
  },

  async deleteMatch(match_id: string) {
    try {
      await supabase.from('matches').delete().eq('match_id', match_id);
    } catch (error: any) {
      console.error("Delete Match Error:", error);
    }
  },

  // Added missing method to handle fetching pending transactions from Supabase or local users' histories
  async getPendingTransactions(): Promise<PendingTransaction[]> {
    try {
      const { data, error } = await supabase.from('transactions').select('*').eq('status', 'PENDING');
      if (error) throw error;
      return (data || []).map(t => toCamelCase(t));
    } catch (error: any) {
      const db = JSON.parse(localStorage.getItem("LUDO_USERS_DATABASE") || '[]');
      const allPending: PendingTransaction[] = [];
      db.forEach((u: any) => {
        if (u.history) {
          u.history.forEach((tx: any) => {
            if (tx.status === 'PENDING') allPending.push(tx);
          });
        }
      });
      return allPending;
    }
  },

  async getSettings(): Promise<any> {
    const localBackup = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
    try {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      const settingsMap: any = { ...localBackup };
      data?.forEach(s => { settingsMap[s.key] = s.value; });
      // Fix: Added missing value argument and removed invalid truthiness check for localStorage.setItem (returns void)
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsMap));
      return settingsMap;
    } catch (error: any) {
      return localBackup;
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
