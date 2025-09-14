import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

function storageAvailable() {
  try { const x='__t'; localStorage.setItem(x,x); localStorage.removeItem(x); return true; } catch { return false; }
}
const safeStorage = storageAvailable() ? localStorage : sessionStorage;

// ➜ Provide a custom lock that just runs the function (no Navigator.locks)
const noOpLock = async <R>(name: string, acquireTimeout: number, fn: () => Promise<R>) => {
  return await fn();
};

export const supabase = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: safeStorage,
      userStorage: safeStorage,
      lock: noOpLock, // <-- avoids Navigator LockManager errors
    },
  }
);
