import { enqueue, getDb, newId } from '../db';
import type { StoredPhoto } from '../media/storage';
import type { SubjectColor } from '../theme';
import { cleanTags, getTags, setTags, splitTags, tagsSql } from './tags';
import { daysUntil, localDate, whenText } from './today';

export type ReportFilter = 'andamento' | 'finalizados' | 'todos';
export type ReportKind = 'continuo' | 'pontual';
export type Reminder = 'nenhum' | 'no_dia' | '1_dia' | '3_dias' | '1_semana';

export interface ReportItem {
  id: string;
  title: string;
  kind: ReportKind;
  finished: boolean;
  subjectName: string;
  subjectColor: SubjectColor;
  entries: number;
  lastEntryAt: string | null;
  delivery: string | null;
  /** Ainda não foi enviado ao servidor. */
  pending: boolean;
  /** Foto de capa (a da área ou, sem ela, a mais recente dos registros), guardada neste aparelho. */
  cover: string | null;
  tags: string[];
}

// o banco local fala português, a API fala inglês
const apiReminder = { nenhum: 'none', no_dia: 'on_the_day', '1_dia': '1_day', '3_dias': '3_days', '1_semana': '1_week' } as const;
const apiKind = { continuo: 'continuous', pontual: 'one_off' } as const;

const filterSql: Record<ReportFilter, string> = {
  andamento: "r.status = 'em_andamento'",
  finalizados: "r.status = 'finalizado'",
  todos: '1 = 1',
};

export async function listReports(filter: ReportFilter, now = new Date()): Promise<ReportItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; titulo: string; tipo: ReportKind; status: string; data_entrega: string | null; materia: string; cor: SubjectColor;
    registros: number; ultimo: string | null; sync_status: string; capa: string | null; tags: string | null;
  }>(
    `SELECT r.id, r.titulo, r.tipo, r.status, r.data_entrega, r.sync_status, m.nome AS materia, m.cor,
            (SELECT count(*) FROM registro g WHERE g.relatorio_id = r.id) AS registros,
            (SELECT max(g.data_hora) FROM registro g WHERE g.relatorio_id = r.id) AS ultimo,
            coalesce(
              (SELECT f.arquivo FROM foto f WHERE f.id = r.capa_foto_id AND f.arquivo IS NOT NULL),
              (SELECT f.arquivo FROM foto f WHERE f.relatorio_id = r.id AND f.arquivo IS NOT NULL LIMIT 1),
              (SELECT f.arquivo FROM foto f JOIN registro g ON g.id = f.registro_id WHERE g.relatorio_id = r.id AND f.arquivo IS NOT NULL ORDER BY f.criado_em DESC LIMIT 1)
            ) AS capa,
            ${tagsSql('relatorio', 'r.id')} AS tags
       FROM relatorio r JOIN materia m ON m.id = r.materia_id AND m.usuario_id = r.usuario_id
      WHERE ${filterSql[filter]}
      ORDER BY r.atualizado_em DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.titulo,
    kind: r.tipo,
    finished: r.status === 'finalizado',
    subjectName: r.materia,
    subjectColor: r.cor,
    entries: r.registros,
    lastEntryAt: r.ultimo,
    delivery: r.data_entrega ? (r.status === 'finalizado' ? 'entregue' : whenText(Math.max(0, daysUntil(r.data_entrega, now)))) : 'sem data',
    pending: r.sync_status !== 'sincronizado',
    cover: r.capa,
    tags: splitTags(r.tags),
  }));
}

export type DeliveryFormat = 'pdf' | 'impresso' | 'slides' | 'outro';
export const deliveryFormatLabel: Record<DeliveryFormat, string> = { pdf: 'PDF', impresso: 'Impresso', slides: 'Slides', outro: 'Outro' };
const apiFormat: Record<DeliveryFormat, string> = { pdf: 'pdf', impresso: 'printed', slides: 'slides', outro: 'other' };

export interface NewReport {
  title: string;
  subjectId: string;
  kind: ReportKind;
  area: { crop: string; place: string; lengthM: number | null; widthM: number | null } | null;
  deliveryDate: string | null;
  reminder: Reminder;
  format: DeliveryFormat | null;
  notes: string;
  /** Foto da área (só relatório contínuo). */
  areaPhoto: StoredPhoto | null;
  tags: string[];
}

export async function createReport(input: NewReport): Promise<string> {
  const db = await getDb();
  const user = await db.getFirstAsync<{ id: string }>('SELECT id FROM usuario LIMIT 1');
  if (!user) throw new Error('Usuário local não encontrado. Sincronize e tente de novo.');
  const id = newId();
  const area = input.kind === 'continuo' ? input.area : null;
  const photo = input.kind === 'continuo' ? input.areaPhoto : null;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO relatorio (id, usuario_id, materia_id, titulo, tipo, data_entrega, lembrete_entrega, formato_entrega, observacoes,
                              area_cultura, area_local, area_comprimento_m, area_largura_m, area_foto_id, sync_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pendente')`,
      id, user.id, input.subjectId, input.title, input.kind, input.deliveryDate, input.deliveryDate ? input.reminder : 'nenhum', input.deliveryDate ? input.format : null, input.notes || null,
      area?.crop || null, area?.place || null, area?.lengthM ?? null, area?.widthM ?? null, photo?.id ?? null,
    );
    if (photo) {
      await db.runAsync("INSERT INTO foto (id, usuario_id, relatorio_id, arquivo, tipo_mime, tamanho_bytes, tirada_em, sync_status) VALUES (?,?,?,?,?,?,?, 'pendente')", photo.id, user.id, id, photo.uri, photo.mime, Math.max(1, photo.sizeBytes), new Date().toISOString());
      await db.runAsync("INSERT INTO fila_midia (id, tipo, entidade, entidade_id, arquivo_local) VALUES (?, 'foto', 'relatorio_area', ?, ?)", photo.id, id, photo.uri);
    }
    await setTags(db, user.id, 'relatorio', id, input.tags);
    const hasArea = area && (area.crop || area.place || area.lengthM || area.widthM);
    await enqueue(db, {
      entity: 'report',
      entityId: id,
      operation: 'criar',
      data: {
        title: input.title,
        subject_id: input.subjectId,
        type: apiKind[input.kind],
        ...(hasArea ? { area: { crop: area.crop || null, place: area.place || null, length_m: area.lengthM, width_m: area.widthM } } : {}),
        ...(input.deliveryDate ? { delivery_date: input.deliveryDate, delivery_reminder: apiReminder[input.reminder], ...(input.format ? { delivery_format: apiFormat[input.format] } : {}) } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        ...(cleanTags(input.tags).length ? { tags: cleanTags(input.tags) } : {}),
      },
    });
  });
  return id;
}

export interface ReportEditData {
  id: string;
  title: string;
  subjectName: string;
  kind: ReportKind;
  area: { crop: string; place: string; lengthM: number | null; widthM: number | null };
  deliveryDate: string | null;
  reminder: Reminder;
  format: DeliveryFormat | null;
  notes: string;
  tags: string[];
  finished: boolean;
}

export async function getReportEdit(id: string): Promise<ReportEditData | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<any>('SELECT r.*, m.nome AS materia FROM relatorio r JOIN materia m ON m.id = r.materia_id AND m.usuario_id = r.usuario_id WHERE r.id = ?', id);
  if (!r) return null;
  return {
    id: r.id, title: r.titulo, subjectName: r.materia, kind: r.tipo,
    area: { crop: r.area_cultura ?? '', place: r.area_local ?? '', lengthM: r.area_comprimento_m, widthM: r.area_largura_m },
    deliveryDate: r.data_entrega, reminder: r.lembrete_entrega, format: r.formato_entrega ?? null, notes: r.observacoes ?? '', tags: await getTags('relatorio', id), finished: r.status === 'finalizado',
  };
}

export interface ReportEdit {
  title: string;
  kind: ReportKind;
  area: { crop: string; place: string; lengthM: number | null; widthM: number | null } | null;
  deliveryDate: string | null;
  reminder: Reminder;
  format: DeliveryFormat | null;
  notes: string;
  tags: string[];
}

/** Altera o relatório no celular e põe a alteração na fila (a matéria e o tipo não mudam). */
export async function updateReport(id: string, input: ReportEdit): Promise<void> {
  const db = await getDb();
  const user = await db.getFirstAsync<{ id: string }>('SELECT id FROM usuario LIMIT 1');
  const current = await db.getFirstAsync<{ versao: number }>('SELECT versao FROM relatorio WHERE id = ?', id);
  if (!user || !current) throw new Error('Relatório não encontrado no celular.');
  const area = input.kind === 'continuo' ? input.area : null;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE relatorio SET titulo = ?, data_entrega = ?, lembrete_entrega = ?, formato_entrega = ?, observacoes = ?, area_cultura = ?, area_local = ?, area_comprimento_m = ?, area_largura_m = ?, sync_status = 'pendente' WHERE id = ?",
      input.title, input.deliveryDate, input.deliveryDate ? input.reminder : 'nenhum', input.deliveryDate ? input.format : null, input.notes || null,
      area?.crop || null, area?.place || null, area?.lengthM ?? null, area?.widthM ?? null, id,
    );
    await setTags(db, user.id, 'relatorio', id, input.tags);
    const hasArea = area && (area.crop || area.place || area.lengthM || area.widthM);
    await enqueue(db, {
      entity: 'report',
      entityId: id,
      operation: 'alterar',
      baseVersion: current.versao,
      data: {
        title: input.title,
        ...(input.kind === 'continuo' ? { area: hasArea ? { crop: area!.crop || null, place: area!.place || null, length_m: area!.lengthM, width_m: area!.widthM } : null } : {}),
        delivery_date: input.deliveryDate,
        delivery_reminder: input.deliveryDate ? apiReminder[input.reminder] : 'none',
        delivery_format: input.deliveryDate && input.format ? apiFormat[input.format] : null,
        notes: input.notes || null,
        tags: cleanTags(input.tags),
      },
    });
  });
}

/** Finalizar ou reabrir o relatório (o servidor usa as rotas finish/reopen por trás de `status`). */
export async function setReportFinished(id: string, finished: boolean): Promise<void> {
  const db = await getDb();
  const current = await db.getFirstAsync<{ versao: number }>('SELECT versao FROM relatorio WHERE id = ?', id);
  if (!current) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE relatorio SET status = ?, finalizado_em = ?, finalizado_por = ?, sync_status = 'pendente' WHERE id = ?",
      finished ? 'finalizado' : 'em_andamento', finished ? new Date().toISOString() : null, finished ? 'usuario' : null, id,
    );
    await enqueue(db, { entity: 'report', entityId: id, operation: 'alterar', baseVersion: current.versao, data: { status: finished ? 'finished' : 'in_progress' } });
  });
}

/** Exclui o relatório, os registros, as fotos e o evento de entrega dele (confirmação fica na tela). */
export async function deleteReport(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM fila_midia WHERE id IN (SELECT f.id FROM foto f LEFT JOIN registro g ON g.id = f.registro_id WHERE f.relatorio_id = ? OR g.relatorio_id = ?) OR id IN (SELECT a.id FROM audio a JOIN registro g ON g.id = a.registro_id WHERE g.relatorio_id = ?)", id, id, id);
    await db.runAsync('DELETE FROM relatorio WHERE id = ?', id);
    await enqueue(db, { entity: 'report', entityId: id, operation: 'excluir' });
  });
}

export { localDate };

export interface ReportPhoto {
  id: string;
  uri: string;
  /** Data da foto (ISO). */
  date: string;
  /** Ainda não subiu para o servidor: não pode ser capa até subir. */
  pending: boolean;
}

/** Todas as fotos do relatório (da área e dos registros), as mais recentes primeiro, e qual está escolhida como capa. */
export async function listReportPhotos(reportId: string): Promise<{ photos: ReportPhoto[]; chosen: string | null }> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; arquivo: string; data: string; sync_status: string }>(
    `SELECT f.id, f.arquivo, f.sync_status, coalesce(f.tirada_em, f.criado_em) AS data
       FROM foto f LEFT JOIN registro g ON g.id = f.registro_id
      WHERE f.arquivo IS NOT NULL AND (f.relatorio_id = ? OR g.relatorio_id = ?)
      ORDER BY coalesce(f.tirada_em, f.criado_em) DESC`,
    reportId, reportId,
  );
  const r = await db.getFirstAsync<{ capa_foto_id: string | null }>('SELECT capa_foto_id FROM relatorio WHERE id = ?', reportId);
  return { photos: rows.map((p) => ({ id: p.id, uri: p.arquivo, date: p.data, pending: p.sync_status !== 'sincronizado' })), chosen: r?.capa_foto_id ?? null };
}

/** Escolhe a foto de capa do relatório (`null` volta à capa automática). */
export async function setReportCover(reportId: string, photoId: string | null): Promise<void> {
  const db = await getDb();
  const current = await db.getFirstAsync<{ versao: number }>('SELECT versao FROM relatorio WHERE id = ?', reportId);
  if (!current) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE relatorio SET capa_foto_id = ?, sync_status = 'pendente' WHERE id = ?", photoId, reportId);
    await enqueue(db, { entity: 'report', entityId: reportId, operation: 'alterar', baseVersion: current.versao, data: { cover_photo_id: photoId } });
  });
}
