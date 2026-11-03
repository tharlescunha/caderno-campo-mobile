import * as Notifications from 'expo-notifications';
import { getDb } from '../db';
import { localDate } from '../data/today';

/**
 * Lembretes agendados no próprio aparelho (não precisam de internet nem de servidor de push).
 * Tudo é refeito a partir do banco local: cancela os antigos e agenda os próximos.
 */
const MAX_PENDING = 60; // o iOS guarda no máximo 64 avisos agendados
const REMIND_HOUR = 8;
const EVE_HOUR = 18;

export type NotificationTarget = { type: 'event' | 'report' | 'subject'; id: string };

export function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export async function notificationsAllowed(): Promise<boolean> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Pede a permissão do sistema se ainda não foi pedida (ou se foi negada, devolve false). */
export async function ensureNotificationPermission(): Promise<'granted' | 'denied'> {
  if (await notificationsAllowed()) return 'granted';
  const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return r.granted || r.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ? 'granted' : 'denied';
}

interface Planned {
  id: string;
  at: Date;
  title: string;
  body: string;
  target: NotificationTarget;
}

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const at = (date: string, hour: number, minute = 0, minusDays = 0) => {
  const d = parse(date);
  d.setDate(d.getDate() - minusDays);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return localDate(d);
};

const offset = { no_dia: 0, '1_dia': 1, '3_dias': 3, '1_semana': 7 } as const;
const whenText = { no_dia: 'hoje', '1_dia': 'amanhã', '3_dias': 'em 3 dias', '1_semana': 'em 1 semana' } as const;
const kindText: Record<string, string> = { prova: 'Prova', trabalho: 'Trabalho', entrega_relatorio: 'Entrega do relatório', atividade: 'Atividade', evento_faculdade: 'Evento da faculdade', outro: 'Evento' };

async function plan(now = new Date()): Promise<Planned[]> {
  const db = await getDb();
  const out: Planned[] = [];
  const today = localDate(now);
  const prefs = await db.getFirstAsync<{ aviso_provas_entregas: number; aviso_vespera_campo: number; aviso_entrega_relatorio: number; lembrar_registro_pos_campo: number; hora_lembrete_pos_campo: string }>(
    'SELECT aviso_provas_entregas, aviso_vespera_campo, aviso_entrega_relatorio, lembrar_registro_pos_campo, hora_lembrete_pos_campo FROM usuario LIMIT 1',
  );
  if (!prefs) return [];

  // 1) lembretes de provas, trabalhos, entregas e eventos
  const events = await db.getAllAsync<{ id: string; tipo: string; titulo: string; data: string; lembrete: keyof typeof offset; relatorio_id: string | null; materia: string | null }>(
    `SELECT e.id, e.tipo, e.titulo, e.data, e.lembrete, e.relatorio_id, m.nome AS materia
       FROM evento e LEFT JOIN materia m ON m.id = e.materia_id AND m.usuario_id = e.usuario_id
      WHERE e.lembrete <> 'nenhum' AND e.concluido = 0 AND e.encerrado_com_periodo = 0 AND e.data >= ?`,
    today,
  );
  for (const e of events) {
    if (e.tipo === 'entrega_relatorio' ? !prefs.aviso_entrega_relatorio : ['prova', 'trabalho'].includes(e.tipo) && !prefs.aviso_provas_entregas) continue;
    const when = at(e.data, REMIND_HOUR, 0, offset[e.lembrete]);
    out.push({
      id: `evento-${e.id}`,
      at: when,
      title: `${kindText[e.tipo] ?? 'Evento'} ${whenText[e.lembrete]}`,
      body: `${e.titulo}${e.materia ? ` · ${e.materia}` : ''}`,
      target: e.relatorio_id ? { type: 'report', id: e.relatorio_id } : { type: 'event', id: e.id },
    });
  }

  // 2) véspera e depois da aula de campo
  const field = await db.getAllAsync<{ id: string; nome: string; lembrar_vespera: number; prof: string | null; dias: string | null }>(
    `SELECT m.id, m.nome, m.lembrar_vespera, p.nome AS prof, (SELECT group_concat(dia_semana) FROM materia_dia WHERE materia_id = m.id) AS dias
       FROM materia m
       JOIN periodo pe ON pe.id = m.periodo_id AND pe.usuario_id = m.usuario_id AND pe.status = 'ativo'
       LEFT JOIN professor p ON p.id = m.professor_id AND p.usuario_id = m.usuario_id
      WHERE m.desativada = 0 AND m.tipo_aula IN ('campo', 'sala_e_campo')`,
  );
  const recent = await db.getAllAsync<{ data_hora: string }>('SELECT data_hora FROM registro ORDER BY data_hora DESC LIMIT 40');
  const recordedToday = recent.some((r) => localDate(new Date(r.data_hora)) === today);
  const [hh, mm] = (prefs.hora_lembrete_pos_campo || '18:00').split(':').map(Number);
  for (let i = 0; i <= 14; i++) {
    const day = addDays(today, i);
    const weekday = parse(day).getDay() === 0 ? 7 : parse(day).getDay();
    for (const s of field) {
      if (!s.dias?.split(',').map(Number).includes(weekday)) continue;
      if (prefs.aviso_vespera_campo && s.lembrar_vespera && i >= 0) {
        out.push({ id: `vespera-${s.id}-${day}`, at: at(day, EVE_HOUR, 0, 1), title: 'Amanhã tem aula de campo', body: `${s.nome}${s.prof ? ` · ${s.prof}` : ''}`, target: { type: 'subject', id: s.id } });
      }
      if (prefs.lembrar_registro_pos_campo && i <= 7 && !(i === 0 && recordedToday)) {
        out.push({ id: `poscampo-${s.id}-${day}`, at: at(day, hh || 18, mm || 0), title: 'Registro da aula de campo', body: `Já registrou a visita de hoje? ${s.nome}`, target: { type: 'subject', id: s.id } });
      }
    }
  }

  return out.filter((p) => p.at.getTime() > now.getTime() + 5_000).sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_PENDING);
}

let running = false;

/** Cancela os lembretes agendados e agenda de novo os próximos. Sem permissão, não faz nada. */
export async function rescheduleReminders(): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    if (!(await notificationsAllowed())) return 0;
    const planned = await plan();
    const old = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of old) {
      if (/^(evento|vespera|poscampo)-/.test(n.identifier)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
    for (const p of planned) {
      await Notifications.scheduleNotificationAsync({
        identifier: p.id,
        content: { title: p.title, body: p.body, data: { target: p.target } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at },
      });
    }
    return planned.length;
  } catch {
    return 0;
  } finally {
    running = false;
  }
}

export async function pendingCount(): Promise<number> {
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}

/** Aviso de teste daqui a alguns segundos (tela de testes). */
export async function scheduleTest(seconds = 10) {
  await Notifications.scheduleNotificationAsync({
    identifier: 'teste',
    content: { title: 'Teste do Caderno de Campo', body: 'Os lembretes do aparelho estão funcionando.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}
