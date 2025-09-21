import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-info',
  imports: [CommonModule, RouterLink],
  templateUrl: './info.component.html'
})
export class InfoComponent {}
