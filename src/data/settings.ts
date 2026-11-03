import { enqueue, getDb } from '../db';

export interface Profile {
  id: string;
  name: string;
  email: string;
  course: string | null;
  institution: string | null;
  city: string;
  periodName: string | null;
}

export async function getProfile(): Promise<Profile | null> {
  const db = await getDb();
  const u = await db.getFirstAsync<{ id: string; nome: string; email: string; curso: string | null; instituicao: string | null; cidade_cotacoes: string }>('SELECT id, nome, email, curso, instituicao, cidade_cotacoes FROM usuario LIMIT 1');
  if (!u) return null;
  const p = await db.getFirstAsync<{ nome: string }>("SELECT nome FROM periodo WHERE status = 'ativo' LIMIT 1");
  return { id: u.id, name: u.nome, email: u.email, course: u.curso, institution: u.instituicao, city: u.cidade_cotacoes, periodName: p?.nome ?? null };
}

export const initialsOf = (name: string | undefined | null) => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

export interface Settings {
  /** Avisos do celular (valem só neste aparelho). */
  examsAndDeadlines: boolean;
  fieldClassEve: boolean;
  reportDeadline: boolean;
  /** Ficam também no servidor. */
  remindRecordAfterField: boolean;
  deleteAudioAfterTranscription: boolean;
  /** Valem só neste aparelho. */
  photosWifiOnly: boolean;
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const u = await db.getFirstAsync<{ aviso_provas_entregas: number; aviso_vespera_campo: number; aviso_entrega_relatorio: number; lembrar_registro_pos_campo: number; apagar_audio_apos_transcricao: number; enviar_fotos_so_wifi: number }>(
    'SELECT aviso_provas_entregas, aviso_vespera_campo, aviso_entrega_relatorio, lembrar_registro_pos_campo, apagar_audio_apos_transcricao, enviar_fotos_so_wifi FROM usuario LIMIT 1',
  );
  return {
    examsAndDeadlines: (u?.aviso_provas_entregas ?? 1) === 1,
    fieldClassEve: (u?.aviso_vespera_campo ?? 1) === 1,
    reportDeadline: (u?.aviso_entrega_relatorio ?? 1) === 1,
    remindRecordAfterField: (u?.lembrar_registro_pos_campo ?? 1) === 1,
    deleteAudioAfterTranscription: (u?.apagar_audio_apos_transcricao ?? 0) === 1,
    photosWifiOnly: (u?.enviar_fotos_so_wifi ?? 1) === 1,
  };
}

const column: Record<keyof Settings, string> = {
  examsAndDeadlines: 'aviso_provas_entregas',
  fieldClassEve: 'aviso_vespera_campo',
  reportDeadline: 'aviso_entrega_relatorio',
  remindRecordAfterField: 'lembrar_registro_pos_campo',
  deleteAudioAfterTranscription: 'apagar_audio_apos_transcricao',
  photosWifiOnly: 'enviar_fotos_so_wifi',
};
/** Só estas existem na API (`PATCH /users/me`); as outras valem para este aparelho. */
const apiField: Partial<Record<keyof Settings, string>> = {
  remindRecordAfterField: 'remind_record_after_field',
  deleteAudioAfterTranscription: 'delete_audio_after_transcription',
};

export async function setSetting(key: keyof Settings, value: boolean): Promise<void> {
  const db = await getDb();
  const u = await db.getFirstAsync<{ id: string; versao: number }>('SELECT id, versao FROM usuario LIMIT 1');
  if (!u) return;
  const field = apiField[key];
  await db.withTransactionAsync(async () => {
    if (field) {
      await db.runAsync(`UPDATE usuario SET ${column[key]} = ?, sync_status = 'pendente' WHERE id = ?`, value ? 1 : 0, u.id);
      await enqueue(db, { entity: 'user', entityId: u.id, operation: 'alterar', baseVersion: u.versao, data: { [field]: value } });
    } else {
      // preferência só deste aparelho: não entra na fila (a versão local do usuário pode subir; o download do servidor a acerta)
      await db.runAsync(`UPDATE usuario SET ${column[key]} = ?, sync_status = sync_status WHERE id = ?`, value ? 1 : 0, u.id);
    }
  });
}

export async function syncOverview(): Promise<{ pending: number; failed: number; media: number }> {
  const db = await getDb();
  const p = await db.getFirstAsync<{ n: number }>("SELECT count(*) n FROM fila_envio WHERE status IN ('pendente','enviando')");
  const f = await db.getFirstAsync<{ n: number }>("SELECT count(*) n FROM fila_envio WHERE status = 'erro'");
  const m = await db.getFirstAsync<{ n: number }>("SELECT count(*) n FROM fila_midia WHERE status IN ('pendente','enviando','erro')");
  return { pending: p?.n ?? 0, failed: f?.n ?? 0, media: m?.n ?? 0 };
}

/** Altera nome, curso e instituição no celular e põe a alteração na fila de envio. */
export async function updateProfile(input: { name: string; course: string; institution: string }): Promise<void> {
  const db = await getDb();
  const u = await db.getFirstAsync<{ id: string; versao: number }>('SELECT id, versao FROM usuario LIMIT 1');
  if (!u) throw new Error('Usuário local não encontrado. Sincronize e tente de novo.');
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE usuario SET nome = ?, curso = ?, instituicao = ?, sync_status = 'pendente' WHERE id = ?", input.name, input.course || null, input.institution || null, u.id);
    await enqueue(db, { entity: 'user', entityId: u.id, operation: 'alterar', baseVersion: u.versao, data: { name: input.name, course: input.course || null, institution: input.institution || null } });
  });
}
