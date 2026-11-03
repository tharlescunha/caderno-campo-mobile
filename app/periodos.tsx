import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../src/components/Icon';
import { Button, Card, EmptyState, Text } from '../src/components/ui';
import { closeActivePeriod, listPeriods, type PeriodRow } from '../src/data/periodsPage';
import { useSync } from '../src/sync';
import { useTheme } from '../src/theme';

// Tela "Períodos" (design/Periodos.dc.html): o ativo, os anteriores (somente leitura) e como encerrar.
const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dateRange = (start: string, end: string | null) => {
  const s = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1);
  if (!end) return `desde ${months[s.getMonth()]} de ${s.getFullYear()}`;
  const e = new Date(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, 1);
  return s.getFullYear() === e.getFullYear() ? `${months[s.getMonth()]} a ${months[e.getMonth()]} de ${e.getFullYear()}` : `${months[s.getMonth()]} de ${s.getFullYear()} a ${months[e.getMonth()]} de ${e.getFullYear()}`;
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function Periodos() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lastSyncAt, syncNow } = useSync();
  const [periods, setPeriods] = useState<PeriodRow[]>([]);

  const load = useCallback(() => listPeriods().then(setPeriods), []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, lastSyncAt]),
  );

  const active = periods.find((p) => p.active);
  const previous = periods.filter((p) => !p.active);

  const confirmClose = () => {
    if (!active) return;
    Alert.alert(
      `Finalizar o ${active.name}?`,
      `As ${plural(active.subjects.length, 'matéria', 'matérias')} dele ficam desativadas e saem da agenda e do quadro da semana, os ${plural(active.reportsOpen, 'relatório em andamento', 'relatórios em andamento')} são finalizados e as provas e entregas futuras são encerradas. Nada é apagado. Você fica sem período ativo até criar o próximo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            await closeActivePeriod();
            await load();
            void syncNow();
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
            <Icon name="right" size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text weight="semibold" muted style={{ fontSize: 12 }}>
              suas matérias ficam dentro de um período
            </Text>
            <Text weight="extrabold" style={{ fontSize: 24, letterSpacing: -0.6 }}>
              Períodos
            </Text>
          </View>
        </View>
        {active ? (
          <View style={{ backgroundColor: '#0B5D3B', borderRadius: 28, padding: 18, gap: 14, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', right: -40, top: -50, width: 140, height: 140, borderRadius: 70, backgroundColor: '#C8F169', opacity: 0.9 }} />
            <View>
              <Text weight="bold" style={{ fontSize: 12, color: '#BFE3CC' }}>
                Período ativo
              </Text>
              <Text weight="extrabold" style={{ fontSize: 26, letterSpacing: -0.7, color: '#fff', marginTop: 4 }}>
                {active.name}
              </Text>
              <Text weight="semibold" style={{ fontSize: 13, color: '#BFE3CC' }}>
                {dateRange(active.start, active.end)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { n: active.subjects.length, r: 'matérias' },
                { n: active.reportsOpen, r: 'relatórios abertos' },
                { n: active.notes, r: 'anotações' },
              ].map((f) => (
                <View key={f.r} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 }}>
                  <Text weight="extrabold" style={{ fontSize: 20, color: '#fff' }}>
                    {f.n}
                  </Text>
                  <Text weight="semibold" style={{ fontSize: 11, color: '#BFE3CC' }}>
                    {f.r}
                  </Text>
                </View>
              ))}
            </View>
            <Pressable onPress={() => router.push({ pathname: '/resumo/[id]', params: { id: active.id } })} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text weight="extrabold" style={{ fontSize: 14, color: '#C8F169' }}>
                Ver o resumo até hoje →
              </Text>
            </Pressable>
          </View>
        ) : (
          <EmptyState icon="book" title="Nenhum período ativo" hint="Cadastre o período em que você está para criar matérias." />
        )}

        <View style={{ gap: 8 }}>
          <Button label="Novo período" icon="plus" variant="primary" onPress={() => router.push('/novo-periodo')} />
          <Text weight="semibold" muted style={{ fontSize: 12, textAlign: 'center' }}>
            Só um período fica ativo. Ao criar o novo, o atual é finalizado.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text weight="extrabold" style={{ fontSize: 19 }}>
              Períodos anteriores
            </Text>
            <Text weight="semibold" muted style={{ fontSize: 12 }}>
              somente leitura
            </Text>
          </View>
          {previous.length === 0 ? (
            <Card>
              <Text weight="semibold" muted style={{ fontSize: 13 }}>
                Ainda não há períodos anteriores.
              </Text>
            </Card>
          ) : null}
          {previous.map((p) => (
            <Card key={p.id} style={{ gap: 10, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text weight="extrabold" style={{ fontSize: 17 }}>
                    {p.name}
                  </Text>
                  <Text weight="semibold" muted style={{ fontSize: 12 }}>
                    {dateRange(p.start, p.end)}
                  </Text>
                </View>
                <View style={{ backgroundColor: colors.chipBg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                  <Text weight="extrabold" style={{ fontSize: 11, color: '#2F463C' }}>
                    Finalizado
                  </Text>
                </View>
              </View>
              {p.subjects.length ? (
                <Text weight="semibold" muted style={{ fontSize: 12, lineHeight: 18 }}>
                  {p.subjects.map((s) => s.name).join(' · ')}
                </Text>
              ) : null}
              <Text weight="semibold" muted style={{ fontSize: 12 }}>
                {plural(p.reports, 'relatório', 'relatórios')} · {plural(p.entries, 'registro', 'registros')} · {plural(p.photos, 'foto', 'fotos')} · {plural(p.notes, 'anotação', 'anotações')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Pressable onPress={() => router.push({ pathname: '/periodo/[id]', params: { id: p.id } })} style={{ minHeight: 40, justifyContent: 'center' }}>
                  <Text weight="extrabold" style={{ fontSize: 14, color: colors.link }}>
                    Ver matérias
                  </Text>
                </Pressable>
                <Pressable onPress={() => router.push({ pathname: '/resumo/[id]', params: { id: p.id } })} style={{ minHeight: 40, justifyContent: 'center' }}>
                  <Text weight="extrabold" style={{ fontSize: 14, color: colors.link }}>
                    Resumo
                  </Text>
                </Pressable>
              </View>
            </Card>
          ))}
          <Text weight="semibold" muted style={{ fontSize: 12, lineHeight: 18 }}>
            Nada se perde. Relatórios, registros, fotos e anotações de períodos antigos continuam guardados e podem ser lidos.
          </Text>
        </View>

        {active ? (
          <Pressable onPress={confirmClose} style={{ minHeight: 52, borderRadius: 999, borderWidth: 2, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Text weight="extrabold" style={{ fontSize: 15, color: colors.danger }}>
              Finalizar período sem criar outro
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      {/* Faixa da cor do app atrás do relógio, para o conteúdo não passar por baixo dele */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top, backgroundColor: colors.bg }} />
    </View>
  );
}
