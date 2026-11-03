import { getDb } from '../db';
import type { tones } from '../theme';
import { daysUntil, localDate, whenText } from './today';

type Tone = keyof typeof tones;

export interface Pending {
  id: string;
  title: string;
  sub: string;
  tag: string;
  tone: Tone;
  icon: 'note' | 'pencil';
  /** Relatório que resolve a pendência. */
  reportId: string;
}

export interface Activity {
  id: string;
  /** O que foi feito: um registro de campo, uma anotação ou um relatório novo. */
  kind: 'registro' | 'anotacao' | 'relatorio';
  title: string;
  subject: string;
  when: string;
  icon: 'note' | 'pencil' | 'notes' | 'sprout';
  /** Item que abre ao tocar: o relatório (registro e relatório) ou a anotação. */
  targetId: string;
}

const dayName = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const shortDay = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dm = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
const parseLocal = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** O que pede atenção: registros em rascunho e entregas de relatórios em andamento (rascunhos primeiro, depois por data). */
export async function getPendings(limit = 4, now = new Date()): Promise<Pending[]> {
  const db = await getDb();
  const out: Pending[] = [];

  const drafts = await db.getAllAsync<{ id: string; relatorio_id: string; titulo: string; data_hora: string }>(
    `SELECT g.id, g.relatorio_id, r.titulo, g.data_hora FROM registro g JOIN relatorio r ON r.id = g.relatorio_id
      WHERE g.status = 'rascunho' AND r.status = 'em_andamento' ORDER BY g.data_hora DESC`,
  );
  for (const d of drafts) {
    const when = new Date(d.data_hora);
    out.push({ id: `rascunho-${d.id}`, title: 'Registro em rascunho', sub: `${d.titulo} · ${dayName[when.getDay()]}, ${dm(when)}`, tag: 'Concluir', tone: 'brown', icon: 'pencil', reportId: d.relatorio_id });
  }

  const deliveries = await db.getAllAsync<{ id: string; titulo: string; data_entrega: string; materia: string }>(
    `SELECT r.id, r.titulo, r.data_entrega, m.nome AS materia FROM relatorio r JOIN materia m ON m.id = r.materia_id AND m.usuario_id = r.usuario_id
      WHERE r.status = 'em_andamento' AND r.data_entrega IS NOT NULL AND r.data_entrega >= ? ORDER BY r.data_entrega`,
    localDate(now),
  );
  for (const r of deliveries) {
    const days = daysUntil(r.data_entrega, now);
    const date = parseLocal(r.data_entrega);
    out.push({ id: `entrega-${r.id}`, title: r.titulo, sub: `${r.materia} · entrega ${dayName[date.getDay()]}, ${dm(date)}`, tag: whenText(days), tone: days <= 3 ? 'amber' : 'purple', icon: 'note', reportId: r.id });
  }
  return out.slice(0, limit);
}

/** As últimas coisas que você fez (registros, anotações e relatórios novos), da mais nova para a mais antiga. */
export async function getRecentActivity(limit = 4): Promise<Activity[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; kind: Activity['kind']; status: string | null; at: string; titulo: string; materia: string | null; alvo: string }>(
    `SELECT * FROM (
       SELECT g.id AS id, 'registro' AS kind, g.status AS status, g.data_hora AS at, r.titulo AS titulo, m.nome AS materia, r.id AS alvo
         FROM registro g JOIN relatorio r ON r.id = g.relatorio_id LEFT JOIN materia m ON m.id = r.materia_id AND m.usuario_id = r.usuario_id
       UNION ALL
       SELECT a.id, 'anotacao', NULL, a.atualizado_em, a.titulo, m.nome, a.id
         FROM anotacao a LEFT JOIN materia m ON m.id = a.materia_id AND m.usuario_id = a.usuario_id
       UNION ALL
       SELECT r.id, 'relatorio', NULL, r.criado_em, r.titulo, m.nome, r.id
         FROM relatorio r LEFT JOIN materia m ON m.id = r.materia_id AND m.usuario_id = r.usuario_id
     ) ORDER BY at DESC LIMIT ?`,
    limit,
  );
  return rows.map((r) => {
    const d = new Date(r.at);
    const title =
      r.kind === 'anotacao' ? `Anotação: ${r.titulo}` : r.kind === 'relatorio' ? `Relatório criado: ${r.titulo}` : r.status === 'rascunho' ? `Rascunho de registro: ${r.titulo}` : `Registro de campo: ${r.titulo}`;
    return {
      id: `${r.kind}-${r.id}`,
      kind: r.kind,
      title,
      subject: r.materia ?? 'Sem matéria',
      when: `${shortDay[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      icon: r.kind === 'anotacao' ? 'notes' : r.kind === 'relatorio' ? 'note' : r.status === 'rascunho' ? 'pencil' : 'sprout',
      targetId: r.alvo,
    };
  });
}
