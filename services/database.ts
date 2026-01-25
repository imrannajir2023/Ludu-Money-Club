
import { createClient } from '@supabase/supabase-js';
import { UserProfile, PendingTransaction, LiveMatch, PlayerColor, GameState } from '../types';

const supabaseUrl = 'https://ipvfupwcckkigyxeqazg.supabase.co';
const supabaseKey = 'sb_publishable_IymvinlNRCFKhicLAUXqFw_cc_xiOm6';

const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_KEY_SETTINGS = "LUDO_SETTINGS_BACKUP";
const STORAGE_KEY_TRANSACTIONS = "LUDO_GLOBAL_TRANSACTIONS";

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

  // --- Real-time Matchmaking ---
  async findOrCreateMatch(stake: number, playerCount: number, user: UserProfile): Promise<string> {
    try {
      // 1. Find existing WAITING match with same stake and player count
      const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'WAITING')
        .eq('stake', stake)
        .eq('player_count', playerCount)
        .limit(1);

      if (error) throw error;

      if (matches && matches.length > 0) {
        const match = matches[0];
        const players = match.players || [];
        
        // Don't add if already in
        if (!players.find((p: any) => p.phone === user.phone)) {
          players.push({
            name: user.name,
            phone: user.phone,
            avatar: user.avatar,
            country: user.country || 'Global',
            flag: user.flag || '🚩',
            isBot: false
          });
          
          await supabase.from('matches').update({ players }).eq('id', match.id);
        }
        return match.id;
      } else {
        // 2. Create new match if none found
        const newId = Math.random().toString(36).substr(2, 9);
        const { error: createError } = await supabase.from('matches').insert({
          id: newId,
          stake,
          player_count: playerCount,
          status: 'WAITING',
          players: [{
            name: user.name,
            phone: user.phone,
            avatar: user.avatar,
            country: user.country || 'Global',
            flag: user.flag || '🚩',
            isBot: false
          }],
          created_at: new Date().toISOString()
        });
        if (createError) throw createError;
        return newId;
      }
    } catch (e) {
      console.error("Matchmaking Error:", e);
      return "local-" + Math.random().toString(36).substr(2, 5);
    }
  },

  listenToMatch(matchId: string, onUpdate: (match: any) => void) {
    if (matchId.startsWith('local-')) return () => {};

    const subscription = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
        onUpdate(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  },

  async updateMatchStatus(matchId: string, status: 'ACTIVE' | 'TERMINATED' | 'FINISHED', finalGameState?: any) {
    if (matchId.startsWith('local-')) return;
    try {
      await supabase.from('matches').update({ 
        status, 
        game_state: finalGameState ? toSnakeCase(finalGameState) : undefined 
      }).eq('id', matchId);
    } catch (e) {}
  },

  async syncGameState(matchId: string, gameState: GameState) {
     if (matchId.startsWith('local-')) return;
     try {
       await supabase.from('matches').update({ 
         game_state: toSnakeCase(gameState),
         last_updated: new Date().toISOString()
       }).eq('id', matchId);
     } catch (e) {}
  },

  // --- Transactions ---
  async createTransaction(tx: PendingTransaction) {
    try {
      const { error } = await supabase.from('transactions').insert(toSnakeCase(tx));
      if (error) throw error;
    } catch (e) {
      const allTx = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
      allTx.push(tx);
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(allTx));
    }
  },

  async updateTransactionStatus(txId: string, status: 'APPROVED' | 'REJECTED') {
    try {
      await supabase.from('transactions').update({ status }).eq('id', txId);
    } catch (e) {
      const allTx = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
      const idx = allTx.findIndex((t: any) => t.id === txId);
      if (idx !== -1) {
        allTx[idx].status = status;
        localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(allTx));
      }
    }
  },

  async getPendingTransactions(): Promise<PendingTransaction[]> {
    try {
      const { data, error } = await supabase.from('transactions').select('*').eq('status', 'PENDING');
      if (error) throw error;
      return (data || []).map(t => toCamelCase(t));
    } catch (error: any) {
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
