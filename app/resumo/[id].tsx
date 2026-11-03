import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { Card, Loading, Text } from '../../src/components/ui';
import { getPeriodSummary, type PeriodSummary } from '../../src/data/periodsPage';
import { tones, useTheme } from '../../src/theme';

// Tela "Resumo do período" (design/Resumo.dc.html): somente leitura, calculado das visitas guardadas no celular.
const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const range = (start: string, end: string | null) => {
  const s = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1);
  if (!end) return `desde ${months[s.getMonth()]} de ${s.getFullYear()}`;
  const e = new Date(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, 1);
  return `${months[s.getMonth()]} a ${months[e.getMonth()]} de ${e.getFullYear()}`;
};

export default function Resumo() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [s, setS] = useState<PeriodSummary | null | undefined>(undefined);

  useEffect(() => {
    void getPeriodSummary(id).then(setS);
  }, [id]);

  const fact = (n: number, r: string) => (
    <View key={r} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 }}>
      <Text weight="extrabold" style={{ fontSize: 20, color: '#fff' }}>
        {n}
      </Text>
      <Text weight="semibold" style={{ fontSize: 11, color: '#BFE3CC' }}>
        {r}
      </Text>
    </View>
  );
  const head = (t: string) => (
    <Text weight="extrabold" style={{ fontSize: 19 }}>
      {t}
    </Text>
  );
  const empty = (t: string) => (
    <Text weight="semibold" muted style={{ fontSize: 13, paddingVertical: 14 }}>
      {t}
    </Text>
  );
  const maxWeek = Math.max(1, ...(s?.weeks.map((w) => w.n) ?? [1]));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
          <Icon name="right" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text weight="semibold" muted style={{ fontSize: 12 }}>
            somente leitura · calculado das suas visitas
          </Text>
          <Text weight="extrabold" style={{ fontSize: 24, letterSpacing: -0.6 }}>
            Resumo do período
          </Text>
        </View>
      </View>

      {s === undefined ? <Loading text="Calculando o resumo..." /> : null}

      {s ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 20 }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: '#0B5D3B', borderRadius: 28, padding: 18, gap: 12 }}>
            <View>
              <Text weight="bold" style={{ fontSize: 12, color: '#BFE3CC' }}>
                {s.active ? 'até hoje' : 'período finalizado'}
              </Text>
              <Text weight="extrabold" style={{ fontSize: 26, letterSpacing: -0.7, color: '#fff' }}>
                {s.name}
              </Text>
              <Text weight="semibold" style={{ fontSize: 13, color: '#BFE3CC' }}>
                {range(s.start, s.end)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {fact(s.visits, 'visitas')}
              {fact(s.reports, 'relatórios')}
              {fact(s.crops.length, 'culturas')}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {fact(s.photos, 'fotos')}
              {fact(s.notes, 'anotações')}
              {fact(s.subjects, 'matérias')}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            {head('Culturas acompanhadas')}
            {s.crops.length === 0 ? <Card>{empty('Nenhuma cultura acompanhada ainda.')}</Card> : null}
            {s.crops.map((c) => (
              <Pressable key={c.reportId} onPress={() => router.push({ pathname: '/relatorio/[id]', params: { id: c.reportId } })}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text weight="extrabold" style={{ fontSize: 16 }}>
                      {c.name}
                    </Text>
                    {c.place ? (
                      <Text weight="semibold" muted style={{ fontSize: 12 }}>
                        {c.place}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text weight="extrabold" style={{ fontSize: 20 }}>
                      {c.visits}
                    </Text>
                    <Text weight="semibold" muted style={{ fontSize: 11 }}>
                      visitas
                    </Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>

          <View style={{ gap: 8 }}>
            {head('Pragas vistas')}
            <Card style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
              {s.pests.length === 0 ? empty('Nenhuma praga registrada.') : null}
              {s.pests.map((p, i) => (
                <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: i === s.pests.length - 1 ? 0 : 1, borderBottomColor: colors.lineSoft }}>
                  <Text weight="bold" style={{ fontSize: 15, flex: 1 }}>
                    {p.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {p.level ? (
                      <View style={{ backgroundColor: tones.amber.bg, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}>
                        <Text weight="extrabold" style={{ fontSize: 11, color: tones.amber.fg }}>
                          nível {p.level}
                        </Text>
                      </View>
                    ) : null}
                    <Text weight="semibold" muted style={{ fontSize: 12 }}>
                      {p.times}×
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>

          <View style={{ gap: 8 }}>
            {head('Produtos aplicados')}
            <Card style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
              {s.products.length === 0 ? empty('Nenhuma aplicação registrada.') : null}
              {s.products.map((p, i) => (
                <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: i === s.products.length - 1 ? 0 : 1, borderBottomColor: colors.lineSoft }}>
                  <Text weight="bold" style={{ fontSize: 15, flex: 1 }}>
                    {p.name}
                  </Text>
                  <Text weight="semibold" muted style={{ fontSize: 12 }}>
                    {p.times}×
                  </Text>
                </View>
              ))}
            </Card>
          </View>

          <View style={{ gap: 8 }}>
            {head('Por matéria')}
            <Card style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
              {s.bySubject.length === 0 ? empty('Nenhuma matéria neste período.') : null}
              {s.bySubject.map((m, i) => (
                <View key={m.name} style={{ paddingVertical: 12, gap: 2, borderBottomWidth: i === s.bySubject.length - 1 ? 0 : 1, borderBottomColor: colors.lineSoft }}>
                  <Text weight="bold" style={{ fontSize: 15 }}>
                    {m.name}
                  </Text>
                  <Text weight="semibold" muted style={{ fontSize: 12 }}>
                    {m.reports} {m.reports === 1 ? 'relatório' : 'relatórios'} · {m.visits} {m.visits === 1 ? 'visita' : 'visitas'} · {m.notes} {m.notes === 1 ? 'anotação' : 'anotações'}
                  </Text>
                </View>
              ))}
            </Card>
          </View>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              {head('Semanas com mais visitas')}
              <Text weight="semibold" muted style={{ fontSize: 12 }}>
                registros
              </Text>
            </View>
            <Card style={{ gap: 10 }}>
              {s.weeks.length === 0 ? empty('Ainda sem visitas concluídas.') : null}
              {s.weeks.map((w) => (
                <View key={w.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text weight="semibold" muted style={{ fontSize: 12, width: 78 }}>
                    {w.label}
                  </Text>
                  <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.chipBg, overflow: 'hidden' }}>
                    <View style={{ width: `${(w.n / maxWeek) * 100}%`, height: 10, borderRadius: 5, backgroundColor: '#1E8A5A' }} />
                  </View>
                  <Text weight="extrabold" style={{ fontSize: 13, width: 22, textAlign: 'right' }}>
                    {w.n}
                  </Text>
                </View>
              ))}
              {s.firstVisit ? (
                <Text weight="semibold" muted style={{ fontSize: 12 }}>
                  Primeira visita em {s.firstVisit} · última em {s.lastVisit}
                </Text>
              ) : null}
            </Card>
          </View>

          <Text weight="semibold" muted style={{ fontSize: 12, lineHeight: 18 }}>
            Esta página só mostra o que você já registrou. Nada aqui altera relatórios, registros ou anotações.
          </Text>
        </ScrollView>
      ) : null}
      {s === null ? <Text weight="semibold" muted style={{ padding: 24 }}>Período não encontrado.</Text> : null}
    </SafeAreaView>
  );
}
