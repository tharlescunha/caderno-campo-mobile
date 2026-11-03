import { getDb } from '../db';
import type { tones } from '../theme';

type Tone = keyof typeof tones;

export interface TodaySubject {
  id: string;
  name: string;
  teacher: string | null;
  classType: 'sala' | 'campo' | 'sala_e_campo';
}

export interface UpcomingEvent {
  id: string;
  dow: string;
  day: number;
  title: string;
  kind: string;
  when: string;
  tone: Tone;
  /** Entrega de relatório: abre o relatório; senão abre o evento. */
  reportId: string | null;
}

const typeLabel: Record<string, string> = {
  prova: 'Prova',
  trabalho: 'Trabalho',
  entrega_relatorio: 'Entrega de relatório',
  atividade: 'Atividade',
  evento_faculdade: 'Evento da faculdade',
  outro: 'Evento',
};
const typeTone: Record<string, Tone> = { prova: 'purple', trabalho: 'amber', entrega_relatorio: 'amber', atividade: 'green', evento_faculdade: 'blue', outro: 'brown' };
const weekdayShort = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** AAAA-MM-DD no fuso do aparelho (as datas de evento são "só data", sem hora). */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const daysUntil = (date: string, from = new Date()) => Math.round((parseDate(date).getTime() - parseDate(localDate(from)).getTime()) / 86_400_000);

export const whenText = (days: number) => (days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `${days} dias`);

/** Matéria de hoje: a do período ativo que tem aula neste dia da semana (1 = segunda ... 7 = domingo). */
export async function getTodaySubject(now = new Date()): Promise<TodaySubject | null> {
  const db = await getDb();
  const weekday = now.getDay() === 0 ? 7 : now.getDay();
  const row = await db.getFirstAsync<{ id: string; nome: string; prof: string | null; tipo_aula: 'sala' | 'campo' | 'sala_e_campo' }>(
    `SELECT m.id, m.nome, m.tipo_aula, p.nome AS prof
       FROM materia m
       JOIN materia_dia d ON d.materia_id = m.id AND d.dia_semana = ?
       JOIN periodo pe ON pe.id = m.periodo_id AND pe.usuario_id = m.usuario_id AND pe.status = 'ativo'
       LEFT JOIN professor p ON p.id = m.professor_id AND p.usuario_id = m.usuario_id
      WHERE m.desativada = 0
      ORDER BY m.nome LIMIT 1`,
    weekday,
  );
  return row ? { id: row.id, name: row.nome, teacher: row.prof, classType: row.tipo_aula } : null;
}

export async function getUpcomingEvents(limit = 3, now = new Date()): Promise<UpcomingEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; tipo: string; descricao_tipo: string | null; titulo: string; data: string; materia: string | null; relatorio_id: string | null }>(
    `SELECT e.id, e.tipo, e.descricao_tipo, e.titulo, e.data, e.relatorio_id, m.nome AS materia
       FROM evento e LEFT JOIN materia m ON m.id = e.materia_id AND m.usuario_id = e.usuario_id
      WHERE e.data >= ? AND e.concluido = 0 AND e.encerrado_com_periodo = 0
      ORDER BY e.data, e.criado_em LIMIT ?`,
    localDate(now),
    limit,
  );
  return rows.map((r) => ({
    id: r.id,
    dow: weekdayShort[parseDate(r.data).getDay()],
    day: parseDate(r.data).getDate(),
    title: r.titulo,
    kind: [r.tipo === 'outro' ? (r.descricao_tipo ?? typeLabel.outro) : typeLabel[r.tipo], r.materia].filter(Boolean).join(' · '),
    when: whenText(daysUntil(r.data, now)),
    tone: typeTone[r.tipo] ?? 'brown',
    reportId: r.relatorio_id,
  }));
}
