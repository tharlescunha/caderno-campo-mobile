import { enqueue, getDb, newId } from '../db';
import type { StoredPhoto } from '../media/storage';
import type { Reminder } from './reports';
import { localDate } from './today';

export type AgendaKind = 'aula' | 'campo' | 'prova' | 'entrega' | 'trabalho' | 'atividade' | 'evento';
export type AgendaFilter = 'tudo' | 'aulas' | 'campo' | 'provas' | 'entregas';

export interface AgendaItem {
  id: string;
  kind: AgendaKind;
  title: string;
  detail: string | null;
  date: string;
  /** Aula (vem do quadro semanal) ou evento marcado. */
  lesson: boolean;
  subjectId: string | null;
  /** Evento marcado (não aula): id para abrir. */
  eventId: string | null;
  /** Entrega de relatório: abre o relatório. */
  reportId: string | null;
}

export const kindLabel: Record<AgendaKind, string> = { aula: 'Aula', campo: 'Aula de campo', prova: 'Prova', entrega: 'Entrega', trabalho: 'Trabalho', atividade: 'Atividade', evento: 'Evento' };
/** Cor de cada tipo (texto, fundo e ponto), como no desenho da Agenda. */
export const kindTone: Record<AgendaKind, { fg: string; bg: string; dot: string }> = {
  aula: { fg: '#1F4FA8', bg: '#DCE8FB', dot: '#1F4FA8' },
  campo: { fg: '#14663F', bg: '#DDF1E5', dot: '#14663F' },
  prova: { fg: '#5B3A99', bg: '#EBE2F7', dot: '#5B3A99' },
  entrega: { fg: '#7A5300', bg: '#FCEFCB', dot: '#7A5300' },
  trabalho: { fg: '#7A5300', bg: '#FCEFCB', dot: '#B7791F' },
  atividade: { fg: '#14663F', bg: '#DDF1E5', dot: '#2E9D63' },
  evento: { fg: '#1B5C83', bg: '#E3F1F8', dot: '#1B5C83' },
};

const eventKind: Record<string, AgendaKind> = { prova: 'prova', trabalho: 'trabalho', entrega_relatorio: 'entrega', atividade: 'atividade', evento_faculdade: 'evento', outro: 'evento' };
const apiType: Record<string, string> = { prova: 'exam', trabalho: 'assignment', entrega_relatorio: 'report_delivery', atividade: 'activity', evento_faculdade: 'college_event', outro: 'other' };
const apiReminder = { nenhum: 'none', no_dia: 'on_the_day', '1_dia': '1_day', '3_dias': '3_days', '1_semana': '1_week' } as const;

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return localDate(d);
};

/** Aulas e eventos de um intervalo de datas (inclusive), em ordem. Aulas vêm do quadro semanal do período ativo. */
export async function getAgenda(from: string, to: string): Promise<AgendaItem[]> {
  const db = await getDb();
  const out: AgendaItem[] = [];

  const subjects = await db.getAllAsync<{ id: string; nome: string; tipo_aula: string; prof: string | null; dias: string | null }>(
    `SELECT m.id, m.nome, m.tipo_aula, p.nome AS prof, (SELECT group_concat(dia_semana) FROM materia_dia WHERE materia_id = m.id) AS dias
       FROM materia m
       JOIN periodo pe ON pe.id = m.periodo_id AND pe.usuario_id = m.usuario_id AND pe.status = 'ativo'
       LEFT JOIN professor p ON p.id = m.professor_id AND p.usuario_id = m.usuario_id
      WHERE m.desativada = 0`,
  );
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = parse(d).getDay() === 0 ? 7 : parse(d).getDay();
    for (const s of subjects) {
      if (!s.dias?.split(',').map(Number).includes(wd)) continue;
      out.push({ id: `aula-${s.id}-${d}`, kind: s.tipo_aula === 'sala' ? 'aula' : 'campo', title: s.nome, detail: s.prof, date: d, lesson: true, subjectId: s.id, eventId: null, reportId: null });
    }
  }

  const events = await db.getAllAsync<{ id: string; tipo: string; descricao_tipo: string | null; titulo: string; data: string; materia_id: string | null; materia: string | null; relatorio_id: string | null }>(
    `SELECT e.id, e.tipo, e.descricao_tipo, e.titulo, e.data, e.materia_id, e.relatorio_id, m.nome AS materia
       FROM evento e LEFT JOIN materia m ON m.id = e.materia_id AND m.usuario_id = e.usuario_id
      WHERE e.data BETWEEN ? AND ? AND e.encerrado_com_periodo = 0 ORDER BY e.data, e.criado_em`,
    from,
    to,
  );
  for (const e of events) out.push({ id: e.id, kind: eventKind[e.tipo] ?? 'evento', title: e.titulo, detail: e.tipo === 'outro' ? [e.descricao_tipo, e.materia].filter(Boolean).join(' · ') || null : e.materia, date: e.data, lesson: false, subjectId: e.materia_id, eventId: e.id, reportId: e.relatorio_id });

  return out.sort((a, b) => a.date.localeCompare(b.date) || Number(b.lesson) - Number(a.lesson));
}

export const matchesFilter = (i: AgendaItem, f: AgendaFilter) =>
  f === 'tudo' || (f === 'aulas' && i.lesson) || (f === 'campo' && i.kind === 'campo') || (f === 'provas' && i.kind === 'prova') || (f === 'entregas' && i.kind === 'entrega');

export interface NewEvent {
  type: 'prova' | 'trabalho' | 'atividade' | 'evento_faculdade' | 'outro';
  typeDescription: string;
  title: string;
  subjectId: string | null;
  date: string;
  reminder: Reminder;
  notes: string;
  photos: StoredPhoto[];
}

export async function createEvent(input: NewEvent): Promise<string> {
  const db = await getDb();
  const user = await db.getFirstAsync<{ id: string }>('SELECT id FROM usuario LIMIT 1');
  if (!user) throw new Error('Usuário local não encontrado. Sincronize e tente de novo.');
  const id = newId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO evento (id, usuario_id, materia_id, tipo, descricao_tipo, titulo, data, lembrete, anotacoes, sync_status) VALUES (?,?,?,?,?,?,?,?,?, 'pendente')",
      id, user.id, input.subjectId, input.type, input.type === 'outro' ? input.typeDescription : null, input.title, input.date, input.reminder, input.notes || null,
    );
    for (const p of input.photos) {
      await db.runAsync("INSERT INTO foto (id, usuario_id, evento_id, arquivo, tipo_mime, tamanho_bytes, tirada_em, sync_status) VALUES (?,?,?,?,?,?,?, 'pendente')", p.id, user.id, id, p.uri, p.mime, Math.max(1, p.sizeBytes), new Date().toISOString());
      await db.runAsync("INSERT INTO fila_midia (id, tipo, entidade, entidade_id, arquivo_local) VALUES (?, 'foto', 'evento', ?, ?)", p.id, id, p.uri);
    }
    await enqueue(db, {
      entity: 'event',
      entityId: id,
      operation: 'criar',
      data: {
        type: apiType[input.type],
        ...(input.type === 'outro' ? { type_description: input.typeDescription } : {}),
        title: input.title,
        ...(input.subjectId ? { subject_id: input.subjectId } : {}),
        date: input.date,
        reminder: apiReminder[input.reminder],
        ...(input.notes ? { notes: input.notes } : {}),
      },
    });
  });
  return id;
}

export { addDays, parse as parseDate };

export interface EventDetail {
  id: string;
  type: NewEvent['type'] | 'entrega_relatorio';
  typeDescription: string;
  title: string;
  subjectId: string | null;
  reportId: string | null;
  date: string;
  reminder: Reminder;
  notes: string;
  photos: { id: string; uri: string | null }[];
}

export async function getEvent(id: string): Promise<EventDetail | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<any>('SELECT * FROM evento WHERE id = ?', id);
  if (!r) return null;
  const photos = await db.getAllAsync<{ id: string; arquivo: string | null }>('SELECT id, arquivo FROM foto WHERE evento_id = ? ORDER BY criado_em', id);
  return {
    id: r.id, type: r.tipo, typeDescription: r.descricao_tipo ?? '', title: r.titulo, subjectId: r.materia_id, reportId: r.relatorio_id,
    date: r.data, reminder: r.lembrete, notes: r.anotacoes ?? '', photos: photos.map((p) => ({ id: p.id, uri: p.arquivo })),
  };
}

/** Altera o evento no celular e põe a alteração na fila (com a versão que o celular conhecia). */
export async function updateEvent(id: string, input: Omit<NewEvent, 'photos'>, photos: StoredPhoto[] = []): Promise<void> {
  const db = await getDb();
  const user = await db.getFirstAsync<{ id: string }>('SELECT id FROM usuario LIMIT 1');
  const current = await db.getFirstAsync<{ versao: number }>('SELECT versao FROM evento WHERE id = ?', id);
  if (!user || !current) throw new Error('Evento não encontrado no celular.');
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE evento SET materia_id = ?, tipo = ?, descricao_tipo = ?, titulo = ?, data = ?, lembrete = ?, anotacoes = ?, sync_status = 'pendente' WHERE id = ?",
      input.subjectId, input.type, input.type === 'outro' ? input.typeDescription : null, input.title, input.date, input.reminder, input.notes || null, id,
    );
    for (const p of photos) {
      await db.runAsync("INSERT INTO foto (id, usuario_id, evento_id, arquivo, tipo_mime, tamanho_bytes, tirada_em, sync_status) VALUES (?,?,?,?,?,?,?, 'pendente')", p.id, user.id, id, p.uri, p.mime, Math.max(1, p.sizeBytes), new Date().toISOString());
      await db.runAsync("INSERT INTO fila_midia (id, tipo, entidade, entidade_id, arquivo_local) VALUES (?, 'foto', 'evento', ?, ?)", p.id, id, p.uri);
    }
    await enqueue(db, {
      entity: 'event',
      entityId: id,
      operation: 'alterar',
      baseVersion: current.versao,
      data: {
        type: apiType[input.type],
        type_description: input.type === 'outro' ? input.typeDescription : null,
        title: input.title,
        subject_id: input.subjectId,
        date: input.date,
        reminder: apiReminder[input.reminder],
        notes: input.notes || null,
      },
    });
  });
}

export async function deleteEvent(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM fila_midia WHERE entidade = 'evento' AND entidade_id = ?", id);
    await db.runAsync('DELETE FROM evento WHERE id = ?', id);
    await enqueue(db, { entity: 'event', entityId: id, operation: 'excluir' });
  });
}
