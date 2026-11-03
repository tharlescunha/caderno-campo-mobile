import { randomUUID } from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { schemaV1 } from './schemaV1';

/**
 * Migrações do banco do celular. A posição na lista + 1 é o número da versão (PRAGMA user_version).
 * Nunca edite uma migração já publicada: acrescente uma nova no fim.
 */
const migrations: string[] = [
  schemaV1,
  // 2: criações de período que ficaram na fila sem a confirmação do encerramento (o servidor devolvia "closing_required")
  `UPDATE fila_envio
      SET dados = json_set(dados, '$.confirm_closing', json('true')), status = 'pendente', proxima_tentativa_em = NULL, erro = NULL, tentativas = 0
    WHERE entidade = 'period' AND operacao = 'criar' AND dados IS NOT NULL AND json_extract(dados, '$.confirm_closing') IS NULL;`,
  // 3: o celular passou a guardar relatórios; baixa tudo de novo para pegar os que já existem no servidor
  `UPDATE estado_sync SET cursor = 0 WHERE id = 1;`,
  // 4: registros e itens da próxima visita passaram a ser guardados; baixa tudo de novo
  `UPDATE estado_sync SET cursor = 0 WHERE id = 1;`,
  // 5: fotos e áudios passaram a ser guardados; baixa tudo de novo
  `UPDATE estado_sync SET cursor = 0 WHERE id = 1;`,
  // 6: as primeiras fotos e áudios foram guardados vazios (cópia de arquivo com defeito); tira da fila o que ainda não subiu
  `DELETE FROM fila_midia WHERE id IN (SELECT id FROM foto WHERE tamanho_bytes <= 1 AND sync_status = 'pendente' UNION SELECT id FROM audio WHERE tamanho_bytes <= 1 AND sync_status = 'pendente');
   DELETE FROM foto WHERE tamanho_bytes <= 1 AND sync_status = 'pendente';
   DELETE FROM audio WHERE tamanho_bytes <= 1 AND sync_status = 'pendente';`,
  // 7: anotações passaram a ser guardadas; baixa tudo de novo
  `UPDATE estado_sync SET cursor = 0 WHERE id = 1;`,
  // 8: anexos de anotação passaram a ser guardados; baixa tudo de novo
  `UPDATE estado_sync SET cursor = 0 WHERE id = 1;`,
  // 9: última resposta do mercado/clima/notícias, para mostrar sem internet
  `CREATE TABLE IF NOT EXISTS mercado_cache (
     chave         TEXT PRIMARY KEY,
     conteudo      TEXT NOT NULL CHECK (json_valid(conteudo)),
     atualizado_em TEXT NOT NULL
   );`,
  // 10: tags passaram a ser guardadas; baixa tudo de novo
  `UPDATE estado_sync SET cursor = 0 WHERE id = 1;`,
  // 11: a busca passa a achar o relatório pela cultura e pelo local da área, e o registro pelo estágio e pelo alvo da aplicação
  `DROP TRIGGER IF EXISTS busca_relatorio_ins;
   DROP TRIGGER IF EXISTS busca_relatorio_upd;
   DROP TRIGGER IF EXISTS busca_registro_ins;
   DROP TRIGGER IF EXISTS busca_registro_upd;
   CREATE TRIGGER busca_relatorio_ins AFTER INSERT ON relatorio BEGIN
     INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
     VALUES (NEW.usuario_id, 'relatorio', NEW.id, NEW.titulo, coalesce(NEW.observacoes,'') || ' ' || coalesce(NEW.area_cultura,'') || ' ' || coalesce(NEW.area_local,'')); END;
   CREATE TRIGGER busca_relatorio_upd AFTER UPDATE OF titulo, observacoes, area_cultura, area_local ON relatorio BEGIN
     DELETE FROM busca_indice WHERE entidade = 'relatorio' AND entidade_id = OLD.id;
     INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
     VALUES (NEW.usuario_id, 'relatorio', NEW.id, NEW.titulo, coalesce(NEW.observacoes,'') || ' ' || coalesce(NEW.area_cultura,'') || ' ' || coalesce(NEW.area_local,'')); END;
   CREATE TRIGGER busca_registro_ins AFTER INSERT ON registro BEGIN
     INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
     VALUES (NEW.usuario_id, 'registro', NEW.id, coalesce(NEW.praga_nome,''),
             coalesce(NEW.observacoes,'') || ' ' || coalesce(NEW.aplicacao_produto,'') || ' ' || coalesce(NEW.aplicacao_alvo,'') || ' ' || coalesce(NEW.estagio,'')); END;
   CREATE TRIGGER busca_registro_upd AFTER UPDATE OF observacoes, praga_nome, aplicacao_produto, aplicacao_alvo, estagio ON registro BEGIN
     DELETE FROM busca_indice WHERE entidade = 'registro' AND entidade_id = OLD.id;
     INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
     VALUES (NEW.usuario_id, 'registro', NEW.id, coalesce(NEW.praga_nome,''),
             coalesce(NEW.observacoes,'') || ' ' || coalesce(NEW.aplicacao_produto,'') || ' ' || coalesce(NEW.aplicacao_alvo,'') || ' ' || coalesce(NEW.estagio,'')); END;
   DELETE FROM busca_indice WHERE entidade IN ('relatorio', 'registro');
   INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
     SELECT usuario_id, 'relatorio', id, titulo, coalesce(observacoes,'') || ' ' || coalesce(area_cultura,'') || ' ' || coalesce(area_local,'') FROM relatorio;
   INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
     SELECT usuario_id, 'registro', id, coalesce(praga_nome,''), coalesce(observacoes,'') || ' ' || coalesce(aplicacao_produto,'') || ' ' || coalesce(aplicacao_alvo,'') || ' ' || coalesce(estagio,'') FROM registro;`,
  // 12: foto de capa escolhida pelo usuário
  'ALTER TABLE relatorio ADD COLUMN capa_foto_id TEXT;',
  // 13: formato da entrega do relatório (pdf, impresso, slides, outro)
  'ALTER TABLE relatorio ADD COLUMN formato_entrega TEXT;',
];

export const DB_NAME = 'caderno.db';

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

/** Abre o banco, liga as chaves estrangeiras e aplica as migrações que faltam (cada uma numa transação). */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  opening ??= (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    for (let v = row?.user_version ?? 0; v < migrations.length; v++) {
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.execAsync(migrations[v]);
        await tx.execAsync(`PRAGMA user_version = ${v + 1}`);
      });
    }
    return db;
  })().catch((e) => {
    opening = null;
    throw e;
  });
  return opening;
}

/** UUID v4 em minúsculas, gerado no aparelho (os ids nascem no cliente). */
export function newId(): string {
  return randomUUID();
}

export type Operation = 'criar' | 'alterar' | 'excluir' | 'encerrar_periodo';

/**
 * Registra na fila de envio o que foi feito, junto com a gravação (chame dentro da mesma transação).
 * Junta operações do mesmo item que ainda não saíram: criar+alterar vira criar com os dados novos;
 * criar+excluir some (o servidor nunca soube do item); alterar+alterar mantém uma só.
 */
export async function enqueue(
  db: Pick<SQLite.SQLiteDatabase, 'getFirstAsync' | 'runAsync'>,
  op: { entity: string; entityId: string; operation: Operation; data?: Record<string, unknown> | null; baseVersion?: number | null },
) {
  const now = new Date().toISOString();
  if (op.operation === 'encerrar_periodo') {
    // encerrar não se junta com criar/alterar: é uma operação própria, enviada depois delas
    await db.runAsync('INSERT INTO fila_envio (id, entidade, entidade_id, operacao, dados, versao_base, feito_em) VALUES (?,?,?,?,?,?,?)', newId(), op.entity, op.entityId, op.operation, null, null, now);
    return;
  }
  const pending = await db.getFirstAsync<{ id: string; operacao: Operation; dados: string | null; versao_base: number | null }>(
    "SELECT id, operacao, dados, versao_base FROM fila_envio WHERE entidade = ? AND entidade_id = ? AND status = 'pendente' ORDER BY criado_em DESC LIMIT 1",
    op.entity,
    op.entityId,
  );
  if (!pending) {
    await db.runAsync(
      'INSERT INTO fila_envio (id, entidade, entidade_id, operacao, dados, versao_base, feito_em) VALUES (?,?,?,?,?,?,?)',
      newId(),
      op.entity,
      op.entityId,
      op.operation,
      op.data ? JSON.stringify(op.data) : null,
      op.baseVersion ?? null,
      now,
    );
    return;
  }
  if (pending.operacao === 'criar' && op.operation === 'excluir') {
    await db.runAsync('DELETE FROM fila_envio WHERE id = ?', pending.id);
    return;
  }
  const merged = { ...(pending.dados ? JSON.parse(pending.dados) : {}), ...(op.data ?? {}) };
  // criar+alterar continua "criar"; qualquer coisa+excluir vira "excluir"
  const operation: Operation = op.operation === 'excluir' ? 'excluir' : pending.operacao === 'criar' ? 'criar' : op.operation;
  await db.runAsync('UPDATE fila_envio SET operacao = ?, dados = ?, feito_em = ? WHERE id = ?', operation, operation === 'excluir' ? null : JSON.stringify(merged), now, pending.id);
}

/**
 * Apaga tudo o que é da conta neste aparelho (dados, filas, busca, mercado guardado e os arquivos de fotos e áudios).
 * Usado ao sair da conta, para a próxima pessoa que entrar não ver nada da anterior.
 */
export async function wipeLocalData(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM usuario'); // apaga em cascata tudo que tem usuario_id
    await db.runAsync('DELETE FROM fila_envio');
    await db.runAsync('DELETE FROM fila_midia');
    await db.runAsync('DELETE FROM busca_indice');
    await db.runAsync('DELETE FROM mercado_cache');
    await db.runAsync('UPDATE estado_sync SET cursor = 0, ultima_sync_em = NULL, ultimo_erro = NULL WHERE id = 1');
  });
  try {
    const FileSystem = await import('expo-file-system/legacy');
    await FileSystem.deleteAsync(`${FileSystem.documentDirectory}media/`, { idempotent: true });
  } catch {
    // sem pasta de arquivos
  }
}
