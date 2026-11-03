import { api } from '../api/client';
import { getDb } from '../db';
import { tableOf } from './pull';

const BATCH = 50;
const apiOperation = { criar: 'create', alterar: 'update', excluir: 'delete', encerrar_periodo: 'close_period' } as const;
/** Erros que não adianta tentar de novo sem o usuário corrigir algo. */
const FINAL_ERRORS = new Set(['validation', 'forbidden', 'unknown_entity']);

interface QueueRow {
  id: string;
  entidade: string;
  entidade_id: string;
  operacao: keyof typeof apiOperation;
  dados: string | null;
  versao_base: number | null;
  feito_em: string;
  tentativas: number;
}

interface OpResult {
  operation_id: string;
  status: 'ok' | 'already_processed' | 'conflict' | 'error';
  version?: number;
  code?: string;
  message?: string;
}

export interface PushResult {
  sent: number;
  ok: number;
  failed: number;
  waiting: number;
}

/** Espera crescente entre tentativas: 30 s, 1 min, 2 min... no máximo 1 hora. */
export const backoffMs = (attempts: number) => Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 3_600_000);

/**
 * Envia a fila de envio ao servidor, em lotes de até 50, na ordem em que foi feita.
 * O que o servidor aceitar sai da fila; erro definitivo fica marcado como "erro" sem travar o resto;
 * falha de rede devolve tudo para "pendente" com espera crescente.
 */
export function pushChanges(): Promise<PushResult> {
  // um envio por vez (abrir o app, voltar a rede e "Sincronizar agora" podem disparar juntos)
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

let running: Promise<PushResult> | null = null;

async function run(): Promise<PushResult> {
  const db = await getDb();
  const result: PushResult = { sent: 0, ok: 0, failed: 0, waiting: 0 };
  // sobras de um envio interrompido (app fechado no meio) voltam para a fila
  await db.runAsync("UPDATE fila_envio SET status = 'pendente' WHERE status = 'enviando'");
  for (;;) {
    const rows = await db.getAllAsync<QueueRow>(
      `SELECT id, entidade, entidade_id, operacao, dados, versao_base, feito_em, tentativas FROM fila_envio
        WHERE status = 'pendente' AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= ?)
        ORDER BY criado_em, rowid LIMIT ?`,
      new Date().toISOString(),
      BATCH,
    );
    if (rows.length === 0) break;
    const marks = rows.map(() => '?').join(',');
    await db.runAsync(`UPDATE fila_envio SET status = 'enviando' WHERE id IN (${marks})`, ...rows.map((r) => r.id));

    let results: OpResult[];
    try {
      const res = await api<{ results: OpResult[] }>('POST', '/sync/send', {
        operations: rows.map((r) => ({
          operation_id: r.id,
          entity: r.entidade,
          operation: apiOperation[r.operacao],
          id: r.entidade_id,
          ...(r.dados ? { data: JSON.parse(r.dados) } : {}),
          ...(r.versao_base != null ? { base_version: r.versao_base } : {}),
          done_at: r.feito_em,
        })),
      });
      results = res.results;
    } catch (e) {
      // sem rede / servidor fora / sessão recusada: nada se perde, tenta de novo mais tarde
      for (const r of rows) {
        await db.runAsync("UPDATE fila_envio SET status = 'pendente', tentativas = tentativas + 1, proxima_tentativa_em = ?, erro = ? WHERE id = ?", new Date(Date.now() + backoffMs(r.tentativas + 1)).toISOString(), e instanceof Error ? e.message : String(e), r.id);
      }
      result.waiting += rows.length;
      break;
    }

    result.sent += rows.length;
    for (const r of rows) {
      const res = results.find((x) => x.operation_id === r.id);
      if (res && res.status !== 'error') {
        await db.withTransactionAsync(async () => {
          await db.runAsync('DELETE FROM fila_envio WHERE id = ?', r.id);
          const table = tableOf(r.entidade);
          const more = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM fila_envio WHERE entidade = ? AND entidade_id = ?', r.entidade, r.entidade_id);
          // só marca como sincronizado se não sobrou outra alteração do mesmo item esperando
          if (table && !more?.n && r.operacao !== 'excluir') await db.runAsync(`UPDATE ${table} SET sync_status = 'sincronizado' WHERE id = ?`, r.entidade_id);
          // os itens "para a próxima visita" criados no celular têm ids do aparelho; o servidor cria os dele e o download traz de volta
          if (r.entidade === 'entry' && r.operacao === 'criar') await db.runAsync("DELETE FROM registro_pendencia WHERE registro_id = ? AND sync_status = 'pendente'", r.entidade_id);
        });
        result.ok++;
      } else {
        const code = res?.code ?? 'no_result';
        const message = res?.message ?? 'O servidor não respondeu esta operação.';
        const final = FINAL_ERRORS.has(code);
        await db.runAsync(
          'UPDATE fila_envio SET status = ?, tentativas = tentativas + 1, proxima_tentativa_em = ?, erro = ? WHERE id = ?',
          final ? 'erro' : 'pendente',
          final ? null : new Date(Date.now() + backoffMs(r.tentativas + 1)).toISOString(),
          `${code}: ${message}`,
          r.id,
        );
        const table = tableOf(r.entidade);
        if (final && table) await db.runAsync(`UPDATE ${table} SET sync_status = 'erro' WHERE id = ?`, r.entidade_id);
        result.failed++;
      }
    }
    if (rows.length < BATCH) break;
  }
  return result;
}
