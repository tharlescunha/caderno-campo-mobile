import * as ImageManipulator from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getDb } from '../db';
import { activityLabel, cropLabel, irrigationLabel, type Activity, type CropCondition, type Irrigation, type PestLevel } from '../data/entries';
import { deliveryFormatLabel, type DeliveryFormat } from '../data/reports';
import { getTags } from '../data/tags';

// PDF de apoio com as informações do relatório e os registros de campo, com as fotos (modelo em "MODELO RELATORIO APP.pdf").
// Montado no próprio celular, a partir do banco local (funciona sem internet). Não é o relatório final da faculdade.
// O WebView do celular não repete cabeçalho nem numera páginas sozinho, então as páginas são montadas à mão:
// cada bloco tem a altura calculada e é colocado na página onde cabe.

const PAGE_W = 595;
const PAGE_H = 842;
const SIDE = 64;
const CONTENT_W = PAGE_W - SIDE * 2;
const TOP = 78; // onde começa o conteúdo (abaixo do cabeçalho corrente)
const BOTTOM = 64; // espaço do número da página
const CAPACITY = PAGE_H - TOP - BOTTOM - 18; // folga para o texto que quebrar mais do que o calculado

const esc = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');

const pad = (n: number) => String(n).padStart(2, '0');
const dateShort = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const timeShort = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dateLong = (d: Date) => `${pad(d.getDate())} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
const nf = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const words = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze'];
const countWord = (n: number) => words[n] ?? String(n);
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40) || 'relatorio';
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s: string) => s.split(' ').map(capitalize).join(' ');
const pestLevel: Record<PestLevel, string> = { baixo: 'baixa', medio: 'média', alto: 'alta' };

/** "Cultura da abóbora" / "Cultura do milho". */
const cultureTitle = (crop: string) => `Cultura ${/a$/i.test(crop.trim()) ? 'da' : 'do'} ${crop.trim().toLowerCase()}`;

interface Block {
  html: string;
  h: number;
}

const LINE = 17; // altura de uma linha de texto (11.5 pt, entrelinha 1,45)
const lines = (text: string, perLine: number) =>
  Math.max(
    1,
    text
      .split('\n')
      .reduce((sum, p) => sum + Math.max(1, Math.ceil(p.length / perLine)), 0),
  );

/** Reduz a foto para caber no PDF sem pesar (lado maior 900 px). Foto que não abre é ignorada. */
async function shrink(uri: string): Promise<{ src: string; w: number; h: number } | null> {
  try {
    const probe = await ImageManipulator.ImageManipulator.manipulate(uri).renderAsync();
    const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
    if (Math.max(probe.width, probe.height) > 900) ctx.resize(probe.width >= probe.height ? { width: 900 } : { height: 900 });
    const image = await ctx.renderAsync();
    const out = await image.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.62, base64: true });
    if (!out.base64) return null;
    return { src: `data:image/jpeg;base64,${out.base64}`, w: out.width, h: out.height };
  } catch {
    return null;
  }
}

interface Fig {
  src: string;
  w: number;
  h: number;
  caption: string;
}

async function photosOf(where: string, id: string, caption: (date: string) => string): Promise<Fig[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ arquivo: string; data: string }>(`SELECT arquivo, coalesce(tirada_em, criado_em) AS data FROM foto WHERE ${where} AND arquivo IS NOT NULL ORDER BY criado_em`, id);
  const out: Fig[] = [];
  for (const r of rows) {
    const s = await shrink(r.arquivo);
    if (s) out.push({ ...s, caption: caption(r.data) });
  }
  return out;
}

let figureNumber = 0;

/** Fotos centralizadas, até duas por linha, cada uma com a legenda "Figura n – ...". Cada linha de fotos é um bloco. */
function figureBlocks(figs: Fig[]): Block[] {
  const blocks: Block[] = [];
  for (let i = 0; i < figs.length; i += 2) {
    const row = figs.slice(i, i + 2);
    const maxW = row.length === 1 ? 215 : 215;
    const maxH = 250;
    const cells = row.map((f) => {
      const scale = Math.min(maxW / f.w, maxH / f.h);
      const w = Math.round(f.w * scale);
      const h = Math.round(f.h * scale);
      figureNumber += 1;
      return { w, h, html: `<div class="fig"><img src="${f.src}" style="width:${w}pt;height:${h}pt" /><div class="cap"><b>Figura ${figureNumber}</b> – ${esc(f.caption)}</div></div>`, height: h };
    });
    const h = Math.max(...cells.map((c) => c.height)) + 34;
    blocks.push({ html: `<div class="figrow">${cells.map((c) => c.html).join('')}</div>`, h });
  }
  return blocks;
}

/** Tabela de duas colunas (rótulo e valor), no estilo do modelo. */
function kvTable(rows: [string, string, boolean?][]): Block {
  let h = 4;
  const html = rows
    .map(([label, value, italic]) => {
      const plain = value.replace(/<[^>]+>/g, '');
      h += lines(plain, 54) * LINE + 11;
      return `<tr><th>${esc(label)}</th><td${italic ? ' class="it"' : ''}>${value}</td></tr>`;
    })
    .join('');
  return { html: `<table class="kv">${html}</table>`, h: h + 10 };
}

const heading = (text: string, level: 2 | 3) => (level === 2 ? `<h2>${esc(text)}</h2>` : `<h3>${esc(text)}</h3>`);
const headingH = (level: 2 | 3) => (level === 2 ? 44 : 34);

const css = `
  @page { margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Times, serif; color: #1c1c1c; font-size: 11.5pt; line-height: 1.45; }
  .page { position: relative; width: ${PAGE_W}pt; height: ${PAGE_H - 8}pt; overflow: hidden; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .run { position: absolute; left: ${SIDE}pt; right: ${SIDE}pt; top: 36pt; font-style: italic; font-size: 9pt; color: #666; border-bottom: 1pt solid #c9c9c9; padding-bottom: 6pt; }
  .num { position: absolute; left: 0; right: 0; bottom: 34pt; text-align: center; font-size: 10pt; color: #333; }
  .body { position: absolute; left: ${SIDE}pt; right: ${SIDE}pt; top: ${TOP}pt; }
  h2 { font-size: 15pt; color: #245a3d; margin: 0 0 8pt; padding-top: 14pt; line-height: 1.2; }
  h3 { font-size: 12.5pt; margin: 0 0 6pt; padding-top: 8pt; line-height: 1.2; }
  p.lead { margin: 0 0 12pt; text-align: justify; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; }
  table.kv { border-top: 1.5pt solid #1c1c1c; border-bottom: 1.5pt solid #1c1c1c; }
  table.kv th { text-align: left; width: 31%; font-weight: bold; padding: 5pt 8pt; vertical-align: top; border-bottom: 1pt solid #e1e1e1; }
  table.kv td { padding: 5pt 8pt; vertical-align: top; border-bottom: 1pt solid #e1e1e1; }
  table.kv tr:last-child th, table.kv tr:last-child td { border-bottom: 0; }
  td.it { font-style: italic; }
  table.syn { border-top: 1.5pt solid #1c1c1c; border-bottom: 1.5pt solid #1c1c1c; font-size: 10.5pt; }
  table.syn th { text-align: left; font-weight: bold; padding: 5pt 6pt; border-bottom: 1pt solid #1c1c1c; }
  table.syn td { padding: 5pt 6pt; border-bottom: 1pt solid #e1e1e1; vertical-align: top; }
  table.syn tr:last-child td { border-bottom: 0; }
  .tcap { text-align: center; font-size: 9pt; color: #666; margin: -2pt 0 6pt; }
  .figrow { display: flex; justify-content: center; gap: 22pt; margin: 4pt 0 8pt; }
  .fig { text-align: center; }
  .fig img { display: block; margin: 0 auto; }
  .cap { font-size: 9pt; color: #555; margin-top: 4pt; }
  .rule { position: absolute; left: ${SIDE}pt; right: ${SIDE}pt; border-top: 3pt solid #245a3d; }
  .rule.thin { border-top-width: 1pt; }
  .c { position: absolute; left: ${SIDE}pt; right: ${SIDE}pt; text-align: center; }
`;

/** Monta o PDF do relatório e abre a tela de compartilhar. Devolve `false` se o relatório não existe. */
export async function shareReportPdf(reportId: string): Promise<boolean> {
  const db = await getDb();
  const r = await db.getFirstAsync<any>(
    `SELECT r.*, m.nome AS materia, p.nome AS prof FROM relatorio r
       JOIN materia m ON m.id = r.materia_id AND m.usuario_id = r.usuario_id
       LEFT JOIN professor p ON p.id = m.professor_id AND p.usuario_id = m.usuario_id WHERE r.id = ?`,
    reportId,
  );
  if (!r) return false;
  figureNumber = 0;
  const tags = await getTags('relatorio', reportId);
  const entries = await db.getAllAsync<any>('SELECT * FROM registro WHERE relatorio_id = ? ORDER BY data_hora', reportId);
  const crop: string | null = r.area_cultura || null;
  const subtitle = crop ? cultureTitle(crop) : r.titulo;
  const runningHead = `Relatório de Acompanhamento de Campo · ${crop ? `Cultura ${/a$/i.test(crop.trim()) ? 'da' : 'do'} ${titleCase(crop.trim())}` : r.titulo}`;

  const blocks: Block[] = [];

  // ---- 1. Identificação
  const idRows: [string, string][] = [['Componente', esc(r.materia)]];
  if (r.prof) idRows.push(['Professor(a)', esc(r.prof)]);
  const areaLabel = r.area_local || (tags.length ? tags.map((t) => `#${t}`).join(' ') : '');
  if (areaLabel) idRows.push(['Área acompanhada', esc(areaLabel)]);
  if (crop) idRows.push(['Cultura', esc(capitalize(crop))]);
  if (r.area_comprimento_m && r.area_largura_m) idRows.push(['Tamanho', `${nf(r.area_comprimento_m)} × ${nf(r.area_largura_m)} m`]);
  if (r.area_m2) idRows.push(['Área', `${nf(r.area_m2)} m<sup>2</sup>`]);
  if (entries.length) {
    const first = dateShort(entries[0].data_hora);
    const last = dateShort(entries[entries.length - 1].data_hora);
    idRows.push(['Período de acompanhamento', `${first} a ${last}`]);
  }
  idRows.push(['Número de registros', String(entries.length)]);
  if (r.data_entrega) idRows.push(['Entrega', `${dateShort(r.data_entrega)}${r.formato_entrega ? ` (${deliveryFormatLabel[r.formato_entrega as DeliveryFormat] ?? r.formato_entrega})` : ''}`]);
  if (r.observacoes) idRows.push(['Orientações', esc(r.observacoes)]);
  const idTable = kvTable(idRows);
  blocks.push({ html: heading('1. Identificação da área acompanhada', 2) + idTable.html, h: headingH(2) + idTable.h });

  const areaFigs = r.tipo === 'continuo' ? await photosOf('relatorio_id = ?', reportId, () => 'Foto da área acompanhada.') : [];
  for (const b of figureBlocks(areaFigs)) blocks.push(b);

  // ---- 2. Síntese dos registros
  if (entries.length) {
    const sameDay = dateShort(entries[0].data_hora) === dateShort(entries[entries.length - 1].data_hora);
    const span = sameDay ? `em campo em ${dateShort(entries[0].data_hora)}` : `em campo entre ${dateShort(entries[0].data_hora)} e ${dateShort(entries[entries.length - 1].data_hora)}`;
    const lead = `A tabela a seguir reúne, em uma única visão, ${entries.length === 1 ? 'o registro realizado' : `os ${countWord(entries.length)} registros realizados`} ${span}. O detalhamento de cada visita está na seção 3.`;
    const synRows = entries.map((e) => {
      const acts = (JSON.parse(e.atividades) as Activity[]).map((a) => activityLabel[a] ?? a).join(', ');
      return {
        when: sameDay ? timeShort(e.data_hora) : `${dateShort(e.data_hora).slice(0, 5)} ${timeShort(e.data_hora)}`,
        acts: acts || '—',
        irr: e.irrigacao ? irrigationLabel[e.irrigacao as Irrigation] : '—',
        crop: e.cultura_estado ? cropLabel[e.cultura_estado as CropCondition] : '—',
        pest: e.houve_praga ? `${e.praga_nome}${e.praga_nivel ? ` (${pestLevel[e.praga_nivel as PestLevel]})` : ''}` : '—',
      };
    });
    const CHUNK = 14;
    for (let i = 0; i < synRows.length; i += CHUNK) {
      const part = synRows.slice(i, i + CHUNK);
      const first = i === 0;
      const last = i + CHUNK >= synRows.length;
      const head = `<tr><th>${sameDay ? 'Hora' : 'Data/hora'}</th><th>Atividade</th><th>Irrigação</th><th>Cultura</th><th>Praga (infestação)</th></tr>`;
      const body = part.map((x) => `<tr><td>${x.when}</td><td>${esc(x.acts)}</td><td>${esc(x.irr)}</td><td>${esc(x.crop)}</td><td>${esc(x.pest)}</td></tr>`).join('');
      const html =
        (first ? heading('2. Síntese dos registros', 2) + `<p class="lead">${esc(lead)}</p>` : '') +
        `<table class="syn">${head}${body}</table>` +
        (last ? `<div class="tcap">Tabela 1 – Registros de campo ${sameDay ? `de ${dateShort(entries[0].data_hora)}` : `de ${dateShort(entries[0].data_hora)} a ${dateShort(entries[entries.length - 1].data_hora)}`}.</div>` : '');
      const h = (first ? headingH(2) + lines(lead, 78) * LINE + 12 : 0) + 30 + part.length * 30 + (last ? 26 : 8);
      blocks.push({ html, h });
    }

    // ---- 3. Registros de campo
    let n = 0;
    for (const e of entries) {
      n += 1;
      const acts = (JSON.parse(e.atividades) as Activity[]).map((a) => activityLabel[a] ?? a);
      const rows: [string, string, boolean?][] = [['Situação', e.status === 'rascunho' ? 'Rascunho' : 'Concluído']];
      if (e.clima_temperatura_c != null || e.clima_descricao) {
        const w = [
          e.clima_temperatura_c != null ? `${Math.round(e.clima_temperatura_c)}°C` : null,
          e.clima_descricao,
          e.clima_umidade_pct != null ? `umidade ${e.clima_umidade_pct}%` : null,
          e.clima_vento_kmh != null ? `vento ${Math.round(e.clima_vento_kmh)} km/h` : null,
          e.clima_chuva_1h_mm != null ? `chuva ${nf(e.clima_chuva_1h_mm)} mm` : null,
        ].filter(Boolean);
        rows.push(['Clima', esc(w.join(' · '))]);
      }
      if (acts.length) rows.push(['O que foi feito', esc(acts.join(', '))]);
      if (e.aplicacao_produto || e.aplicacao_dose || e.aplicacao_alvo)
        rows.push(['Aplicação', esc([e.aplicacao_produto, e.aplicacao_dose ? `dose ${e.aplicacao_dose}` : null, e.aplicacao_alvo ? `alvo ${e.aplicacao_alvo}` : null].filter(Boolean).join(' · '))]);
      if (e.irrigacao) rows.push(['Irrigação', esc(irrigationLabel[e.irrigacao as Irrigation])]);
      const meas = [e.altura_plantas_cm != null ? `altura das plantas ${nf(e.altura_plantas_cm)} cm` : null, e.area_medida_m2 != null ? `área medida ${nf(e.area_medida_m2)} m²` : null].filter(Boolean);
      if (meas.length) rows.push(['Medidas', esc(meas.join(' · '))]);
      const cropRow = [e.cultura_estado ? cropLabel[e.cultura_estado as CropCondition] : null, e.estagio ? `estágio ${e.estagio}` : null].filter(Boolean);
      if (cropRow.length) rows.push(['Cultura', esc(cropRow.join(' · '))]);
      if (e.houve_praga) rows.push(['Praga', `${esc(e.praga_nome)}${e.praga_nivel ? ` (infestação ${pestLevel[e.praga_nivel as PestLevel]})` : ''}`]);
      if (e.observacoes) rows.push(['Observações', esc(e.observacoes)]);
      const audios = await db.getAllAsync<{ t: string | null }>('SELECT coalesce(transcricao_editada, transcricao) AS t FROM audio WHERE registro_id = ? ORDER BY criado_em', e.id);
      for (const a of audios) if (a.t) rows.push(['Áudio transcrito', esc(a.t), true]);
      const next = await db.getAllAsync<{ texto: string }>('SELECT texto FROM registro_pendencia WHERE registro_id = ? ORDER BY ordem', e.id);
      if (next.length) rows.push(['Para a próxima visita', esc(next.map((x) => x.texto).join('; '))]);
      const entryTags = await getTags('registro', e.id);
      if (entryTags.length) rows.push(['Tags', esc(entryTags.map((t) => `#${t}`).join(' '))]);

      const table = kvTable(rows);
      const title = `3.${n} Registro ${n} – ${dateShort(e.data_hora)}, ${timeShort(e.data_hora)}`;
      const sectionHead = n === 1 ? heading('3. Registros de campo', 2) : '';
      blocks.push({ html: sectionHead + heading(title, 3) + table.html, h: (n === 1 ? headingH(2) : 0) + headingH(3) + table.h });
      const figs = await photosOf('registro_id = ?', e.id, () => `Foto do registro das ${timeShort(e.data_hora)}.`);
      for (const b of figureBlocks(figs)) blocks.push(b);
    }
  }

  // ---- páginas: cada bloco vai para a primeira página onde ainda cabe
  const pages: Block[][] = [[]];
  let used = 0;
  for (const b of blocks) {
    if (used + b.h > CAPACITY && pages[pages.length - 1].length) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(b);
    used += b.h;
  }

  const today = new Date();
  const cover = `<div class="page">
    <div class="rule" style="top:112pt"></div><div class="rule thin" style="top:120pt"></div>
    <div class="c" style="top:152pt;font-size:11.5pt;letter-spacing:.3pt">${esc(r.materia.toUpperCase())}</div>
    <div class="c" style="top:312pt;font-size:27pt;font-weight:bold;line-height:1.2">RELATÓRIO DE<br>ACOMPANHAMENTO DE CAMPO</div>
    <div class="c" style="top:432pt;font-size:16pt;font-style:italic;color:#245a3d">${esc(subtitle)}</div>
    <div class="c" style="top:552pt;font-size:11.5pt;line-height:1.9">${r.prof ? `Professor(a): ${esc(r.prof)}<br>` : ''}${areaLabel ? `Área acompanhada: ${esc(areaLabel)}` : ''}</div>
    <div class="rule thin" style="top:728pt;border-color:#245a3d"></div>
    <div class="c" style="top:744pt;font-size:11pt">${dateLong(today)}</div>
  </div>`;
  const body = pages
    .map(
      (p, i) =>
        `<div class="page"><div class="run">${esc(runningHead)}</div><div class="body">${p.map((b) => b.html).join('')}</div><div class="num">${i + 2}</div></div>`,
    )
    .join('');

  const html = `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${cover}${body}</body></html>`;
  const file = await Print.printToFileAsync({ html, width: PAGE_W, height: PAGE_H });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não consegue compartilhar arquivos.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Relatório: ${slug(r.titulo)}` });
  return true;
}
