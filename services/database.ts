
import { createClient } from '@supabase/supabase-js';
import { UserProfile, PendingTransaction, LiveMatch, PlayerColor, GameState } from '../types';

const supabaseUrl = 'https://ipvfupwcckkigyxeqazg.supabase.co';
const supabaseKey = 'sb_publishable_IymvinlNRCFKhicLAUXqFw_cc_xiOm6';

const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_KEY_SETTINGS = "LUDO_SETTINGS_BACKUP";
const STORAGE_KEY_TRANSACTIONS = "LUDO_GLOBAL_TRANSACTIONS";

// Helper to normalize phone numbers for comparison (e.g., "017..." and "+88017..." become "17...")
const normalizePhone = (p: string | undefined): string => {
  if (!p) return "";
  const cleaned = p.replace(/\D/g, ''); // keep only digits
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
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return (data || []).map(u => toCamelCase(u));
    } catch (error: any) {
      return JSON.parse(localStorage.getItem("LUDO_USERS_DATABASE") || '[]');
    }
  },

  async getUserByPhone(phone: string): Promise<UserProfile | null> {
    try {
      // First try exact match
      let { data, error } = await supabase.from('users').select('*').eq('phone', phone).maybeSingle();
      
      // If no exact match, try partial match for normalized phone
      if (!data) {
        const { data: all } = await supabase.from('users').select('*');
        const normalizedTarget = normalizePhone(phone);
        data = all?.find(u => normalizePhone(u.phone) === normalizedTarget) || null;
      }
      
      if (!data) return null;
      return toCamelCase(data);
    } catch (e) {
      const db = JSON.parse(localStorage.getItem("LUDO_USERS_DATABASE") || '[]');
      const normalizedTarget = normalizePhone(phone);
      return db.find((u: any) => normalizePhone(u.phone) === normalizedTarget) || null;
    }
  },

  async updateUser(user: UserProfile) {
    try {
      const snakeData = toSnakeCase(user);
      const { error } = await supabase.from('users').upsert(snakeData);
      if (error) throw error;
    } catch (error: any) {
      const db = JSON.parse(localStorage.getItem("LUDO_USERS_DATABASE") || '[]');
      const idx = db.findIndex((u: any) => normalizePhone(u.phone) === normalizePhone(user.phone));
      if (idx !== -1) db[idx] = user; else db.push(user);
      localStorage.setItem("LUDO_USERS_DATABASE", JSON.stringify(db));
    }
  },

  async findOrCreateMatch(stake: number, playerCount: number, user: UserProfile): Promise<string> {
    try {
      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('status', 'WAITING')
        .contains('players', [{ phone: user.phone }])
        .limit(1);
      
      if (existing && existing.length > 0) return existing[0].id;

      const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'WAITING')
        .eq('stake', stake)
        .eq('player_count', playerCount)
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) throw error;

      if (matches && matches.length > 0) {
        const match = matches[0];
        const players = match.players || [];
        players.push({
          name: user.name,
          phone: user.phone,
          avatar: user.avatar,
          country: user.country || 'Global',
          flag: user.flag || '🚩',
          isBot: false
        });
        await supabase.from('matches').update({ players }).eq('id', match.id);
        return match.id;
      } else {
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
      return "local-" + Math.random().toString(36).substr(2, 5);
    }
  },

  listenToMatch(matchId: string, onUpdate: (match: any) => void) {
    if (matchId.startsWith('local-')) return () => {};
    const subscription = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
        onUpdate(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  },

  async updateMatchStatus(matchId: string, status: 'ACTIVE' | 'TERMINATED' | 'FINISHED', finalGameState?: any) {
    if (!matchId || matchId.startsWith('local-')) return;
    try {
      await supabase.from('matches').update({ 
        status, 
        game_state: finalGameState ? toSnakeCase(finalGameState) : undefined 
      }).eq('id', matchId);
    } catch (e) {}
  },

  async leaveMatch(matchId: string, phone: string) {
    if (!matchId || matchId.startsWith('local-')) return;
    try {
      const { data: match } = await supabase.from('matches').select('players, status').eq('id', matchId).single();
      if (match) {
        if (match.status === 'WAITING') {
          const newPlayers = match.players.filter((p: any) => p.phone !== phone);
          if (newPlayers.length === 0) {
            await supabase.from('matches').delete().eq('id', matchId);
          } else {
            await supabase.from('matches').update({ players: newPlayers }).eq('id', matchId);
          }
        } else if (match.status === 'ACTIVE') {
          await supabase.from('matches').update({ status: 'TERMINATED' }).eq('id', matchId);
        }
      }
    } catch (e) {}
  },

  async syncGameState(matchId: string, gameState: GameState) {
     if (!matchId || matchId.startsWith('local-')) return;
     try {
       await supabase.from('matches').update({ 
         game_state: toSnakeCase(gameState),
         last_updated: new Date().toISOString()
       }).eq('id', matchId);
     } catch (e) {}
  },

  async createTransaction(tx: PendingTransaction) {
    try {
      await supabase.from('transactions').insert(toSnakeCase(tx));
    } catch (e) {
      const allTx = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
      allTx.push(tx);
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(allTx));
    }
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
