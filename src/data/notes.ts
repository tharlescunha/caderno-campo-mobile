import { enqueue, getDb, newId } from '../db';
import type { StoredAudio, StoredPhoto } from '../media/storage';
import type { SubjectColor } from '../theme';
import { cleanTags, setTags, splitTags, tagsSql } from './tags';
import { localDate } from './today';
import type { EntryAudio } from './entries';

export type NoteFilter = 'todas' | 'soltas' | 'com';

export interface NoteItem {
  id: string;
  title: string;
  text: string | null;
  link: string | null;
  pinned: boolean;
  updatedAt: string;
  subjectId: string | null;
  subjectName: string | null;
  subjectColor: SubjectColor | null;
  pending: boolean;
  tags: string[];
}

const row = (r: any): NoteItem => ({
  id: r.id,
  title: r.titulo,
  text: r.texto,
  link: r.link,
  pinned: r.fixada === 1,
  updatedAt: r.atualizado_em,
  subjectId: r.materia_id,
  subjectName: r.materia,
  subjectColor: r.cor,
  pending: r.sync_status !== 'sincronizado',
  tags: splitTags(r.tags),
});

const select = `SELECT a.*, m.nome AS materia, m.cor AS cor, ${tagsSql('anotacao', 'a.id')} AS tags FROM anotacao a LEFT JOIN materia m ON m.id = a.materia_id AND m.usuario_id = a.usuario_id`;

/** Fixadas primeiro, depois as mais recentes. */
export async function listNotes(filter: NoteFilter): Promise<NoteItem[]> {
  const db = await getDb();
  const where = filter === 'soltas' ? 'WHERE a.materia_id IS NULL' : filter === 'com' ? 'WHERE a.materia_id IS NOT NULL' : '';
  return (await db.getAllAsync<any>(`${select} ${where} ORDER BY a.fixada DESC, a.atualizado_em DESC`)).map(row);
}

export async function getNote(id: string): Promise<NoteItem | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<any>(`${select} WHERE a.id = ?`, id);
  return r ? row(r) : null;
}

export async function listNoteAudios(noteId: string): Promise<EntryAudio[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT id, arquivo, duracao_s, status, transcricao, transcricao_editada, sync_status FROM audio WHERE anotacao_id = ? ORDER BY criado_em', noteId);
  return rows.map((a) => ({ id: a.id, uri: a.arquivo, durationS: a.duracao_s, status: a.status, text: a.transcricao_editada ?? a.transcricao, pending: a.sync_status !== 'sincronizado' }));
}

/** Quantas anotações desta matéria foram criadas hoje (para o cartão "Matéria de hoje"). */
export async function countNotesToday(subjectId: string, now = new Date()): Promise<number> {
  const db = await getDb();
  const day = localDate(now);
  const r = await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM anotacao WHERE materia_id = ? AND substr(criado_em, 1, 10) >= ?", subjectId, day);
  return r?.n ?? 0;
}

export interface NoteInput {
  title: string;
  text: string;
  link: string;
  subjectId: string | null;
  pinned: boolean;
  tags: string[];
}

const normalizeLink = (link: string) => {
  const l = link.trim();
  if (!l) return null;
  return /^https?:\/\//i.test(l) ? l : `https://${l}`;
};

async function attachAudios(db: Awaited<ReturnType<typeof getDb>>, userId: string, noteId: string, audios: (StoredAudio & { durationS: number })[]) {
  const nowIso = new Date().toISOString();
  for (const a of audios) {
    await db.runAsync(
      "INSERT INTO audio (id, usuario_id, anotacao_id, arquivo, tipo_mime, duracao_s, tamanho_bytes, gravado_em, sync_status) VALUES (?,?,?,?,?,?,?,?, 'pendente')",
      a.id, userId, noteId, a.uri, a.mime, Math.min(300, Math.max(1, a.durationS)), Math.max(1, a.sizeBytes), nowIso,
    );
    await db.runAsync("INSERT INTO fila_midia (id, tipo, entidade, entidade_id, arquivo_local) VALUES (?, 'audio', 'anotacao', ?, ?)", a.id, noteId, a.uri);
  }
}

export interface NoteAttachment {
  id: string;
  uri: string | null;
  mime: string;
}

export async function listNoteAttachments(noteId: string): Promise<NoteAttachment[]> {
  const db = await getDb();
  return (await db.getAllAsync<{ id: string; arquivo: string | null; tipo_mime: string }>('SELECT id, arquivo, tipo_mime FROM anexo WHERE anotacao_id = ? ORDER BY criado_em', noteId)).map((a) => ({ id: a.id, uri: a.arquivo, mime: a.tipo_mime }));
}

async function attachPhotos(db: Awaited<ReturnType<typeof getDb>>, userId: string, noteId: string, photos: StoredPhoto[]) {
  for (const p of photos) {
    await db.runAsync('INSERT INTO anexo (id, usuario_id, anotacao_id, arquivo, tipo_mime, tamanho_bytes) VALUES (?,?,?,?,?,?)', p.id, userId, noteId, p.uri, p.mime, Math.max(1, p.sizeBytes));
    await db.runAsync("INSERT INTO fila_midia (id, tipo, entidade, entidade_id, arquivo_local) VALUES (?, 'anexo', 'anotacao', ?, ?)", p.id, noteId, p.uri);
  }
}

export async function createNote(input: NoteInput, audios: (StoredAudio & { durationS: number })[], photos: StoredPhoto[] = []): Promise<string> {
  const db = await getDb();
  const user = await db.getFirstAsync<{ id: string }>('SELECT id FROM usuario LIMIT 1');
  if (!user) throw new Error('Usuário local não encontrado. Sincronize e tente de novo.');
  const id = newId();
  const link = normalizeLink(input.link);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO anotacao (id, usuario_id, materia_id, titulo, texto, link, fixada, sync_status) VALUES (?,?,?,?,?,?,?, 'pendente')",
      id, user.id, input.subjectId, input.title, input.text || null, link, input.pinned ? 1 : 0,
    );
    await attachAudios(db, user.id, id, audios);
    await attachPhotos(db, user.id, id, photos);
    await setTags(db, user.id, 'anotacao', id, input.tags);
    await enqueue(db, {
      entity: 'note',
      entityId: id,
      operation: 'criar',
      data: { title: input.title, ...(input.text ? { text: input.text } : {}), ...(input.subjectId ? { subject_id: input.subjectId } : {}), ...(link ? { link } : {}), pinned: input.pinned, ...(cleanTags(input.tags).length ? { tags: cleanTags(input.tags) } : {}) },
    });
  });
  return id;
}

export async function updateNote(id: string, input: NoteInput, audios: (StoredAudio & { durationS: number })[], photos: StoredPhoto[] = []): Promise<void> {
  const db = await getDb();
  const user = await db.getFirstAsync<{ id: string }>('SELECT id FROM usuario LIMIT 1');
  const current = await db.getFirstAsync<{ versao: number }>('SELECT versao FROM anotacao WHERE id = ?', id);
  if (!user || !current) throw new Error('Anotação não encontrada no celular.');
  const link = normalizeLink(input.link);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE anotacao SET materia_id = ?, titulo = ?, texto = ?, link = ?, fixada = ?, sync_status = 'pendente' WHERE id = ?",
      input.subjectId, input.title, input.text || null, link, input.pinned ? 1 : 0, id,
    );
    await attachAudios(db, user.id, id, audios);
    await attachPhotos(db, user.id, id, photos);
    await setTags(db, user.id, 'anotacao', id, input.tags);
    await enqueue(db, {
      entity: 'note',
      entityId: id,
      operation: 'alterar',
      baseVersion: current.versao,
      data: { title: input.title, text: input.text || null, subject_id: input.subjectId, link, pinned: input.pinned, tags: cleanTags(input.tags) },
    });
  });
}

/** Fixar ou desafixar sem abrir a anotação. */
export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const db = await getDb();
  const current = await db.getFirstAsync<{ versao: number }>('SELECT versao FROM anotacao WHERE id = ?', id);
  if (!current) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE anotacao SET fixada = ?, sync_status = 'pendente' WHERE id = ?", pinned ? 1 : 0, id);
    await enqueue(db, { entity: 'note', entityId: id, operation: 'alterar', baseVersion: current.versao, data: { pinned } });
  });
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM fila_midia WHERE entidade = 'anotacao' AND entidade_id = ?", id);
    await db.runAsync('DELETE FROM anotacao WHERE id = ?', id);
    await enqueue(db, { entity: 'note', entityId: id, operation: 'excluir' });
  });
}
