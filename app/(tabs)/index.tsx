import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { getActivePeriod } from '../../src/data/periods';
import { countNotesToday } from '../../src/data/notes';
import { getProfile, initialsOf, syncOverview } from '../../src/data/settings';
import { getPendings, getRecentActivity, type Activity, type Pending } from '../../src/data/home';
import { getTodaySubject, getUpcomingEvents, type TodaySubject, type UpcomingEvent } from '../../src/data/today';
import { Change, UpdatedAt } from '../../src/components/MarketStrip';
import { money, useMarket, useReadNews } from '../../src/data/market';
import { useInbox } from '../../src/notifications/inbox';
import { useSync } from '../../src/sync';
import { Pressable, ScrollView, View } from 'react-native';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../src/components/Icon';
import { Button, Card, Chip, IconBox, SectionHeader, Text } from '../../src/components/ui';
import { tones, useTheme } from '../../src/theme';

const newsTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
};

// anotação = amarelo, registro de campo = verde, relatório = azul
const activityTone = { anotacao: tones.amber, registro: tones.green, relatorio: tones.blue } as const;

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

function formatDate(d: Date) {
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s;
}

export default function Hoje() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const market = useMarket();
  const { unread } = useInbox();
  const readNews = useReadNews();
  const router = useRouter();
  const [subject, setSubject] = useState<TodaySubject | null>(null);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [noteCount, setNoteCount] = useState(0);
  const [initials, setInitials] = useState('');
  const [firstName, setFirstName] = useState('');
  const [pendings, setPendings] = useState<Pending[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);

  const [refused, setRefused] = useState(0);
  const { online, syncing, lastError, lastSyncAt, syncNow } = useSync();
  // com internet e mesmo assim falhou = erro de verdade (vermelho); sem internet é só um aviso (amarelo)
  const failed = online && Boolean(lastError) && !syncing;

  // Tudo vem do banco do celular; a sincronização roda em segundo plano e, quando termina, a tela recarrega.
  const [hasPeriod, setHasPeriod] = useState<boolean | null>(null);
  const load = useCallback(async () => {
    void syncOverview().then((o) => setRefused(o.failed));
    setHasPeriod((await getActivePeriod()) !== null);
    const profile = await getProfile();
    setInitials(initialsOf(profile?.name));
    setFirstName(profile?.name?.split(' ')[0] ?? '');
    const today = await getTodaySubject();
    setSubject(today);
    setNoteCount(today ? await countNotesToday(today.id) : 0);
    setEvents(await getUpcomingEvents());
    setPendings(await getPendings());
    setActivity(await getRecentActivity());
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, lastSyncAt]),
  );
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(isDark ? 'light' : 'dark');
    }, [isDark]),
  );
  const hero = isDark ? '#0E3B28' : '#0B5D3B';
  const m = market.data;
  const quotes = [
    { nome: 'Soja · saca', valor: m?.quotes.soy ? money(m.quotes.soy.price) : '—', pct: m?.quotes.soy?.change_pct },
    { nome: 'Milho · saca', valor: m?.quotes.corn ? money(m.quotes.corn.price) : '—', pct: m?.quotes.corn?.change_pct },
    { nome: 'Dólar', valor: m?.dollar ? money(m.dollar.value) : '—', pct: m?.dollar?.change_pct },
  ];
  const w = m?.weather;
  const weather = w?.temperature_c != null ? `${m?.city ?? ''} · ${Math.round(w.temperature_c)}°${w.description ? ` ${w.description}` : ''}` : `${m?.city ?? 'Clima'} · clima indisponível`;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* Faixa de painel: nome do app, saudação e mercado dentro da cor de destaque */}
        <View style={{ backgroundColor: hero, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 22, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -70, top: -80, width: 230, height: 230, borderRadius: 115, backgroundColor: '#C8F169', opacity: 0.14 }} />
          <View style={{ position: 'absolute', left: -60, bottom: -90, width: 200, height: 200, borderRadius: 100, backgroundColor: '#FFFFFF', opacity: 0.06 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Tocar no logo abre a tela Sobre */}
            <Pressable onPress={() => router.push('/sobre')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: '#C8F169', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="logo" size={17} color="#0B5D3B" />
              </View>
              <Text weight="bold" style={{ fontSize: 13, color: '#fff', opacity: 0.92 }}>
                Caderno de Campo
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <GlassButton label="Buscar" icon="search" onPress={() => router.push('/busca')} />
              <GlassButton label="Notificações" icon="bell" dot={unread > 0} onPress={() => router.push('/notificacoes')} />
              <Pressable onPress={() => router.push('/configuracoes')} accessibilityLabel="Conta e configurações" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#C8F169', alignItems: 'center', justifyContent: 'center' }}>
                <Text weight="extrabold" style={{ color: '#0B5D3B', fontSize: 14 }}>
                  {initials}
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={{ marginTop: 22 }}>
            <Text weight="semibold" style={{ fontSize: 13, color: '#fff', opacity: 0.8 }}>
              {formatDate(new Date())}
            </Text>
            <Text weight="extrabold" style={{ fontSize: 30, color: '#fff', letterSpacing: -0.9, lineHeight: 34, marginTop: 2 }}>
              {greeting()}
              {firstName ? `, ${firstName}` : ''}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/mercado')} accessibilityLabel="Abrir o mercado" style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
            {quotes.map((q) => (
              <View key={q.nome} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: 12, gap: 5 }}>
                <Text weight="bold" style={{ fontSize: 11, color: '#fff', opacity: 0.8 }}>
                  {q.nome}
                </Text>
                <Text weight="extrabold" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 20, color: '#fff', letterSpacing: -0.5 }}>
                  {q.valor}
                </Text>
                <Change pct={q.pct} />
              </View>
            ))}
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <Icon name="sun" size={17} color="#C8F169" />
            <Text weight="semibold" numberOfLines={1} style={{ flex: 1, fontSize: 13, color: '#fff' }}>
              {weather}
            </Text>
          </View>
          <UpdatedAt market={market} style={{ marginTop: 4, color: 'rgba(255,255,255,0.7)' }} />
        </View>

        {/* Sem período ativo: convida a cadastrar */}
        {hasPeriod === false ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <Card style={{ gap: 10 }}>
              <Text weight="extrabold" style={{ fontSize: 16 }}>
                Falta só o seu período
              </Text>
              <Text muted style={{ fontSize: 13, lineHeight: 19 }}>
                As matérias ficam dentro de um período. Cadastre o período em que você está.
              </Text>
              <Button label="Cadastrar período" variant="primary" onPress={() => router.push('/novo-periodo')} />
            </Card>
          </View>
        ) : null}

        {/* Itens que o servidor recusou: o botão Ver abre a lista */}
        {refused > 0 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.dangerBg, borderRadius: 20, padding: 14 }}>
              <View style={{ flex: 1 }}>
                <Text weight="extrabold" style={{ fontSize: 14, color: colors.danger }}>
                  {refused === 1 ? '1 item não foi aceito pelo servidor' : `${refused} itens não foram aceitos pelo servidor`}
                </Text>
                <Text weight="semibold" style={{ fontSize: 12, color: colors.danger }}>
                  Tudo continua guardado no celular.
                </Text>
              </View>
              <Pressable onPress={() => router.push('/itens-nao-enviados')} style={{ paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' }}>
                <Text weight="extrabold" style={{ fontSize: 13, color: colors.danger }}>
                  Ver
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Cartão de conexão: só aparece quando há algo a dizer */}
        {!online || lastError || syncing ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: failed ? colors.dangerBg : tones.amber.bg, borderRadius: 20, padding: 14 }}>
              <View style={{ flex: 1 }}>
                <Text weight="extrabold" style={{ fontSize: 14, color: failed ? colors.danger : tones.amber.fg }}>
                  {!online ? 'Sem internet' : failed ? 'Não foi possível sincronizar' : 'Sincronizando...'}
                </Text>
                <Text weight="semibold" style={{ fontSize: 12, color: failed ? colors.danger : tones.amber.fg }}>
                  {!online ? 'Tudo o que você fizer fica salvo no celular e é enviado quando a internet voltar.' : failed ? 'Seus dados continuam salvos no celular.' : 'Enviando e buscando novidades.'}
                </Text>
              </View>
              {failed ? (
                <Pressable onPress={syncNow} style={{ paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' }}>
                  <Text weight="extrabold" style={{ fontSize: 13, color: colors.danger }}>
                    Tentar de novo
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Matéria de hoje */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Pressable disabled={!subject} onPress={() => subject && router.push({ pathname: '/materia/[id]', params: { id: subject.id } })} style={{ backgroundColor: '#C8F169', borderRadius: 28, padding: 18, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text weight="extrabold" style={{ fontSize: 12, color: '#1B2A06', opacity: 0.75, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Matéria de hoje
              </Text>
              {subject ? (
                <View style={{ backgroundColor: '#0B5D3B', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text weight="extrabold" style={{ fontSize: 11, color: '#fff' }}>
                    {subject.classType === 'sala' ? 'aula' : subject.classType === 'campo' ? 'aula de campo' : 'sala e campo'}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text weight="extrabold" style={{ fontSize: 24, color: '#1B2A06', letterSpacing: -0.6, lineHeight: 28 }}>
              {subject ? subject.name : 'Sem aula hoje'}
            </Text>
            {subject ? (
              <>
                <Text weight="semibold" style={{ fontSize: 13, color: '#1B2A06', opacity: 0.8 }}>
                  {subject.teacher ? `${/^prof/i.test(subject.teacher) ? subject.teacher : `Prof. ${subject.teacher}`} · ` : ''}
                  {noteCount === 0 ? 'nenhuma anotação desta aula ainda' : `${noteCount} ${noteCount === 1 ? 'anotação' : 'anotações'} desta aula hoje`}
                </Text>
                <Button label="Anotar aula" icon="pencil" variant="primary" onPress={() => router.push({ pathname: '/nova-nota', params: { subjectId: subject.id } })} />
              </>
            ) : (
              <Text weight="semibold" style={{ fontSize: 13, color: '#1B2A06', opacity: 0.8 }}>
                Aproveite para colocar as anotações em dia.
              </Text>
            )}
          </Pressable>
        </View>

        {/* Pendências */}
        <View style={{ paddingHorizontal: 16, paddingTop: 22, gap: 10 }}>
          <SectionHeader title="Pendências" aside={pendings.length ? `${pendings.length} ${pendings.length === 1 ? 'item' : 'itens'}` : undefined} />
          <Card style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
            {pendings.length === 0 ? (
              <Text weight="semibold" muted style={{ fontSize: 13, paddingVertical: 14 }}>
                Tudo em dia. Nenhuma pendência.
              </Text>
            ) : null}
            {pendings.map((p, i) => (
              <Pressable key={p.id} onPress={() => router.push({ pathname: '/relatorio/[id]', params: { id: p.reportId } })}>
                <Row last={i === pendings.length - 1}>
                  <IconBox name={p.icon} fg={tones[p.tone].fg} bg={tones[p.tone].bg} />
                  <View style={{ flex: 1 }}>
                    <Text weight="bold" style={{ fontSize: 14, lineHeight: 18 }}>
                      {p.title}
                    </Text>
                    <Text weight="semibold" muted style={{ fontSize: 12 }}>
                      {p.sub}
                    </Text>
                  </View>
                  <Chip label={p.tag} fg={tones[p.tone].fg} bg={tones[p.tone].bg} />
                </Row>
              </Pressable>
            ))}
          </Card>
        </View>

        {/* Próximos eventos */}
        <View style={{ paddingHorizontal: 16, paddingTop: 22, gap: 10 }}>
          <SectionHeader title="Próximos eventos" aside="Agenda" onAsidePress={() => router.push('/agenda')} />
          <Card style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
            {events.length === 0 ? (
              <Text weight="semibold" muted style={{ fontSize: 13, paddingVertical: 14 }}>
                Nenhum evento marcado.
              </Text>
            ) : null}
            {events.map((e, i) => (
              <Pressable key={e.id} onPress={() => (e.reportId ? router.push({ pathname: '/relatorio/[id]', params: { id: e.reportId } }) : router.push({ pathname: '/novo-evento', params: { id: e.id } }))}>
              <Row last={i === events.length - 1}>
                <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: tones[e.tone].bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text weight="bold" style={{ fontSize: 10, color: tones[e.tone].fg, textTransform: 'uppercase' }}>
                    {e.dow}
                  </Text>
                  <Text weight="extrabold" style={{ fontSize: 17, color: tones[e.tone].fg, lineHeight: 19 }}>
                    {e.day}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text weight="bold" style={{ fontSize: 14, lineHeight: 18 }}>
                    {e.title}
                  </Text>
                  <Text weight="semibold" muted style={{ fontSize: 12 }}>
                    {e.kind}
                  </Text>
                </View>
                <Text weight="extrabold" style={{ fontSize: 12, color: tones[e.tone].fg }}>
                  {e.when}
                </Text>
              </Row>
              </Pressable>
            ))}
          </Card>
        </View>

        {/* Últimas atividades */}
        <View style={{ paddingHorizontal: 16, paddingTop: 22, gap: 10 }}>
          <SectionHeader title="Últimas atividades" />
          <Card style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
            {activity.length === 0 ? (
              <Text weight="semibold" muted style={{ fontSize: 13, paddingVertical: 14 }}>
                Registros, anotações e relatórios que você fizer aparecem aqui.
              </Text>
            ) : null}
            {activity.map((u, i) => (
              <Pressable key={u.id} onPress={() => (u.kind === 'anotacao' ? router.push({ pathname: '/nova-nota', params: { id: u.targetId } }) : router.push({ pathname: '/relatorio/[id]', params: { id: u.targetId } }))}>
                <Row last={i === activity.length - 1}>
                  <IconBox name={u.icon} fg={activityTone[u.kind].fg} bg={activityTone[u.kind].bg} size={36} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text weight="bold" style={{ fontSize: 14, lineHeight: 18 }}>
                      {u.title}
                    </Text>
                    <Text weight="semibold" muted style={{ fontSize: 12 }}>
                      {u.subject}
                    </Text>
                  </View>
                  <Text weight="semibold" muted style={{ fontSize: 11 }}>
                    {u.when}
                  </Text>
                </Row>
              </Pressable>
            ))}
          </Card>
        </View>

        {/* Notícia do dia */}
        {market.data?.news?.[0] ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 22 }}>
            <Pressable onPress={() => router.push('/mercado')}>
              <Card style={{ paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconBox name="news" fg={tones.blue.fg} bg={tones.blue.bg} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    {readNews.has(market.data.news[0].id) ? <Icon name="check" size={13} color="#1E8A5A" /> : null}
                    <Text weight="semibold" muted style={{ fontSize: 11 }}>
                      Notícia do dia · {newsTime(market.data.news[0].published_at)}
                    </Text>
                  </View>
                  <Text weight="bold" style={{ fontSize: 14, lineHeight: 18, marginTop: 2 }} numberOfLines={2}>
                    {market.data.news[0].title}
                  </Text>
                </View>
              </Card>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Row({ children, last }: { children: React.ReactNode; last: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.lineSoft }}>{children}</View>
  );
}

function GlassButton({ label, icon, dot, onPress }: { label: string; icon: IconName; dot?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={21} color="#fff" />
      {dot ? <View style={{ position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: '#C8F169' }} /> : null}
    </Pressable>
  );
}

function RoundButton({ label, icon, dot, onPress }: { label: string; icon: IconName; dot?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={22} color={colors.text} />
      {dot ? <View style={{ position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: '#D9483B', borderWidth: 2, borderColor: colors.card }} /> : null}
    </Pressable>
  );
}
