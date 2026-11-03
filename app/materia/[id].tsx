import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../src/components/Icon';
import { Card, EmptyState, Text } from '../../src/components/ui';
import { getSubjectPage, type SubjectPage } from '../../src/data/subjectPage';
import { useSync } from '../../src/sync';
import { subjectTones, tones, useTheme } from '../../src/theme';

// Tela "Matéria" (design/Materia.dc.html): tudo desta matéria num lugar só: datas, relatórios e anotações.
const weekday = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const shortDate = (s: string) => {
  const d = s.length === 10 ? new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) : new Date(s);
  return `${weekday[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Materia() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lastSyncAt } = useSync();
  const [page, setPage] = useState<SubjectPage | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      void getSubjectPage(id).then(setPage);
    }, [id, lastSyncAt]),
  );

  if (page === undefined) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (page === null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <EmptyState icon="book" title="Matéria não encontrada" hint="Volte e abra a lista de novo." />
      </SafeAreaView>
    );
  }

  const tone = subjectTones[page.color];
  const upcoming = page.events.filter((e) => !e.past);
  const openEvent = (e: SubjectPage['events'][number]) => (e.reportId ? router.push({ pathname: '/relatorio/[id]', params: { id: e.reportId } }) : router.push({ pathname: '/novo-evento', params: { id: e.id } }));

  const sectionHead = (title: string, right?: { label: string; onPress: () => void }, count?: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <Text weight="extrabold" style={{ fontSize: 19 }}>
        {title}
      </Text>
      {right ? (
        <Pressable onPress={right.onPress} hitSlop={8}>
          <Text weight="extrabold" style={{ fontSize: 14, color: colors.link }}>
            {right.label}
          </Text>
        </Pressable>
      ) : count ? (
        <Text weight="semibold" muted style={{ fontSize: 12 }}>
          {count}
        </Text>
      ) : null}
    </View>
  );

  const action = (label: string, icon: IconName, onPress: () => void, primary = false) => (
    <Pressable onPress={onPress} style={{ flex: 1, minHeight: 48, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: primary ? '#0B5D3B' : colors.card, borderWidth: 2, borderColor: '#0B5D3B' }}>
      <Icon name={icon} size={18} color={primary ? '#fff' : '#0B5D3B'} />
      <Text weight="extrabold" style={{ fontSize: 14, color: primary ? '#fff' : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Cabeçalho */}
        <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#0B5D3B', borderRadius: 28, padding: 18, gap: 12, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -40, top: -50, width: 140, height: 140, borderRadius: 70, backgroundColor: tone.dot, opacity: 0.9 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
              <Icon name="right" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={() => router.push({ pathname: '/nova-materia', params: { id: page.id } })} accessibilityLabel="Editar matéria" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' }}>
              <Icon name="pencil" size={15} color="#fff" />
              <Text weight="extrabold" style={{ fontSize: 13, color: '#fff' }}>
                Editar
              </Text>
            </Pressable>
          </View>
          <View style={{ gap: 4 }}>
            <Text weight="semibold" style={{ fontSize: 12, color: '#BFE3CC' }}>
              {page.scheduleText}
              {!page.active ? ' · desativada' : ''}
            </Text>
            <Text weight="extrabold" style={{ fontSize: 25, lineHeight: 29, letterSpacing: -0.6, color: '#fff' }}>
              {page.name}
            </Text>
            {page.teacher ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="user" size={15} color="#BFE3CC" />
                <Text weight="semibold" style={{ fontSize: 13, color: '#BFE3CC' }}>
                  {page.teacher}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { n: page.reports.length, r: 'relatórios' },
              { n: page.notes.length, r: 'anotações' },
              { n: upcoming.length, r: upcoming.length === 1 ? 'data próxima' : 'datas próximas' },
            ].map((c) => (
              <View key={c.r} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 }}>
                <Text weight="extrabold" style={{ fontSize: 20, color: '#fff' }}>
                  {c.n}
                </Text>
                <Text weight="semibold" style={{ fontSize: 11, color: '#BFE3CC' }}>
                  {c.r}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Ações */}
        {page.active && page.periodActive ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 14, flexDirection: 'row', gap: 10 }}>
            {action('Anotação', 'pencil', () => router.push({ pathname: '/nova-nota', params: { subjectId: page.id } }), true)}
            {action('Relatório', 'note', () => router.push({ pathname: '/novo-relatorio', params: { subjectId: page.id } }))}
          </View>
        ) : null}

        {/* Provas e entregas */}
        <View style={{ paddingHorizontal: 16, paddingTop: 22, gap: 10 }}>
          {sectionHead('Provas e entregas', page.active ? { label: '+ Lançar', onPress: () => router.push({ pathname: '/novo-evento', params: { subjectId: page.id } }) } : undefined)}
          <Card style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
            {page.events.length === 0 ? (
              <Text weight="semibold" muted style={{ fontSize: 13, paddingVertical: 14 }}>
                Nenhuma data marcada para esta matéria.
              </Text>
            ) : null}
            {page.events.map((e, i) => (
              <Pressable key={e.id} onPress={() => openEvent(e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i === page.events.length - 1 ? 0 : 1, borderBottomColor: colors.lineSoft, opacity: e.past ? 0.6 : 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: tones.amber.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={e.reportId ? 'flag' : 'cal'} size={18} color={tones.amber.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text weight="bold" style={{ fontSize: 14, lineHeight: 18 }}>
                    {e.title}
                  </Text>
                  <Text weight="semibold" muted style={{ fontSize: 12 }}>
                    {e.kind} · {shortDate(e.date)}
                  </Text>
                </View>
                <Text weight="extrabold" style={{ fontSize: 12, color: e.past ? colors.muted : tones.amber.fg }}>
                  {e.when}
                </Text>
              </Pressable>
            ))}
          </Card>
        </View>

        {/* Relatórios */}
        <View style={{ paddingHorizontal: 16, paddingTop: 22, gap: 10 }}>
          {sectionHead('Relatórios', undefined, `${page.reports.length} ${page.reports.length === 1 ? 'relatório' : 'relatórios'}`)}
          {page.reports.length === 0 ? (
            <Card>
              <Text weight="semibold" muted style={{ fontSize: 13 }}>
                Nenhum relatório desta matéria ainda.
              </Text>
            </Card>
          ) : null}
          {page.reports.map((r) => (
            <Pressable key={r.id} onPress={() => router.push({ pathname: '/relatorio/[id]', params: { id: r.id } })}>
              <Card style={{ gap: 6, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text weight="semibold" muted style={{ fontSize: 12 }}>
                    {r.kind === 'continuo' ? 'Contínuo' : 'Pontual'} · {r.entries} {r.entries === 1 ? 'registro' : 'registros'}
                  </Text>
                  <View style={{ backgroundColor: r.finished ? colors.chipBg : '#DDF1E5', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 }}>
                    <Text weight="extrabold" style={{ fontSize: 11, color: r.finished ? '#2F463C' : '#14663F' }}>
                      {r.finished ? 'Finalizado' : 'Em andamento'}
                    </Text>
                  </View>
                </View>
                <Text weight="extrabold" style={{ fontSize: 16, lineHeight: 21 }}>
                  {r.title}
                </Text>
                {r.deliveryDate ? (
                  <Text weight="semibold" muted style={{ fontSize: 12 }}>
                    Entrega {shortDate(r.deliveryDate)}
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          ))}
        </View>

        {/* Anotações da matéria */}
        <View style={{ paddingHorizontal: 16, paddingTop: 22, gap: 10 }}>
          {sectionHead('Anotações da matéria', page.active ? { label: '+ Nova', onPress: () => router.push({ pathname: '/nova-nota', params: { subjectId: page.id } }) } : undefined)}
          {page.notes.length === 0 ? (
            <Card>
              <Text weight="semibold" muted style={{ fontSize: 13 }}>
                Nenhuma anotação desta matéria ainda.
              </Text>
            </Card>
          ) : null}
          {page.notes.map((n) => (
            <Pressable key={n.id} onPress={() => router.push({ pathname: '/nova-nota', params: { id: n.id } })}>
              <Card style={{ gap: 6, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text weight="semibold" muted style={{ fontSize: 12 }}>
                    {shortDate(n.updatedAt)}
                  </Text>
                  {n.pinned ? <Icon name="pin" size={14} color="#7A5300" /> : null}
                </View>
                <Text weight="extrabold" style={{ fontSize: 16, lineHeight: 21 }}>
                  {n.title}
                </Text>
                {n.text ? (
                  <Text muted style={{ fontSize: 14, lineHeight: 21 }} numberOfLines={3}>
                    {n.text}
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
