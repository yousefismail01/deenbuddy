import { Injectable, signal } from '@angular/core';
import { supabase } from './supabase.client';


@Injectable({ providedIn: 'root' })
export class AuthService {
  session = signal<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>(null);
  ready = signal(false);

  constructor() {
    // Initial load
    supabase.auth.getSession().then(r => {
      this.session.set(r.data.session);
      this.ready.set(true);
    });
    // Keep in sync
    supabase.auth.onAuthStateChange((_e, s) => {
      this.session.set(s);
      this.ready.set(true);
    });
  }

  async ensureLoaded() {
    // Wait until we’ve evaluated the initial session at least once
    if (this.ready()) return;
    await new Promise<void>(res => {
      const check = () => this.ready() ? res() : setTimeout(check, 10);
      check();
    });
  }

  get userId() { return this.session()?.user?.id ?? null; }

  signInWithEmail(email: string) {
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/' } // explicit trailing slash
    });
  }

  async signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' }
    });
  }

  signOut() { return supabase.auth.signOut(); }
}
