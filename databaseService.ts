
import { createClient } from '@supabase/supabase-js';
import { UserProfile, PendingTransaction, LiveMatch } from './types';

// These should be set in your Vercel Environment Variables (Settings > Environment Variables)
const supabaseUrl = (process.env as any).SUPABASE_URL || '';
const supabaseKey = (process.env as any).SUPABASE_KEY || '';

// Fallback to local storage if supabase is not configured
const isConfigured = supabaseUrl && supabaseKey;
const supabase = isConfigured ? createClient(supabaseUrl, supabaseKey) : null;

export const databaseService = {
  isOnline: () => !!supabase,

  async getUsers(): Promise<UserProfile[]> {
    if (!supabase) return JSON.parse(localStorage.getItem("LUDO_USERS_DATABASE") || '[]');
    const { data, error } = await supabase.from('users').select('*');
    if (error) console.error("Supabase Error:", error);
    return data || [];
  },

  async updateUser(user: UserProfile) {
    if (!supabase) {
      const db = JSON.parse(localStorage.getItem("LUDO_USERS_DATABASE") || '[]');
      const idx = db.findIndex((u: any) => u.phone === user.phone);
      if (idx !== -1) db[idx] = user; else db.push(user);
      localStorage.setItem("LUDO_USERS_DATABASE", JSON.stringify(db));
      return;
    }
    const { error } = await supabase.from('users').upsert(user);
    if (error) console.error("Supabase Update Error:", error);
  },

  async getLiveMatches(): Promise<LiveMatch[]> {
    if (!supabase) return JSON.parse(localStorage.getItem("LUDO_LIVE_MATCHES") || '[]');
    const { data } = await supabase.from('matches').select('*');
    return data || [];
  },

  async syncMatch(match: LiveMatch) {
    if (!supabase) {
      const matches = JSON.parse(localStorage.getItem("LUDO_LIVE_MATCHES") || '[]');
      const idx = matches.findIndex((m: any) => m.matchId === match.matchId);
      if (idx !== -1) matches[idx] = match; else matches.push(match);
      localStorage.setItem("LUDO_LIVE_MATCHES", JSON.stringify(matches));
      return;
    }
    await supabase.from('matches').upsert(match);
  },

  async deleteMatch(matchId: string) {
    if (!supabase) {
      const matches = JSON.parse(localStorage.getItem("LUDO_LIVE_MATCHES") || '[]');
      localStorage.setItem("LUDO_LIVE_MATCHES", JSON.stringify(matches.filter((m: any) => m.matchId !== matchId)));
      return;
    }
    await supabase.from('matches').delete().eq('matchId', matchId);
  },

  async getPendingTransactions(): Promise<PendingTransaction[]> {
    if (!supabase) return JSON.parse(localStorage.getItem("LUDO_PENDING_TRANSACTIONS") || '[]');
    const { data } = await supabase.from('transactions').select('*').eq('status', 'PENDING');
    return data || [];
  },

  async submitTransaction(tx: PendingTransaction) {
    if (!supabase) {
      const txs = JSON.parse(localStorage.getItem("LUDO_PENDING_TRANSACTIONS") || '[]');
      txs.push(tx);
      localStorage.setItem("LUDO_PENDING_TRANSACTIONS", JSON.stringify(txs));
      return;
    }
    await supabase.from('transactions').insert(tx);
  },

  async updateTransactionStatus(txId: string, status: string) {
    if (!supabase) {
      const txs = JSON.parse(localStorage.getItem("LUDO_PENDING_TRANSACTIONS") || '[]');
      localStorage.setItem("LUDO_PENDING_TRANSACTIONS", JSON.stringify(txs.filter((t: any) => t.id !== txId)));
      return;
    }
    await supabase.from('transactions').update({ status }).eq('id', txId);
  }
};
