import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../src/api/client';
import { Icon } from '../src/components/Icon';
import { AudioClip, PhotoField, PhotoThumb, RecordButton, RecordedList, RecordingBanner, useAudioRecording } from '../src/components/media';
import { TagField } from '../src/components/TagField';
import { Card, Text } from '../src/components/ui';
import { removeFile, type StoredAudio, type StoredPhoto } from '../src/media/storage';
import {
  activityLabel, createEntry, cropLabel, deleteEntry, getEntryEdit, getReportDetail, irrigationLabel, listEntryMedia, listOpenTodos, pestLabel, updateEntry,
  type Activity, type CropCondition, type EntryAudio, type EntryPhoto, type Irrigation, type OpenTodo, type PestLevel, type ReportDetail,
} from '../src/data/entries';
import { SavedAudio } from '../src/components/SavedAudio';
import { listReports, type ReportItem } from '../src/data/reports';
import { useSync } from '../src/sync';
import { fonts, tones, useTheme } from '../src/theme';

// Tela "Novo registro" (design/NovoRegistro.dc.html): uma visita ao campo dentro de um relatório.
const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n >= 0 ? n : null;
};
const weekday = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

interface WeatherPreview {
  temperature_c: number | null;
  humidity_pct: number | null;
  wind_kmh: number | null;
  rain_1h_mm: number | null;
  description: string | null;
}

export default function NovoRegistro() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reportId: reportParam, id } = useLocalSearchParams<{ reportId: string; id?: string }>();
  const editing = Boolean(id);
  const { syncNow } = useSync();
  const [reportId, setReportId] = useState(reportParam);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [entryDraft, setEntryDraft] = useState(true);
  const [savedPhotos, setSavedPhotos] = useState<EntryPhoto[]>([]);
  const [savedAudios, setSavedAudios] = useState<EntryAudio[]>([]);
  const [openTodos, setOpenTodos] = useState<OpenTodo[]>([]);
  const [done, setDone] = useState<string[]>([]);
  const [when, setWhen] = useState(new Date());
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locState, setLocState] = useState<'buscando' | 'ok' | 'sem'>('buscando');
  const [weather, setWeather] = useState<WeatherPreview | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [product, setProduct] = useState('');
  const [dose, setDose] = useState('');
  const [target, setTarget] = useState('');
  const [irrigation, setIrrigation] = useState<Irrigation | null>(null);
  const [height, setHeight] = useState('');
  const [areaM2, setAreaM2] = useState('');
  const [crop, setCrop] = useState<CropCondition | null>(null);
  const [stage, setStage] = useState('');
  const [pest, setPest] = useState(false);
  const [pestName, setPestName] = useState('');
  const [pestLevel, setPestLevel] = useState<PestLevel | null>(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [audios, setAudios] = useState<(StoredAudio & { durationS: number })[]>([]);
  const [next, setNext] = useState<string[]>([]);
  const [nextText, setNextText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const rec = useAudioRecording(audios, setAudios);

  useEffect(() => {
    void listReports('andamento').then(setReports);
  }, []);

  useEffect(() => {
    void getReportDetail(reportId).then(setReport);
    void listOpenTodos(reportId).then(setOpenTodos);
    setDone([]);
  }, [reportId]);

  // Local do aparelho: só usa se a permissão já foi dada (o pedido acontece no Primeiro acesso).
  useEffect(() => {
    if (id) return; // ao editar, o local e o clima do registro não mudam
    void (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return setLocState('sem');
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocState('ok');
        // prévia do clima do local (o servidor busca e guarda o clima de verdade ao salvar)
        const w = await Promise.race([
          api<WeatherPreview>('GET', `/weather?lat=${pos.coords.latitude.toFixed(4)}&lon=${pos.coords.longitude.toFixed(4)}`),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('tempo')), 8000)),
        ]);
        setWeather(w);
      } catch {
        setLocState((s) => (s === 'buscando' ? 'sem' : s));
      }
    })();
  }, [id]);

  // editar: preenche a tela com o registro
  useEffect(() => {
    if (!id) return;
    void (async () => {
      const e = await getEntryEdit(id);
      if (!e) return;
      setWhen(e.recordedAt);
      setEntryDraft(e.draft);
      setActivities(e.activities);
      setProduct(e.application.product);
      setDose(e.application.dose);
      setTarget(e.application.target);
      setIrrigation(e.irrigation);
      setHeight(e.plantHeightCm != null ? String(e.plantHeightCm) : '');
      setAreaM2(e.measuredAreaM2 != null ? String(e.measuredAreaM2) : '');
      setCrop(e.cropCondition);
      setStage(e.stage);
      setPest(e.pest.found);
      setPestName(e.pest.name);
      setPestLevel(e.pest.level);
      setNotes(e.notes);
      setTags(e.tags);
      setNext(e.nextVisit.map((n) => n.text));
      const m = await listEntryMedia(id);
      setSavedPhotos(m.photos);
      setSavedAudios(m.audios);
    })();
  }, [id]);

  const reloadMedia = async () => {
    if (!id) return;
    const m = await listEntryMedia(id);
    setSavedAudios(m.audios);
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async (draft: boolean) => {
    const e: Record<string, string> = {};
    if (pest && !pestName.trim()) e.pest = 'Informe qual praga foi encontrada.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const common = {
        recordedAt: when,
        draft,
        activities,
        application: { product: product.trim(), dose: dose.trim(), target: target.trim() },
        irrigation,
        plantHeightCm: num(height),
        measuredAreaM2: num(areaM2),
        cropCondition: crop,
        stage,
        pest: { found: pest, name: pestName, level: pestLevel },
        notes,
        tags,
        nextVisit: next,
        photos,
        audios,
      };
      if (id) await updateEntry(id, common);
      else await createEntry({ ...common, reportId, location, todosDone: done });
      void syncNow();
      router.back();
    } catch (err) {
      Alert.alert('Não foi possível salvar', err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  const cancel = () => {
    photos.forEach((p) => removeFile(p.uri));
    audios.forEach((a) => removeFile(a.uri));
    router.back();
  };

  const sel = (on: boolean, small = false) => ({
    minHeight: small ? 36 : 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: on ? '#0B5D3B' : colors.line,
    backgroundColor: on ? '#0B5D3B' : colors.card,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  });
  const label = (t: string) => (
    <Text weight="bold" style={{ fontSize: 13, color: colors.muted }}>
      {t}
    </Text>
  );
  const chips = <T extends string>(options: Record<T, string>, value: T | null, onPick: (v: T | null) => void) => (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {(Object.keys(options) as T[]).map((k) => (
        <Pressable key={k} onPress={() => onPick(value === k ? null : k)} style={sel(value === k)}>
          <Text weight="extrabold" style={{ fontSize: 14, color: value === k ? '#fff' : colors.text }}>
            {options[k]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  const input = { minHeight: 48, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line, paddingHorizontal: 14, fontFamily: fonts.medium, fontSize: 15, color: colors.text } as const;
  const addNext = () => {
    if (!nextText.trim() || next.length >= 10) return;
    setNext([...next, nextText.trim()]);
    setNextText('');
  };
  const lastVisit = openTodos[0]?.fromDate;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Barra: cancelar e título */}
      <View style={{ paddingHorizontal: 16, paddingTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={cancel} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, width: 96 }}>
          <Icon name="x" size={18} color={colors.muted} />
          <Text weight="bold" muted style={{ fontSize: 15 }}>
            Cancelar
          </Text>
        </Pressable>
        <Text weight="extrabold" style={{ fontSize: 16 }}>
          {editing ? 'Editar registro' : 'Novo registro'}
        </Text>
        <View style={{ width: 96 }} />
      </View>

      <ScrollView style={{ flex: 1 }} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: insets.bottom + 150, gap: 20 }} keyboardShouldPersistTaps="handled">
        {/* Adicionar ao relatório */}
        <View style={{ gap: 8 }}>
          {label('Adicionar ao relatório')}
          {editing ? (
            <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 14, gap: 2 }}>
              <Text weight="extrabold" style={{ fontSize: 15 }}>
                {report?.title}
              </Text>
              <Text weight="semibold" muted style={{ fontSize: 12 }}>
                {report?.subjectName}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {(reports.length ? reports : report ? [{ id: report.id, title: report.title, subjectName: report.subjectName, entries: report.entryCount } as ReportItem] : []).map((r) => {
                const on = r.id === reportId;
                return (
                  <Pressable key={r.id} onPress={() => setReportId(r.id)} style={{ minHeight: 56, borderRadius: 20, borderWidth: 2, borderColor: on ? '#0B5D3B' : colors.line, backgroundColor: on ? '#0B5D3B' : colors.card, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text weight="extrabold" style={{ fontSize: 15, color: on ? '#fff' : colors.text }} numberOfLines={1}>
                        {r.title}
                      </Text>
                      <Text weight="semibold" style={{ fontSize: 12, color: on ? 'rgba(255,255,255,0.8)' : colors.muted }}>
                        {r.subjectName} · {r.entries} {r.entries === 1 ? 'registro' : 'registros'}
                      </Text>
                    </View>
                    {on ? <Icon name="check" size={18} color="#fff" /> : null}
                  </Pressable>
                );
              })}
              <Pressable onPress={() => router.push('/novo-relatorio')} style={{ minHeight: 44, borderRadius: 999, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icon name="plus" size={16} color={colors.text} />
                <Text weight="extrabold" style={{ fontSize: 14 }}>
                  Começar novo relatório
                </Text>
              </Pressable>
              <Text weight="semibold" muted style={{ fontSize: 12 }}>
                Cada visita vira um registro novo dentro do mesmo relatório.
              </Text>
            </View>
          )}
        </View>

        {/* Da última visita */}
        {!editing && openTodos.length ? (
          <View style={{ backgroundColor: tones.amber.bg, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, gap: 4 }}>
            <Text weight="extrabold" style={{ fontSize: 14, color: '#5E4100' }}>
              Da última visita{lastVisit ? ` · ${weekday[new Date(lastVisit).getDay()]}, ${dm(lastVisit)}` : ''}
            </Text>
            {openTodos.map((t) => {
              const on = done.includes(t.id);
              return (
                <Pressable key={t.id} onPress={() => setDone(toggle(done, t.id))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: '#7A5300', backgroundColor: on ? '#7A5300' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Icon name="check" size={14} color="#fff" /> : null}
                  </View>
                  <Text weight="semibold" style={{ flex: 1, fontSize: 15, lineHeight: 21, color: '#3D2B00', textDecorationLine: on ? 'line-through' : 'none' }}>
                    {t.text}
                  </Text>
                </Pressable>
              );
            })}
            <Text weight="semibold" style={{ fontSize: 12, color: '#7A5300' }}>
              Marque o que fez nesta visita.
            </Text>
          </View>
        ) : null}

        {/* Data e hora, local */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, gap: 6, alignItems: 'flex-start' }}>
            {label('Data e hora')}
            <DateTimePicker value={when} mode="datetime" display="compact" onChange={(_, d) => d && setWhen(d)} locale="pt-BR" />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            {label('Local')}
            <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="pin" size={16} color={colors.muted} />
              <Text weight="bold" style={{ fontSize: 14, flexShrink: 1 }}>
                {editing ? 'Local do registro' : locState === 'buscando' ? 'Buscando...' : locState === 'ok' ? 'Localização obtida' : 'Sem localização'}
              </Text>
            </View>
          </View>
        </View>

        {/* Clima pela localização */}
        {!editing ? (
          <View style={{ backgroundColor: tones.blue.bg, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="pin" size={18} color={tones.blue.fg} />
                <Text weight="extrabold" style={{ fontSize: 14, color: tones.blue.fg }}>
                  Clima pela sua localização
                </Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 }}>
                <Text weight="extrabold" style={{ fontSize: 12, color: tones.blue.fg }}>
                  {location ? 'Automático' : 'Indisponível'}
                </Text>
              </View>
            </View>
            {weather && weather.temperature_c != null ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { r: 'Temp.', v: `${Math.round(weather.temperature_c)}°` },
                  { r: 'Umidade', v: weather.humidity_pct != null ? `${Math.round(weather.humidity_pct)}%` : '—' },
                  { r: 'Vento', v: weather.wind_kmh != null ? `${Math.round(weather.wind_kmh)} km/h` : '—' },
                  { r: 'Chuva 1h', v: weather.rain_1h_mm != null ? `${weather.rain_1h_mm} mm` : '—' },
                ].map((m) => (
                  <View key={m.r} style={{ flex: 1 }}>
                    <Text weight="semibold" muted style={{ fontSize: 11 }}>
                      {m.r}
                    </Text>
                    <Text weight="extrabold" style={{ fontSize: 17 }}>
                      {m.v}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text weight="semibold" style={{ fontSize: 13, lineHeight: 19, color: '#2F5D78' }}>
              {location
                ? `${weather?.description ? weather.description[0].toUpperCase() + weather.description.slice(1) + '. ' : ''}Buscado pelo GPS do celular e salvo junto com o registro, no horário em que você o criou.`
                : 'Sem a localização do celular o clima não é buscado. Você pode liberar a permissão nas configurações do celular.'}
            </Text>
          </View>
        ) : null}

        {/* O que foi feito */}
        <View style={{ gap: 8 }}>
          {label('O que foi feito')}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(activityLabel) as Activity[]).map((a) => {
              const on = activities.includes(a);
              return (
                <Pressable key={a} onPress={() => setActivities(toggle(activities, a))} accessibilityState={{ selected: on }} style={sel(on)}>
                  {on ? <Icon name="check" size={16} color="#fff" /> : null}
                  <Text weight="extrabold" style={{ fontSize: 14, color: on ? '#fff' : colors.text }}>
                    {activityLabel[a]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {activities.includes('aplicacao') ? (
          <Card style={{ gap: 12 }}>
            <Text weight="extrabold" style={{ fontSize: 17 }}>
              Aplicação
            </Text>
            <View style={{ gap: 6 }}>
              {label('Produto')}
              <TextInput value={product} onChangeText={setProduct} placeholder="Nome do produto ou calda" placeholderTextColor={colors.muted} style={input} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                {label('Dose')}
                <TextInput value={dose} onChangeText={setDose} placeholder="ex.: 200 mL/ha" placeholderTextColor={colors.muted} style={input} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                {label('Alvo')}
                <TextInput value={target} onChangeText={setTarget} placeholder="praga ou doença" placeholderTextColor={colors.muted} style={input} />
              </View>
            </View>
          </Card>
        ) : null}

        {/* Irrigação */}
        <View style={{ gap: 8 }}>
          {label('Irrigação')}
          {chips(irrigationLabel, irrigation, setIrrigation)}
        </View>

        {/* Medidas */}
        <View style={{ gap: 8 }}>
          {label('Medidas (opcional)')}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TextInput value={height} onChangeText={setHeight} placeholder="Altura das plantas (cm)" placeholderTextColor={colors.muted} keyboardType="decimal-pad" accessibilityLabel="Altura das plantas em centímetros" style={[input, { flex: 1 }]} />
            <TextInput value={areaM2} onChangeText={setAreaM2} placeholder="Área medida (m²)" placeholderTextColor={colors.muted} keyboardType="decimal-pad" accessibilityLabel="Área medida em metros quadrados" style={[input, { flex: 1 }]} />
          </View>
        </View>

        {/* Cultura */}
        <View style={{ gap: 8 }}>
          {label('Como está a cultura')}
          {chips(cropLabel, crop, setCrop)}
          <View style={{ gap: 6, marginTop: 4 }}>
            {label('Estágio de desenvolvimento')}
            <TextInput value={stage} onChangeText={setStage} placeholder="ex.: V6, florescimento" placeholderTextColor={colors.muted} style={input} />
          </View>
        </View>

        {/* Praga */}
        <Card style={{ gap: 12, paddingVertical: 16, paddingHorizontal: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Icon name="warn" size={18} color={colors.danger} />
              <Text weight="extrabold" style={{ fontSize: 16, flexShrink: 1 }}>
                Houve ataque de praga?
              </Text>
            </View>
            <View style={{ flexDirection: 'row', backgroundColor: colors.chipBg, borderRadius: 999, padding: 3 }}>
              {[true, false].map((v) => (
                <Pressable key={String(v)} onPress={() => setPest(v)} style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', backgroundColor: pest === v ? '#0B5D3B' : 'transparent' }}>
                  <Text weight="extrabold" style={{ fontSize: 14, color: pest === v ? '#fff' : colors.text }}>
                    {v ? 'Sim' : 'Não'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {pest ? (
            <View style={{ gap: 12 }}>
              <View style={{ gap: 6 }}>
                {label('Praga ou doença')}
                <TextInput value={pestName} onChangeText={setPestName} placeholder="ex.: lagarta-do-cartucho" placeholderTextColor={colors.muted} style={[input, errors.pest ? { borderColor: colors.danger } : null]} />
                {errors.pest ? (
                  <Text weight="semibold" style={{ fontSize: 12, color: colors.danger }}>
                    {errors.pest}
                  </Text>
                ) : null}
              </View>
              <View style={{ gap: 8 }}>
                {label('Nível de infestação')}
                {chips(pestLabel, pestLevel, setPestLevel)}
              </View>
            </View>
          ) : null}
        </Card>

        {/* Fotos */}
        {savedPhotos.length ? (
          <View style={{ gap: 8 }}>
            {label('Fotos deste registro')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {savedPhotos.map((p) => (
                <PhotoThumb key={p.id} uri={p.uri} size={96} radius={18} />
              ))}
            </View>
          </View>
        ) : null}
        <PhotoField photos={photos} onChange={setPhotos} />

        {/* Observações, com o botão de gravar áudio ao lado */}
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {label('Observações')}
            <RecordButton rec={rec} />
          </View>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="Descreva o que aconteceu, o que observou e o que ficou pendente. Ou grave um áudio."
            placeholderTextColor={colors.muted}
            accessibilityLabel="Observações"
            style={{ minHeight: 100, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line, padding: 12, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.text }}
          />
        </View>

        {/* Áudios */}
        {rec.recording || audios.length || savedAudios.length ? (
          <View style={{ gap: 8 }}>
            {label(`Áudios (${audios.length + savedAudios.length})`)}
            <RecordingBanner rec={rec} />
            <RecordedList audios={audios} onChange={setAudios} />
            {savedAudios.map((a) => (
              <SavedAudio key={a.id} audio={a} onUseText={(text) => setNotes((n) => (n ? `${n}\n${text}` : text))} onChanged={reloadMedia} />
            ))}
            <Text weight="semibold" muted style={{ fontSize: 12, lineHeight: 18 }}>
              Sem internet, o áudio fica no celular, sobe sozinho quando conectar e o servidor faz a transcrição. A transcrição é uma sugestão e não muda o que você digitou.
            </Text>
          </View>
        ) : null}

        {/* Para a próxima visita */}
        <View style={{ gap: 8 }}>
          {label('Para a próxima visita (opcional)')}
          <Card style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 4 }}>
            {next.map((t, i) => (
              <View key={`${t}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderTopWidth: i ? 1 : 0, borderTopColor: colors.lineSoft }}>
                <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: colors.line }} />
                <Text weight="semibold" style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>
                  {t}
                </Text>
                <Pressable onPress={() => setNext(next.filter((_, j) => j !== i))} accessibilityLabel="Remover item" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="x" size={18} color={colors.muted} />
                </Pressable>
              </View>
            ))}
            {next.length < 10 ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: next.length ? 6 : 0 }}>
                <TextInput value={nextText} onChangeText={setNextText} placeholder="Adicionar item" placeholderTextColor={colors.muted} maxLength={200} onSubmitEditing={addNext} returnKeyType="done" accessibilityLabel="Novo item para a próxima visita" style={[input, { flex: 1, minHeight: 44, borderStyle: 'dashed' }]} />
                <Pressable onPress={addNext} accessibilityLabel="Adicionar item" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#0B5D3B', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" size={20} color="#fff" />
                </Pressable>
              </View>
            ) : null}
          </Card>
          <Text weight="semibold" muted style={{ fontSize: 12, lineHeight: 18 }}>
            Aparece na próxima visita deste relatório.
          </Text>
        </View>

        {/* Tags */}
        <TagField tags={tags} onChange={setTags} />

        {editing ? (
          <Pressable
            onPress={() =>
              Alert.alert('Excluir registro?', 'As fotos, os áudios e os itens para a próxima visita deste registro também serão apagados. Isso não pode ser desfeito.', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Excluir',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteEntry(id!);
                    void syncNow();
                    router.back();
                  },
                },
              ])
            }
            style={{ minHeight: 48, borderRadius: 999, borderWidth: 2, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text weight="extrabold" style={{ fontSize: 15, color: colors.danger }}>
              Excluir registro
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Rodapé: salvar rascunho e concluir (como no desenho) */}
      <View pointerEvents="box-none" style={{  flexDirection: 'row', gap: 10, paddingHorizontal: 16, position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom - 6, 10) }}>
        {!editing || entryDraft ? (
          <Pressable onPress={busy ? undefined : () => save(true)} style={{ flex: 1, minHeight: 52, borderRadius: 999, borderWidth: 2, borderColor: '#0B5D3B', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text weight="extrabold" style={{ fontSize: 15 }}>
              Salvar rascunho
            </Text>
          </Pressable>
        ) : null}
        <Pressable onPress={busy ? undefined : () => save(false)} style={{ flex: 1, minHeight: 52, borderRadius: 999, backgroundColor: '#0B5D3B', alignItems: 'center', justifyContent: 'center' }}>
          <Text weight="extrabold" style={{ fontSize: 15, color: '#fff' }}>
            {busy ? 'Salvando...' : editing && !entryDraft ? 'Salvar alterações' : 'Concluir'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
