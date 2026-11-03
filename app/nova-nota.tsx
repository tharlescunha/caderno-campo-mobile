import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field } from '../src/components/form';
import { Icon } from '../src/components/Icon';
import { AudioClip, AudioField, PhotoField, PhotoThumb } from '../src/components/media';
import { SubjectSelect } from '../src/components/SubjectSelect';
import { TagField } from '../src/components/TagField';
import { getTags } from '../src/data/tags';
import { Button, Card, Text } from '../src/components/ui';
import type { EntryAudio } from '../src/data/entries';
import { createNote, deleteNote, getNote, listNoteAttachments, listNoteAudios, updateNote, type NoteAttachment } from '../src/data/notes';
import { listSubjects, type SubjectItem } from '../src/data/subjects';
import { removeFile, type StoredAudio, type StoredPhoto } from '../src/media/storage';
import { useSync } from '../src/sync';
import { fonts, useTheme } from '../src/theme';

// Tela "Nova anotação / editar" (design/NovaNota.dc.html). Anexos (fotos e arquivos) entram num próximo passo.
export default function NovaNota() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, subjectId: presetSubject } = useLocalSearchParams<{ id?: string; subjectId?: string }>();
  const editing = Boolean(id);
  const { syncNow } = useSync();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(presetSubject ?? null);
  const [pinned, setPinned] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [audios, setAudios] = useState<(StoredAudio & { durationS: number })[]>([]);
  const [saved, setSaved] = useState<EntryAudio[]>([]);
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<NoteAttachment[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listSubjects().then(setSubjects);
    if (id) {
      void getNote(id).then((n) => {
        if (!n) return;
        setTitle(n.title);
        setText(n.text ?? '');
        setLink(n.link ?? '');
        setSubjectId(n.subjectId);
        setPinned(n.pinned);
      });
      void listNoteAudios(id).then(setSaved);
      void listNoteAttachments(id).then(setSavedPhotos);
      void getTags('anotacao', id).then(setTags);
    }
  }, [id]);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Informe um título.';
    if (link.trim() && !/^(https?:\/\/)?[^\s/]+\.[^\s]+$/i.test(link.trim())) e.link = 'Esse link não parece válido.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const input = { title: title.trim(), text: text.trim(), link, subjectId, pinned, tags };
      if (id) await updateNote(id, input, audios, photos);
      else await createNote(input, audios, photos);
      void syncNow();
      router.back();
    } catch (err) {
      Alert.alert('Não foi possível salvar', err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  const confirmDelete = () =>
    Alert.alert('Excluir anotação?', 'Ela e os áudios dela serão apagados. Isso não pode ser desfeito.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteNote(id!);
          void syncNow();
          router.back();
        },
      },
    ]);

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
            audios.forEach((a) => removeFile(a.uri));
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
          {editing ? 'Editar anotação' : 'Nova anotação'}
        </Text>
        <View style={{ width: 96 }} />
      </View>

      <ScrollView style={{ flex: 1 }} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 150, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row' }}>
          <Field label="Título" placeholder="ex.: Dose do fungicida" value={title} onChangeText={setTitle} error={errors.title} />
        </View>

        <View style={{ gap: 6 }}>
          {label('Texto')}
          <TextInput value={text} onChangeText={setText} multiline textAlignVertical="top" placeholder="Escreva aqui..." placeholderTextColor={colors.muted} accessibilityLabel="Texto" style={{ minHeight: 140, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line, padding: 12, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.text }} />
        </View>

        <View style={{ gap: 8 }}>
          {label('Matéria (opcional)')}
          <SubjectSelect subjects={subjects} value={subjectId} onChange={setSubjectId} optional />
          <Text weight="semibold" muted style={{ fontSize: 12 }}>
            Sem matéria, a anotação fica solta e continua valendo depois que o período acabar.
          </Text>
        </View>

        <View style={{ flexDirection: 'row' }}>
          <Field label="Link (opcional)" placeholder="https://..." autoCapitalize="none" autoCorrect={false} keyboardType="url" value={link} onChangeText={setLink} error={errors.link} />
        </View>

        <TagField tags={tags} onChange={setTags} />

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#FCEFCB', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="pin" size={18} color="#7A5300" />
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="bold" style={{ fontSize: 15 }}>
              Fixar no topo
            </Text>
            <Text weight="semibold" muted style={{ fontSize: 12 }}>
              Anotações fixadas aparecem primeiro
            </Text>
          </View>
          <Switch value={pinned} onValueChange={setPinned} trackColor={{ true: '#0B5D3B' }} />
        </Card>

        {saved.length ? (
          <View style={{ gap: 8 }}>
            {label('Áudios desta anotação')}
            {saved.map((a) => (
              <AudioClip key={a.id} uri={a.uri} durationS={a.durationS} status={a.status} text={a.text} pending={a.pending} />
            ))}
          </View>
        ) : null}

        {savedPhotos.length ? (
          <View style={{ gap: 8 }}>
            {label('Fotos anexadas')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {savedPhotos.map((a) => (
                <PhotoThumb key={a.id} uri={a.uri} size={96} radius={16} />
              ))}
            </View>
          </View>
        ) : null}

        <PhotoField photos={photos} onChange={setPhotos} label="Anexar fotos" hint="As fotos ficam anexadas a esta anotação." />

        <AudioField audios={audios} onChange={setAudios} />

        {editing ? (
          <Pressable onPress={confirmDelete} style={{ minHeight: 48, borderRadius: 999, borderWidth: 2, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Text weight="extrabold" style={{ fontSize: 15, color: colors.danger }}>
              Excluir anotação
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View pointerEvents="box-none" style={{  paddingHorizontal: 16, position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom - 6, 10) }}>
        <Button label={busy ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar anotação'} icon="check" variant="primary" onPress={busy ? undefined : save} />
      </View>
    </SafeAreaView>
  );
}
