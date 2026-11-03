import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { Loading, Text } from '../../src/components/ui';
import { useEffect } from 'react';
import { formatUpdated, markNewsRead, useCachedApi, type Article } from '../../src/data/market';
import { useTheme } from '../../src/theme';

// Leitor de notícia: a matéria completa vem da API e é lida aqui dentro. Depois de aberta uma vez, fica guardada no celular.
const when = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} · ${p(d.getHours())}h${p(d.getMinutes())}`;
};

export default function Noticia() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id, title: listTitle } = useLocalSearchParams<{ id: string; title?: string }>();
  const { data, updatedAt, offline, loading, refresh } = useCachedApi<Article>(`noticia:${id}`, `/market/news/${id}`);
  // abriu a matéria: marca como lida (o chequezinho na lista)
  useEffect(() => {
    if (id) void markNewsRead(id);
  }, [id]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
          <Icon name="right" size={22} color={colors.text} />
        </Pressable>
        <Text weight="bold" muted style={{ fontSize: 13 }}>
          Notícia do agro
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}>
        {data?.image ? <Image source={{ uri: data.image }} resizeMode="cover" style={{ width: '100%', height: 190, borderRadius: 20, backgroundColor: colors.chipBg }} /> : null}

        <Text weight="extrabold" style={{ fontSize: 26, lineHeight: 31, letterSpacing: -0.6 }}>
          {data?.title ?? listTitle ?? 'Notícia'}
        </Text>

        {data ? (
          <Text weight="semibold" muted style={{ fontSize: 12 }}>
            {data.author ? `${data.author} · ` : ''}
            {when(data.published_at)}
          </Text>
        ) : null}

        {!data && loading ? (
          <Loading text="Carregando a matéria..." />
        ) : null}

        {!data && !loading ? (
          <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 16, gap: 8 }}>
            <Text weight="extrabold" style={{ fontSize: 15 }}>
              Não foi possível abrir a matéria agora
            </Text>
            <Text muted style={{ fontSize: 13, lineHeight: 19 }}>
              Sem conexão e ela ainda não foi guardada no celular. Abra de novo quando houver internet e ela fica salva para ler depois.
            </Text>
            <Pressable onPress={() => void refresh()} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text weight="extrabold" style={{ fontSize: 14, color: colors.link }}>
                Tentar de novo
              </Text>
            </Pressable>
          </View>
        ) : null}

        {data?.content.map((b, i) =>
          b.type === 'h2' || b.type === 'h3' ? (
            <Text key={i} weight="extrabold" style={{ fontSize: b.type === 'h2' ? 20 : 17, lineHeight: 26, marginTop: 6 }}>
              {b.text}
            </Text>
          ) : b.type === 'li' ? (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <Text style={{ fontSize: 16, lineHeight: 25 }}>•</Text>
              <Text style={{ flex: 1, fontSize: 16, lineHeight: 25 }}>{b.text}</Text>
            </View>
          ) : (
            <Text key={i} style={{ fontSize: 16, lineHeight: 26 }}>
              {b.text}
            </Text>
          ),
        )}

        {data ? (
          <View style={{ gap: 6, marginTop: 8 }}>
            <Text weight="semibold" muted style={{ fontSize: 11 }}>
              {offline ? `Sem conexão. Matéria salva em ${formatUpdated(updatedAt)}.` : updatedAt ? `Atualizado em ${formatUpdated(updatedAt)}` : ''}
            </Text>
            {data.url ? (
              <Pressable onPress={() => Linking.openURL(data.url!).catch(() => {})} style={{ minHeight: 36, justifyContent: 'center' }}>
                <Text weight="bold" style={{ fontSize: 12, color: colors.muted, textDecorationLine: 'underline' }}>
                  Ver a matéria original no site
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
