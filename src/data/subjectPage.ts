import { getDb } from '../db';
import type { SubjectColor } from '../theme';
import { daysUntil, localDate, whenText } from './today';
import { classTypeLabel, weekdayName, type ClassType } from './subjects';

export interface SubjectPage {
  id: string;
  name: string;
  teacher: string | null;
  color: SubjectColor;
  classType: ClassType;
  /** "aula de campo · toda terça" */
  scheduleText: string;
  active: boolean;
  periodActive: boolean;
  events: { id: string; title: string; kind: string; date: string; when: string; past: boolean; reportId: string | null }[];
  reports: { id: string; title: string; kind: 'continuo' | 'pontual'; finished: boolean; entries: number; deliveryDate: string | null }[];
  notes: { id: string; title: string; text: string | null; updatedAt: string; pinned: boolean }[];
}

const dayLong = ['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const kindText: Record<string, string> = { prova: 'Prova', trabalho: 'Trabalho', entrega_relatorio: 'Entrega de relatório', atividade: 'Atividade', evento_faculdade: 'Evento da faculdade', outro: 'Evento' };

/** Tudo o que é desta matéria num lugar só: datas, relatórios e anotações. */
export async function getSubjectPage(id: string, now = new Date()): Promise<SubjectPage | null> {
  const db = await getDb();
  const s = await db.getFirstAsync<{ nome: string; tipo_aula: ClassType; cor: SubjectColor; desativada: number; prof: string | null; periodo_status: string }>(
    `SELECT m.nome, m.tipo_aula, m.cor, m.desativada, p.nome AS prof, pe.status AS periodo_status
       FROM materia m JOIN periodo pe ON pe.id = m.periodo_id AND pe.usuario_id = m.usuario_id
       LEFT JOIN professor p ON p.id = m.professor_id AND p.usuario_id = m.usuario_id WHERE m.id = ?`,
    id,
  );
  if (!s) return null;
  const days = (await db.getAllAsync<{ dia_semana: number }>('SELECT dia_semana FROM materia_dia WHERE materia_id = ? ORDER BY dia_semana', id)).map((d) => d.dia_semana);
  const scheduleText = `${classTypeLabel[s.tipo_aula]}${days.length ? ` · toda ${days.map((d) => dayLong[d]).join(' e ')}` : ''}`;
  void weekdayName;

  const today = localDate(now);
  const events = (
    await db.getAllAsync<{ id: string; tipo: string; titulo: string; data: string; relatorio_id: string | null }>(
      'SELECT id, tipo, titulo, data, relatorio_id FROM evento WHERE materia_id = ? AND encerrado_com_periodo = 0 ORDER BY data',
      id,
    )
  ).map((e) => ({ id: e.id, title: e.titulo, kind: kindText[e.tipo] ?? 'Evento', date: e.data, when: e.data >= today ? whenText(daysUntil(e.data, now)) : 'passou', past: e.data < today, reportId: e.relatorio_id }));
  // as próximas primeiro (da mais perto para a mais longe), depois as que já passaram (da mais recente)
  events.sort((a, b) => (a.past === b.past ? (a.past ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)) : a.past ? 1 : -1));

  const reports = (
    await db.getAllAsync<{ id: string; titulo: string; tipo: 'continuo' | 'pontual'; status: string; data_entrega: string | null; registros: number }>(
      `SELECT r.id, r.titulo, r.tipo, r.status, r.data_entrega, (SELECT count(*) FROM registro g WHERE g.relatorio_id = r.id) AS registros
         FROM relatorio r WHERE r.materia_id = ? ORDER BY (r.status = 'em_andamento') DESC, r.atualizado_em DESC`,
      id,
    )
  ).map((r) => ({ id: r.id, title: r.titulo, kind: r.tipo, finished: r.status === 'finalizado', entries: r.registros, deliveryDate: r.data_entrega }));

  const notes = (
    await db.getAllAsync<{ id: string; titulo: string; texto: string | null; atualizado_em: string; fixada: number }>(
      'SELECT id, titulo, texto, atualizado_em, fixada FROM anotacao WHERE materia_id = ? ORDER BY fixada DESC, atualizado_em DESC',
      id,
    )
  ).map((n) => ({ id: n.id, title: n.titulo, text: n.texto, updatedAt: n.atualizado_em, pinned: n.fixada === 1 }));

  return { id, name: s.nome, teacher: s.prof, color: s.cor, classType: s.tipo_aula, scheduleText, active: s.desativada === 0, periodActive: s.periodo_status === 'ativo', events, reports, notes };
}
