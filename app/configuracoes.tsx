import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Linking, Pressable, ScrollView, Switch, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../src/api/client';
import { Icon } from '../src/components/Icon';
import { Card, Text } from '../src/components/ui';
import { initialsOf, getProfile, getSettings, setSetting, syncOverview, type Profile, type Settings } from '../src/data/settings';
import { formatUpdated } from '../src/data/market';
import { rescheduleReminders } from '../src/notifications/local';
import { useSession } from '../src/session';
import { useSync } from '../src/sync';
import { useTheme, type ThemeMode } from '../src/theme';

// Tela "Conta e configurações" (design/Configuracoes.dc.html).
const modes: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' },
];

function Row({ title, hint, right, onPress, last }: { title: string; hint?: string; right?: ReactNode; onPress?: () => void; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.lineSoft }}>
      <View style={{ flex: 1 }}>
        <Text weight="bold" style={{ fontSize: 15 }}>
          {title}
        </Text>
        {hint ? (
          <Text weight="semibold" muted style={{ fontSize: 12, lineHeight: 17 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export default function Configuracoes() {
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();
  const { signOut } = useSession();
  const { syncNow, syncing, lastSyncAt, lastError, online } = useSync();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [perm, setPerm] = useState<{ location: boolean; notifications: boolean }>({ location: false, notifications: false });
  const [queue, setQueue] = useState({ pending: 0, failed: 0, media: 0 });

  const load = useCallback(async () => {
    setProfile(await getProfile());
    setSettings(await getSettings());
    setQueue(await syncOverview());
    const loc = await Location.getForegroundPermissionsAsync().catch(() => null);
    const not = await Notifications.getPermissionsAsync().catch(() => null);
    setPerm({ location: Boolean(loc?.granted), notifications: Boolean(not?.granted || not?.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) });
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, lastSyncAt]),
  );

  const toggle = async (key: keyof Settings, value: boolean) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    await setSetting(key, value);
    if (key === 'examsAndDeadlines' || key === 'fieldClassEve' || key === 'reportDeadline' || key === 'remindRecordAfterField') void rescheduleReminders();
    if (key === 'remindRecordAfterField' || key === 'deleteAudioAfterTranscription') void syncNow();
  };

  const pickTheme = (m: ThemeMode) => {
    setMode(m);
    // guarda também na conta (se não houver internet, fica só neste aparelho)
    api('PATCH', '/users/me', { theme: m }).catch(() => {});
  };

  const confirmSignOut = () => {
    const unsent = queue.pending + queue.media;
    Alert.alert(
      'Sair da conta?',
      unsent > 0 ? `Há ${unsent} ${unsent === 1 ? 'item' : 'itens'} que ainda não foram enviados ao servidor. Se sair agora, ${unsent === 1 ? 'ele será perdido' : 'eles serão perdidos'}. Tente sincronizar antes.` : 'Os dados deste aparelho serão apagados. Eles continuam guardados no servidor e voltam quando você entrar de novo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  };

  const [exporting, setExporting] = useState(false);
  const downloadData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await api('GET', '/users/me/export');
      const uri = `${FileSystem.cacheDirectory}caderno-de-campo-dados.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2));
      if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não consegue compartilhar arquivos.');
      await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Meus dados do Caderno de Campo', UTI: 'public.json' });
    } catch (e) {
      Alert.alert('Não foi possível baixar os dados', e instanceof Error ? e.message : 'Verifique a internet e tente de novo.');
    }
    setExporting(false);
  };

  const confirmSignOutEverywhere = () =>
    Alert.alert('Sair de todos os aparelhos?', 'Você sai deste e dos outros aparelhos onde está conectado. Os dados continuam guardados no servidor.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair de todos',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('DELETE', '/users/me/sessions');
            await signOut();
          } catch (e) {
            Alert.alert('Não foi possível sair de todos', e instanceof Error ? e.message : 'Verifique a internet e tente de novo.');
          }
        },
      },
    ]);

  const confirmDelete = () =>
    Alert.alert('Excluir a conta?', 'Isso apaga tudo para sempre: períodos, matérias, relatórios, registros, fotos e anotações. Não dá para desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Continuar',
        style: 'destructive',
        onPress: () =>
          Alert.prompt(
            'Confirme com a sua senha',
            'Digite a senha para excluir a conta.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Excluir',
                style: 'destructive',
                onPress: async (password?: string) => {
                  try {
                    await api('DELETE', '/users/me', { password });
                    await signOut();
                  } catch (e) {
                    Alert.alert('Não foi possível excluir', e instanceof Error ? e.message : 'Verifique a senha e a internet.');
                  }
                },
              },
            ],
            'secure-text',
          ),
      },
    ]);

  const sectionTitle = (t: string) => (
    <Text weight="extrabold" style={{ fontSize: 19 }}>
      {t}
    </Text>
  );
  const note = (t: string) => (
    <Text weight="semibold" muted style={{ fontSize: 12, lineHeight: 18 }}>
      {t}
    </Text>
  );
  const status = (on: boolean, yes: string, no: string) => (
    <Text weight="extrabold" style={{ fontSize: 12, color: on ? '#14663F' : colors.danger }}>
      {on ? yes : no}
    </Text>
  );
  const sw = (key: keyof Settings) => <Switch value={settings?.[key] ?? false} onValueChange={(v) => void toggle(key, v)} trackColor={{ true: '#0B5D3B' }} />;

  const unsent = queue.pending + queue.media;
  const syncTitle = !online ? 'Sem internet' : syncing ? 'Sincronizando...' : lastError ? 'Não foi possível sincronizar' : unsent > 0 ? 'Aguardando envio' : 'Tudo sincronizado';
  const syncHint = `${lastSyncAt ? `Última vez ${formatUpdated(lastSyncAt.toISOString())}` : 'Ainda não sincronizou nesta abertura'} · ${unsent > 0 ? `${unsent} ${unsent === 1 ? 'item' : 'itens'} pendente${unsent === 1 ? '' : 's'}` : 'nada pendente'}${queue.failed ? ` · ${queue.failed} com erro` : ''}`;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
          <Icon name="right" size={22} color={colors.text} />
        </Pressable>
        <Text weight="extrabold" style={{ fontSize: 22, letterSpacing: -0.5 }}>
          Conta e configurações
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 22 }} showsVerticalScrollIndicator={false}>
        {/* Perfil */}
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#0B5D3B', alignItems: 'center', justifyContent: 'center' }}>
              <Text weight="extrabold" style={{ fontSize: 20, color: '#fff' }}>
                {initialsOf(profile?.name)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text weight="extrabold" style={{ fontSize: 18 }}>
                {profile?.name ?? '—'}
              </Text>
              <Text weight="semibold" muted style={{ fontSize: 13 }}>
                {profile?.email}
              </Text>
            </View>
          </View>
          <Text weight="semibold" muted style={{ fontSize: 13 }}>
            {[profile?.course, profile?.institution, profile?.periodName].filter(Boolean).join(' · ') || 'Curso, instituição e período ainda não informados'}
          </Text>
          {profile && (!profile.course || !profile.institution) ? (
            <Text weight="semibold" muted style={{ fontSize: 12, lineHeight: 18 }}>
              Informe o curso e a instituição em Editar perfil.
            </Text>
          ) : null}
          <Pressable onPress={() => router.push('/editar-perfil')} style={{ minHeight: 46, borderRadius: 999, borderWidth: 2, borderColor: '#0B5D3B', alignItems: 'center', justifyContent: 'center' }}>
            <Text weight="extrabold" style={{ fontSize: 14 }}>
              Editar perfil
            </Text>
          </Pressable>
        </Card>

        {/* Períodos */}
        <Card style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
          <Row title="Períodos" hint="Período ativo, anteriores e resumo" onPress={() => router.push('/periodos')} right={<Icon name="right" size={18} color={colors.muted} />} last />
        </Card>

        {/* Aparência */}
        <View style={{ gap: 10 }}>
          {sectionTitle('Aparência')}
          <Card style={{ gap: 12 }}>
            <Text weight="bold" style={{ fontSize: 15 }}>
              Tema
            </Text>
            <View style={{ flexDirection: 'row', backgroundColor: colors.chipBg, borderRadius: 999, padding: 4 }}>
              {modes.map((m) => (
                <Pressable key={m.value} onPress={() => pickTheme(m.value)} style={{ flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: mode === m.value ? '#0B5D3B' : 'transparent' }}>
                  <Text weight="extrabold" style={{ fontSize: 13, color: mode === m.value ? '#fff' : colors.muted }}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </View>

        {/* Permissões */}
        <View style={{ gap: 10 }}>
          {sectionTitle('Permissões do aparelho')}
          <Card style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
            <Row title="Localização" hint="Clima de cada registro de campo" right={status(perm.location, 'Permitida', 'Desligada')} onPress={() => void Linking.openSettings()} />
            <Row title="Notificações" hint="Lembretes no celular" right={status(perm.notifications, 'Permitidas', 'Desligadas')} onPress={() => void Linking.openSettings()} last />
          </Card>
          {note('As permissões são do sistema. Para mudar, toque no item e o app abre as configurações do celular.')}
        </View>

        {/* Avisos */}
        <View style={{ gap: 10 }}>
          {sectionTitle('Avisos')}
          <Card style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
            <Row title="Provas e entregas" hint="Conforme o lembrete de cada evento" right={sw('examsAndDeadlines')} />
            <Row title="Véspera da aula de campo" hint="Aviso às 18h do dia anterior" right={sw('fieldClassEve')} />
            <Row title="Entrega de relatório" hint="Conforme a data de entrega" right={sw('reportDeadline')} />
            <Row title="Registrar depois da aula de campo" hint="Aviso às 18h se ainda não houver registro" right={sw('remindRecordAfterField')} last />
          </Card>
          {note('Anotações não geram aviso.')}
        </View>

        {/* Mercado */}
        <View style={{ gap: 10 }}>
          {sectionTitle('Mercado')}
          <Card style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
            <Row title="Cidade das cotações" hint="Usada para soja e milho" right={<Text weight="bold" style={{ fontSize: 14 }}>{profile?.city ?? '—'}</Text>} last />
          </Card>
        </View>

        {/* Sincronização */}
        <View style={{ gap: 10 }}>
          {sectionTitle('Sincronização e modo offline')}
          <Card style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
            <Row title={syncTitle} hint={syncHint} right={status(online && !lastError && unsent === 0 && !syncing, 'Em dia', syncing ? '...' : 'Atenção')} />
            <Row title="Itens não enviados" hint={queue.failed ? `${queue.failed} ${queue.failed === 1 ? "item recusado" : "itens recusados"} pelo servidor` : "Ver o que está esperando para subir"} onPress={() => router.push("/itens-nao-enviados")} right={<Icon name="right" size={18} color={colors.muted} />} />
            <Row title={syncing ? "Sincronizando..." : "Sincronizar agora"} hint="Envia o que ficou guardado no celular" onPress={syncing ? undefined : () => void syncNow()} right={syncing ? <ActivityIndicator color={colors.primary} /> : <Icon name="right" size={18} color={colors.muted} />} />
            <Row title="Enviar fotos só no Wi-Fi" hint="Economiza o seu pacote de dados" right={sw('photosWifiOnly')} />
            <Row title="Apagar o áudio depois de transcrever" hint="Guarda só o texto e libera espaço" right={sw('deleteAudioAfterTranscription')} last />
          </Card>
          {note('Sem internet, o app continua funcionando. Registros, relatórios, anotações, eventos e matérias ficam guardados no celular e sobem sozinhos quando a conexão voltar.')}
        </View>

        {/* Segurança */}
        <View style={{ gap: 10 }}>
          {sectionTitle('Segurança')}
          <Card style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
            <Row title="Alterar senha" onPress={() => router.push('/alterar-senha')} right={<Icon name="right" size={18} color={colors.muted} />} />
            <Row title="Sair de todos os aparelhos" hint="Encerra a sessão em todos os celulares e computadores" onPress={confirmSignOutEverywhere} right={<Icon name="right" size={18} color={colors.muted} />} />
            <Row title={exporting ? "Preparando os dados..." : "Baixar todos os meus dados"} hint="Gera um arquivo com tudo o que está na sua conta" onPress={downloadData} right={exporting ? <ActivityIndicator color={colors.primary} /> : <Icon name="right" size={18} color={colors.muted} />} last />
          </Card>
        </View>

        <View style={{ gap: 10 }}>
          <Pressable onPress={confirmSignOut} style={{ minHeight: 52, borderRadius: 999, borderWidth: 2, borderColor: '#0B5D3B', alignItems: 'center', justifyContent: 'center' }}>
            <Text weight="extrabold" style={{ fontSize: 16 }}>
              Sair
            </Text>
          </Pressable>
          <Pressable onPress={confirmDelete} style={{ minHeight: 52, borderRadius: 999, borderWidth: 2, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Text weight="extrabold" style={{ fontSize: 16, color: colors.danger }}>
              Excluir minha conta
            </Text>
          </Pressable>
          {note('Excluir a conta apaga tudo para sempre: períodos, matérias, relatórios, registros, fotos e anotações. O app pede a senha e a confirmação antes.')}
        </View>

        <Text weight="semibold" muted style={{ fontSize: 12, textAlign: 'center' }}>
          {'Caderno de Campo · versão 1\nDesenvolvido por Tharles Cunha'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
