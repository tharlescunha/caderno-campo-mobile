import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../src/components/Icon';
import { Card, EmptyState, Text } from '../src/components/ui';
import { clearRecentSearches, getRecentSearches, MARK_CLOSE, MARK_OPEN, rememberSearch, searchAll, type SearchHit, type SearchKind } from '../src/data/search';
import { fonts, tones, useTheme } from '../src/theme';

// Tela "Busca" (design/Busca.dc.html): procura em tudo o que está no celular, sem internet.
const groups: { kind: SearchKind; title: string; chip: string; icon: IconName; tone: { fg: string; bg: string } }[] = [
  { kind: 'registro', title: 'Registros', chip: 'Registros', icon: 'sprout', tone: tones.green },
  { kind: 'relatorio', title: 'Relatórios', chip: 'Relatórios', icon: 'note', tone: tones.amber },
  { kind: 'anotacao', title: 'Anotações', chip: 'Anotações', icon: 'notes', tone: tones.blue },
  { kind: 'materia', title: 'Matérias', chip: 'Matérias', icon: 'book', tone: tones.green },
  { kind: 'evento', title: 'Eventos', chip: 'Eventos', icon: 'flag', tone: tones.purple },
];

/** Mostra o texto com a palavra encontrada em destaque (o banco marca com [[ ]]). */
function Highlighted({ text, size = 14, weight = 'bold' as const }: { text: string; size?: number; weight?: 'bold' | 'medium' | 'semibold' }) {
  const { colors } = useTheme();
  const parts = text.split(new RegExp(`(${MARK_OPEN.replace(/[[\]]/g, '\\$&')}.*?${MARK_CLOSE.replace(/[[\]]/g, '\\$&')})`, 'g'));
  return (
    <Text weight={weight} style={{ fontSize: size, lineHeight: size * 1.4 }}>
      {parts.map((p, i) =>
        p.startsWith(MARK_OPEN) ? (
          <Text key={i} weight="extrabold" style={{ fontSize: size, backgroundColor: '#FCEFCB', color: '#5E4100' }}>
            {p.slice(MARK_OPEN.length, -MARK_CLOSE.length)}
          </Text>
        ) : (
          <Text key={i} weight={weight} style={{ fontSize: size, color: colors.text }}>
            {p}
          </Text>
        ),
      )}
    </Text>
  );
}

export default function Busca() {
  const { colors } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [filter, setFilter] = useState<SearchKind | 'tudo'>('tudo');
  const [recent, setRecent] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    void getRecentSearches().then(setRecent);
  }, []);

  // busca enquanto digita (com uma pequena espera para não buscar a cada letra)
  useEffect(() => {
    let cancelled = false;
    if (!query.trim()) {
      setHits([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      const r = await searchAll(query).catch(() => []);
      if (!cancelled) {
        setHits(r);
        setSearched(true);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const counts = useMemo(() => Object.fromEntries(groups.map((g) => [g.kind, hits.filter((h) => h.kind === g.kind).length])) as Record<SearchKind, number>, [hits]);

  const open = (h: SearchHit) => {
    void rememberSearch(query);
    if (h.kind === 'anotacao') router.push({ pathname: '/nova-nota', params: { id: h.targetId } });
    else if (h.kind === 'relatorio' || h.kind === 'registro') router.push({ pathname: '/relatorio/[id]', params: { id: h.targetId } });
    else if (h.kind === 'materia') router.push({ pathname: '/nova-materia', params: { id: h.targetId } });
    else if (h.reportId) router.push({ pathname: '/relatorio/[id]', params: { id: h.reportId } });
    else router.push({ pathname: '/novo-evento', params: { id: h.targetId } });
  };

  const chip = (value: SearchKind | 'tudo', text: string) => (
    <Pressable key={value} onPress={() => setFilter(value)} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', borderWidth: 2, borderColor: filter === value ? '#0B5D3B' : colors.line, backgroundColor: filter === value ? '#0B5D3B' : colors.card }}>
      <Text weight="extrabold" style={{ fontSize: 13, color: filter === value ? '#fff' : colors.text }}>
        {text}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
          <Icon name="right" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 999, paddingLeft: 16, paddingRight: 6, minHeight: 48, borderWidth: 2, borderColor: '#0B5D3B' }}>
          <Icon name="search" size={20} color={colors.muted} />
          <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Buscar em tudo" placeholderTextColor={colors.muted} returnKeyType="search" autoCorrect={false} accessibilityLabel="Buscar" style={{ flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text, minHeight: 44 }} />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Limpar" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={16} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 20 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {query.trim() && hits.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {chip('tudo', `Tudo · ${hits.length}`)}
            {groups.filter((g) => counts[g.kind] > 0).map((g) => chip(g.kind, `${g.chip} · ${counts[g.kind]}`))}
          </View>
        ) : null}

        {query.trim() && searched && hits.length === 0 ? <EmptyState icon="search" title="Nada encontrado" hint="Tente outra palavra. A busca olha títulos, textos, observações, pragas e matérias." /> : null}

        {groups
          .filter((g) => (filter === 'tudo' || filter === g.kind) && counts[g.kind] > 0)
          .map((g) => (
            <View key={g.kind} style={{ gap: 8 }}>
              <Text weight="extrabold" style={{ fontSize: 19 }}>
                {g.title}
              </Text>
              <Card style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
                {hits
                  .filter((h) => h.kind === g.kind)
                  .map((h, i, arr) => (
                    <Pressable key={h.key} onPress={() => open(h)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: colors.lineSoft }}>
                      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: g.tone.bg, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={g.icon} size={18} color={g.tone.fg} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Highlighted text={h.title} />
                        {h.snippet ? <Highlighted text={h.snippet} size={13} weight="medium" /> : null}
                        <Text weight="semibold" muted style={{ fontSize: 12 }}>
                          {h.subtitle}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
              </Card>
            </View>
          ))}

        {!query.trim() ? (
          recent.length ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text weight="extrabold" style={{ fontSize: 19 }}>
                  Buscas recentes
                </Text>
                <Pressable onPress={() => void clearRecentSearches().then(() => setRecent([]))} hitSlop={8}>
                  <Text weight="bold" muted style={{ fontSize: 12 }}>
                    Limpar
                  </Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {recent.map((r) => (
                  <Pressable key={r} onPress={() => setQuery(r)} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.card }}>
                    <Icon name="search" size={14} color={colors.muted} />
                    <Text weight="extrabold" style={{ fontSize: 13 }}>
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <EmptyState icon="search" title="Procure em tudo" hint="Relatórios, registros, anotações, matérias e eventos. Funciona sem internet." />
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
