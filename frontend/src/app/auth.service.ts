import { Injectable, signal } from '@angular/core';

export type Role = 'patient' | 'doctor' | 'admin';
export interface User { id: number; name: string; email: string; role: Role; }


const API_URL =
  globalThis.location?.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : 'https://sehhatn-api.onrender.com/api';

const TOKEN_KEY = 'sehhatn_token';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** L'utilisateur connecté, ou null. Les pages peuvent lire auth.user(). */
  readonly user = signal<User | null>(null);

  constructor() {
    this.restoreSession();
  }

  get token(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }

  private saveToken(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch { /* stockage indisponible : on continue sans */ }
  }

  /** Appel générique vers le backend (ajoute le token s'il existe). */
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.token;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(API_URL + path, { ...options, headers });
    } catch {
      throw new ApiError('Impossible de joindre le serveur. Réessaie dans un instant.', 0);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'Erreur serveur', res.status);
    return data as T;
  }

  async register(name: string, email: string, password: string, role: 'patient' | 'doctor') {
    const data = await this.request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
    this.saveToken(data.token);
    this.user.set(data.user);
  }

  async login(email: string, password: string) {
    const data = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.saveToken(data.token);
    this.user.set(data.user);
  }

  logout() {
    this.saveToken(null);
    this.user.set(null);
  }

  /** Au chargement du site : si un token est gardé, on retrouve l'utilisateur. */
  private async restoreSession() {
    if (!this.token) return;
    try {
      this.user.set(await this.request<User>('/auth/me'));
    } catch (e) {
      // Token refusé (expiré) : on le supprime. Serveur injoignable : on le garde.
      if (e instanceof ApiError && e.status === 401) this.saveToken(null);
    }
  }
}