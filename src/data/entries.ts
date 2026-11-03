import { api } from '../api/client';
import { enqueue, getDb, newId } from '../db';
import type { SubjectColor } from '../theme';
import type { StoredAudio, StoredPhoto } from '../media/storage';
import type { ReportKind } from './reports';
import { cleanTags, getTags, setTags, splitTags, tagsSql } from './tags';

export type Activity = 'adubacao' | 'limpeza' | 'vistoria' | 'aplicacao' | 'irrigacao' | 'plantio' | 'colheita' | 'outro';
export type Irrigation = 'funcionando' | 'com_falha' | 'sem_irrigacao' | 'a_instalar';
export type CropCondition = 'otima' | 'boa' | 'regular' | 'ruim';
export type PestLevel = 'baixo' | 'medio' | 'alto';

export const activityLabel: Record<Activity, string> = {
  vistoria: 'Vistoria', limpeza: 'Limpeza', adubacao: 'Adubação', aplicacao: 'Aplicação', irrigacao: 'Irrigação', plantio: 'Plantio', colheita: 'Colheita', outro: 'Outro',
};
export const irrigationLabel: Record<Irrigation, string> = { funcionando: 'Funcionando', com_falha: 'Com falha', sem_irrigacao: 'Sem irrigação', a_instalar: 'A instalar' };
export const cropLabel: Record<CropCondition, string> = { otima: 'Ótima', boa: 'Boa', regular: 'Regular', ruim: 'Ruim' };
export const pestLabel: Record<PestLevel, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };

// o banco local fala português, a API fala inglês
const apiActivity: Record<Activity, string> = { adubacao: 'fertilization', limpeza: 'cleaning', vistoria: 'inspection', aplicacao: 'application', irrigacao: 'irrigation', plantio: 'planting', colheita: 'harvest', outro: 'other' };
const apiIrrigation: Record<Irrigation, string> = { funcionando: 'working', com_falha: 'faulty', sem_irrigacao: 'none', a_instalar: 'to_install' };
const apiCrop: Record<CropCondition, string> = { otima: 'excellent', boa: 'good', regular: 'fair', ruim: 'poor' };
const apiPest: Record<PestLevel, string> = { baixo: 'low', medio: 'medium', alto: 'high' };

export interface ReportDetail {
  id: string;
  title: string;
  kind: ReportKind;
  finished: boolean;
  subjectName: string;
  subjectColor: SubjectColor;
  deliveryDate: string | null;
  notes: string | null;
  area: { crop: string | null; place: string | null; lengthM: number | null; widthM: number | null; m2: number | null } | null;
  /** Situação atual: vem do registro concluído mais recente. */
  situation: { crop: CropCondition | null; stage: string | null; irrigation: Irrigation | null; pest: string | null } | null;
  tags: string[];
  teacher: string | null;
  areaPhotoUri: string | null;
  areaPhotoDate: string | null;
  entryCount: number;
  /** Data (ISO) do primeiro registro, ou da criação do relatório. */
  sinceDate: string;
}

export interface OpenTodo {
  id: string;
  text: string;
  entryId: string;
  /** Data da visita em que o item foi anotado. */
  fromDate: string;
}

export interface EntryItem {
  id: string;
  recordedAt: string;
  draft: boolean;
  activities: Activity[];
  notes: string | null;
  pest: string | null;
  weather: string | null;
  weatherPending: boolean;
  pending: boolean;
  tags: string[];
  irrigation: Irrigation | null;
  photoCount: number;
  audioCount: number;
  audioReady: number;
  nextVisit: string[];
}

export async function getReportDetail(id: string): Promise<ReportDetail | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<any>(
    `SELECT r.*, m.nome AS materia, m.cor, p.nome AS prof FROM relatorio r JOIN materia m ON m.id = r.materia_id AND m.usuario_id = r.usuario_id LEFT JOIN professor p ON p.id = m.professor_id AND p.usuario_id = m.usuario_id WHERE r.id = ?`,
    id,
  );
  if (!r) return null;
  const last = await db.getFirstAsync<any>("SELECT cultura_estado, estagio, irrigacao, houve_praga, praga_nome FROM registro WHERE relatorio_id = ? AND status = 'concluido' ORDER BY data_hora DESC LIMIT 1", id);
  const hasArea = r.area_cultura || r.area_local || r.area_comprimento_m || r.area_largura_m;
  // a capa escolhida vale mais; depois a foto da área; depois a mais recente dos registros
  const photo = await db.getFirstAsync<{ arquivo: string | null; tirada_em: string | null; criado_em: string }>(
    'SELECT arquivo, tirada_em, criado_em FROM foto WHERE id = ? AND arquivo IS NOT NULL UNION ALL SELECT arquivo, tirada_em, criado_em FROM (SELECT arquivo, tirada_em, criado_em FROM foto WHERE relatorio_id = ? ORDER BY criado_em DESC LIMIT 1)',
    r.capa_foto_id ?? '', id,
  );
  // sem foto da área, usa a foto mais recente dos registros (mesma regra da capa na lista)
  const fallback = photo?.arquivo
    ? null
    : await db.getFirstAsync<{ arquivo: string | null; tirada_em: string | null; criado_em: string }>(
        'SELECT f.arquivo, f.tirada_em, f.criado_em FROM foto f JOIN registro g ON g.id = f.registro_id WHERE g.relatorio_id = ? AND f.arquivo IS NOT NULL ORDER BY f.criado_em DESC LIMIT 1',
        id,
      );
  const shown = photo?.arquivo ? photo : fallback;
  const area = { uri: shown?.arquivo ?? null, date: shown ? (shown.tirada_em ?? shown.criado_em) : null };
  const counts = await db.getFirstAsync<{ n: number; first: string | null }>('SELECT count(*) AS n, min(data_hora) AS first FROM registro WHERE relatorio_id = ?', id);
  return {
    id: r.id,
    title: r.titulo,
    kind: r.tipo,
    finished: r.status === 'finalizado',
    subjectName: r.materia,
    subjectColor: r.cor,
    deliveryDate: r.data_entrega,
    notes: r.observacoes,
    area: hasArea ? { crop: r.area_cultura, place: r.area_local, lengthM: r.area_comprimento_m, widthM: r.area_largura_m, m2: r.area_m2 } : null,
    tags: await getTags('relatorio', id),
    teacher: r.prof ?? null,
    areaPhotoUri: area.uri,
    areaPhotoDate: area.date,
    entryCount: counts?.n ?? 0,
    sinceDate: counts?.first ?? r.criado_em,
    situation: last ? { crop: last.cultura_estado, stage: last.estagio, irrigation: last.irrigacao, pest: last.houve_praga ? last.praga_nome : null } : null,
  };
}

export async function listEntries(reportId: string): Promise<EntryItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT registro.*, ${tagsSql('registro', 'registro.id')} AS tags,
            (SELECT count(*) FROM foto WHERE registro_id = registro.id) AS fotos,
            (SELECT count(*) FROM audio WHERE registro_id = registro.id) AS audios,
            (SELECT count(*) FROM audio WHERE registro_id = registro.id AND status = 'pronto') AS audios_ok
       FROM registro WHERE relatorio_id = ? ORDER BY data_hora DESC`,
    reportId,
  );
  const list: EntryItem[] = rows.map((r) => ({
    id: r.id,
    recordedAt: r.data_hora,
    draft: r.status === 'rascunho',
    activities: JSON.parse(r.atividades) as Activity[],
    notes: r.observacoes,
    pest: r.houve_praga ? r.praga_nome : null,
    weather: r.clima_temperatura_c != null ? `${Math.round(r.clima_temperatura_c)}°${r.clima_descricao ? ` · ${r.clima_descricao}` : ''}` : null,
    weatherPending: r.clima_origem === 'pendente',
    pending: r.sync_status !== 'sincronizado',
    tags: splitTags(r.tags),
    irrigation: r.irrigacao,
    photoCount: r.fotos,
    audioCount: r.audios,
    audioReady: r.audios_ok,
    nextVisit: [],
  }));
  for (const e of list) {
    e.nextVisit = (await db.getAllAsync<{ texto: string }>('SELECT texto FROM registro_pendencia WHERE registro_id = ? AND feito = 0 ORDER BY ordem', e.id)).map((x) => x.texto);
  }
  return list;
}

/** Itens "para a próxima visita" ainda abertos, de todas as visitas do relatório (os mais antigos primeiro). */
export async function listOpenTodos(reportId: string): Promise<OpenTodo[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; texto: string; registro_id: string; data_hora: string }>(
    `SELECT p.id, p.texto, p.registro_id, g.data_hora FROM registro_pendencia p JOIN registro g ON g.id = p.registro_id
      WHERE g.relatorio_id = ? AND p.feito = 0 ORDER BY g.data_hora, p.ordem`,
    reportId,
  );
  return rows.map((r) => ({ id: r.id, text: r.texto, entryId: r.registro_id, fromDate: r.data_hora }));
}

export interface NewEntry {
  reportId: string;
  recordedAt: Date;
  draft: boolean;
  activities: Activity[];
  application: { product: string; dose: string; target: string } | null;
  irrigation: Irrigation | null;
  plantHeightCm: number | null;
  measuredAreaM2: number | null;
  cropCondition: CropCondition | null;
  stage: string;
  pest: { found: boolean; name: string; level: PestLevel | null };
  notes: string;
  location: { latitude: number; longitude: number } | null;
  /** Textos novos de "Para a próxima visita". */
  nextVisit: string[];
  tags: string[];
  /** Itens abertos de visitas anteriores que foram feitos nesta. */
  todosDone: string[];
  photos: StoredPhoto[];
  audios: (StoredAudio & { durationS: number })[];
}

export async function createEntry(input: NewEntry): Promise<string> {
  const db = await getDb();
  const user = await db.getFirstAsync<{ id: string }>('SELECT id FROM usuario LIMIT 1');
  if (!user) throw new Error('Usuário local não encontrado. Sincronize e tente de novo.');
  const id = newId();
  const nowIso = new Date().toISOString();
  const app = input.activities.includes('aplicacao') ? input.application : null;
  const nextVisit = input.nextVisit.map((t) => t.trim()).filter(Boolean).slice(0, 10);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO registro (id, usuario_id, relatorio_id, data_hora, status, atividades, aplicacao_produto, aplicacao_dose, aplicacao_alvo, irrigacao,
                             altura_plantas_cm, area_medida_m2, cultura_estado, estagio, houve_praga, praga_nome, praga_nivel, observacoes,
                             latitude, longitude, clima_origem, sync_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pendente')`,
      id, user.id, input.reportId, input.recordedAt.toISOString(), input.draft ? 'rascunho' : 'concluido', JSON.stringify(input.activities),
      app?.product || null, app?.dose || null, app?.target || null, input.irrigation,
      input.plantHeightCm, input.measuredAreaM2, input.cropCondition, input.stage.trim() || null,
      input.pest.found ? 1 : 0, input.pest.found ? input.pest.name.trim() : null, input.pest.found ? input.pest.level : null, input.notes.trim() || null,
      input.location?.latitude ?? null, input.location?.longitude ?? null, input.location ? 'pendente' : null,
    );
    for (const p of input.photos) {
      await db.runAsync(
        "INSERT INTO foto (id, usuario_id, registro_id, arquivo, tipo_mime, tamanho_bytes, tirada_em, latitude, longitude, sync_status) VALUES (?,?,?,?,?,?,?,?,?, 'pendente')",
        p.id, user.id, id, p.uri, p.mime, Math.max(1, p.sizeBytes), nowIso, input.location?.latitude ?? null, input.location?.longitude ?? null,
      );
      await db.runAsync("INSERT INTO fila_midia (id, tipo, entidade, entidade_id, arquivo_local) VALUES (?, 'foto', 'registro', ?, ?)", p.id, id, p.uri);
    }
    for (const a of input.audios) {
      await db.runAsync(
        "INSERT INTO audio (id, usuario_id, registro_id, arquivo, tipo_mime, duracao_s, tamanho_bytes, gravado_em, sync_status) VALUES (?,?,?,?,?,?,?,?, 'pendente')",
        a.id, user.id, id, a.uri, a.mime, Math.min(300, Math.max(1, a.durationS)), Math.max(1, a.sizeBytes), nowIso,
      );
      await db.runAsync("INSERT INTO fila_midia (id, tipo, entidade, entidade_id, arquivo_local) VALUES (?, 'audio', 'registro', ?, ?)", a.id, id, a.uri);
    }
    await setTags(db, user.id, 'registro', id, input.tags);
    // itens novos: ids do aparelho só para aparecer já (o servidor cria os dele e o download substitui estes)
    for (let i = 0; i < nextVisit.length; i++) {
      await db.runAsync("INSERT INTO registro_pendencia (id, usuario_id, registro_id, texto, ordem, sync_status) VALUES (?,?,?,?,?, 'pendente')", newId(), user.id, id, nextVisit[i], i);
    }
    // só ids que o servidor já conhece podem ir em todos_done (item criado agora no aparelho ainda não existe lá)
    const knownDone: string[] = [];
    for (const todoId of input.todosDone) {
      await db.runAsync('UPDATE registro_pendencia SET feito = 1, feito_no_registro_id = ?, feito_em = ? WHERE id = ?', id, nowIso, todoId);
      const row = await db.getFirstAsync<{ sync_status: string }>('SELECT sync_status FROM registro_pendencia WHERE id = ?', todoId);
      if (row?.sync_status === 'sincronizado') knownDone.push(todoId);
    }
    await enqueue(db, {
      entity: 'entry',
      entityId: id,
      operation: 'criar',
      data: {
        report_id: input.reportId,
        recorded_at: input.recordedAt.toISOString(),
        status: input.draft ? 'draft' : 'completed',
        activities: input.activities.map((a) => apiActivity[a]),
        ...(app && (app.product || app.dose || app.target) ? { application: { product: app.product || null, dose: app.dose || null, target: app.target || null } } : {}),
        ...(input.irrigation ? { irrigation: apiIrrigation[input.irrigation] } : {}),
        measurements: { plant_height_cm: input.plantHeightCm, measured_area_m2: input.measuredAreaM2 },
        ...(input.cropCondition ? { crop_condition: apiCrop[input.cropCondition] } : {}),
        ...(input.stage.trim() ? { stage: input.stage.trim() } : {}),
        pest: input.pest.found ? { found: true, name: input.pest.name.trim(), level: input.pest.level ? apiPest[input.pest.level] : null } : { found: false },
        ...(input.notes.trim() ? { notes: input.notes.trim() } : {}),
        ...(input.location ? { latitude: input.location.latitude, longitude: input.location.longitude } : {}),
        ...(nextVisit.length ? { next_visit: nextVisit } : {}),
        ...(cleanTags(input.tags).length ? { tags: cleanTags(input.tags) } : {}),
        ...(knownDone.length ? { todos_done: knownDone } : {}),
      },
    });
  });
  return id;
}

export interface EntryPhoto {
  id: string;
  /** Arquivo guardado neste aparelho (fotos vindas de outro aparelho ainda não são baixadas). */
  uri: string | null;
  pending: boolean;
}

export interface EntryAudio {
  id: string;
  uri: string | null;
  durationS: number;
  status: 'transcrevendo' | 'pronto' | 'erro';
  /** O texto do usuário vale mais que o automático. */
  text: string | null;
  pending: boolean;
}

export async function listEntryMedia(entryId: string): Promise<{ photos: EntryPhoto[]; audios: EntryAudio[] }> {
  const db = await getDb();
  const photos = await db.getAllAsync<{ id: string; arquivo: string | null; sync_status: string }>('SELECT id, arquivo, sync_status FROM foto WHERE registro_id = ? ORDER BY criado_em', entryId);
  const audios = await db.getAllAsync<{ id: string; arquivo: string | null; duracao_s: number; status: EntryAudio['status']; transcricao: string | null; transcricao_editada: string | null; sync_status: string }>(
    'SELECT id, arquivo, duracao_s, status, transcricao, transcricao_editada, sync_status FROM audio WHERE registro_id = ? ORDER BY criado_em',
    entryId,
  );
  return {
    photos: photos.map((p) => ({ id: p.id, uri: p.arquivo, pending: p.sync_status !== 'sincronizado' })),
    audios: audios.map((a) => ({ id: a.id, uri: a.arquivo, durationS: a.duracao_s, status: a.status, text: a.transcricao_editada ?? a.transcricao, pending: a.sync_status !== 'sincronizado' })),
  };
}

export interface EntryEditData {
  id: string;
  reportId: string;
  recordedAt: Date;
  draft: boolean;
  activities: Activity[];
  application: { product: string; dose: string; target: string };
  irrigation: Irrigation | null;
  plantHeightCm: number | null;
  measuredAreaM2: number | null;
  cropCondition: CropCondition | null;
  stage: string;
  pest: { found: boolean; name: string; level: PestLevel | null };
  notes: string;
  tags: string[];
  /** Itens "para a próxima visita" ainda abertos, criados neste registro. */
  nextVisit: { id: string; text: string }[];
}

export async function getEntryEdit(id: string): Promise<EntryEditData | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<any>('SELECT * FROM registro WHERE id = ?', id);
  if (!r) return null;
  const todos = await db.getAllAsync<{ id: string; texto: string }>('SELECT id, texto FROM registro_pendencia WHERE registro_id = ? AND feito = 0 ORDER BY ordem', id);
  return {
    id: r.id,
    reportId: r.relatorio_id,
    recordedAt: new Date(r.data_hora),
    draft: r.status === 'rascunho',
    activities: JSON.parse(r.atividades) as Activity[],
    application: { product: r.aplicacao_produto ?? '', dose: r.aplicacao_dose ?? '', target: r.aplicacao_alvo ?? '' },
    irrigation: r.irrigacao,
    plantHeightCm: r.altura_plantas_cm,
    measuredAreaM2: r.area_medida_m2,
    cropCondition: r.cultura_estado,
    stage: r.estagio ?? '',
    pest: { found: r.houve_praga === 1, name: r.praga_nome ?? '', level: r.praga_nivel },
    notes: r.observacoes ?? '',
    tags: await getTags('registro', id),
    nextVisit: todos.map((x) => ({ id: x.id, text: x.texto })),
  };
}

export interface EntryUpdate {
  recordedAt: Date;
  draft: boolean;
  activities: Activity[];
  application: { product: string; dose: string; target: string } | null;
  irrigation: Irrigation | null;
  plantHeightCm: number | null;
  measuredAreaM2: number | null;
  cropCondition: CropCondition | null;
  stage: string;
  pest: { found: boolean; name: string; level: PestLevel | null };
  notes: string;
  tags: string[];
  nextVisit: string[];
  photos: StoredPhoto[];
  audios: (StoredAudio & { durationS: number })[];
}

/** Altera o registro no celular e na fila. O clima e o local não mudam. */
export async function updateEntry(id: string, input: EntryUpdate): Promise<void> {
  const db = await getDb();
  const user = await db.getFirstAsync<{ id: string }>('SELECT id FROM usuario LIMIT 1');
  const current = await db.getFirstAsync<{ versao: number }>('SELECT versao FROM registro WHERE id = ?', id);
  if (!user || !current) throw new Error('Registro não encontrado no celular.');
  const nowIso = new Date().toISOString();
  const app = input.activities.includes('aplicacao') ? input.application : null;
  const texts = input.nextVisit.map((x) => x.trim()).filter(Boolean).slice(0, 10);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE registro SET data_hora = ?, status = ?, atividades = ?, aplicacao_produto = ?, aplicacao_dose = ?, aplicacao_alvo = ?, irrigacao = ?,
              altura_plantas_cm = ?, area_medida_m2 = ?, cultura_estado = ?, estagio = ?, houve_praga = ?, praga_nome = ?, praga_nivel = ?, observacoes = ?, sync_status = 'pendente' WHERE id = ?`,
      input.recordedAt.toISOString(), input.draft ? 'rascunho' : 'concluido', JSON.stringify(input.activities), app?.product || null, app?.dose || null, app?.target || null, input.irrigation,
      input.plantHeightCm, input.measuredAreaM2, input.cropCondition, input.stage.trim() || null,
      input.pest.found ? 1 : 0, input.pest.found ? input.pest.name.trim() : null, input.pest.found ? input.pest.level : null, input.notes.trim() || null, id,
    );
    await setTags(db, user.id, 'registro', id, input.tags);

    // itens da próxima visita: os que continuam mantêm o id; os novos ganham id; o servidor aceita { id, text }
    const open = await db.getAllAsync<{ id: string; texto: string }>('SELECT id, texto FROM registro_pendencia WHERE registro_id = ? AND feito = 0 ORDER BY ordem', id);
    const keep = new Map(open.map((o) => [o.texto, o.id]));
    await db.runAsync('DELETE FROM registro_pendencia WHERE registro_id = ? AND feito = 0', id);
    const nextItems: { id: string; text: string }[] = [];
    for (let i = 0; i < texts.length; i++) {
      const todoId = keep.get(texts[i]) ?? newId();
      keep.delete(texts[i]);
      await db.runAsync("INSERT INTO registro_pendencia (id, usuario_id, registro_id, texto, ordem, sync_status) VALUES (?,?,?,?,?, 'sincronizado')", todoId, user.id, id, texts[i], i);
      nextItems.push({ id: todoId, text: texts[i] });
    }

    for (const p of input.photos) {
      await db.runAsync("INSERT INTO foto (id, usuario_id, registro_id, arquivo, tipo_mime, tamanho_bytes, tirada_em, sync_status) VALUES (?,?,?,?,?,?,?, 'pendente')", p.id, user.id, id, p.uri, p.mime, Math.max(1, p.sizeBytes), nowIso);
      await db.runAsync("INSERT INTO fila_midia (id, tipo, entidade, entidade_id, arquivo_local) VALUES (?, 'foto', 'registro', ?, ?)", p.id, id, p.uri);
    }
    for (const a of input.audios) {
      await db.runAsync("INSERT INTO audio (id, usuario_id, registro_id, arquivo, tipo_mime, duracao_s, tamanho_bytes, gravado_em, sync_status) VALUES (?,?,?,?,?,?,?,?, 'pendente')", a.id, user.id, id, a.uri, a.mime, Math.min(300, Math.max(1, a.durationS)), Math.max(1, a.sizeBytes), nowIso);
      await db.runAsync("INSERT INTO fila_midia (id, tipo, entidade, entidade_id, arquivo_local) VALUES (?, 'audio', 'registro', ?, ?)", a.id, id, a.uri);
    }

    await enqueue(db, {
      entity: 'entry',
      entityId: id,
      operation: 'alterar',
      baseVersion: current.versao,
      data: {
        recorded_at: input.recordedAt.toISOString(),
        status: input.draft ? 'draft' : 'completed',
        activities: input.activities.map((a) => apiActivity[a]),
        application: app && (app.product || app.dose || app.target) ? { product: app.product || null, dose: app.dose || null, target: app.target || null } : null,
        irrigation: input.irrigation ? apiIrrigation[input.irrigation] : null,
        measurements: { plant_height_cm: input.plantHeightCm, measured_area_m2: input.measuredAreaM2 },
        crop_condition: input.cropCondition ? apiCrop[input.cropCondition] : null,
        stage: input.stage.trim() || null,
        pest: input.pest.found ? { found: true, name: input.pest.name.trim(), level: input.pest.level ? apiPest[input.pest.level] : null } : { found: false, name: null, level: null },
        notes: input.notes.trim() || null,
        next_visit: nextItems,
        tags: cleanTags(input.tags),
      },
    });
  });
}

/** Exclui o registro com as fotos, áudios e itens dele. Itens que ele tinha marcado como feitos voltam a ficar abertos. */
export async function deleteEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE registro_pendencia SET feito = 0, feito_no_registro_id = NULL, feito_em = NULL WHERE feito_no_registro_id = ?", id);
    await db.runAsync("DELETE FROM fila_midia WHERE id IN (SELECT id FROM foto WHERE registro_id = ?) OR id IN (SELECT id FROM audio WHERE registro_id = ?)", id, id);
    await db.runAsync('DELETE FROM registro WHERE id = ?', id);
    await enqueue(db, { entity: 'entry', entityId: id, operation: 'excluir' });
  });
}

/** Salva o texto ajustado pelo usuário num áudio que já está no servidor (precisa de internet). Texto vazio volta ao automático. */
export async function editAudioText(audioId: string, text: string) {
  const value = text.trim() || null;
  await api('PATCH', `/audios/${audioId}`, { edited_transcription: value });
  const db = await getDb();
  await db.runAsync('UPDATE audio SET transcricao_editada = ? WHERE id = ?', value, audioId);
}

/** Pede ao servidor uma nova transcrição (precisa de internet). O texto editado pelo usuário não é trocado. */
export async function retranscribeAudio(audioId: string) {
  await api('POST', `/audios/${audioId}/retranscribe`);
  const db = await getDb();
  await db.runAsync("UPDATE audio SET status = 'transcrevendo', erro = NULL WHERE id = ?", audioId);
}
