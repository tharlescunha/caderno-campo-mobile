import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useCachedApi } from '../data/market';

export interface InboxItem {
  id: string;
  type: 'event_reminder' | 'field_class_reminder' | 'delivery_reminder' | 'post_field_record_reminder';
  title: string;
  text: string | null;
  reference: { type: 'event' | 'report' | 'subject'; id: string } | null;
  scheduled_for: string;
  delivered_at: string | null;
  read_at: string | null;
}

export interface Inbox {
  items: InboxItem[];
  unread_count: number;
}

// Todas as telas que mostram o "não lidas" (o sino da tela Hoje e a própria caixa) recebem o número novo na hora,
// sem esperar a próxima busca no servidor.
const listeners = new Set<(unread: number) => void>();
const announce = (unread: number) => listeners.forEach((fn) => fn(unread));

/** Caixa de entrada (avisos já entregues pelo servidor); guardada no celular para ver sem internet. */
export function useInbox() {
  const state = useCachedApi<Inbox>('notificacoes', '/notifications?limit=50');
  const { refresh, data } = state;
  const [announced, setAnnounced] = useState<number | null>(null);

  useEffect(() => {
    listeners.add(setAnnounced);
    return () => {
      listeners.delete(setAnnounced);
    };
  }, []);
  // chegou resposta do servidor: ela vale mais que o aviso rápido
  useEffect(() => {
    setAnnounced(null);
  }, [data]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const unreadNow = announced ?? data?.unread_count ?? 0;

  const markRead = useCallback(
    async (id: string) => {
      const wasUnread = data?.items.find((i) => i.id === id)?.read_at === null;
      try {
        await api('PATCH', `/notifications/${id}/read`);
        if (wasUnread) announce(Math.max(0, unreadNow - 1));
      } catch {
        // sem internet: marca na próxima vez que abrir
      }
      await refresh();
    },
    [data, unreadNow, refresh],
  );
  const markAllRead = useCallback(async () => {
    try {
      await api('POST', '/notifications/read-all');
      announce(0);
    } catch {
      // idem
    }
    await refresh();
  }, [refresh]);

  return { ...state, unread: unreadNow, markRead, markAllRead };
}
