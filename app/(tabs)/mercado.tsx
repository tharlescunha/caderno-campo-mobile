import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Change, UpdatedAt } from '../../src/components/MarketStrip';
import { Icon } from '../../src/components/Icon';
import { Card, EmptyState, Loading, Text } from '../../src/components/ui';
import { money, useMarket, useReadNews } from '../../src/data/market';
import { tones, useTheme } from '../../src/theme';

// Aba "Mercado" (design/Mercado.dc.html): cotações, clima e notícias. Tudo é guardado no celular:
// sem internet o app mostra o que foi salvo da última vez, com a data da atualização.
const weekday = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const airText: Record<string, string> = { good: 'boa', fair: 'razoável', moderate: 'moderada', poor: 'ruim', very_poor: 'muito ruim' };
const windDir: Record<string, string> = { N: 'N', NNE: 'NNL', NE: 'NE', ENE: 'LNE', E: 'L', ESE: 'LSE', SE: 'SE', SSE: 'SSE', S: 'S', SSW: 'SSO', SW: 'SO', WSW: 'OSO', W: 'O', WNW: 'ONO', NW: 'NO', NNW: 'NNO' };

const dateBr = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const timeBr = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
};
const quoteDate = (s: string) => {
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
};

export default function Mercado() {
  const { colors } = useTheme();
  const router = useRouter();
  const market = useMarket();
  const read = useReadNews();
  const d = market.data;
  const w = d?.weather;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={market.loading && Boolean(d)} onRefresh={() => void market.refresh()} />}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Text weight="semibold" muted style={{ fontSize: 12 }}>
            cotações, clima e notícias
          </Text>
          <Text weight="extrabold" style={{ fontSize: 26, letterSpacing: -0.8, marginTop: 2 }}>
            Mercado
          </Text>
          <UpdatedAt market={market} style={{ marginTop: 4 }} />
        </View>

        {!d ? (
          <View style={{ paddingTop: 40 }}>
            {market.loading ? <Loading text="Buscando o mercado..." size="large" /> : <EmptyState icon="chart" title="Ainda sem dados" hint="Conecte-se à internet uma vez. Depois o app guarda a última cotação e mostra mesmo sem internet." />}
          </View>
        ) : (
          <>
            {/* Cotações */}
            <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
              <Text weight="extrabold" style={{ fontSize: 19 }}>
                Cotações · {d.city}
              </Text>
              <Card style={{ paddingVertical: 14, paddingHorizontal: 8 }}>
                <View style={{ flexDirection: 'row' }}>
                  {[
                    { nome: 'Soja', produto: 'soy', cor: '#2E9D63', valor: d.quotes.soy ? money(d.quotes.soy.price) : '—', pct: d.quotes.soy?.change_pct, nota: d.quotes.soy ? `saca 60 kg · ${quoteDate(d.quotes.soy.date)}` : 'sem cotação' },
                    { nome: 'Milho', produto: 'corn', cor: '#E0A21B', valor: d.quotes.corn ? money(d.quotes.corn.price) : '—', pct: d.quotes.corn?.change_pct, nota: d.quotes.corn ? `saca 60 kg · ${quoteDate(d.quotes.corn.date)}` : 'sem cotação' },
                    { nome: 'Dólar', cor: '#1F4FA8', valor: d.dollar ? money(d.dollar.value) : '—', pct: d.dollar?.change_pct, nota: 'USD/BRL' },
                  ].map((m, i) => (
                    <Pressable key={m.nome} disabled={!('produto' in m)} onPress={() => 'produto' in m && router.push({ pathname: '/historico', params: { product: m.produto } })} style={{ flex: 1, paddingHorizontal: 10, gap: 3, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.lineSoft }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: m.cor }} />
                        <Text weight="bold" style={{ fontSize: 12 }}>
                          {m.nome}
                        </Text>
                      </View>
                      <Text weight="extrabold" style={{ fontSize: 26, letterSpacing: -0.5 }}>
                        {m.valor}
                      </Text>
                      <Change pct={m.pct} />
                      <Text weight="semibold" muted style={{ fontSize: 10 }}>
                        {m.nota}
                      </Text>
                      {'produto' in m ? (
                        <Text weight="extrabold" style={{ fontSize: 11, color: colors.link }}>
                          Ver histórico
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
                {d.sources.quotes?.stale || d.sources.dollar?.stale ? (
                  <Text weight="semibold" style={{ fontSize: 11, color: tones.amber.fg, marginTop: 10, marginHorizontal: 10 }}>
                    O servidor não conseguiu atualizar agora e mostra a última cotação que tinha.
                  </Text>
                ) : null}
              </Card>
            </View>

            {/* Clima */}
            <View style={{ paddingHorizontal: 16, paddingTop: 22, gap: 10 }}>
              <Text weight="extrabold" style={{ fontSize: 19 }}>
                Clima · {d.city}
              </Text>
              <Card style={{ gap: 14 }}>
                {w && w.temperature_c != null ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Icon name="sun" size={34} color="#E0A21B" />
                      <View style={{ flex: 1 }}>
                        <Text weight="extrabold" style={{ fontSize: 34, letterSpacing: -1, lineHeight: 38 }}>
                          {Math.round(w.temperature_c)}°
                        </Text>
                        <Text weight="semibold" muted style={{ fontSize: 13 }}>
                          {w.description ? w.description[0].toUpperCase() + w.description.slice(1) : ''}
                          {w.feels_like_c != null ? ` · sensação ${Math.round(w.feels_like_c)}°` : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        { rotulo: 'Umidade', valor: w.humidity_pct != null ? `${Math.round(w.humidity_pct)}%` : '—' },
                        { rotulo: 'Vento', valor: w.wind_kmh != null ? `${Math.round(w.wind_kmh)} km/h${w.wind_direction ? ' ' + (windDir[w.wind_direction] ?? w.wind_direction) : ''}` : '—' },
                        { rotulo: 'Chuva 1h', valor: w.rain_1h_mm != null ? `${w.rain_1h_mm} mm` : '—' },
                        { rotulo: 'Ar', valor: w.air_quality ? (airText[w.air_quality] ?? w.air_quality) : '—' },
                      ].map((i) => (
                        <View key={i.rotulo} style={{ minWidth: '22%', flexGrow: 1, backgroundColor: colors.chipBg, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10 }}>
                          <Text weight="extrabold" style={{ fontSize: 14 }}>
                            {i.valor}
                          </Text>
                          <Text weight="semibold" muted style={{ fontSize: 11 }}>
                            {i.rotulo}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {w.sunrise && w.sunset ? (
                      <Text weight="semibold" muted style={{ fontSize: 12 }}>
                        Nascer do sol {w.sunrise} · pôr do sol {w.sunset}
                      </Text>
                    ) : null}
                    {w.next_rain ? (
                      <View style={{ backgroundColor: tones.blue.bg, borderRadius: 16, padding: 12 }}>
                        <Text weight="extrabold" style={{ fontSize: 13, color: tones.blue.fg }}>
                          Próxima chuva: {dateBr(w.next_rain.when)} às {timeBr(w.next_rain.when)}
                        </Text>
                        <Text weight="semibold" style={{ fontSize: 12, color: '#2F5D78' }}>
                          {w.next_rain.description} · {Math.round(w.next_rain.rain_chance_pct)}% de chance · {w.next_rain.mm} mm
                        </Text>
                      </View>
                    ) : null}
                    {w.forecast_days?.length ? (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {w.forecast_days.slice(0, 5).map((f) => {
                          const [y, m, dd] = f.date.split('-').map(Number);
                          return (
                            <View key={f.date} style={{ flex: 1, alignItems: 'center', backgroundColor: colors.chipBg, borderRadius: 14, paddingVertical: 8 }}>
                              <Text weight="bold" muted style={{ fontSize: 11 }}>
                                {weekday[new Date(y, m - 1, dd).getDay()]}
                              </Text>
                              <Text weight="extrabold" style={{ fontSize: 13 }}>
                                {Math.round(f.max)}°
                              </Text>
                              <Text weight="semibold" muted style={{ fontSize: 11 }}>
                                {Math.round(f.min)}°
                              </Text>
                              <Text weight="semibold" style={{ fontSize: 10, color: tones.blue.fg }}>
                                {Math.round(f.rain_chance_pct)}%
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Text weight="semibold" muted style={{ fontSize: 13 }}>
                    Clima indisponível agora. Quando houver conexão e a chave do clima estiver ativa, ele aparece aqui.
                  </Text>
                )}
              </Card>
            </View>

            {/* Notícias */}
            <View style={{ paddingHorizontal: 16, paddingTop: 22, gap: 10 }}>
              <Text weight="extrabold" style={{ fontSize: 19 }}>
                Notícias do agro
              </Text>
              <Card style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
                {d.news.length === 0 ? (
                  <Text weight="semibold" muted style={{ fontSize: 13, paddingVertical: 14 }}>
                    Sem notícias no momento.
                  </Text>
                ) : null}
                {d.news.map((n, i) => (
                  <Pressable key={n.id} onPress={() => router.push({ pathname: '/noticia/[id]', params: { id: n.id, title: n.title } })} style={{ paddingVertical: 12, gap: 3, borderBottomWidth: i === d.news.length - 1 ? 0 : 1, borderBottomColor: colors.lineSoft }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      {read.has(n.id) ? <Icon name="check" size={13} color="#1E8A5A" /> : null}
                      <Text weight="semibold" muted style={{ fontSize: 11 }}>
                        {dateBr(n.published_at)} · {timeBr(n.published_at)}
                      </Text>
                    </View>
                    <Text weight="bold" style={{ fontSize: 15, lineHeight: 20 }}>
                      {n.title}
                    </Text>
                    {n.summary ? (
                      <Text muted style={{ fontSize: 13, lineHeight: 19 }} numberOfLines={2}>
                        {n.summary}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
