import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { wipeLocalData } from './db';
import { api, clearSession, hasStoredSession, login as apiLogin, logout as apiLogout, register as apiRegister, refreshSession, setSessionLostHandler, type NewAccount } from './api/client';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionValue {
  status: Status;
  /** Já passou (ou pulou) as 3 telas do primeiro acesso. */
  firstAccessDone: boolean;
  signIn: (email: string, password: string, keepLoggedIn: boolean) => Promise<void>;
  signUp: (account: NewAccount) => Promise<void>;
  signOut: () => Promise<void>;
  completeFirstAccess: () => Promise<void>;
}

const FIRST_ACCESS_KEY = 'first_access_done';
const noop = async () => {};

const SessionContext = createContext<SessionValue>({ status: 'loading', firstAccessDone: false, signIn: noop, signUp: noop, signOut: noop, completeFirstAccess: noop });

/**
 * Quem está logado. Com sessão guardada no cofre o app abre direto, sem login e sem servidor:
 * a renovação do token roda em segundo plano e só desloga se o servidor recusar (401).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [firstAccessDone, setFirstAccessDone] = useState(false);

  useEffect(() => {
    setSessionLostHandler(() => setStatus('signedOut'));
    (async () => {
      const has = await hasStoredSession();
      setFirstAccessDone((await SecureStore.getItemAsync(FIRST_ACCESS_KEY)) === '1');
      setStatus(has ? 'signedIn' : 'signedOut');
      if (has) void refreshSession();
    })();
    return () => setSessionLostHandler(null);
  }, []);

  const afterAuth = useCallback(async (user: { first_access_completed_at?: string | null }) => {
    const done = Boolean(user?.first_access_completed_at);
    setFirstAccessDone(done);
    if (done) await SecureStore.setItemAsync(FIRST_ACCESS_KEY, '1');
    else await SecureStore.deleteItemAsync(FIRST_ACCESS_KEY);
    setStatus('signedIn');
  }, []);

  const signIn = useCallback(async (email: string, password: string, keep: boolean) => afterAuth(await apiLogin(email, password, keep)), [afterAuth]);
  const signUp = useCallback(async (account: NewAccount) => afterAuth(await apiRegister(account)), [afterAuth]);

  const signOut = useCallback(async () => {
    await apiLogout().catch(() => clearSession());
    await wipeLocalData().catch(() => {});
    await SecureStore.deleteItemAsync(FIRST_ACCESS_KEY);
    setFirstAccessDone(false);
    setStatus('signedOut');
  }, []);

  /** Vale no aparelho na hora; o aviso ao servidor é tentativa (sem rede, fica só aqui). */
  const completeFirstAccess = useCallback(async () => {
    await SecureStore.setItemAsync(FIRST_ACCESS_KEY, '1');
    setFirstAccessDone(true);
    api('PATCH', '/users/me', { first_access_completed: true }).catch(() => {});
  }, []);

  const value = useMemo(() => ({ status, firstAccessDone, signIn, signUp, signOut, completeFirstAccess }), [status, firstAccessDone, signIn, signUp, signOut, completeFirstAccess]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
