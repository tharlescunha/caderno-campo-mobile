import { getDb } from '../db';
import { tableOf } from '../sync/pull';

// Itens da fila de envio que o servidor recusou ("Itens não enviados") e os que ainda esperam para subir.
export interface QueueItem {
  id: string;
  entity: string;
  entityId: string;
  operation: string;
  kind: string;
  title: string;
  when: string;
  reason: string;
  /** Tela para corrigir o item no app (quando existe tela de edição). */
  fix: { label: string; pathname: string; params: Record<string, string> } | null;
}

const kinds: Record<string, string> = {
  period: 'Período',
  teacher: 'Professor',
  subject: 'Matéria',
  report: 'Relatório',
  entry: 'Registro de campo',
  todo: 'Item da próxima visita',
  note: 'Anotação',
  photo: 'Foto',
  audio: 'Áudio',
  event: 'Evento',
};

// motivos que o servidor devolve, em português simples
const reasons: Record<string, string> = {
  validation: 'O servidor não aceitou os dados deste item. Corrija e tente de novo.',
  forbidden: 'Este item não pode ser alterado por esta conta.',
  unknown_entity: 'O servidor não conhece este tipo de item.',
};

async function describe(entity: string, id: string): Promise<{ title: string; fix: QueueItem['fix'] }> {
  const db = await getDb();
  switch (entity) {
    case 'report': {
      const r = await db.getFirstAsync<{ titulo: string }>('SELECT titulo FROM relatorio WHERE id = ?', id);
      return { title: r?.titulo ?? 'Relatório', fix: r ? { label: 'Corrigir relatório', pathname: '/novo-relatorio', params: { id } } : null };
    }
    case 'entry': {
      const r = await db.getFirstAsync<{ relatorio_id: string; data_hora: string; titulo: string }>('SELECT g.relatorio_id, g.data_hora, r.titulo FROM registro g JOIN relatorio r ON r.id = g.relatorio_id WHERE g.id = ?', id);
      if (!r) return { title: 'Registro de campo', fix: null };
      const d = new Date(r.data_hora);
      return { title: `${r.titulo} · ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, fix: { label: 'Corrigir registro', pathname: '/novo-registro', params: { reportId: r.relatorio_id, id } } };
    }
    case 'event': {
      const r = await db.getFirstAsync<{ titulo: string }>('SELECT titulo FROM evento WHERE id = ?', id);
      return { title: r?.titulo ?? 'Evento', fix: r ? { label: 'Revisar evento', pathname: '/novo-evento', params: { id } } : null };
    }
    case 'note': {
      const r = await db.getFirstAsync<{ titulo: string }>('SELECT titulo FROM anotacao WHERE id = ?', id);
      return { title: r?.titulo ?? 'Anotação', fix: r ? { label: 'Revisar anotação', pathname: '/nova-nota', params: { id } } : null };
    }
    case 'subject': {
      const r = await db.getFirstAsync<{ nome: string }>('SELECT nome FROM materia WHERE id = ?', id);
      return { title: r?.nome ?? 'Matéria', fix: null };
    }
    case 'period': {
      const r = await db.getFirstAsync<{ nome: string }>('SELECT nome FROM periodo WHERE id = ?', id);
      return { title: r?.nome ?? 'Período', fix: null };
    }
    default:
      return { title: kinds[entity] ?? entity, fix: null };
  }
}

export async function listQueue(): Promise<{ failed: QueueItem[]; waiting: QueueItem[] }> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; entidade: string; entidade_id: string; operacao: string; feito_em: string; erro: string | null; status: string }>(
    'SELECT id, entidade, entidade_id, operacao, feito_em, erro, status FROM fila_envio ORDER BY criado_em',
  );
  const failed: QueueItem[] = [];
  const waiting: QueueItem[] = [];
  for (const r of rows) {
    const d = await describe(r.entidade, r.entidade_id);
    const code = r.erro?.split(':')[0] ?? '';
    const detail = r.erro?.includes(':') ? r.erro.slice(r.erro.indexOf(':') + 1).trim() : '';
    const item: QueueItem = {
      id: r.id,
      entity: r.entidade,
      entityId: r.entidade_id,
      operation: r.operacao,
      kind: kinds[r.entidade] ?? r.entidade,
      title: d.title,
      when: r.feito_em,
      reason: reasons[code] ? `${reasons[code]}${detail ? ` (${detail})` : ''}` : detail || 'Motivo não informado.',
      fix: d.fix,
    };
    (r.status === 'erro' ? failed : waiting).push(item);
  }
  return { failed, waiting };
}

/** Coloca o item de volta na fila para a próxima tentativa. */
export async function retryItem(item: QueueItem) {
  const db = await getDb();
  await db.runAsync("UPDATE fila_envio SET status = 'pendente', tentativas = 0, proxima_tentativa_em = NULL, erro = NULL WHERE id = ?", item.id);
  const table = tableOf(item.entity);
  if (table) await db.runAsync(`UPDATE ${table} SET sync_status = 'pendente' WHERE id = ?`, item.entityId);
}

/**
 * Descarta o item. Se ele foi criado só no celular, é apagado daqui; se já existe no servidor, só a alteração recusada é
 * abandonada e a versão do servidor volta no próximo download.
 */
export async function discardItem(item: QueueItem) {
  const db = await getDb();
  const table = tableOf(item.entity);
  await db.withTransactionAsync(async () => {
    if (item.operation === 'criar') {
      await db.runAsync('DELETE FROM fila_envio WHERE entidade = ? AND entidade_id = ?', item.entity, item.entityId);
      await db.runAsync('DELETE FROM fila_midia WHERE entidade_id = ?', item.entityId);
      if (table) await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, item.entityId);
    } else {
      await db.runAsync('DELETE FROM fila_envio WHERE id = ?', item.id);
      if (table) await db.runAsync(`UPDATE ${table} SET sync_status = 'sincronizado' WHERE id = ?`, item.entityId);
    }
  });
}
