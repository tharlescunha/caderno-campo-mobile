import NetInfo from '@react-native-community/netinfo';
import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { API_URL, authHeader } from '../api/client';
import { getDb } from '../db';
import { backoffMs } from './push';

interface MediaRow {
  id: string;
  tipo: 'foto' | 'anexo' | 'audio';
  entidade: string;
  entidade_id: string;
  arquivo_local: string;
  tentativas: number;
}

export interface MediaResult {
  sent: number;
  failed: number;
  /** Havia arquivos esperando, mas só se envia no Wi-Fi (ou o registro ainda não chegou ao servidor). */
  waiting: number;
}

let running: Promise<MediaResult> | null = null;

/** Envia fotos e áudios da fila, um por vez, depois que o item a que pertencem já foi enviado. Só no Wi-Fi por padrão. */
export function pushMedia(options: { anyNetwork?: boolean } = {}): Promise<MediaResult> {
  running ??= run(options).finally(() => {
    running = null;
  });
  return running;
}

async function run({ anyNetwork }: { anyNetwork?: boolean }): Promise<MediaResult> {
  const db = await getDb();
  const result: MediaResult = { sent: 0, failed: 0, waiting: 0 };
  const net = await NetInfo.fetch();
  if (net.isConnected === false) return result;
  const onWifi = net.type === 'wifi' || net.type === 'ethernet';
  const user = await db.getFirstAsync<{ enviar_fotos_so_wifi: number }>('SELECT enviar_fotos_so_wifi FROM usuario LIMIT 1');
  const wifiOnly = (user?.enviar_fotos_so_wifi ?? 1) === 1 && !anyNetwork;

  for (;;) {
    const row = await db.getFirstAsync<MediaRow>(
      `SELECT id, tipo, entidade, entidade_id, arquivo_local, tentativas FROM fila_midia
        WHERE status = 'pendente' AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= ?) ORDER BY criado_em, rowid LIMIT 1 OFFSET ?`,
      new Date().toISOString(),
      result.waiting,
    );
    if (!row) break;
    if (wifiOnly && !onWifi) {
      result.waiting++;
      continue;
    }
    // o registro (ou evento) dono do arquivo precisa já existir no servidor
    const parent = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM fila_envio WHERE entidade_id = ?', row.entidade_id);
    if (parent?.n) {
      result.waiting++;
      continue;
    }
    try {
      await upload(row);
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM fila_midia WHERE id = ?', row.id);
        if (row.tipo === 'foto') await db.runAsync("UPDATE foto SET sync_status = 'sincronizado' WHERE id = ?", row.id);
        if (row.tipo === 'audio') await db.runAsync("UPDATE audio SET sync_status = 'sincronizado' WHERE id = ?", row.id);
      });
      result.sent++;
    } catch (e) {
      await db.runAsync("UPDATE fila_midia SET tentativas = tentativas + 1, proxima_tentativa_em = ? WHERE id = ?", new Date(Date.now() + backoffMs(row.tentativas + 1)).toISOString(), row.id);
      result.failed++;
      if (e instanceof Error && /Network|offline|connect/i.test(e.message)) break;
    }
  }
  return result;
}

async function upload(row: MediaRow) {
  const db = await getDb();
  const form = new FormData();
  const apiEntity: Record<string, string> = { registro: 'entry', evento: 'event', relatorio_area: 'report_area' };
  form.append('entity', row.tipo === 'audio' ? (row.entidade === 'anotacao' ? 'note_audio' : 'entry_audio') : row.tipo === 'anexo' ? 'note' : (apiEntity[row.entidade] ?? 'entry'));
  form.append('entity_id', row.entidade_id);
  if (row.tipo === 'anexo') {
    form.append('attachment_id', row.id);
  } else if (row.tipo === 'foto') {
    const f = await db.getFirstAsync<{ tirada_em: string | null; latitude: number | null; longitude: number | null }>('SELECT tirada_em, latitude, longitude FROM foto WHERE id = ?', row.id);
    form.append('photo_id', row.id);
    if (f?.tirada_em) form.append('taken_at', f.tirada_em);
    if (f?.latitude != null && f?.longitude != null) {
      form.append('latitude', String(f.latitude));
      form.append('longitude', String(f.longitude));
    }
  } else {
    const a = await db.getFirstAsync<{ duracao_s: number; gravado_em: string }>('SELECT duracao_s, gravado_em FROM audio WHERE id = ?', row.id);
    form.append('audio_id', row.id);
    if (a) {
      form.append('duration_s', String(a.duracao_s));
      form.append('recorded_at', a.gravado_em);
    }
  }
  const file = new File(row.arquivo_local);
  if (!file.exists) throw new Error('Arquivo não encontrado no aparelho.');
  form.append('file', file);
  const res = await fetch(`${API_URL}/sync/media`, { method: 'POST', headers: await authHeader(), body: form });
  if (!res.ok && res.status !== 200) {
    const text = await res.text().catch(() => '');
    throw new Error(`Envio recusado (${res.status}) ${text.slice(0, 120)}`);
  }
}
