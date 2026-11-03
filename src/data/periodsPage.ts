import { enqueue, getDb } from '../db';
import type { SubjectColor } from '../theme';

export interface PeriodRow {
  id: string;
  name: string;
  start: string;
  end: string | null;
  active: boolean;
  subjects: { id: string; name: string; color: SubjectColor }[];
  reportsOpen: number;
  reports: number;
  entries: number;
  notes: number;
  photos: number;
}

/** Todos os períodos do aparelho: o ativo primeiro, depois os anteriores (do mais novo ao mais antigo). */
export async function listPeriods(): Promise<PeriodRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; nome: string; data_inicio: string; data_fim: string | null; status: string }>('SELECT id, nome, data_inicio, data_fim, status FROM periodo ORDER BY (status = \'ativo\') DESC, data_inicio DESC');
  const out: PeriodRow[] = [];
  for (const p of rows) {
    const subjects = await db.getAllAsync<{ id: string; nome: string; cor: SubjectColor }>('SELECT id, nome, cor FROM materia WHERE periodo_id = ? ORDER BY nome', p.id);
    const n = async (sql: string) => (await db.getFirstAsync<{ n: number }>(sql, p.id))?.n ?? 0;
    out.push({
      id: p.id,
      name: p.nome,
      start: p.data_inicio,
      end: p.data_fim,
      active: p.status === 'ativo',
      subjects: subjects.map((s) => ({ id: s.id, name: s.nome, color: s.cor })),
      reportsOpen: await n("SELECT count(*) n FROM relatorio r JOIN materia m ON m.id = r.materia_id WHERE m.periodo_id = ? AND r.status = 'em_andamento'"),
      reports: await n('SELECT count(*) n FROM relatorio r JOIN materia m ON m.id = r.materia_id WHERE m.periodo_id = ?'),
      entries: await n('SELECT count(*) n FROM registro g JOIN relatorio r ON r.id = g.relatorio_id JOIN materia m ON m.id = r.materia_id WHERE m.periodo_id = ?'),
      notes: await n('SELECT count(*) n FROM anotacao a JOIN materia m ON m.id = a.materia_id WHERE m.periodo_id = ?'),
      photos: await n('SELECT count(*) n FROM foto f JOIN registro g ON g.id = f.registro_id JOIN relatorio r ON r.id = g.relatorio_id JOIN materia m ON m.id = r.materia_id WHERE m.periodo_id = ?'),
    });
  }
  return out;
}

export interface PeriodSummary {
  id: string;
  name: string;
  start: string;
  end: string | null;
  active: boolean;
  visits: number;
  reports: number;
  crops: { name: string; place: string | null; visits: number; reportId: string }[];
  photos: number;
  notes: number;
  subjects: number;
  pests: { name: string; level: string | null; times: number }[];
  products: { name: string; times: number }[];
  bySubject: { name: string; reports: number; visits: number; notes: number }[];
  weeks: { label: string; n: number }[];
  firstVisit: string | null;
  lastVisit: string | null;
}

const levelRank: Record<string, number> = { baixo: 1, medio: 2, alto: 3 };
const levelText: Record<string, string> = { baixo: 'baixo', medio: 'médio', alto: 'alto' };

/** Resumo calculado só dos dados que já estão no celular (somente leitura). */
export async function getPeriodSummary(id: string): Promise<PeriodSummary | null> {
  const db = await getDb();
  const p = await db.getFirstAsync<{ nome: string; data_inicio: string; data_fim: string | null; status: string }>('SELECT nome, data_inicio, data_fim, status FROM periodo WHERE id = ?', id);
  if (!p) return null;
  const one = async (sql: string) => (await db.getFirstAsync<{ n: number }>(sql, id))?.n ?? 0;
  const entries = await db.getAllAsync<{ data_hora: string; praga_nome: string | null; houve_praga: number; praga_nivel: string | null; aplicacao_produto: string | null; relatorio_id: string }>(
    `SELECT g.data_hora, g.praga_nome, g.houve_praga, g.praga_nivel, g.aplicacao_produto, g.relatorio_id FROM registro g
       JOIN relatorio r ON r.id = g.relatorio_id JOIN materia m ON m.id = r.materia_id WHERE m.periodo_id = ? AND g.status = 'concluido' ORDER BY g.data_hora`,
    id,
  );

  const crops = await db.getAllAsync<{ id: string; area_cultura: string | null; area_local: string | null; visitas: number }>(
    `SELECT r.id, r.area_cultura, r.area_local, (SELECT count(*) FROM registro g WHERE g.relatorio_id = r.id AND g.status = 'concluido') AS visitas
       FROM relatorio r JOIN materia m ON m.id = r.materia_id WHERE m.periodo_id = ? AND r.tipo = 'continuo' AND r.area_cultura IS NOT NULL ORDER BY visitas DESC`,
    id,
  );

  const pestMap = new Map<string, { level: string | null; times: number }>();
  const productMap = new Map<string, number>();
  for (const e of entries) {
    if (e.houve_praga && e.praga_nome) {
      const k = e.praga_nome.trim();
      const cur = pestMap.get(k) ?? { level: null, times: 0 };
      cur.times++;
      if (e.praga_nivel && (levelRank[e.praga_nivel] ?? 0) > (levelRank[cur.level ?? ''] ?? 0)) cur.level = e.praga_nivel;
      pestMap.set(k, cur);
    }
    if (e.aplicacao_produto) productMap.set(e.aplicacao_produto.trim(), (productMap.get(e.aplicacao_produto.trim()) ?? 0) + 1);
  }

  // semanas (segunda a domingo) com mais registros
  const weekMap = new Map<string, number>();
  for (const e of entries) {
    const d = new Date(e.data_hora);
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    const key = `${String(monday.getDate()).padStart(2, '0')}/${String(monday.getMonth() + 1).padStart(2, '0')}`;
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
  }
  const weeks = [...weekMap.entries()].map(([label, n]) => ({ label: `sem. ${label}`, n })).sort((a, b) => b.n - a.n).slice(0, 5);

  const bySubject = await db.getAllAsync<{ nome: string; relatorios: number; visitas: number; notas: number }>(
    `SELECT m.nome,
            (SELECT count(*) FROM relatorio r WHERE r.materia_id = m.id) AS relatorios,
            (SELECT count(*) FROM registro g JOIN relatorio r ON r.id = g.relatorio_id WHERE r.materia_id = m.id AND g.status = 'concluido') AS visitas,
            (SELECT count(*) FROM anotacao a WHERE a.materia_id = m.id) AS notas
       FROM materia m WHERE m.periodo_id = ? ORDER BY m.nome`,
    id,
  );

  const dm = (iso: string) => `${String(new Date(iso).getDate()).padStart(2, '0')}/${String(new Date(iso).getMonth() + 1).padStart(2, '0')}`;
  return {
    id,
    name: p.nome,
    start: p.data_inicio,
    end: p.data_fim,
    active: p.status === 'ativo',
    visits: entries.length,
    reports: await one('SELECT count(*) n FROM relatorio r JOIN materia m ON m.id = r.materia_id WHERE m.periodo_id = ?'),
    crops: crops.map((c) => ({ name: c.area_cultura!, place: c.area_local, visits: c.visitas, reportId: c.id })),
    photos: await one('SELECT count(*) n FROM foto f JOIN registro g ON g.id = f.registro_id JOIN relatorio r ON r.id = g.relatorio_id JOIN materia m ON m.id = r.materia_id WHERE m.periodo_id = ?'),
    notes: await one('SELECT count(*) n FROM anotacao a JOIN materia m ON m.id = a.materia_id WHERE m.periodo_id = ?'),
    subjects: bySubject.length,
    pests: [...pestMap.entries()].map(([name, v]) => ({ name, level: v.level ? levelText[v.level] : null, times: v.times })).sort((a, b) => b.times - a.times),
    products: [...productMap.entries()].map(([name, times]) => ({ name, times })).sort((a, b) => b.times - a.times),
    bySubject: bySubject.map((s) => ({ name: s.nome, reports: s.relatorios, visits: s.visitas, notes: s.notas })),
    weeks,
    firstVisit: entries.length ? dm(entries[0].data_hora) : null,
    lastVisit: entries.length ? dm(entries[entries.length - 1].data_hora) : null,
  };
}

/**
 * Encerra o período ativo sem criar outro (mesma regra do servidor): matérias desativadas, eventos futuros encerrados,
 * relatórios em andamento finalizados "por período". Vai para a fila como `close_period`.
 */
export async function closeActivePeriod(now = new Date()): Promise<void> {
  const db = await getDb();
  const active = await db.getFirstAsync<{ id: string }>("SELECT id FROM periodo WHERE status = 'ativo' LIMIT 1");
  if (!active) return;
  const nowIso = now.toISOString();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE periodo SET status = 'finalizado', finalizado_em = ? WHERE id = ?", nowIso, active.id);
    await db.runAsync("UPDATE relatorio SET status = 'finalizado', finalizado_por = 'periodo', finalizado_em = ? WHERE status = 'em_andamento' AND materia_id IN (SELECT id FROM materia WHERE periodo_id = ?)", nowIso, active.id);
    await db.runAsync('UPDATE evento SET encerrado_com_periodo = 1 WHERE data >= ? AND encerrado_com_periodo = 0 AND materia_id IN (SELECT id FROM materia WHERE periodo_id = ?)', today, active.id);
    await db.runAsync('UPDATE materia SET desativada = 1 WHERE periodo_id = ? AND desativada = 0', active.id);
    await enqueue(db, { entity: 'period', entityId: active.id, operation: 'encerrar_periodo' });
  });
}

const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "agosto a dezembro de 2026" / "desde agosto de 2026". */
export function dateRange(start: string, end: string | null): string {
  const s = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1);
  if (!end) return `desde ${monthNames[s.getMonth()]} de ${s.getFullYear()}`;
  const e = new Date(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, 1);
  return s.getFullYear() === e.getFullYear() ? `${monthNames[s.getMonth()]} a ${monthNames[e.getMonth()]} de ${e.getFullYear()}` : `${monthNames[s.getMonth()]} de ${s.getFullYear()} a ${monthNames[e.getMonth()]} de ${e.getFullYear()}`;
}
