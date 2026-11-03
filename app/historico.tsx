import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Icon } from '../src/components/Icon';
import { Change } from '../src/components/MarketStrip';
import { Card, Loading, Text } from '../src/components/ui';
import { formatUpdated, money, useCachedApi, type History } from '../src/data/market';
import { useTheme } from '../src/theme';

// Histórico de preço da soja ou do milho (saca de 60 kg), guardado no celular para ver sem internet.
const periods = [7, 30, 90] as const;
const label = { soy: 'Soja', corn: 'Milho' } as const;
const color = { soy: '#2E9D63', corn: '#E0A21B' } as const;

const dm = (s: string) => {
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
};

function Chart({ points, stroke }: { points: { date: string; price: number }[]; stroke: string }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const height = 190;
  const padX = 8;
  const padY = 16;
  if (points.length < 2) {
    return (
      <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
        <Text weight="semibold" muted style={{ fontSize: 13 }}>
          Poucos pontos neste período para desenhar o gráfico.
        </Text>
      </View>
    );
  }
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const x = (i: number) => padX + (i * (width - 2 * padX)) / (points.length - 1);
  const y = (v: number) => padY + (1 - (v - min) / span) * (height - 2 * padY);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.price).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line x1={padX} x2={width - padX} y1={y(max)} y2={y(max)} stroke={colors.lineSoft} strokeWidth={1} strokeDasharray="4 4" />
          <Line x1={padX} x2={width - padX} y1={y(min)} y2={y(min)} stroke={colors.lineSoft} strokeWidth={1} strokeDasharray="4 4" />
          <Path d={line} stroke={stroke} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={x(last)} cy={y(points[last].price)} r={5} fill={stroke} />
        </Svg>
      ) : null}
    </View>
  );
}

export default function Historico() {
  const { colors } = useTheme();
  const router = useRouter();
  const { product: param } = useLocalSearchParams<{ product?: string }>();
  const product: 'soy' | 'corn' = param === 'corn' ? 'corn' : 'soy';
  const [days, setDays] = useState<(typeof periods)[number]>(30);
  const { data, updatedAt, offline, loading } = useCachedApi<History>(`historico:${product}:${days}`, `/market/history?days=${days}&product=${product}`);

  const points = data?.quotes[product] ?? [];
  const summary = data?.summary[product];
  const stroke = color[product];
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
          <Icon name="right" size={22} color={colors.text} />
        </Pressable>
        <View>
          <Text weight="semibold" muted style={{ fontSize: 12 }}>
            histórico de preço · saca de 60 kg
          </Text>
          <Text weight="extrabold" style={{ fontSize: 24, letterSpacing: -0.6 }}>
            {label[product]}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 999, padding: 4 }}>
          {periods.map((p) => (
            <Pressable key={p} onPress={() => setDays(p)} style={{ flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: days === p ? '#0B5D3B' : 'transparent' }}>
              <Text weight="extrabold" style={{ fontSize: 13, color: days === p ? '#fff' : colors.muted }}>
                {p} dias
              </Text>
            </Pressable>
          ))}
        </View>

        {!data ? (
          loading ? (
            <Loading text="Carregando o histórico..." />
          ) : (
            <Text weight="semibold" muted style={{ fontSize: 14, textAlign: 'center', paddingVertical: 32 }}>
              Sem conexão e este período ainda não foi guardado. Abra com internet uma vez.
            </Text>
          )
        ) : (
          <>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <View>
                  <Text weight="semibold" muted style={{ fontSize: 12 }}>
                    {last ? `último preço · ${dm(last.date)}` : 'sem preços'}
                  </Text>
                  <Text weight="extrabold" style={{ fontSize: 32, letterSpacing: -1 }}>
                    {last ? money(last.price) : '—'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Change pct={summary?.change_pct} />
                  <Text weight="semibold" muted style={{ fontSize: 11 }}>
                    {first && last ? `${dm(first.date)} a ${dm(last.date)}` : ''}
                  </Text>
                </View>
              </View>
              <Chart points={points} stroke={stroke} />
            </Card>

            {summary ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { r: 'Máxima', v: money(summary.max) },
                  { r: 'Média', v: money(summary.average) },
                  { r: 'Mínima', v: money(summary.min) },
                ].map((i) => (
                  <View key={i.r} style={{ flex: 1, backgroundColor: colors.card, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12 }}>
                    <Text weight="extrabold" style={{ fontSize: 17 }}>
                      {i.v}
                    </Text>
                    <Text weight="semibold" muted style={{ fontSize: 11 }}>
                      {i.r}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              <Text weight="extrabold" style={{ fontSize: 19 }}>
                Preço dia a dia
              </Text>
              <Card style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
                {[...points].reverse().map((p, i, arr) => (
                  <View key={p.date} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: colors.lineSoft }}>
                    <Text weight="semibold" muted style={{ fontSize: 13 }}>
                      {dm(p.date)}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Change pct={p.change_pct} />
                      <Text weight="extrabold" style={{ fontSize: 15, minWidth: 64, textAlign: 'right' }}>
                        {money(p.price)}
                      </Text>
                    </View>
                  </View>
                ))}
                {points.length === 0 ? (
                  <Text weight="semibold" muted style={{ fontSize: 13, paddingVertical: 14 }}>
                    Nenhuma cotação neste período. A cotação só existe em dias úteis.
                  </Text>
                ) : null}
              </Card>
            </View>

            <Text weight="semibold" muted style={{ fontSize: 11 }}>
              {offline ? `Sem conexão. Histórico salvo em ${formatUpdated(updatedAt)}.` : updatedAt ? `Atualizado em ${formatUpdated(updatedAt)}` : ''}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
