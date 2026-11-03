import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../src/components/Icon';
import { Card, EmptyState, Text } from '../src/components/ui';
import { formatUpdated } from '../src/data/market';
import { useInbox, type InboxItem } from '../src/notifications/inbox';
import { tones, useTheme } from '../src/theme';

// Tela "Notificações" (design/Notificacoes.dc.html): avisos que o servidor já entregou, do mais novo ao mais antigo.
const iconOf: Record<InboxItem['type'], { icon: IconName; tone: { fg: string; bg: string } }> = {
  event_reminder: { icon: 'cal', tone: tones.purple },
  field_class_reminder: { icon: 'sprout', tone: tones.green },
  delivery_reminder: { icon: 'flag', tone: tones.amber },
  post_field_record_reminder: { icon: 'pencil', tone: tones.brown },
};
const pad = (n: number) => String(n).padStart(2, '0');
const hour = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}h${pad(d.getMinutes())}`;
};
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function Notificacoes() {
  const { colors } = useTheme();
  const router = useRouter();
  const { data, unread, offline, updatedAt, loading, markRead, markAllRead } = useInbox();
  const items = data?.items ?? [];

  const now = new Date();
  const todayKey = dayKey(now.toISOString());
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = dayKey(yesterday.toISOString());
  const stamp = (n: InboxItem) => n.delivered_at ?? n.scheduled_for;
  const groups = [
    { title: 'Hoje', list: items.filter((n) => dayKey(stamp(n)) === todayKey) },
    { title: 'Ontem', list: items.filter((n) => dayKey(stamp(n)) === yesterdayKey) },
    { title: 'Mais antigas', list: items.filter((n) => dayKey(stamp(n)) !== todayKey && dayKey(stamp(n)) !== yesterdayKey) },
  ].filter((g) => g.list.length);

  const open = (n: InboxItem) => {
    if (!n.read_at) void markRead(n.id);
    const r = n.reference;
    if (!r) return;
    if (r.type === 'report') router.push({ pathname: '/relatorio/[id]', params: { id: r.id } });
    else if (r.type === 'subject') router.push({ pathname: '/materia/[id]', params: { id: r.id } });
    else router.push({ pathname: '/novo-evento', params: { id: r.id } });
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
          <Icon name="right" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text weight="semibold" muted style={{ fontSize: 12 }}>
            lembretes e avisos
          </Text>
          <Text weight="extrabold" style={{ fontSize: 24, letterSpacing: -0.6 }}>
            Notificações
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text weight="semibold" muted style={{ fontSize: 12 }}>
            {unread === 0 ? 'Nenhuma não lida' : unread === 1 ? '1 não lida' : `${unread} não lidas`}
          </Text>
          {unread > 0 ? (
            <Pressable onPress={() => void markAllRead()} hitSlop={8}>
              <Text weight="extrabold" style={{ fontSize: 13, color: colors.link }}>
                Marcar todas como lidas
              </Text>
            </Pressable>
          ) : null}
        </View>

        {!data && !loading ? <EmptyState icon="bell" title="Sem conexão" hint="Os avisos aparecem aqui quando houver internet. Os lembretes do celular continuam funcionando." /> : null}
        {data && items.length === 0 ? <EmptyState icon="bell" title="Nenhum aviso ainda" hint="Lembretes de provas, entregas e aulas de campo aparecem aqui." /> : null}

        {groups.map((g) => (
          <View key={g.title} style={{ gap: 8 }}>
            <Text weight="extrabold" style={{ fontSize: 19 }}>
              {g.title}
            </Text>
            <Card style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
              {g.list.map((n, i) => {
                const t = iconOf[n.type];
                return (
                  <Pressable key={n.id} onPress={() => open(n)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: i === g.list.length - 1 ? 0 : 1, borderBottomColor: colors.lineSoft }}>
                    <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: t.tone.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={t.icon} size={18} color={t.tone.fg} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text weight={n.read_at ? 'semibold' : 'extrabold'} style={{ fontSize: 14, lineHeight: 18 }}>
                        {n.title}
                      </Text>
                      {n.text ? (
                        <Text muted style={{ fontSize: 13, lineHeight: 19 }}>
                          {n.text}
                        </Text>
                      ) : null}
                      <Text weight="semibold" muted style={{ fontSize: 11 }}>
                        {g.title === 'Mais antigas' ? `${pad(new Date(stamp(n)).getDate())}/${pad(new Date(stamp(n)).getMonth() + 1)} · ` : ''}
                        {hour(stamp(n))}
                      </Text>
                    </View>
                    {!n.read_at ? <View accessibilityLabel="Não lida" style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#D9483B', marginTop: 6 }} /> : null}
                  </Pressable>
                );
              })}
            </Card>
          </View>
        ))}

        <Text weight="semibold" muted style={{ fontSize: 11 }}>
          {offline && updatedAt ? `Sem conexão. Avisos salvos em ${formatUpdated(updatedAt)}. ` : ''}
          As notificações ficam guardadas por 30 dias. Anotações não geram aviso.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
