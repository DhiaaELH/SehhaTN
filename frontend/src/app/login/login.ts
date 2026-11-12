import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule], 
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  username = '';
  password = '';
  errorMessage = '';

  http = inject(HttpClient);
  router = inject(Router);

  onLogin() {
    this.http.post('http://localhost:5000/login', {
      username: this.username,
      password: this.password
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.errorMessage = err.error.message || 'Login failed';
      }
    });
  }
}