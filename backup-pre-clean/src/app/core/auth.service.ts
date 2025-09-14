// src/app/core/auth.service.ts
import { Injectable, NgZone, signal } from '@angular/core';
import { supabase } from './supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Signals you already use
  session = signal<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null>(null);
  ready = signal(false);

  constructor(private zone: NgZone) {
    // Initial load
    supabase.auth.getSession().then(({ data }) => {
      this.session.set(data.session ?? null);
      this.ready.set(true);
    });

    // Keep in sync (signed in/out, token refresh)
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // ensure UI updates in Angular zone
      this.zone.run(() => {
        this.session.set(session ?? null);
        this.ready.set(true);
      });
    });

    // If you ever want to clean up (not usually needed for a root service):
    // data.subscription.unsubscribe();
  }

  /** Wait until we've evaluated the initial session at least once. */
  async ensureLoaded() {
    if (this.ready()) return;
    await new Promise<void>(resolve => {
      const tick = () => (this.ready() ? resolve() : setTimeout(tick, 10));
      tick();
    });
  }

  /** Convenience getter (kept for compatibility with existing calls). */
  get userId() {
    return this.session()?.user?.id ?? null;
  }

  // ---------------------------
  // Email + Password flows
  // ---------------------------

  /** Create a new user with email & password. If email confirmations are ON, user must confirm first. */
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  /** Sign in with email & password. */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data; // session updates via onAuthStateChange
  }

  /** Sign out. */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  // ---------------------------
  // Password reset
  // ---------------------------

  /** Send password reset email. Ensure Supabase Redirect URLs include `${origin}/reset`. */
  async sendReset(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`
    });
    if (error) throw error;
    return data;
  }

  /** After the user returns with a recovery session, set the new password. */
  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  }

  // ---------------------------
  // Helpers for guards/components
  // ---------------------------

  /** One-shot fetch of current session. */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session ?? null;
  }

  /** One-shot fetch of current user. */
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user ?? null;
  }

  /** Ensure user is authenticated; throws if not. Great for route guards. */
  async requireSession() {
    const s = await this.getSession();
    if (!s) throw new Error('Not authenticated');
    return s;
  }

  // ---------------------------
  // (Optional) OAuth you had before
  // ---------------------------

  /** If you still want Google alongside password login */
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` }
    });
    if (error) throw error;
    return data;
  }
}
