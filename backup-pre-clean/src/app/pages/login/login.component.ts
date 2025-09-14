import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
  // signals for template-driven inputs
  mode = signal<'login' | 'signup'>('login');
  email = signal('');
  password = signal('');
  loading = signal(false);
  err = signal('');
  msg = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  async ngOnInit() {
    // if already signed in, go home
    const session = await this.auth.getSession();
    if (session) this.router.navigateByUrl('/');
  }

  switchMode() {
    this.err.set('');
    this.msg.set('');
    this.mode.set(this.mode() === 'login' ? 'signup' : 'login');
  }

  async submit() {
    this.err.set('');
    this.msg.set('');
    const email = this.email().trim();
    const pw = this.password();

    if (!email || pw.length < 6) {
      this.err.set('Please enter a valid email and a password of at least 6 characters.');
      return;
    }

    this.loading.set(true);
    try {
      if (this.mode() === 'signup') {
        await this.auth.signUp(email, pw);     // creates the user
        this.msg.set('Account created. You can sign in now.');
        this.mode.set('login');                // flip to sign-in
      } else {
        await this.auth.signIn(email, pw);     // sign in
        this.router.navigateByUrl('/');
      }
    } catch (e: any) {
      this.err.set(e?.message ?? 'Something went wrong.');
    } finally {
      this.loading.set(false);
    }
  }
}
