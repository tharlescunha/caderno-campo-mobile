import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, View } from 'react-native';
import { removeFile, storeAudio, storePhoto, type StoredAudio, type StoredPhoto } from '../media/storage';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { PendingBadge, Text } from './ui';

const MAX_PHOTOS = 20;
const MAX_AUDIOS = 5;
const MAX_AUDIO_SECONDS = 300;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Fotos: grade de 3 colunas; o quadrado tracejado "Foto" abre as opções (tirar agora ou escolher da galeria). */
export function PhotoField({ photos, onChange, label = 'Fotos', max = MAX_PHOTOS, hint = 'Tirar agora ou escolher da galeria. A data e o clima ficam anexados a cada foto.' }: { photos: StoredPhoto[]; onChange: (p: StoredPhoto[]) => void; label?: string; max?: number; hint?: string }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  const add = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setBusy(true);
    try {
      const stored: StoredPhoto[] = [];
      for (const a of assets.slice(0, max - photos.length)) stored.push(await storePhoto(a.uri, a.width, a.height));
      onChange([...photos, ...stored]);
    } catch (e) {
      Alert.alert('Não foi possível guardar a foto', e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const camera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Câmera bloqueada', 'Libere a câmera nas configurações do celular para tirar fotos.');
    const r = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!r.canceled) await add(r.assets);
  };
  const library = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsMultipleSelection: max > 1, quality: 1 });
    if (!r.canceled) await add(r.assets);
  };
  const choose = () =>
    Alert.alert('Adicionar foto', undefined, [
      { text: 'Tirar foto', onPress: () => void camera() },
      { text: 'Escolher da galeria', onPress: () => void library() },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  const remove = (p: StoredPhoto) => {
    removeFile(p.uri);
    onChange(photos.filter((x) => x.id !== p.id));
  };

  const full = photos.length >= max;
  const cell = { width: '31.5%' as const, aspectRatio: 1, borderRadius: 18 };
  return (
    <View style={{ gap: 8 }}>
      <Text weight="bold" style={{ fontSize: 13, color: colors.muted }}>
        {label} {photos.length ? `(${photos.length})` : ''}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {photos.map((p) => (
          <View key={p.id} style={[cell, { overflow: 'hidden', backgroundColor: colors.chipBg }]}>
            <Image source={{ uri: p.uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} onError={(e) => Alert.alert('Não foi possível mostrar a foto', `${e.nativeEvent.error}\n${p.uri}`)} />
            <Pressable onPress={() => remove(p)} accessibilityLabel="Remover foto" hitSlop={6} style={{ position: 'absolute', top: 4, right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        {!full ? (
          <Pressable onPress={busy ? undefined : choose} accessibilityLabel="Adicionar foto" style={[cell, { borderWidth: 2, borderStyle: 'dashed', borderColor: '#1E8A5A', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', gap: 4, opacity: busy ? 0.5 : 1 }]}>
            <Icon name="camera" size={24} color={colors.link} />
            <Text weight="bold" style={{ fontSize: 12, color: colors.link }}>
              {busy ? 'Guardando...' : 'Foto'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text weight="semibold" muted style={{ fontSize: 12 }}>
        {hint}
      </Text>
    </View>
  );
}

/** Tocar um áudio já gravado e, quando existir, o texto transcrito logo abaixo. */
export function AudioClip({ uri, durationS, status, text, pending, onRemove }: { uri: string | null; durationS: number; status?: 'transcrevendo' | 'pronto' | 'erro'; text?: string | null; pending?: boolean; onRemove?: () => void }) {
  const { colors } = useTheme();
  const player = useAudioPlayer(uri);
  const st = useAudioPlayerStatus(player);
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={() => {
            if (!uri) return;
            if (st.playing) player.pause();
            else {
              if (st.didJustFinish || (st.duration && st.currentTime >= st.duration - 0.1)) player.seekTo(0);
              player.play();
            }
          }}
          accessibilityLabel={st.playing ? 'Pausar' : 'Ouvir'}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: uri ? '#0B5D3B' : colors.line, alignItems: 'center', justifyContent: 'center' }}
        >
          {st.playing ? (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <View style={{ width: 4, height: 14, backgroundColor: '#fff', borderRadius: 2 }} />
              <View style={{ width: 4, height: 14, backgroundColor: '#fff', borderRadius: 2 }} />
            </View>
          ) : (
            <View style={{ marginLeft: 3, borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 13, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#fff' }} />
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text weight="extrabold" style={{ fontSize: 14 }}>
            {st.playing ? `${mmss(st.currentTime)} / ${mmss(durationS)}` : `Áudio · ${mmss(durationS)}`}
          </Text>
          {status === 'transcrevendo' ? (
            <Text weight="semibold" muted style={{ fontSize: 12 }}>
              {pending ? 'Aguardando envio' : 'Transcrevendo...'}
            </Text>
          ) : status === 'erro' ? (
            <Text weight="semibold" style={{ fontSize: 12, color: colors.danger }}>
              Não foi possível transcrever
            </Text>
          ) : null}
        </View>
        {pending && status !== 'transcrevendo' ? <PendingBadge /> : null}
        {onRemove ? (
          <Pressable onPress={onRemove} accessibilityLabel="Remover áudio" hitSlop={8}>
            <Icon name="x" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {text ? (
        <Text style={{ fontSize: 14, lineHeight: 21 }}>{text}</Text>
      ) : null}
    </View>
  );
}

type AudioItem = StoredAudio & { durationS: number };

/** Gravação de áudio (até 5 minutos cada, no máximo 5 por registro). A transcrição é feita no servidor depois do envio. */
export function useAudioRecording(audios: AudioItem[], onChange: (a: AudioItem[]) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [recording, setRecording] = useState(false);
  const stopping = useRef(false);

  const start = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return Alert.alert('Microfone bloqueado', 'Libere o microfone nas configurações do celular para gravar áudio.');
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAX_AUDIO_SECONDS });
      setRecording(true);
    } catch (e) {
      Alert.alert('Não foi possível gravar', e instanceof Error ? e.message : String(e));
    }
  };

  const stop = async () => {
    if (stopping.current) return;
    stopping.current = true;
    try {
      const seconds = Math.max(1, Math.round((state.durationMillis || recorder.currentTime * 1000) / 1000));
      await recorder.stop();
      setRecording(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (recorder.uri) onChange([...audios, { ...(await storeAudio(recorder.uri)), durationS: Math.min(MAX_AUDIO_SECONDS, seconds) }]);
    } catch (e) {
      setRecording(false);
      Alert.alert('Não foi possível guardar o áudio', e instanceof Error ? e.message : String(e));
    }
    stopping.current = false;
  };

  // parou sozinho no limite de 5 minutos
  useEffect(() => {
    if (recording && state.durationMillis >= MAX_AUDIO_SECONDS * 1000) void stop();
  }, [recording, state.durationMillis]);

  return { recording, seconds: state.durationMillis / 1000, start, stop, full: audios.length >= MAX_AUDIOS };
}

export type AudioRecording = ReturnType<typeof useAudioRecording>;

/** Botão "Gravar áudio" (vira "Parar" enquanto grava). */
export function RecordButton({ rec }: { rec: AudioRecording }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={rec.recording ? rec.stop : rec.full ? undefined : rec.start}
      style={{ minHeight: 44, borderRadius: 999, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: rec.recording ? colors.danger : '#0B5D3B', backgroundColor: rec.recording ? colors.danger : colors.card, opacity: rec.full && !rec.recording ? 0.5 : 1 }}
    >
      <View style={{ width: 12, height: 12, borderRadius: rec.recording ? 3 : 6, backgroundColor: rec.recording ? '#fff' : colors.danger }} />
      <Text weight="extrabold" style={{ fontSize: 14, color: rec.recording ? '#fff' : colors.text }}>
        {rec.recording ? 'Parar' : 'Gravar áudio'}
      </Text>
    </Pressable>
  );
}

const bars = [8, 14, 18, 10, 16, 6, 12, 18, 9, 14];

/** Faixa vermelha "Gravando… 0:07" com as barrinhas, como no desenho. Só aparece enquanto grava. */
export function RecordingBanner({ rec }: { rec: AudioRecording }) {
  const { colors } = useTheme();
  if (!rec.recording) return null;
  return (
    <View style={{ backgroundColor: colors.dangerBg, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#D9483B' }} />
      <View style={{ flex: 1 }}>
        <Text weight="extrabold" style={{ fontSize: 14, color: colors.danger }}>
          Gravando… {mmss(rec.seconds)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center', height: 20, marginTop: 2 }}>
          {bars.map((h, i) => (
            <View key={i} style={{ width: 3, height: h, backgroundColor: '#D9483B', borderRadius: 2 }} />
          ))}
        </View>
      </View>
      <Pressable onPress={rec.stop} accessibilityLabel="Parar gravação" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#fff' }} />
      </Pressable>
    </View>
  );
}

/** Lista dos áudios gravados (ainda não salvos), com ouvir e remover. */
export function RecordedList({ audios, onChange, onUseText }: { audios: AudioItem[]; onChange: (a: AudioItem[]) => void; onUseText?: (text: string) => void }) {
  void onUseText;
  return (
    <>
      {audios.map((a) => (
        <AudioClip
          key={a.id}
          uri={a.uri}
          durationS={a.durationS}
          onRemove={() => {
            removeFile(a.uri);
            onChange(audios.filter((x) => x.id !== a.id));
          }}
        />
      ))}
    </>
  );
}

/** Tudo junto (usado nas anotações): botão, faixa de gravação e lista. */
export function AudioField({ audios, onChange }: { audios: AudioItem[]; onChange: (a: AudioItem[]) => void }) {
  const { colors } = useTheme();
  const rec = useAudioRecording(audios, onChange);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text weight="bold" style={{ fontSize: 13, color: colors.muted }}>
          Áudios {audios.length ? `(${audios.length})` : ''}
        </Text>
        <RecordButton rec={rec} />
      </View>
      <RecordingBanner rec={rec} />
      <RecordedList audios={audios} onChange={onChange} />
      <Text weight="semibold" muted style={{ fontSize: 12 }}>
        Fale o que viu no campo. O texto aparece abaixo do áudio depois que o servidor transcrever.
      </Text>
    </View>
  );
}

/** Miniatura que abre a foto em tela cheia ao tocar. */
export function PhotoThumb({ uri, size = 72, radius = 12 }: { uri: string | null; size?: number; radius?: number }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => uri && setOpen(true)} accessibilityLabel="Ampliar foto" style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
        {uri ? <Image source={{ uri }} resizeMode="cover" style={{ width: size, height: size }} /> : <Icon name="camera" size={Math.round(size / 3)} color={colors.muted} />}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
          {uri ? <Image source={{ uri }} resizeMode="contain" style={{ width: '100%', height: '85%' }} /> : null}
          <Pressable onPress={() => setOpen(false)} accessibilityLabel="Fechar" style={{ position: 'absolute', top: 56, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={22} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
