import * as SecureStore from 'expo-secure-store';

/** Endereço da API. Em desenvolvimento use o IP do computador na rede (o celular não enxerga 127.0.0.1). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api-campo.araujocunha.online/api/v1';

const REFRESH_KEY = 'refresh_token';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Sessão: o refresh token fica no cofre do aparelho; o access token só na memória. */
let accessToken: string | null = null;
let accessExpiresAt = 0;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export const setSessionLostHandler = (fn: (() => void) | null) => {
  onSessionLost = fn;
};

const storeTokens = async (t: { access_token: string; expires_in: number; refresh_token?: string }) => {
  accessToken = t.access_token;
  accessExpiresAt = Date.now() + t.expires_in * 1000;
  if (t.refresh_token) await SecureStore.setItemAsync(REFRESH_KEY, t.refresh_token);
};

export const hasStoredSession = async () => (await SecureStore.getItemAsync(REFRESH_KEY)) !== null;

export async function clearSession() {
  accessToken = null;
  accessExpiresAt = 0;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

async function parse(res: Response) {
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = body?.error;
    throw new ApiError(res.status, e?.code ?? 'unknown', e?.message ?? `Erro ${res.status}`, e?.fields);
  }
  return body;
}

/**
 * Renova o token. Só uma renovação por vez (o refresh token é de uso único).
 * Sem rede ou servidor fora: mantém a sessão e devolve false (o app segue offline).
 * Só apaga a sessão quando o servidor diz que ela não vale mais (401).
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: refresh }) });
      if (res.status === 401) {
        await clearSession();
        onSessionLost?.();
        return false;
      }
      await storeTokens(await parse(res));
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function login(email: string, password: string, keepLoggedIn: boolean) {
  const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, keep_logged_in: keepLoggedIn }) });
  const body = await parse(res);
  await storeTokens(body);
  return body.user;
}

export interface NewAccount {
  name: string;
  email: string;
  password: string;
  course?: string;
  institution?: string;
}

/** Cria a conta; a resposta já traz a sessão (sem confirmação de e-mail na versão 1). */
export async function register(account: NewAccount) {
  const res = await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...account, accepted_terms: true }) });
  const body = await parse(res);
  await storeTokens(body);
  return body.user;
}

export async function logout() {
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  await clearSession();
  if (refresh) await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: refresh }) }).catch(() => {});
}

/** Cabeçalho de autorização (renova o token se estiver perto de vencer); usado nos envios de arquivo. */
export async function authHeader(): Promise<Record<string, string>> {
  if (!accessToken || Date.now() > accessExpiresAt - 30_000) await refreshSession();
  return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  if (!accessToken || Date.now() > accessExpiresAt - 30_000) await refreshSession();
  const send = () =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  let res = await send();
  if (res.status === 401 && (await refreshSession())) res = await send();
  return parse(res);
}
