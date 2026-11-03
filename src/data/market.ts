import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { getDb } from '../db';

export interface Quote {
  date: string;
  price: number;
  change_pct: number | null;
  updated_at?: string | null;
}
export interface Weather {
  observed_at: string | null;
  description: string | null;
  temperature_c: number | null;
  feels_like_c: number | null;
  humidity_pct: number | null;
  wind_kmh: number | null;
  wind_direction: string | null;
  rain_1h_mm: number | null;
  sunrise: string | null;
  sunset: string | null;
  next_rain: { when: string; rain_chance_pct: number; mm: number; description: string } | null;
  forecast_days: { date: string; min: number; max: number; rain_chance_pct: number; rain_mm: number }[];
  air_quality: string | null;
}
export interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  image: string | null;
  published_at: string;
  url: string | null;
}
export interface MarketSummary {
  city: string;
  quotes: { soy: Quote | null; corn: Quote | null };
  dollar: { pair: string; value: number; change_abs: number | null; change_pct: number | null } | null;
  weather: Weather | null;
  news: NewsItem[];
  sources: Record<string, { stale: boolean; updated_at: string | null; error?: string }>;
}

const KEY = 'resumo';
const TIMEOUT_MS = 12_000;

/** Guarda a última resposta no banco do celular (tabela `mercado_cache`). */
async function saveCache(data: unknown, key = KEY): Promise<string> {
  const db = await getDb();
  const at = new Date().toISOString();
  await db.runAsync('INSERT INTO mercado_cache (chave, conteudo, atualizado_em) VALUES (?,?,?) ON CONFLICT(chave) DO UPDATE SET conteudo = excluded.conteudo, atualizado_em = excluded.atualizado_em', key, JSON.stringify(data), at);
  return at;
}

export async function readCache(key = KEY): Promise<{ data: MarketSummary; updatedAt: string } | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ conteudo: string; atualizado_em: string }>('SELECT conteudo, atualizado_em FROM mercado_cache WHERE chave = ?', key);
  if (!r) return null;
  try {
    return { data: JSON.parse(r.conteudo) as MarketSummary, updatedAt: r.atualizado_em };
  } catch {
    return null;
  }
}

/** Busca no servidor; qualquer falha (sem internet, servidor fora, tempo esgotado) vira erro para quem chamou mostrar o que está guardado. */
async function fetchSummary(): Promise<MarketSummary> {
  return Promise.race([
    api<MarketSummary>('GET', '/market/summary'),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Tempo esgotado ao buscar o mercado.')), TIMEOUT_MS)),
  ]);
}

export interface MarketState {
  data: MarketSummary | null;
  /** Quando estes dados foram buscados com sucesso (hora do aparelho). */
  updatedAt: string | null;
  /** Mostrando o que estava guardado porque não foi possível buscar agora. */
  offline: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Mercado, clima e notícias. Mostra na hora o que está guardado no celular, tenta atualizar, e se não conseguir
 * continua mostrando o guardado (com a data da última atualização). Nada aqui pode travar o app.
 */
export function useMarket(): MarketState {
  const [data, setData] = useState<MarketSummary | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const fresh = await fetchSummary();
      const at = await saveCache(fresh);
      setData(fresh);
      setUpdatedAt(at);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    setLoading(false);
    busy.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cached = await readCache();
        if (cached && !cancelled) {
          setData(cached.data);
          setUpdatedAt(cached.updatedAt);
        }
      } catch {
        // sem cache ainda
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return { data, updatedAt, offline, loading, refresh };
}

/** "03/11 às 12:56" */
export function formatUpdated(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const money = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface Article {
  id: string;
  title: string;
  author: string | null;
  published_at: string;
  image: string | null;
  url: string | null;
  content: { type: 'p' | 'h2' | 'h3' | 'li'; text: string }[];
}

export interface History {
  city: string;
  from: string;
  to: string;
  quotes: { soy?: { date: string; price: number; change_pct: number | null }[]; corn?: { date: string; price: number; change_pct: number | null }[] };
  summary: { soy?: { max: number; min: number; average: number; change_pct: number | null } | null; corn?: { max: number; min: number; average: number; change_pct: number | null } | null };
}

/**
 * Busca uma rota do mercado e guarda a resposta no celular (`mercado_cache`), como o resumo:
 * mostra na hora o que estava guardado, tenta atualizar, e sem conexão continua mostrando o guardado.
 */
export function useCachedApi<T>(key: string, path: string): Omit<MarketState, 'data'> & { data: T | null } {
  const [data, setData] = useState<T | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await Promise.race([
        api<T>('GET', path),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Tempo esgotado.')), TIMEOUT_MS)),
      ]);
      const at = await saveCache(fresh, key);
      setData(fresh);
      setUpdatedAt(at);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    setLoading(false);
  }, [key, path]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setUpdatedAt(null);
    void (async () => {
      try {
        const cached = await readCache(key);
        if (cached && !cancelled) {
          setData(cached.data as unknown as T);
          setUpdatedAt(cached.updatedAt);
        }
      } catch {
        // ainda não há nada guardado
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [key, refresh]);

  return { data, updatedAt, offline, loading, refresh };
}

/** Notícias já abertas: ficam marcadas com um "visto" (guardado no celular, na tabela `mercado_cache`). */
export async function markNewsRead(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO mercado_cache (chave, conteudo, atualizado_em) VALUES (?, 'true', ?)", `lida:${id}`, new Date().toISOString());
}

export function useReadNews(): Set<string> {
  const [read, setRead] = useState<Set<string>>(new Set());
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const db = await getDb();
        const rows = await db.getAllAsync<{ chave: string }>("SELECT chave FROM mercado_cache WHERE chave LIKE 'lida:%'");
        setRead(new Set(rows.map((r) => r.chave.slice(5))));
      })();
    }, []),
  );
  return read;
}
