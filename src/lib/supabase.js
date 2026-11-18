import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Browser Client (Frontend & Auth ke liye)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server Admin Client (Sirf API routes ke liye)
export function getSupabaseAdmin() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// --- 30-Day Local Chat Retention + DB Sync Helper ---
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function getLocalChats(userId, moduleSlug) {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const key = `saarthi_chats_${userId}_${moduleSlug}`;
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    const now = Date.now();
    // 30 din se purani chats automatically clean karein
    const valid = raw.filter(item => (now - new Date(item.created_at).getTime()) < THIRTY_DAYS_MS);
    if (valid.length !== raw.length) {
      localStorage.setItem(key, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return [];
  }
}

export function saveLocalChat(userId, moduleSlug, chatEntry) {
  if (typeof window === 'undefined' || !userId) return;
  const key = `saarthi_chats_${userId}_${moduleSlug}`;
  const existing = getLocalChats(userId, moduleSlug);
  const updated = [...existing, chatEntry];
  localStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

// Naye device par login hone par Supabase se last N chats sync karein
export async function syncChatsFromDB(userId, moduleSlug) {
  const local = getLocalChats(userId, moduleSlug);
  if (local.length > 0) return local;

  const { data, error } = await supabase
    .from('chat_logs')
    .select('id, user_query, ai_response, created_at')
    .eq('user_id', userId)
    .eq('module_slug', moduleSlug)
    .order('created_at', { ascending: true });

  if (!error && data && data.length > 0) {
    const key = `saarthi_chats_${userId}_${moduleSlug}`;
    localStorage.setItem(key, JSON.stringify(data));
    return data;
  }
  return [];
}
