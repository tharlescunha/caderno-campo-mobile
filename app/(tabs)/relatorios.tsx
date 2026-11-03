import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { Card, EmptyState, PendingBadge, Text } from '../../src/components/ui';
import { listReports, type ReportFilter, type ReportItem } from '../../src/data/reports';
import { useSync } from '../../src/sync';
import { TagChip } from '../../src/components/TagField';
import { fonts, subjectTones, useTheme } from '../../src/theme';

// Aba "Relatórios" (design/Relatorios.dc.html): lista com filtro de situação e busca.
const filters: { value: ReportFilter; label: string; title: string }[] = [
  { value: 'andamento', label: 'Em andamento', title: 'Em andamento' },
  { value: 'finalizados', label: 'Finalizados', title: 'Finalizados' },
  { value: 'todos', label: 'Todos', title: 'Todos os relatórios' },
];

const weekday = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${weekday[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Relatorios() {
  const { colors } = useTheme();
  const router = useRouter();
  const { lastSyncAt } = useSync();
  const [filter, setFilter] = useState<ReportFilter>('andamento');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ReportItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      void listReports(filter).then(setItems);
    }, [filter, lastSyncAt]),
  );

  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((r) => r.title.toLowerCase().includes(q) || r.subjectName.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q))) : items;
  const current = filters.find((f) => f.value === filter)!;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text weight="semibold" muted style={{ fontSize: 12 }}>
              acompanhamentos e registros de campo
            </Text>
            <Text weight="extrabold" style={{ fontSize: 26, letterSpacing: -0.8, marginTop: 2 }}>
              Relatórios
            </Text>
          </View>
          <Pressable onPress={() => router.push('/novo-relatorio')} accessibilityLabel="Novo relatório" style={{ width: 48, height: 48, borderRadius: 18, backgroundColor: '#0B5D3B', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 16, minHeight: 48 }}>
            <Icon name="search" size={20} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Buscar por título, matéria ou tag" placeholderTextColor={colors.muted} accessibilityLabel="Buscar nos relatórios" style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, minHeight: 44 }} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 999, padding: 4 }}>
            {filters.map((f) => (
              <Pressable key={f.value} onPress={() => setFilter(f.value)} style={{ flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: filter === f.value ? '#0B5D3B' : 'transparent' }}>
                <Text weight="extrabold" style={{ fontSize: 13, color: filter === f.value ? '#fff' : colors.muted }}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text weight="extrabold" style={{ fontSize: 19 }}>
              {current.title}
            </Text>
            <Text weight="semibold" muted style={{ fontSize: 12 }}>
              {shown.length} {shown.length === 1 ? 'relatório' : 'relatórios'}
            </Text>
          </View>

          {shown.length === 0 ? (
            <EmptyState
              icon="note"
              title={q ? 'Nada encontrado' : filter === 'finalizados' ? 'Nenhum relatório finalizado' : 'Nenhum relatório ainda'}
              hint={q ? 'Tente outra palavra.' : 'Toque no "+" para criar o primeiro.'}
            />
          ) : null}

          {shown.map((r) => {
            const tone = subjectTones[r.subjectColor];
            return (
              <Pressable key={r.id} onPress={() => router.push({ pathname: '/relatorio/[id]', params: { id: r.id } })} accessibilityLabel={`Abrir ${r.title}`}>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <View style={{ height: 110, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
                  {r.cover ? <Image source={{ uri: r.cover }} resizeMode="cover" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} /> : <Icon name="camera" size={30} color={tone.fg} />}
                  <View style={{ position: 'absolute', left: 12, top: 12, backgroundColor: '#0B5D3B', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                    <Text weight="extrabold" style={{ color: '#fff', fontSize: 11 }}>
                      {r.kind === 'continuo' ? 'Contínuo' : 'Pontual'}
                    </Text>
                  </View>
                </View>
                <View style={{ padding: 16, gap: 10 }}>
                  <Text weight="extrabold" style={{ fontSize: 13, color: tone.fg }}>
                    {r.subjectName}
                  </Text>
                  <Text weight="extrabold" style={{ fontSize: 18, lineHeight: 23, letterSpacing: -0.2 }}>
                    {r.title}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Fact value={String(r.entries)} label="registros" />
                    <Fact value={r.lastEntryAt ? shortDate(r.lastEntryAt) : '—'} label="último registro" small />
                    <Fact value={r.delivery ?? 'sem data'} label="entrega" small />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <View style={{ backgroundColor: r.finished ? colors.chipBg : '#DDF1E5', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                      <Text weight="extrabold" style={{ fontSize: 11, color: r.finished ? '#2F463C' : '#14663F' }}>
                        {r.finished ? 'Finalizado' : 'Em andamento'}
                      </Text>
                    </View>
                    {r.pending ? <PendingBadge /> : null}
                    {r.tags.map((t) => (
                      <TagChip key={t} name={t} onPress={() => setQuery(t)} />
                    ))}
                  </View>
                </View>
              </Card>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Fact({ value, label, small }: { value: string; label: string; small?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.chipBg, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10 }}>
      <Text weight="extrabold" style={{ fontSize: small ? 14 : 17, paddingTop: small ? 2 : 0 }}>
        {value}
      </Text>
      <Text weight="semibold" muted style={{ fontSize: 11 }}>
        {label}
      </Text>
    </View>
  );
}
