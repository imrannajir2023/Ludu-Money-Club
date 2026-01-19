
import { createClient } from '@supabase/supabase-js';
import { UserProfile, PendingTransaction, LiveMatch } from '../types';

// Supabase configuration from user provided credentials
const supabaseUrl = 'https://ipvfupwcckkigyxeqazg.supabase.co';
const supabaseKey = 'sb_publishable_IymvinlNRCFKhicLAUXqFw_cc_xiOm6';

// Initialize Supabase Client
const supabase = createClient(supabaseUrl, supabaseKey);

export const databaseService = {
  isOnline: () => !!supabase,

  async getUsers(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Supabase Get Users Error:", error);
      return JSON.parse(localStorage.getItem("LUDO_USERS_DATABASE") || '[]');
    }
  },

  async updateUser(user: UserProfile) {
    try {
      const { error } = await supabase.from('users').upsert(user);
      if (error) throw error;
    } catch (error) {
      console.error("Supabase Update User Error:", error);
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
      return data || [];
    } catch (error) {
      console.error("Supabase Get Matches Error:", error);
      return JSON.parse(localStorage.getItem("LUDO_LIVE_MATCHES") || '[]');
    }
  },

  async syncMatch(match: LiveMatch) {
    try {
      const { error } = await supabase.from('matches').upsert(match);
      if (error) throw error;
    } catch (error) {
      console.error("Supabase Sync Match Error:", error);
      const matches = JSON.parse(localStorage.getItem("LUDO_LIVE_MATCHES") || '[]');
      const idx = matches.findIndex((m: any) => m.matchId === match.matchId);
      if (idx !== -1) matches[idx] = match; else matches.push(match);
      localStorage.setItem("LUDO_LIVE_MATCHES", JSON.stringify(matches));
    }
  },

  async deleteMatch(matchId: string) {
    try {
      const { error } = await supabase.from('matches').delete().eq('matchId', matchId);
      if (error) throw error;
    } catch (error) {
      console.error("Supabase Delete Match Error:", error);
      const matches = JSON.parse(localStorage.getItem("LUDO_LIVE_MATCHES") || '[]');
      localStorage.setItem("LUDO_LIVE_MATCHES", JSON.stringify(matches.filter((m: any) => m.matchId !== matchId)));
    }
  },

  async getPendingTransactions(): Promise<PendingTransaction[]> {
    try {
      const { data, error } = await supabase.from('transactions').select('*').eq('status', 'PENDING');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Supabase Get Txs Error:", error);
      return JSON.parse(localStorage.getItem("LUDO_PENDING_TRANSACTIONS") || '[]');
    }
  },

  async submitTransaction(tx: PendingTransaction) {
    try {
      const { error } = await supabase.from('transactions').insert(tx);
      if (error) throw error;
    } catch (error) {
      console.error("Supabase Submit Tx Error:", error);
      const txs = JSON.parse(localStorage.getItem("LUDO_PENDING_TRANSACTIONS") || '[]');
      txs.push(tx);
      localStorage.setItem("LUDO_PENDING_TRANSACTIONS", JSON.stringify(txs));
    }
  },

  async updateTransactionStatus(txId: string, status: string) {
    try {
      const { error } = await supabase.from('transactions').update({ status }).eq('id', txId);
      if (error) throw error;
    } catch (error) {
      console.error("Supabase Update Tx Status Error:", error);
      const txs = JSON.parse(localStorage.getItem("LUDO_PENDING_TRANSACTIONS") || '[]');
      localStorage.setItem("LUDO_PENDING_TRANSACTIONS", JSON.stringify(txs.filter((t: any) => t.id !== txId)));
    }
  }
};
