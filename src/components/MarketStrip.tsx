import { View } from 'react-native';
import { formatUpdated, money, type MarketState } from '../data/market';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './ui';

/** Variação do dia: verde quando sobe, vermelho quando cai, cinza quando não há dado. */
export function Change({ pct }: { pct: number | null | undefined }) {
  const { colors } = useTheme();
  if (pct == null) return <View style={{ height: 22 }} />;
  const up = pct >= 0;
  const fg = up ? '#14663F' : colors.danger;
  const bg = up ? '#DDF1E5' : colors.dangerBg;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3, borderRadius: 999, backgroundColor: bg, paddingVertical: 3, paddingLeft: 5, paddingRight: 8 }}>
      <View style={{ transform: [{ rotate: up ? '180deg' : '0deg' }] }}>
        <Icon name="down" size={12} color={fg} />
      </View>
      <Text weight="bold" style={{ fontSize: 11, color: fg }}>
        {Math.abs(pct).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
      </Text>
    </View>
  );
}

/** Texto pequeno com a última atualização dos dados, e o aviso quando são dados guardados. */
export function UpdatedAt({ market, style }: { market: MarketState; style?: object }) {
  const when = formatUpdated(market.updatedAt);
  let text = '';
  if (market.updatedAt) text = `Atualizado em ${when}`;
  else if (market.loading) text = 'Buscando...';
  else text = 'Ainda sem dados do mercado';
  if (market.offline && market.updatedAt) text += ' · sem conexão, mostrando o que está salvo';
  return (
    <Text weight="semibold" muted style={[{ fontSize: 11 }, style]}>
      {text}
    </Text>
  );
}

/** Faixa de mercado da tela Hoje: soja, milho e dólar, clima da cidade e última atualização. */
export function MarketStrip({ market }: { market: MarketState }) {
  const { colors } = useTheme();
  const d = market.data;
  const cells = [
    { nome: 'Soja', cor: '#2E9D63', valor: d?.quotes.soy ? money(d.quotes.soy.price) : '—', pct: d?.quotes.soy?.change_pct },
    { nome: 'Milho', cor: '#E0A21B', valor: d?.quotes.corn ? money(d.quotes.corn.price) : '—', pct: d?.quotes.corn?.change_pct },
    { nome: 'Dólar', cor: '#1F4FA8', valor: d?.dollar ? money(d.dollar.value) : '—', pct: d?.dollar?.change_pct },
  ];
  const w = d?.weather;
  const weather = w?.temperature_c != null ? `${d?.city ?? ''} · ${Math.round(w.temperature_c)}°${w.description ? ` · ${w.description}` : ''}` : `${d?.city ?? 'Clima'} · clima indisponível`;
  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {cells.map((m, i) => (
          <View key={m.nome} style={{ flex: 1, paddingHorizontal: 10, gap: 3, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.lineSoft }}>
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
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginHorizontal: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.lineSoft }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          <Icon name="sun" size={15} color="#E0A21B" />
          <Text weight="semibold" muted style={{ fontSize: 12 }} numberOfLines={1}>
            {weather}
          </Text>
        </View>
        <Text weight="semibold" muted style={{ fontSize: 11 }}>
          sacas de 60 kg
        </Text>
      </View>
      <UpdatedAt market={market} style={{ marginTop: 6, marginHorizontal: 10 }} />
    </View>
  );
}
