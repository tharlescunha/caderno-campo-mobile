import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';
import { api } from '../api/client';
import { getDb } from '../db';
import { setTags, type TagOwner } from '../data/tags';

// A API fala inglês; o banco do celular (docs/schema-celular.sql) fala português. Cada tabela abaixo traduz os dois lados.

const periodStatus = { active: 'ativo', finished: 'finalizado' } as const;
const classType = { classroom: 'sala', field: 'campo', classroom_and_field: 'sala_e_campo' } as const;
const color = { blue: 'azul', green: 'verde', earth: 'terra', purple: 'roxo', red: 'vermelho' } as const;
const eventType = { exam: 'prova', assignment: 'trabalho', report_delivery: 'entrega_relatorio', activity: 'atividade', college_event: 'evento_faculdade', other: 'outro' } as const;
const deliveryFormat = { pdf: 'pdf', printed: 'impresso', slides: 'slides', other: 'outro' } as const;
const reminder = { none: 'nenhum', on_the_day: 'no_dia', '1_day': '1_dia', '3_days': '3_dias', '1_week': '1_semana' } as const;
const reportType = { continuous: 'continuo', one_off: 'pontual' } as const;
const reportStatus = { in_progress: 'em_andamento', finished: 'finalizado' } as const;
const finishedBy = { user: 'usuario', period: 'periodo' } as const;
const activityMap = { fertilization: 'adubacao', cleaning: 'limpeza', inspection: 'vistoria', application: 'aplicacao', irrigation: 'irrigacao', planting: 'plantio', harvest: 'colheita', other: 'outro' } as const;
const irrigationMap = { working: 'funcionando', faulty: 'com_falha', none: 'sem_irrigacao', to_install: 'a_instalar' } as const;
const cropMap = { excellent: 'otima', good: 'boa', fair: 'regular', poor: 'ruim' } as const;
const pestLevel = { low: 'baixo', medium: 'medio', high: 'alto' } as const;
const weatherOrigin = { gps: 'gps', manual: 'manual', pending: 'pendente', gps_late: 'gps_atrasado' } as const;
const audioStatus = { transcribing: 'transcrevendo', ready: 'pronto', error: 'erro' } as const;
const entryStatus = { draft: 'rascunho', completed: 'concluido' } as const;
const mapOrNull = <T extends Record<string, string>>(map: T, key: string | null | undefined) => (key && key in map ? map[key as keyof T] : null);
const theme = { light: 'claro', dark: 'escuro', system: 'sistema' } as const;

const pick = <T extends Record<string, string>>(map: T, key: string | undefined | null, fallback: keyof T): T[keyof T] => map[(key && key in map ? key : fallback) as keyof T];
const bool = (v: unknown) => (v ? 1 : 0);

type Item = Record<string, any>;
type Row = Record<string, SQLiteBindValue>;

interface Mapper {
  table: string;
  /** Linha da tabela local (sem usuario_id e sync_status, que são acrescentados). */
  toRow: (item: Item) => Row;
  /** Tabelas filhas que precisam ser refeitas junto (ex.: dias da matéria). */
  after?: (db: SQLiteDatabase, item: Item, userId: string) => Promise<void>;
}

const mappers: Record<string, Mapper> = {
  period: {
    table: 'periodo',
    toRow: (i) => ({ id: i.id, nome: i.name, data_inicio: i.start_date, data_fim: i.end_date, status: pick(periodStatus, i.status, 'active'), finalizado_em: i.finished_at, criado_em: i.created_at, atualizado_em: i.updated_at, versao: i.version }),
  },
  teacher: {
    table: 'professor',
    toRow: (i) => ({ id: i.id, nome: i.name, email: i.email, observacoes: i.notes, criado_em: i.created_at, atualizado_em: i.updated_at, versao: i.version }),
  },
  subject: {
    table: 'materia',
    toRow: (i) => ({
      id: i.id,
      periodo_id: i.period_id,
      professor_id: i.teacher?.id ?? null,
      nome: i.name,
      tipo_aula: pick(classType, i.class_type, 'classroom'),
      cor: pick(color, i.color, 'green'),
      lembrar_vespera: bool(i.remind_eve),
      desativada: bool(i.deactivated),
      criado_em: i.created_at,
      atualizado_em: i.updated_at,
      versao: i.version,
    }),
    after: async (db, i) => {
      await db.runAsync('DELETE FROM materia_dia WHERE materia_id = ?', i.id);
      for (const d of i.weekdays ?? []) await db.runAsync('INSERT INTO materia_dia (materia_id, dia_semana) VALUES (?, ?)', i.id, d);
    },
  },
  report: {
    table: 'relatorio',
    toRow: (i) => ({
      id: i.id,
      materia_id: i.subject?.id,
      titulo: i.title,
      tipo: pick(reportType, i.type, 'continuous'),
      status: pick(reportStatus, i.status, 'in_progress'),
      finalizado_em: i.finished_at,
      finalizado_por: i.finished_by ? pick(finishedBy, i.finished_by, 'user') : null,
      data_entrega: i.delivery_date,
      lembrete_entrega: pick(reminder, i.delivery_reminder, 'none'),
      observacoes: i.notes,
      area_cultura: i.area?.crop ?? null,
      area_local: i.area?.place ?? null,
      area_comprimento_m: i.area?.length_m ?? null,
      area_largura_m: i.area?.width_m ?? null,
      area_foto_id: i.area_photo_id,
      capa_foto_id: i.chosen_cover_photo_id ?? null,
      formato_entrega: i.delivery_format ? deliveryFormat[i.delivery_format as keyof typeof deliveryFormat] ?? null : null,
      criado_em: i.created_at,
      atualizado_em: i.updated_at,
      versao: i.version,
    }),
    after: async (db, i, userId) => syncTags(db, userId, 'relatorio', 'relatorio', i),
  },
  entry: {
    table: 'registro',
    toRow: (i) => ({
      id: i.id,
      relatorio_id: i.report_id,
      data_hora: i.recorded_at,
      status: pick(entryStatus, i.status, 'draft'),
      atividades: JSON.stringify((i.activities ?? []).map((a: string) => activityMap[a as keyof typeof activityMap] ?? 'outro')),
      aplicacao_produto: i.application?.product ?? null,
      aplicacao_dose: i.application?.dose ?? null,
      aplicacao_alvo: i.application?.target ?? null,
      irrigacao: mapOrNull(irrigationMap, i.irrigation),
      altura_plantas_cm: i.measurements?.plant_height_cm ?? null,
      area_medida_m2: i.measurements?.measured_area_m2 ?? null,
      cultura_estado: mapOrNull(cropMap, i.crop_condition),
      estagio: i.stage ?? null,
      houve_praga: bool(i.pest?.found),
      praga_nome: i.pest?.name ?? null,
      praga_nivel: mapOrNull(pestLevel, i.pest?.level),
      observacoes: i.notes ?? null,
      latitude: i.latitude ?? null,
      longitude: i.longitude ?? null,
      clima_origem: mapOrNull(weatherOrigin, i.weather_origin),
      clima_descricao: i.weather?.description ?? null,
      clima_temperatura_c: i.weather?.temperature_c ?? null,
      clima_sensacao_c: i.weather?.feels_like_c ?? null,
      clima_umidade_pct: i.weather?.humidity_pct != null ? Math.round(i.weather.humidity_pct) : null,
      clima_vento_kmh: i.weather?.wind_kmh ?? null,
      clima_chuva_1h_mm: i.weather?.rain_1h_mm ?? null,
      clima_medido_em: i.weather?.measured_at ?? null,
      criado_em: i.created_at,
      atualizado_em: i.updated_at,
      versao: i.version,
    }),
    // os itens "para a próxima visita" vêm dentro do registro
    after: async (db, i, userId) => {
      for (const todo of i.todos ?? []) await upsert(db, userId, mappers.todo, todo);
      await syncTags(db, userId, 'registro', 'registro', i);
    },
  },
  note: {
    table: 'anotacao',
    toRow: (i) => ({
      id: i.id,
      materia_id: i.subject?.id ?? null,
      titulo: i.title,
      texto: i.text ?? null,
      link: i.link ?? null,
      fixada: bool(i.pinned),
      criado_em: i.created_at ?? i.updated_at,
      atualizado_em: i.updated_at,
      versao: i.version,
    }),
    // anexos não são uma entidade: vêm dentro da anotação (o arquivo guardado no aparelho é mantido)
    after: async (db, i, userId) => {
      for (const a of i.attachments ?? []) {
        await db.runAsync('INSERT OR IGNORE INTO anexo (id, usuario_id, anotacao_id, tipo_mime, tamanho_bytes) VALUES (?,?,?,?,?)', a.id, userId, i.id, a.mime_type, Math.max(1, a.size_bytes ?? 1));
      }
      await syncTags(db, userId, 'anotacao', 'anotacao', i);
    },
  },
  // arquivo/miniatura não vêm da API: o que o aparelho já tem guardado é mantido (a coluna não entra na atualização)
  photo: {
    table: 'foto',
    toRow: (i) => ({
      id: i.id,
      registro_id: i.entry_id ?? null,
      relatorio_id: i.report_id ?? null,
      evento_id: i.event_id ?? null,
      tipo_mime: i.mime_type,
      tamanho_bytes: Math.max(1, i.size_bytes ?? 1),
      legenda: i.caption ?? null,
      tirada_em: i.taken_at ?? null,
      latitude: i.latitude ?? null,
      longitude: i.longitude ?? null,
      criado_em: i.created_at,
      atualizado_em: i.updated_at,
      versao: i.version,
    }),
  },
  audio: {
    table: 'audio',
    toRow: (i) => ({
      id: i.id,
      registro_id: i.entry_id ?? null,
      anotacao_id: i.note_id ?? null,
      tipo_mime: i.mime_type,
      duracao_s: Math.min(300, Math.max(1, i.duration_s ?? 1)),
      tamanho_bytes: Math.max(1, i.size_bytes ?? 1),
      gravado_em: i.recorded_at,
      status: pick(audioStatus, i.status, 'transcribing'),
      idioma: i.language ?? 'pt-BR',
      transcricao: i.transcription ?? null,
      transcricao_editada: i.edited_transcription ?? null,
      confianca: i.confidence ?? null,
      tentativas: i.attempts ?? 0,
      erro: i.error ?? null,
      transcrito_em: i.transcribed_at ?? null,
      criado_em: i.created_at,
      atualizado_em: i.updated_at,
      versao: i.version,
    }),
  },
  todo: {
    table: 'registro_pendencia',
    toRow: (i) => ({ id: i.id, registro_id: i.entry_id, texto: i.text, ordem: i.order ?? 0, feito: bool(i.done), feito_no_registro_id: i.done_in_entry_id ?? null, feito_em: i.done_at ?? null, versao: i.version }),
  },
  event: {
    table: 'evento',
    toRow: (i) => ({
      id: i.id,
      materia_id: i.subject_id,
      relatorio_id: i.report_id,
      tipo: pick(eventType, i.type, 'other'),
      descricao_tipo: i.type_description,
      titulo: i.title,
      data: i.date,
      lembrete: pick(reminder, i.reminder, 'none'),
      anotacoes: i.notes,
      concluido: bool(i.completed),
      encerrado_com_periodo: bool(i.closed_with_period),
      criado_em: i.created_at,
      atualizado_em: i.updated_at,
      versao: i.version,
    }),
  },
};

/**
 * Entidades que o celular ainda não sabe guardar (relatório, registro, anotação, foto...) são ignoradas.
 * Ao ensinar uma nova, uma migração deve zerar o cursor (`UPDATE estado_sync SET cursor = 0`) para baixar tudo de novo.
 */
export const KNOWN_ENTITIES = Object.keys(mappers);

/** Tabela local de uma entidade da API (ou undefined se o celular ainda não a guarda). */
export const tableOf = (entity: string) => mappers[entity]?.table;

/** Tags vêm como nomes dentro do item; só trocam as do aparelho se o item não tem alteração local esperando envio. */
async function syncTags(db: SQLiteDatabase, userId: string, owner: TagOwner, tableName: string, item: Item) {
  const row = await db.getFirstAsync<{ sync_status: string }>(`SELECT sync_status FROM ${tableName} WHERE id = ?`, item.id);
  if (row?.sync_status === 'sincronizado') await setTags(db, userId, owner, item.id, Array.isArray(item.tags) ? item.tags : []);
}

async function upsert(db: SQLiteDatabase, userId: string, m: Mapper, item: Item) {
  const row: Row = { ...m.toRow(item), usuario_id: userId, sync_status: 'sincronizado' };
  const cols = Object.keys(row);
  const sets = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`);
  // só troca se a versão mudou e o item não tem alteração local esperando envio
  await db.runAsync(
    `INSERT INTO ${m.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${sets.join(', ')} WHERE excluded.versao <> ${m.table}.versao AND ${m.table}.sync_status = 'sincronizado'`,
    ...cols.map((c) => row[c]),
  );
  await m.after?.(db, item, userId);
}

/** Cria/atualiza a linha do usuário no banco local (as outras tabelas apontam para ela). */
async function ensureLocalUser(db: SQLiteDatabase) {
  const u = await api<Item>('GET', '/users/me');
  await db.runAsync(
    `INSERT INTO usuario (id, nome, email, curso, instituicao, fuso_horario, tema, cidade_cotacoes, aceitou_termos_em, primeiro_acesso_concluido_em, criado_em, atualizado_em, versao)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, email = excluded.email, curso = excluded.curso, instituicao = excluded.instituicao,
       fuso_horario = excluded.fuso_horario, tema = excluded.tema, cidade_cotacoes = excluded.cidade_cotacoes,
       primeiro_acesso_concluido_em = excluded.primeiro_acesso_concluido_em, atualizado_em = excluded.atualizado_em, versao = excluded.versao
     WHERE excluded.versao <> usuario.versao`,
    u.id, u.name, u.email, u.course ?? null, u.institution ?? null, u.timezone ?? 'America/Araguaina', pick(theme, u.theme, 'system'), u.quotes_city ?? 'Palmas-TO',
    u.created_at, u.first_access_completed_at ?? null, u.created_at, u.updated_at, u.version,
  );
  return u.id as string;
}

export interface PullResult {
  pages: number;
  applied: Record<string, number>;
  skipped: Record<string, number>;
  deleted: number;
}

/** Baixa do servidor tudo o que mudou desde o último cursor e aplica no banco local. */
export async function pullChanges(): Promise<PullResult> {
  const db = await getDb();
  const userId = await ensureLocalUser(db);
  const result: PullResult = { pages: 0, applied: {}, skipped: {}, deleted: 0 };
  let more = true;
  while (more) {
    const state = await db.getFirstAsync<{ cursor: string | null }>('SELECT cast(cursor AS TEXT) AS cursor FROM estado_sync WHERE id = 1');
    const cursor = state?.cursor && state.cursor !== '0' ? `&cursor=${encodeURIComponent(state.cursor.padStart(9, '0'))}` : '';
    const page = await api<{ changes: { entity: string; operation: 'upsert' | 'delete'; id: string; item?: Item }[]; cursor: string; has_more: boolean }>('GET', `/sync/changes?limit=200${cursor}`);
    await db.withTransactionAsync(async () => {
      // pais e filhos podem chegar em qualquer ordem dentro da página; confere as chaves só no fim
      await db.execAsync('PRAGMA defer_foreign_keys = ON');
      for (const c of page.changes) {
        const m = mappers[c.entity];
        if (!m) {
          result.skipped[c.entity] = (result.skipped[c.entity] ?? 0) + 1;
        } else if (c.operation === 'delete') {
          await db.runAsync(`DELETE FROM ${m.table} WHERE id = ?`, c.id);
          result.deleted++;
        } else if (c.item) {
          await upsert(db, userId, m, c.item);
          result.applied[c.entity] = (result.applied[c.entity] ?? 0) + 1;
        }
      }
      await db.runAsync('UPDATE estado_sync SET cursor = ?, ultima_sync_em = ?, ultimo_erro = NULL WHERE id = 1', Number(page.cursor), new Date().toISOString());
    });
    result.pages++;
    more = page.has_more;
  }
  return result;
}
