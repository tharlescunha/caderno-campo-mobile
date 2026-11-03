import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field } from '../src/components/form';
import { Icon } from '../src/components/Icon';
import { PhotoField, PhotoThumb } from '../src/components/media';
import { SubjectSelect } from '../src/components/SubjectSelect';
import { Button, Text } from '../src/components/ui';
import { removeFile, type StoredPhoto } from '../src/media/storage';
import { createEvent, deleteEvent, getEvent, updateEvent, type NewEvent } from '../src/data/agenda';
import type { Reminder } from '../src/data/reports';
import { listSubjects, type SubjectItem } from '../src/data/subjects';
import { localDate } from '../src/data/today';
import { useSync } from '../src/sync';
import { fonts, useTheme } from '../src/theme';

// Tela "Novo evento" (design/NovoEvento.dc.html). Fotos do evento entram junto com as fotos dos registros.
const types: { value: NewEvent['type']; label: string }[] = [
  { value: 'prova', label: 'Prova' },
  { value: 'trabalho', label: 'Trabalho' },
  { value: 'atividade', label: 'Atividade' },
  { value: 'evento_faculdade', label: 'Evento da faculdade' },
  { value: 'outro', label: 'Outro' },
];
const reminders: { value: Reminder; label: string }[] = [
  { value: 'nenhum', label: 'Sem lembrete' },
  { value: 'no_dia', label: 'No dia' },
  { value: '1_dia', label: '1 dia antes' },
  { value: '3_dias', label: '3 dias antes' },
  { value: '1_semana', label: '1 semana antes' },
];

export default function NovoEvento() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, subjectId: presetSubject } = useLocalSearchParams<{ id?: string; subjectId?: string }>();
  const editing = Boolean(id);
  const { syncNow } = useSync();
  const [savedPhotos, setSavedPhotos] = useState<{ id: string; uri: string | null }[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [type, setType] = useState<NewEvent['type']>('prova');
  const [typeDescription, setTypeDescription] = useState('');
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(presetSubject ?? null);
  const [date, setDate] = useState(new Date(Date.now() + 86_400_000));
  const [reminder, setReminder] = useState<Reminder>('1_dia');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listSubjects().then(setSubjects);
    if (id) {
      void getEvent(id).then((e) => {
        if (!e) return;
        if (e.type !== 'entrega_relatorio') setType(e.type);
        setTypeDescription(e.typeDescription);
        setTitle(e.title);
        setSubjectId(e.subjectId);
        const [y, m, d] = e.date.split('-').map(Number);
        setDate(new Date(y, m - 1, d));
        setReminder(e.reminder);
        setNotes(e.notes);
        setSavedPhotos(e.photos);
      });
    }
  }, [id]);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Informe o título do evento.';
    if (type === 'outro' && !typeDescription.trim()) e.type = 'Diga que tipo de evento é.';
    if (!editing && localDate(date) < localDate()) e.date = 'A data não pode ser anterior a hoje.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const input = { type, typeDescription: typeDescription.trim(), title: title.trim(), subjectId, date: localDate(date), reminder, notes: notes.trim() };
      if (id) await updateEvent(id, input, photos);
      else await createEvent({ ...input, photos });
      void syncNow();
      router.back();
    } catch (err) {
      Alert.alert('Não foi possível salvar', err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  const pill = (on: boolean) => ({
    minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 2,
    borderColor: on ? '#0B5D3B' : colors.line, backgroundColor: on ? '#0B5D3B' : colors.card,
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
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
            photos.forEach((p) => removeFile(p.uri));
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
          {editing ? 'Evento' : 'Novo evento'}
        </Text>
        <View style={{ width: 96 }} />
      </View>

      <ScrollView style={{ flex: 1 }} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 150, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          {label('Tipo')}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {types.map((t) => (
              <Pressable key={t.value} onPress={() => setType(t.value)} style={pill(type === t.value)}>
                <Text weight="extrabold" style={{ fontSize: 14, color: type === t.value ? '#fff' : colors.text }}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {type === 'outro' ? (
            <View style={{ flexDirection: 'row' }}>
              <Field label="Que tipo?" placeholder="ex.: visita técnica" value={typeDescription} onChangeText={setTypeDescription} error={errors.type} />
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row' }}>
          <Field label="Título" placeholder="ex.: Prova de Culturas Anuais" value={title} onChangeText={setTitle} error={errors.title} />
        </View>

        <View style={{ gap: 8 }}>
          {label('Matéria (opcional)')}
          <SubjectSelect subjects={subjects} value={subjectId} onChange={setSubjectId} optional />
        </View>

        <View style={{ gap: 6, alignItems: 'flex-start' }}>
          {label('Data')}
          <DateTimePicker value={date} mode="date" display="compact" minimumDate={new Date()} onChange={(_, d) => d && setDate(d)} locale="pt-BR" />
          {errors.date ? (
            <Text weight="semibold" style={{ fontSize: 12, color: colors.danger }}>
              {errors.date}
            </Text>
          ) : null}
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

        <View style={{ gap: 6 }}>
          {label('Anotações')}
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="Conteúdo da prova, o que levar, local..."
            placeholderTextColor={colors.muted}
            accessibilityLabel="Anotações"
            style={{ minHeight: 100, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line, padding: 12, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.text }}
          />
        </View>
        {savedPhotos.length ? (
          <View style={{ gap: 8 }}>
            {label('Fotos do evento')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {savedPhotos.map((p) => (
                <PhotoThumb key={p.id} uri={p.uri} size={96} radius={16} />
              ))}
            </View>
          </View>
        ) : null}

        <PhotoField photos={photos} onChange={setPhotos} hint="Por exemplo, a foto do quadro com o conteúdo da prova." />
        {editing ? (
          <Pressable
            onPress={() =>
              Alert.alert('Excluir evento?', 'Isso não pode ser desfeito.', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: async () => { await deleteEvent(id!); void syncNow(); router.back(); } },
              ])
            }
            style={{ minHeight: 48, borderRadius: 999, borderWidth: 2, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text weight="extrabold" style={{ fontSize: 15, color: colors.danger }}>
              Excluir evento
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View pointerEvents="box-none" style={{  paddingHorizontal: 16, position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom - 6, 10) }}>
        <Button label={busy ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar evento'} icon="check" variant="primary" onPress={busy ? undefined : save} />
      </View>
    </SafeAreaView>
  );
}
