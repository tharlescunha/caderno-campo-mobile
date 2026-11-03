import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field } from '../src/components/form';
import { Icon } from '../src/components/Icon';
import { PhotoField } from '../src/components/media';
import { SubjectSelect } from '../src/components/SubjectSelect';
import { TagField } from '../src/components/TagField';
import { Button, Card, Text } from '../src/components/ui';
import { removeFile, type StoredPhoto } from '../src/media/storage';
import { createReport, deleteReport, deliveryFormatLabel, getReportEdit, updateReport, type DeliveryFormat, type Reminder, type ReportKind } from '../src/data/reports';
import { listSubjects, type SubjectItem } from '../src/data/subjects';
import { localDate } from '../src/data/today';
import { useSync } from '../src/sync';
import { fonts, useTheme } from '../src/theme';

// Tela "Novo relatório" (design/NovoRelatorio.dc.html). A foto da área e o primeiro registro entram nos próximos passos.
const reminders: { value: Reminder; label: string }[] = [
  { value: 'no_dia', label: 'No dia' },
  { value: '1_dia', label: '1 dia antes' },
  { value: '3_dias', label: '3 dias antes' },
];

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

export default function NovoRelatorio() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { syncNow } = useSync();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [title, setTitle] = useState('');
  const { subjectId: presetSubject, id } = useLocalSearchParams<{ subjectId?: string; id?: string }>();
  const editing = Boolean(id);
  const [subjectName, setSubjectName] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(presetSubject ?? null);
  const [kind, setKind] = useState<ReportKind>('continuo');
  const [crop, setCrop] = useState('');
  const [place, setPlace] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [hasDelivery, setHasDelivery] = useState(false);
  const [delivery, setDelivery] = useState(new Date(Date.now() + 7 * 86_400_000));
  const [reminder, setReminder] = useState<Reminder>('1_dia');
  const [format, setFormat] = useState<DeliveryFormat | null>(null);
  const [notes, setNotes] = useState('');
  const [areaPhoto, setAreaPhoto] = useState<StoredPhoto[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listSubjects().then(setSubjects);
    if (id) {
      void getReportEdit(id).then((r) => {
        if (!r) return;
        setTitle(r.title);
        setKind(r.kind);
        setSubjectName(r.subjectName);
        setCrop(r.area.crop);
        setPlace(r.area.place);
        setLength(r.area.lengthM ? String(r.area.lengthM) : '');
        setWidth(r.area.widthM ? String(r.area.widthM) : '');
        if (r.deliveryDate) {
          const [y, m, d] = r.deliveryDate.split('-').map(Number);
          setHasDelivery(true);
          setDelivery(new Date(y, m - 1, d));
        }
        setReminder(r.reminder === 'nenhum' ? '1_dia' : r.reminder);
        setFormat(r.format);
        setNotes(r.notes);
        setTags(r.tags);
      });
    }
  }, [id]);

  const area = num(length) && num(width) ? (num(length)! * num(width)!).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : null;

  const save = async (thenEntry = false) => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Informe o título do relatório.';
    if (!subjectId && !editing) e.subject = 'Escolha a matéria.';
    if (!editing && hasDelivery && localDate(delivery) < localDate()) e.delivery = 'A data de entrega não pode ser anterior a hoje.';
    setErrors(e);
    if (Object.keys(e).length || (!subjectId && !editing)) return;
    setBusy(true);
    try {
      if (id) {
        await updateReport(id, {
          title: title.trim(),
          kind,
          area: kind === 'continuo' ? { crop: crop.trim(), place: place.trim(), lengthM: num(length), widthM: num(width) } : null,
          deliveryDate: hasDelivery ? localDate(delivery) : null,
          reminder,
          format,
          notes: notes.trim(),
          tags,
        });
        void syncNow();
        router.back();
        return;
      }
      const newId = await createReport({
        title: title.trim(),
        subjectId: subjectId!,
        kind,
        area: kind === 'continuo' ? { crop: crop.trim(), place: place.trim(), lengthM: num(length), widthM: num(width) } : null,
        deliveryDate: hasDelivery ? localDate(delivery) : null,
        reminder,
        format,
        notes: notes.trim(),
        areaPhoto: areaPhoto[0] ?? null,
        tags,
      });
      void syncNow();
      if (thenEntry) {
        // abre o relatório e, por cima, o primeiro registro
        router.replace({ pathname: '/relatorio/[id]', params: { id: newId } });
        router.push({ pathname: '/novo-registro', params: { reportId: newId } });
      } else router.back();
    } catch (err) {
      Alert.alert('Não foi possível salvar', err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  const pill = (on: boolean) => ({
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: on ? '#0B5D3B' : colors.line,
    backgroundColor: on ? '#0B5D3B' : colors.card,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  });
  const label = (t: string) => (
    <Text weight="bold" style={{ fontSize: 13, color: colors.muted }}>
      {t}
    </Text>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          onPress={() => {
            areaPhoto.forEach((p) => removeFile(p.uri));
            router.back();
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, width: 96 }}
        >
          <Icon name="x" size={18} color={colors.muted} />
          <Text weight="bold" muted style={{ fontSize: 15 }}>
            Cancelar
          </Text>
        </Pressable>
        <Text weight="extrabold" style={{ fontSize: 16 }}>
          {editing ? 'Editar relatório' : 'Novo relatório'}
        </Text>
        <View style={{ width: 96 }} />
      </View>

      <ScrollView style={{ flex: 1 }} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 150, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row' }}>
          <Field label="Título do relatório" placeholder="ex.: Acompanhamento da área de milho" value={title} onChangeText={setTitle} error={errors.title} />
        </View>

        {editing ? (
          <View style={{ gap: 6 }}>
            {label('Matéria e tipo')}
            <View style={{ backgroundColor: colors.chipBg, borderRadius: 16, padding: 14, gap: 2 }}>
              <Text weight="extrabold" style={{ fontSize: 15 }}>
                {subjectName}
              </Text>
              <Text weight="semibold" muted style={{ fontSize: 12 }}>
                Relatório {kind === 'continuo' ? 'contínuo' : 'pontual'} · a matéria e o tipo não mudam depois de criado
              </Text>
            </View>
          </View>
        ) : null}

        {!editing ? (
        <View style={{ gap: 8 }}>
          {label('Matéria')}
          <SubjectSelect subjects={subjects} value={subjectId} onChange={setSubjectId} error={errors.subject} />
          <Text weight="semibold" muted style={{ fontSize: 12 }}>
            O professor vem da matéria.
          </Text>
        </View>
        ) : null}

        {!editing ? (
        <View style={{ gap: 8 }}>
          {label('Tipo de relatório')}
          {(
            [
              { value: 'continuo', title: 'Contínuo', text: 'Você vai adicionando registros semana a semana na mesma área, até o fim.' },
              { value: 'pontual', title: 'Pontual', text: 'Um registro só, de uma visita ou atividade.' },
            ] as const
          ).map((o) => (
            <Pressable key={o.value} onPress={() => setKind(o.value)} style={{ borderRadius: 20, borderWidth: 2, borderColor: kind === o.value ? '#0B5D3B' : colors.line, backgroundColor: kind === o.value ? colors.chipBg : colors.card, padding: 14, paddingHorizontal: 16, gap: 4 }}>
              <Text weight="extrabold" style={{ fontSize: 15 }}>
                {o.title}
              </Text>
              <Text weight="semibold" muted style={{ fontSize: 12, lineHeight: 18 }}>
                {o.text}
              </Text>
            </Pressable>
          ))}
        </View>
        ) : null}

        {kind === 'continuo' ? (
          <Card style={{ gap: 12, backgroundColor: colors.chipBg }}>
            <Text weight="extrabold" style={{ fontSize: 17 }}>
              Área acompanhada
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field label="Cultura" placeholder="ex.: milho" value={crop} onChangeText={setCrop} />
              <Field label="Local" placeholder="ex.: canteiro 3" value={place} onChangeText={setPlace} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
              <Field label="Comprimento" placeholder="m" keyboardType="decimal-pad" value={length} onChangeText={setLength} />
              <Field label="Largura" placeholder="m" keyboardType="decimal-pad" value={width} onChangeText={setWidth} />
              <View style={{ flex: 1, gap: 6 }}>
                {label('Área')}
                <View style={{ minHeight: 52, borderRadius: 16, backgroundColor: colors.chipBg, borderWidth: 2, borderColor: colors.line, paddingHorizontal: 12, justifyContent: 'center' }}>
                  <Text weight="extrabold" style={{ fontSize: 15 }}>
                    {area ?? '—'} m²
                  </Text>
                </View>
              </View>
            </View>
            {!editing ? <PhotoField photos={areaPhoto} onChange={setAreaPhoto} label="Foto da área" max={1} hint="A localização do celular é guardada junto com a foto, quando permitida." /> : null}
          </Card>
        ) : null}

        <Card style={{ gap: 12, paddingVertical: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text weight="extrabold" style={{ fontSize: 17 }}>
                Tem data de entrega?
              </Text>
              <Text weight="semibold" muted style={{ fontSize: 12, marginTop: 2 }}>
                Aparece na agenda, com lembrete
              </Text>
            </View>
            <View style={{ flexDirection: 'row', backgroundColor: colors.chipBg, borderRadius: 999, padding: 3 }}>
              {[true, false].map((v) => (
                <Pressable key={String(v)} onPress={() => setHasDelivery(v)} style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', backgroundColor: hasDelivery === v ? '#0B5D3B' : 'transparent' }}>
                  <Text weight="extrabold" style={{ fontSize: 14, color: hasDelivery === v ? '#fff' : colors.text }}>
                    {v ? 'Sim' : 'Não'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {hasDelivery ? (
            <View style={{ gap: 12 }}>
              <View style={{ gap: 6, alignItems: 'flex-start' }}>
                {label('Data de entrega')}
                <DateTimePicker value={delivery} mode="date" display="compact" minimumDate={new Date()} onChange={(_, d) => d && setDelivery(d)} locale="pt-BR" />
                {errors.delivery ? (
                  <Text weight="semibold" style={{ fontSize: 12, color: colors.danger }}>
                    {errors.delivery}
                  </Text>
                ) : null}
              </View>
              <View style={{ gap: 8 }}>
                {label('Formato da entrega (opcional)')}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {(Object.keys(deliveryFormatLabel) as DeliveryFormat[]).map((f) => (
                    <Pressable key={f} onPress={() => setFormat(format === f ? null : f)} style={pill(format === f)}>
                      <Text weight="extrabold" style={{ fontSize: 14, color: format === f ? '#fff' : colors.text }}>
                        {deliveryFormatLabel[f]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ gap: 8 }}>
                {label('Lembrete')}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {reminders.map((r) => (
                    <Pressable key={r.value} onPress={() => setReminder(r.value)} style={pill(reminder === r.value)}>
                      <Text weight="extrabold" style={{ fontSize: 14, color: reminder === r.value ? '#fff' : colors.text }}>
                        {r.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ) : null}
        </Card>

        <TagField tags={tags} onChange={setTags} />

        <View style={{ gap: 6 }}>
          {label('Observações do relatório')}
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="O que a professora pediu, regras de entrega, o que não pode esquecer..."
            placeholderTextColor={colors.muted}
            accessibilityLabel="Observações do relatório"
            style={{ minHeight: 100, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line, padding: 12, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.text }}
          />
        </View>
        {editing ? (
          <Pressable
            onPress={() =>
              Alert.alert('Excluir relatório?', 'Os registros, as fotos, os áudios e a data de entrega deste relatório também serão apagados. Isso não pode ser desfeito.', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Excluir',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteReport(id!);
                    void syncNow();
                    router.dismissAll();
                  },
                },
              ])
            }
            style={{ minHeight: 48, borderRadius: 999, borderWidth: 2, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text weight="extrabold" style={{ fontSize: 15, color: colors.danger }}>
              Excluir relatório
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View pointerEvents="box-none" style={{  paddingHorizontal: 16, gap: 8, position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom - 6, 10) }}>
        {editing ? (
          <Button label={busy ? 'Salvando...' : 'Salvar alterações'} icon="check" variant="primary" onPress={busy ? undefined : () => save()} />
        ) : (
          <>
            <Button label={busy ? 'Salvando...' : 'Criar e adicionar o primeiro registro'} variant="primary" onPress={busy ? undefined : () => save(true)} />
            <Pressable onPress={busy ? undefined : () => save()} style={{ minHeight: 46, borderRadius: 999, borderWidth: 2, borderColor: '#0B5D3B', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
              <Text weight="extrabold" style={{ fontSize: 15 }}>
                Só criar o relatório
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
