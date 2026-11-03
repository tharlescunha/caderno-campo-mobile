import { enqueue, getDb, newId } from '../db';
import { localDate } from './today';

export interface ActivePeriod {
  id: string;
  name: string;
  subjects: number;
  futureEvents: number;
}

/** Período ativo do aparelho, com o que seria encerrado se um novo fosse criado. */
export async function getActivePeriod(now = new Date()): Promise<ActivePeriod | null> {
  const db = await getDb();
  const p = await db.getFirstAsync<{ id: string; nome: string }>("SELECT id, nome FROM periodo WHERE status = 'ativo' LIMIT 1");
  if (!p) return null;
  const subjects = await db.getFirstAsync<{ n: number }>('SELECT count(*) n FROM materia WHERE periodo_id = ? AND desativada = 0', p.id);
  const events = await db.getFirstAsync<{ n: number }>(
    `SELECT count(*) n FROM evento e JOIN materia m ON m.id = e.materia_id AND m.usuario_id = e.usuario_id
      WHERE m.periodo_id = ? AND e.data >= ? AND e.encerrado_com_periodo = 0`,
    p.id,
    localDate(now),
  );
  return { id: p.id, name: p.nome, subjects: subjects?.n ?? 0, futureEvents: events?.n ?? 0 };
}

export interface NewPeriod {
  name: string;
  startDate: string;
  endDate: string | null;
}

/**
 * Cria o período já ativo. Se havia outro ativo, ele é encerrado junto (como o servidor faz): matérias desativadas
 * e eventos futuros dessas matérias encerrados. Tudo é gravado no banco do celular e entra na fila de envio;
 * o servidor repete a mesma regra ao receber a criação.
 */
export async function createPeriod(input: NewPeriod, now = new Date()): Promise<string> {
  const db = await getDb();
  const user = await db.getFirstAsync<{ id: string }>('SELECT id FROM usuario LIMIT 1');
  if (!user) throw new Error('Usuário local não encontrado. Sincronize e tente de novo.');
  const id = newId();
  const nowIso = now.toISOString();
  // o usuário já confirmou na tela ("Entendi"); o servidor exige a confirmação junto com a criação
  let closing = false;
  await db.withTransactionAsync(async () => {
    const old = await db.getFirstAsync<{ id: string }>("SELECT id FROM periodo WHERE status = 'ativo' LIMIT 1");
    if (old) {
      closing = true;
      // não mexe em sync_status: o servidor faz a mesma cascata e o que ele devolver vale
      await db.runAsync("UPDATE periodo SET status = 'finalizado', finalizado_em = ? WHERE id = ?", nowIso, old.id);
      await db.runAsync(
        `UPDATE evento SET encerrado_com_periodo = 1
          WHERE data >= ? AND encerrado_com_periodo = 0 AND materia_id IN (SELECT id FROM materia WHERE periodo_id = ?)`,
        localDate(now),
        old.id,
      );
      await db.runAsync('UPDATE materia SET desativada = 1 WHERE periodo_id = ? AND desativada = 0', old.id);
      await db.runAsync("UPDATE relatorio SET status = 'finalizado', finalizado_por = 'periodo', finalizado_em = ? WHERE status = 'em_andamento' AND materia_id IN (SELECT id FROM materia WHERE periodo_id = ?)", nowIso, old.id);
    }
    await db.runAsync("INSERT INTO periodo (id, usuario_id, nome, data_inicio, data_fim, sync_status) VALUES (?,?,?,?,?, 'pendente')", id, user.id, input.name, input.startDate, input.endDate);
    await enqueue(db, { entity: 'period', entityId: id, operation: 'criar', data: { name: input.name, start_date: input.startDate, ...(input.endDate ? { end_date: input.endDate } : {}), ...(closing ? { confirm_closing: true } : {}) } });
  });
  return id;
}
