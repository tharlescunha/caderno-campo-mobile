import { getDb } from '../db';

export type SearchKind = 'anotacao' | 'relatorio' | 'registro' | 'materia' | 'evento';

export interface SearchHit {
  key: string;
  kind: SearchKind;
  /** id do item que abre: a anotação, o relatório (também para registro), a matéria ou o evento. */
  targetId: string;
  title: string;
  /** Pedaço do texto onde a palavra apareceu (marcada com [[ ]]). */
  snippet: string | null;
  /** Linha de baixo: tipo, matéria e data. */
  subtitle: string;
  /** Entrega de relatório: abre o relatório. */
  reportId?: string | null;
}

const MARK_OPEN = '[[';
const MARK_CLOSE = ']]';

/** Transforma o que foi digitado numa busca do FTS5: cada palavra vira um prefixo ("praga"*), todas precisam aparecer. */
export function toMatch(input: string): string | null {
  const words = input
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);
  return words.length ? words.map((w) => `"${w.replace(/"/g, '')}"*`).join(' ') : null;
}

const typeText: Record<string, string> = { prova: 'Prova', trabalho: 'Trabalho', entrega_relatorio: 'Entrega', atividade: 'Atividade', evento_faculdade: 'Evento da faculdade', outro: 'Evento' };
const pad = (n: number) => String(n).padStart(2, '0');
const dm = (iso: string) => {
  const d = iso.length === 10 ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) : new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

/** Busca no banco do celular (funciona sem internet). */
export async function searchAll(input: string): Promise<SearchHit[]> {
  const match = toMatch(input);
  if (!match) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<{ entidade: SearchKind; entidade_id: string; titulo: string; titulo_marcado: string; trecho: string }>(
    `SELECT entidade, entidade_id, titulo,
            highlight(busca_indice, 3, '${MARK_OPEN}', '${MARK_CLOSE}') AS titulo_marcado,
            snippet(busca_indice, 4, '${MARK_OPEN}', '${MARK_CLOSE}', '…', 14) AS trecho
       FROM busca_indice WHERE busca_indice MATCH ? ORDER BY rank LIMIT 80`,
    match,
  );

  const hits: SearchHit[] = [];
  for (const r of rows) {
    const hasMark = (s: string | null) => Boolean(s && s.includes(MARK_OPEN));
    const snippet = hasMark(r.trecho) ? r.trecho : null;
    if (r.entidade === 'anotacao') {
      const n = await db.getFirstAsync<{ titulo: string; atualizado_em: string; materia: string | null }>('SELECT a.titulo, a.atualizado_em, m.nome AS materia FROM anotacao a LEFT JOIN materia m ON m.id = a.materia_id WHERE a.id = ?', r.entidade_id);
      if (n) hits.push({ key: `a-${r.entidade_id}`, kind: 'anotacao', targetId: r.entidade_id, title: r.titulo_marcado, snippet, subtitle: `Anotação · ${n.materia ?? 'sem matéria'} · ${dm(n.atualizado_em)}` });
    } else if (r.entidade === 'relatorio') {
      const n = await db.getFirstAsync<{ tipo: string; status: string; materia: string }>('SELECT r.tipo, r.status, m.nome AS materia FROM relatorio r JOIN materia m ON m.id = r.materia_id WHERE r.id = ?', r.entidade_id);
      if (n) hits.push({ key: `r-${r.entidade_id}`, kind: 'relatorio', targetId: r.entidade_id, title: r.titulo_marcado, snippet, subtitle: `Relatório ${n.tipo === 'continuo' ? 'contínuo' : 'pontual'} · ${n.materia} · ${n.status === 'finalizado' ? 'finalizado' : 'em andamento'}` });
    } else if (r.entidade === 'registro') {
      const n = await db.getFirstAsync<{ relatorio_id: string; data_hora: string; titulo: string; observacoes: string | null; praga_nome: string | null }>('SELECT g.relatorio_id, g.data_hora, r.titulo, g.observacoes, g.praga_nome FROM registro g JOIN relatorio r ON r.id = g.relatorio_id WHERE g.id = ?', r.entidade_id);
      if (n) {
        const text = n.praga_nome ? `Praga: ${n.praga_nome}` : (n.observacoes ?? 'Registro de campo');
        hits.push({ key: `g-${r.entidade_id}`, kind: 'registro', targetId: n.relatorio_id, title: snippet ?? r.titulo_marcado ?? text, snippet: null, subtitle: `Registro · ${n.titulo} · ${dm(n.data_hora)}` });
      }
    } else if (r.entidade === 'materia') {
      hits.push({ key: `m-${r.entidade_id}`, kind: 'materia', targetId: r.entidade_id, title: r.titulo_marcado, snippet: null, subtitle: 'Matéria' });
    } else if (r.entidade === 'evento') {
      const n = await db.getFirstAsync<{ tipo: string; data: string; relatorio_id: string | null; materia: string | null }>('SELECT e.tipo, e.data, e.relatorio_id, m.nome AS materia FROM evento e LEFT JOIN materia m ON m.id = e.materia_id WHERE e.id = ?', r.entidade_id);
      if (n) hits.push({ key: `e-${r.entidade_id}`, kind: 'evento', targetId: r.entidade_id, title: r.titulo_marcado, snippet, subtitle: `${typeText[n.tipo] ?? 'Evento'}${n.materia ? ` · ${n.materia}` : ''} · ${dm(n.data)}`, reportId: n.relatorio_id });
    }
  }
  // tags: o nome da tag também acha o item (relatório, registro ou anotação)
  const like = `%${input.trim().replace(/[%_]/g, '')}%`;
  if (input.trim().length >= 2) {
    const seen = new Set(hits.map((h) => h.key));
    const tagRows = await db.getAllAsync<{ kind: SearchKind; id: string; alvo: string; titulo: string; tag: string; extra: string | null }>(
      `SELECT 'relatorio' AS kind, r.id AS id, r.id AS alvo, r.titulo AS titulo, t.nome AS tag, NULL AS extra
         FROM relatorio_tag x JOIN tag t ON t.id = x.tag_id JOIN relatorio r ON r.id = x.relatorio_id WHERE t.nome LIKE ?
       UNION ALL
       SELECT 'registro', g.id, g.relatorio_id, r.titulo, t.nome, g.data_hora
         FROM registro_tag x JOIN tag t ON t.id = x.tag_id JOIN registro g ON g.id = x.registro_id JOIN relatorio r ON r.id = g.relatorio_id WHERE t.nome LIKE ?
       UNION ALL
       SELECT 'anotacao', a.id, a.id, a.titulo, t.nome, a.atualizado_em
         FROM anotacao_tag x JOIN tag t ON t.id = x.tag_id JOIN anotacao a ON a.id = x.anotacao_id WHERE t.nome LIKE ? LIMIT 40`,
      like, like, like,
    );
    for (const r of tagRows) {
      const key = `${r.kind === 'relatorio' ? 'r' : r.kind === 'registro' ? 'g' : 'a'}-${r.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        key,
        kind: r.kind,
        targetId: r.alvo,
        title: r.kind === 'registro' ? `${MARK_OPEN}#${r.tag}${MARK_CLOSE} em ${r.titulo}` : r.titulo,
        snippet: r.kind === 'registro' ? null : `${MARK_OPEN}#${r.tag}${MARK_CLOSE}`,
        subtitle: r.kind === 'relatorio' ? 'Relatório · tag' : r.kind === 'registro' ? `Registro · tag${r.extra ? ' · ' + dm(r.extra) : ''}` : `Anotação · tag${r.extra ? ' · ' + dm(r.extra) : ''}`,
      });
    }
  }
  return hits;
}

const RECENT_KEY = 'buscas_recentes';

export async function getRecentSearches(): Promise<string[]> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ conteudo: string }>('SELECT conteudo FROM mercado_cache WHERE chave = ?', RECENT_KEY);
  try {
    return r ? (JSON.parse(r.conteudo) as string[]) : [];
  } catch {
    return [];
  }
}

export async function rememberSearch(term: string): Promise<void> {
  const t = term.trim();
  if (t.length < 2) return;
  const list = [t, ...(await getRecentSearches()).filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8);
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO mercado_cache (chave, conteudo, atualizado_em) VALUES (?,?,?)', RECENT_KEY, JSON.stringify(list), new Date().toISOString());
}

export async function clearRecentSearches(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM mercado_cache WHERE chave = ?', RECENT_KEY);
}

export { MARK_CLOSE, MARK_OPEN };
