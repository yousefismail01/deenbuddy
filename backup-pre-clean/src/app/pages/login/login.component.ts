import { Component, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  email = signal('');
  sent = signal(false);
  loading = signal(false);

  constructor(private auth:AuthService, private router:Router) {
    // If we arrive here already signed in (after magic link), go home
    effect(() => {
      if (this.auth.session()) this.router.navigateByUrl('/');
    });
  }

  async onEmail() {
    if (!this.email()) return;
    this.loading.set(true);
    try { await this.auth.signInWithEmail(this.email()); this.sent.set(true); }
    finally { this.loading.set(false); }
  }
  async onGoogle() {
    this.loading.set(true);
    try { await this.auth.signInWithGoogle(); }
    finally { this.loading.set(false); }
  }
}
