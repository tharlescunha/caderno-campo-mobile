import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { editAudioText, retranscribeAudio, type EntryAudio } from '../data/entries';
import { fonts, useTheme } from '../theme';
import { AudioClip } from './media';
import { Text } from './ui';

/** Áudio já salvo do registro: ouvir, usar o texto nas observações, ajustar o texto ou pedir nova transcrição. */
export function SavedAudio({ audio, onUseText, onChanged }: { audio: EntryAudio; onUseText: (text: string) => void; onChanged: () => void }) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
      onChanged();
    } catch (e) {
      Alert.alert('Não foi possível', e instanceof Error ? e.message : 'Precisa de internet e de o áudio já ter sido enviado ao servidor.');
    }
    setBusy(false);
  };

  const action = (label: string, onPress: () => void, primary = false) => (
    <Pressable onPress={busy ? undefined : onPress} style={{ minHeight: 44, borderRadius: 999, backgroundColor: primary ? '#0B5D3B' : colors.pill, paddingHorizontal: 14, justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
      <Text weight="extrabold" style={{ fontSize: 13, color: primary ? '#fff' : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 6 }}>
      <AudioClip uri={audio.uri} durationS={audio.durationS} status={audio.status} text={audio.text} pending={audio.pending} />
      {editing ? (
        <View style={{ gap: 8 }}>
          <TextInput value={draft} onChangeText={setDraft} multiline textAlignVertical="top" accessibilityLabel="Texto do áudio" placeholderTextColor={colors.muted} style={{ minHeight: 90, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line, padding: 12, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.text }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {action(
              'Salvar texto',
              () =>
                void run(async () => {
                  await editAudioText(audio.id, draft);
                  setEditing(false);
                }),
              true,
            )}
            {action('Cancelar', () => setEditing(false))}
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {audio.text ? action('Usar nas observações', () => onUseText(audio.text ?? ''), true) : null}
          {audio.status !== 'transcrevendo' && !audio.pending
            ? action('Editar texto', () => {
                setDraft(audio.text ?? '');
                setEditing(true);
              })
            : null}
          {audio.status !== 'transcrevendo' && !audio.pending && audio.uri ? action('Transcrever de novo', () => void run(() => retranscribeAudio(audio.id))) : null}
        </View>
      )}
    </View>
  );
}
