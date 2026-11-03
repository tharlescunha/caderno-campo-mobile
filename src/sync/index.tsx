import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useSession } from '../session';
import { rescheduleReminders } from '../notifications/local';
import { pushMedia } from './media';
import { pullChanges } from './pull';
import { pushChanges } from './push';

const INTERVAL_MS = 15 * 60 * 1000;

interface SyncValue {
  syncing: boolean;
  online: boolean;
  /** Última sincronização que terminou sem erro. */
  lastSyncAt: Date | null;
  lastError: string | null;
  /** "Sincronizar agora". */
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncValue>({ syncing: false, online: true, lastSyncAt: null, lastError: null, syncNow: async () => {} });

/**
 * Sincroniza (envia a fila e depois baixa as novidades) quando: o app abre, volta para a frente,
 * a internet volta, passam 15 minutos com o app aberto, ou o usuário pede. Só com o usuário logado.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const busy = useRef(false);

  const syncNow = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      await pushChanges();
      await pushMedia();
      await pullChanges();
      setLastSyncAt(new Date());
      setLastError(null);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    }
    void rescheduleReminders();
    busy.current = false;
    setSyncing(false);
  }, []);

  useEffect(() => {
    if (status !== 'signedIn') return;
    void syncNow();
    const appState = AppState.addEventListener('change', (s) => s === 'active' && void syncNow());
    let wasOnline = true;
    const net = NetInfo.addEventListener((s) => {
      const now = s.isConnected !== false && s.isInternetReachable !== false;
      setOnline(now);
      if (now && !wasOnline) void syncNow();
      wasOnline = now;
    });
    const timer = setInterval(() => void syncNow(), INTERVAL_MS);
    return () => {
      appState.remove();
      net();
      clearInterval(timer);
    };
  }, [status, syncNow]);

  const value = useMemo(() => ({ syncing, online, lastSyncAt, lastError, syncNow }), [syncing, online, lastSyncAt, lastError, syncNow]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export const useSync = () => useContext(SyncContext);
