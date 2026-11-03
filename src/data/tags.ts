import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb, newId } from '../db';

export type TagOwner = 'relatorio' | 'registro' | 'anotacao';

const table = { relatorio: 'relatorio_tag', registro: 'registro_tag', anotacao: 'anotacao_tag' } as const;
const column = { relatorio: 'relatorio_id', registro: 'registro_id', anotacao: 'anotacao_id' } as const;

/** Limpa o que foi digitado: sem espaços sobrando, até 60 letras, sem repetir (maiúsculas e acentos não contam). */
export function cleanTags(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/^#/, '').replace(/\s+/g, ' ').slice(0, 60);
    const key = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length === 20) break;
  }
  return out;
}

/** Troca as tags de um item pelas informadas (cria as que ainda não existem). Chame dentro de uma transação. */
export async function setTags(db: Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync'>, userId: string, owner: TagOwner, ownerId: string, names: string[]) {
  await db.runAsync(`DELETE FROM ${table[owner]} WHERE ${column[owner]} = ?`, ownerId);
  for (const name of cleanTags(names)) {
    // a tag é única por usuário, sem diferenciar maiúsculas (o servidor também junta "Milho" e "milho")
    let tag = await db.getFirstAsync<{ id: string }>('SELECT id FROM tag WHERE usuario_id = ? AND lower(nome) = lower(?)', userId, name);
    if (!tag) {
      const id = newId();
      await db.runAsync('INSERT INTO tag (id, usuario_id, nome) VALUES (?,?,?)', id, userId, name);
      tag = { id };
    }
    await db.runAsync(`INSERT OR IGNORE INTO ${table[owner]} (usuario_id, ${column[owner]}, tag_id) VALUES (?,?,?)`, userId, ownerId, tag.id);
  }
}

export async function getTags(owner: TagOwner, ownerId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ nome: string }>(`SELECT t.nome FROM ${table[owner]} x JOIN tag t ON t.id = x.tag_id WHERE x.${column[owner]} = ? ORDER BY t.nome`, ownerId);
  return rows.map((r) => r.nome);
}

/** Tags já usadas, as mais usadas primeiro (para sugerir ao digitar). */
export async function suggestTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ nome: string }>(
    `SELECT t.nome, (SELECT count(*) FROM relatorio_tag a WHERE a.tag_id = t.id) + (SELECT count(*) FROM registro_tag b WHERE b.tag_id = t.id) + (SELECT count(*) FROM anotacao_tag c WHERE c.tag_id = t.id) AS usos
       FROM tag t ORDER BY usos DESC, t.nome LIMIT 30`,
  );
  return rows.map((r) => r.nome);
}

/** Sql que devolve as tags de um item como "a|b|c" (para listas). */
export const tagsSql = (owner: TagOwner, idExpr: string) =>
  `(SELECT group_concat(t.nome, '|') FROM ${table[owner]} x JOIN tag t ON t.id = x.tag_id WHERE x.${column[owner]} = ${idExpr})`;

export const splitTags = (s: string | null | undefined) => (s ? s.split('|') : []);
