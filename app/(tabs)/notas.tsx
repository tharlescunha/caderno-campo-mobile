import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { Card, EmptyState, PendingBadge, Text } from '../../src/components/ui';
import { listNotes, setPinned, type NoteFilter, type NoteItem } from '../../src/data/notes';
import { useSync } from '../../src/sync';
import { TagChip } from '../../src/components/TagField';
import { fonts, subjectTones, useTheme } from '../../src/theme';

// Aba "Anotações" (design/Notas.dc.html): fixadas primeiro, busca e filtro por matéria.
const filters: { value: NoteFilter; label: string; title: string }[] = [
  { value: 'todas', label: 'Todas', title: 'Todas as anotações' },
  { value: 'soltas', label: 'Sem matéria', title: 'Sem matéria' },
  { value: 'com', label: 'Com matéria', title: 'Com matéria' },
];
const weekday = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${weekday[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Notas() {
  const { colors } = useTheme();
  const router = useRouter();
  const { lastSyncAt, syncNow } = useSync();
  const [filter, setFilter] = useState<NoteFilter>('todas');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<NoteItem[]>([]);

  const load = useCallback(() => listNotes(filter).then(setItems), [filter]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, lastSyncAt]),
  );

  const q = query.trim().toLowerCase();
  const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const shown = q ? items.filter((n) => strip(`${n.title} ${n.text ?? ''} ${n.subjectName ?? ''} ${n.tags.join(' ')}`).includes(strip(q))) : items;
  const current = filters.find((f) => f.value === filter)!;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text weight="semibold" muted style={{ fontSize: 12 }}>
              ideias, leituras e lembretes
            </Text>
            <Text weight="extrabold" style={{ fontSize: 26, letterSpacing: -0.8, marginTop: 2 }}>
              Anotações
            </Text>
          </View>
          <Pressable onPress={() => router.push('/nova-nota')} accessibilityLabel="Nova anotação" style={{ width: 48, height: 48, borderRadius: 18, backgroundColor: '#0B5D3B', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 16, minHeight: 48 }}>
            <Icon name="search" size={20} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Buscar nas anotações ou por tag" placeholderTextColor={colors.muted} accessibilityLabel="Buscar nas anotações" style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, minHeight: 44 }} />
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
              {shown.length} {shown.length === 1 ? 'anotação' : 'anotações'}
            </Text>
          </View>

          {shown.length === 0 ? <EmptyState icon="notes" title={q ? 'Nada encontrado' : 'Nenhuma anotação ainda'} hint={q ? 'Tente outra palavra.' : 'Toque no “+” para anotar uma ideia, um lembrete ou um link.'} /> : null}

          {shown.map((n) => {
            const tone = n.subjectColor ? subjectTones[n.subjectColor] : { fg: colors.text, bg: colors.chipBg };
            return (
              <Card key={n.id} style={{ gap: 8, padding: 16 }}>
                <Pressable onPress={() => router.push({ pathname: '/nova-nota', params: { id: n.id } })} style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <View style={{ backgroundColor: tone.bg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, flexShrink: 1 }}>
                      <Text weight="extrabold" style={{ fontSize: 11, color: tone.fg }} numberOfLines={1}>
                        {n.subjectName ?? 'Sem matéria'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {n.pinned ? <Icon name="pin" size={14} color="#7A5300" /> : null}
                      <Text weight="semibold" muted style={{ fontSize: 12 }}>
                        {shortDate(n.updatedAt)}
                      </Text>
                    </View>
                  </View>
                  <Text weight="extrabold" style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.2 }}>
                    {n.title}
                  </Text>
                  {n.text ? (
                    <Text muted style={{ fontSize: 14, lineHeight: 22 }} numberOfLines={3}>
                      {n.text}
                    </Text>
                  ) : null}
                  {n.link ? (
                    <Pressable onPress={() => Linking.openURL(n.link!).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="link" size={14} color="#1B5C83" />
                      <Text weight="bold" style={{ fontSize: 12, color: '#1B5C83', flexShrink: 1 }} numberOfLines={1}>
                        {n.link}
                      </Text>
                    </Pressable>
                  ) : null}
                  {n.tags.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {n.tags.map((t) => (
                        <TagChip key={t} name={t} onPress={() => setQuery(t)} />
                      ))}
                    </View>
                  ) : null}
                  {n.pending ? <PendingBadge /> : null}
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 10, marginTop: 2 }}>
                  <Pressable onPress={() => router.push({ pathname: '/nova-nota', params: { id: n.id } })} style={{ flex: 1, minHeight: 44, borderRadius: 999, backgroundColor: colors.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Icon name="pencil" size={16} color={colors.text} />
                    <Text weight="extrabold" style={{ fontSize: 14 }}>
                      Editar
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      await setPinned(n.id, !n.pinned);
                      await load();
                      void syncNow();
                    }}
                    accessibilityLabel={n.pinned ? 'Desafixar' : 'Fixar'}
                    style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: 999, backgroundColor: n.pinned ? '#FCEFCB' : colors.chipBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Icon name="pin" size={16} color={n.pinned ? '#7A5300' : colors.text} />
                    <Text weight="extrabold" style={{ fontSize: 14, color: n.pinned ? '#7A5300' : colors.text }}>
                      {n.pinned ? 'Fixada' : 'Fixar'}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
