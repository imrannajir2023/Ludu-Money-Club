
import { createClient } from '@supabase/supabase-js';
import { UserProfile, PendingTransaction, LiveMatch } from '../types';

const supabaseUrl = 'https://ipvfupwcckkigyxeqazg.supabase.co';
const supabaseKey = 'sb_publishable_IymvinlNRCFKhicLAUXqFw_cc_xiOm6';

const supabase = createClient(supabaseUrl, supabaseKey);

// Utility to convert camelCase object to snake_case for Supabase
const toSnakeCase = (obj: any) => {
  const snakeObj: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    snakeObj[snakeKey] = obj[key];
  }
  return snakeObj;
};

// Utility to convert snake_case object to camelCase for the App
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
      console.error("Supabase Get Users Error:", error?.message);
      return JSON.parse(localStorage.getItem("LUDO_USERS_DATABASE") || '[]');
    }
  },

  async updateUser(user: UserProfile) {
    try {
      const { error } = await supabase.from('users').upsert(toSnakeCase(user));
      if (error) throw error;
    } catch (error: any) {
      console.error("Supabase Update User Error:", error?.message);
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
      console.error("Supabase Get Matches Error:", error?.message);
      return JSON.parse(localStorage.getItem("LUDO_LIVE_MATCHES") || '[]');
    }
  },

  async syncMatch(match: LiveMatch) {
    try {
      // Map camelCase keys to snake_case columns
      const dbMatch = {
        match_id: match.matchId,
        players: match.players,
        current_player: match.currentPlayer,
        stake: match.stake,
        start_time: match.startTime,
        next_roll_override: match.nextRollOverride,
        status: match.status
      };

      const { error } = await supabase
        .from('matches')
        .upsert(dbMatch, { onConflict: 'match_id' });
      
      if (error) throw error;
    } catch (error: any) {
      console.error("Supabase Sync Match Error:", error?.message);
      const matches = JSON.parse(localStorage.getItem("LUDO_LIVE_MATCHES") || '[]');
      const idx = matches.findIndex((m: any) => m.matchId === match.matchId);
      if (idx !== -1) matches[idx] = match; else matches.push(match);
      localStorage.setItem("LUDO_LIVE_MATCHES", JSON.stringify(matches));
    }
  },

  async deleteMatch(matchId: string) {
    try {
      const { error } = await supabase.from('matches').delete().eq('match_id', matchId);
      if (error) throw error;
    } catch (error: any) {
      console.error("Supabase Delete Match Error:", error?.message);
      const matches = JSON.parse(localStorage.getItem("LUDO_LIVE_MATCHES") || '[]');
      localStorage.setItem("LUDO_LIVE_MATCHES", JSON.stringify(matches.filter((m: any) => m.matchId !== matchId)));
    }
  },

  async getPendingTransactions(): Promise<PendingTransaction[]> {
    try {
      const { data, error } = await supabase.from('transactions').select('*').eq('status', 'PENDING');
      if (error) throw error;
      return (data || []).map(t => toCamelCase(t));
    } catch (error: any) {
      console.error("Supabase Get Txs Error:", error?.message);
      return JSON.parse(localStorage.getItem("LUDO_PENDING_TRANSACTIONS") || '[]');
    }
  },

  async submitTransaction(tx: PendingTransaction) {
    try {
      const { error } = await supabase.from('transactions').insert(toSnakeCase(tx));
      if (error) throw error;
    } catch (error: any) {
      console.error("Supabase Submit Tx Error:", error?.message);
      const txs = JSON.parse(localStorage.getItem("LUDO_PENDING_TRANSACTIONS") || '[]');
      txs.push(tx);
      localStorage.setItem("LUDO_PENDING_TRANSACTIONS", JSON.stringify(txs));
    }
  },

  async updateTransactionStatus(txId: string, status: string) {
    try {
      const { error } = await supabase.from('transactions').update({ status }).eq('id', txId);
      if (error) throw error;
    } catch (error: any) {
      console.error("Supabase Update Tx Status Error:", error?.message);
      const txs = JSON.parse(localStorage.getItem("LUDO_PENDING_TRANSACTIONS") || '[]');
      localStorage.setItem("LUDO_PENDING_TRANSACTIONS", JSON.stringify(txs.filter((t: any) => t.id !== txId)));
    }
  }
};
