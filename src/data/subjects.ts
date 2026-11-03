import { enqueue, getDb, newId } from '../db';
import type { SubjectColor } from '../theme';
import { daysUntil, localDate, whenText } from './today';

export type ClassType = 'sala' | 'campo' | 'sala_e_campo';

export const classTypeLabel: Record<ClassType, string> = { sala: 'aula em sala', campo: 'aula de campo', sala_e_campo: 'sala e campo' };
export const weekdayName = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// o banco local fala português, a API fala inglês
const apiClassType = { sala: 'classroom', campo: 'field', sala_e_campo: 'classroom_and_field' } as const;
const apiColor = { azul: 'blue', verde: 'green', terra: 'earth', roxo: 'purple', vermelho: 'red' } as const;

export interface SubjectItem {
  id: string;
  name: string;
  teacher: string | null;
  classType: ClassType;
  color: SubjectColor;
  weekdays: number[];
  nextDate: string | null;
}

export interface Teacher {
  id: string;
  name: string;
}

export async function getActivePeriodName(): Promise<{ id: string; name: string } | null> {
  const db = await getDb();
  const p = await db.getFirstAsync<{ id: string; nome: string }>("SELECT id, nome FROM periodo WHERE status = 'ativo' LIMIT 1");
  return p ? { id: p.id, name: p.nome } : null;
}

/** Matérias ativas do período ativo, com o professor, os dias da semana e a próxima data. */
export async function listSubjects(now = new Date()): Promise<SubjectItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; nome: string; tipo_aula: ClassType; cor: SubjectColor; prof: string | null; dias: string | null }>(
    `SELECT m.id, m.nome, m.tipo_aula, m.cor, p.nome AS prof,
            (SELECT group_concat(dia_semana) FROM (SELECT dia_semana FROM materia_dia WHERE materia_id = m.id ORDER BY dia_semana)) AS dias
       FROM materia m
       JOIN periodo pe ON pe.id = m.periodo_id AND pe.usuario_id = m.usuario_id AND pe.status = 'ativo'
       LEFT JOIN professor p ON p.id = m.professor_id AND p.usuario_id = m.usuario_id
      WHERE m.desativada = 0
      ORDER BY m.nome`,
  );
  const out: SubjectItem[] = [];
  for (const r of rows) {
    const next = await db.getFirstAsync<{ tipo: string; data: string }>(
      'SELECT tipo, data FROM evento WHERE materia_id = ? AND data >= ? AND concluido = 0 AND encerrado_com_periodo = 0 ORDER BY data LIMIT 1',
      r.id,
      localDate(now),
    );
    out.push({
      id: r.id,
      name: r.nome,
      teacher: r.prof,
      classType: r.tipo_aula,
      color: r.cor,
      weekdays: r.dias ? r.dias.split(',').map(Number) : [],
      nextDate: next ? `${next.tipo === 'prova' ? 'Prova' : next.tipo === 'entrega_relatorio' ? 'Entrega' : 'Evento'} ${whenText(daysUntil(next.data, now))}` : null,
    });
  }
  return out;
}

export async function listTeachers(): Promise<Teacher[]> {
  const db = await getDb();
  return (await db.getAllAsync<{ id: string; nome: string }>('SELECT id, nome FROM professor ORDER BY nome')).map((t) => ({ id: t.id, name: t.nome }));
}

export interface NewSubject {
  name: string;
  periodId: string;
  /** professor já cadastrado... */
  teacherId: string | null;
  /** ...ou o nome de um novo (criado junto, antes da matéria). */
  newTeacherName: string | null;
  classType: ClassType;
  weekdays: number[];
  color: SubjectColor;
  remindEve: boolean;
}

/** Grava a matéria (e o professor novo, se houver) no celular e na fila de envio, nesta ordem: professor, matéria. */
export async function createSubject(input: NewSubject): Promise<string> {
  const db = await getDb();
  const user = await db.getFirstAsync<{ id: string }>('SELECT id FROM usuario LIMIT 1');
  if (!user) throw new Error('Usuário local não encontrado. Sincronize e tente de novo.');
  const id = newId();
  await db.withTransactionAsync(async () => {
    let teacherId = input.teacherId;
    if (!teacherId && input.newTeacherName) {
      teacherId = newId();
      await db.runAsync("INSERT INTO professor (id, usuario_id, nome, sync_status) VALUES (?,?,?, 'pendente')", teacherId, user.id, input.newTeacherName);
      await enqueue(db, { entity: 'teacher', entityId: teacherId, operation: 'criar', data: { name: input.newTeacherName } });
    }
    await db.runAsync(
      "INSERT INTO materia (id, usuario_id, periodo_id, professor_id, nome, tipo_aula, cor, lembrar_vespera, sync_status) VALUES (?,?,?,?,?,?,?,?, 'pendente')",
      id,
      user.id,
      input.periodId,
      teacherId,
      input.name,
      input.classType,
      input.color,
      input.remindEve ? 1 : 0,
    );
    for (const d of input.weekdays) await db.runAsync('INSERT INTO materia_dia (materia_id, dia_semana) VALUES (?, ?)', id, d);
    await enqueue(db, {
      entity: 'subject',
      entityId: id,
      operation: 'criar',
      data: {
        period_id: input.periodId,
        name: input.name,
        class_type: apiClassType[input.classType],
        color: apiColor[input.color],
        weekdays: input.weekdays,
        remind_eve: input.remindEve,
        ...(teacherId ? { teacher_id: teacherId } : {}),
      },
    });
  });
  return id;
}

export interface SubjectDetail {
  id: string;
  name: string;
  periodId: string;
  teacherId: string | null;
  classType: ClassType;
  color: SubjectColor;
  weekdays: number[];
  remindEve: boolean;
}

export async function getSubject(id: string): Promise<SubjectDetail | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ id: string; nome: string; periodo_id: string; professor_id: string | null; tipo_aula: ClassType; cor: SubjectColor; lembrar_vespera: number }>('SELECT * FROM materia WHERE id = ?', id);
  if (!r) return null;
  const days = await db.getAllAsync<{ dia_semana: number }>('SELECT dia_semana FROM materia_dia WHERE materia_id = ? ORDER BY dia_semana', id);
  return { id: r.id, name: r.nome, periodId: r.periodo_id, teacherId: r.professor_id, classType: r.tipo_aula, color: r.cor, weekdays: days.map((d) => d.dia_semana), remindEve: r.lembrar_vespera === 1 };
}

/** Altera a matéria no celular e põe a alteração na fila (com a versão que o celular conhecia, para o servidor resolver conflitos). */
export async function updateSubject(id: string, input: Omit<NewSubject, 'periodId'>): Promise<void> {
  const db = await getDb();
  const user = await db.getFirstAsync<{ id: string }>('SELECT id FROM usuario LIMIT 1');
  const current = await db.getFirstAsync<{ versao: number }>('SELECT versao FROM materia WHERE id = ?', id);
  if (!user || !current) throw new Error('Matéria não encontrada no celular.');
  await db.withTransactionAsync(async () => {
    let teacherId = input.teacherId;
    if (!teacherId && input.newTeacherName) {
      teacherId = newId();
      await db.runAsync("INSERT INTO professor (id, usuario_id, nome, sync_status) VALUES (?,?,?, 'pendente')", teacherId, user.id, input.newTeacherName);
      await enqueue(db, { entity: 'teacher', entityId: teacherId, operation: 'criar', data: { name: input.newTeacherName } });
    }
    await db.runAsync(
      "UPDATE materia SET nome = ?, professor_id = ?, tipo_aula = ?, cor = ?, lembrar_vespera = ?, sync_status = 'pendente' WHERE id = ?",
      input.name,
      teacherId,
      input.classType,
      input.color,
      input.remindEve ? 1 : 0,
      id,
    );
    await db.runAsync('DELETE FROM materia_dia WHERE materia_id = ?', id);
    for (const d of input.weekdays) await db.runAsync('INSERT INTO materia_dia (materia_id, dia_semana) VALUES (?, ?)', id, d);
    await enqueue(db, {
      entity: 'subject',
      entityId: id,
      operation: 'alterar',
      baseVersion: current.versao,
      data: { name: input.name, class_type: apiClassType[input.classType], color: apiColor[input.color], weekdays: input.weekdays, remind_eve: input.remindEve, teacher_id: teacherId },
    });
  });
}
