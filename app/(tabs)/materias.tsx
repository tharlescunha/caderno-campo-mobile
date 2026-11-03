import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { Card, EmptyState, Text } from '../../src/components/ui';
import { dateRange, listPeriods, type PeriodRow } from '../../src/data/periodsPage';
import { classTypeLabel, getActivePeriodName, listSubjects, weekdayName, type SubjectItem } from '../../src/data/subjects';
import { useSync } from '../../src/sync';
import { subjectTones, useTheme } from '../../src/theme';

// Aba "Matérias" (design/Materias.dc.html): quadro da semana + lista das matérias do período ativo.
export default function Materias() {
  const { colors } = useTheme();
  const router = useRouter();
  const { lastSyncAt } = useSync();
  const [period, setPeriod] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [activePeriod, setActivePeriod] = useState<PeriodRow | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setPeriod(await getActivePeriodName());
        setSubjects(await listSubjects());
        setActivePeriod((await listPeriods()).find((p) => p.active) ?? null);
      })();
    }, [lastSyncAt]),
  );

  // segunda a sábado desta semana (os dias com a data de verdade, como no desenho)
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const week = [1, 2, 3, 4, 5, 6].map((d) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + d - 1);
    return { weekday: d, day: date.getDate(), today: date.toDateString() === now.toDateString(), subjects: subjects.filter((s) => s.weekdays.includes(d)) };
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text weight="extrabold" style={{ fontSize: 26, letterSpacing: -0.8, marginTop: 2 }}>
              Matérias
            </Text>
          </View>
          {period ? (
            <Pressable onPress={() => router.push('/nova-materia')} accessibilityLabel="Nova matéria" style={{ width: 48, height: 48, borderRadius: 18, backgroundColor: '#0B5D3B', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={24} color="#fff" />
            </Pressable>
          ) : null}
        </View>

        {period && activePeriod ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <Pressable onPress={() => router.push('/periodos')} accessibilityLabel="Ver períodos e resumo" style={{ backgroundColor: '#0B5D3B', borderRadius: 24, padding: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ position: 'absolute', right: -30, top: -40, width: 110, height: 110, borderRadius: 55, backgroundColor: '#C8F169', opacity: 0.9 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight="bold" style={{ fontSize: 11, color: '#BFE3CC' }}>
                  PERÍODO ATIVO
                </Text>
                <Text weight="extrabold" style={{ fontSize: 22, letterSpacing: -0.5, color: '#fff' }}>
                  {activePeriod.name}
                </Text>
                <Text weight="semibold" style={{ fontSize: 12, color: '#BFE3CC' }}>
                  {dateRange(activePeriod.start, activePeriod.end)} · {activePeriod.subjects.length} {activePeriod.subjects.length === 1 ? 'matéria' : 'matérias'}
                  {activePeriod.reportsOpen ? ` · ${activePeriod.reportsOpen} ${activePeriod.reportsOpen === 1 ? 'relatório aberto' : 'relatórios abertos'}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#C8F169', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="right" size={20} color="#0B5D3B" />
                </View>
                <Text weight="extrabold" style={{ fontSize: 10, color: '#fff' }}>
                  Períodos
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        {period === null ? (
          <View style={{ paddingTop: 40 }}>
            <EmptyState icon="book" title="Nenhum período ativo" hint="Cadastre o período em que você está para poder criar as matérias." />
            <Pressable onPress={() => router.push('/novo-periodo')} style={{ alignSelf: 'center', paddingVertical: 12 }}>
              <Text weight="extrabold" style={{ color: colors.link, fontSize: 15 }}>
                Cadastrar período
              </Text>
            </Pressable>
          </View>
        ) : null}

        {period ? (
          <>
            <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
              <Text weight="extrabold" style={{ fontSize: 19 }}>
                Quadro da semana
              </Text>
              <Card style={{ paddingVertical: 6, paddingHorizontal: 16 }}>
                {week.map((w, i) => {
                  const rows = w.subjects.length ? w.subjects : [null];
                  return rows.map((s, j) => {
                    const tone = s ? subjectTones[s.color] : { fg: colors.muted, bg: colors.chipBg, dot: colors.line };
                    const last = i === week.length - 1 && j === rows.length - 1;
                    return (
                      <Pressable
                        key={`${w.weekday}-${s?.id ?? 'x'}`}
                        disabled={!s}
                        onPress={() => s && router.push({ pathname: '/materia/[id]', params: { id: s.id } })}
                        accessibilityLabel={s ? `Abrir ${s.name}` : undefined}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.lineSoft }}
                      >
                        <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: w.today ? '#0B5D3B' : tone.bg, alignItems: 'center', justifyContent: 'center', opacity: j > 0 ? 0 : 1 }}>
                          <Text weight="bold" style={{ fontSize: 11, color: w.today ? '#fff' : tone.fg }}>
                            {weekdayName[w.weekday]}
                          </Text>
                          <Text weight="extrabold" style={{ fontSize: 16, color: w.today ? '#fff' : tone.fg, lineHeight: 18 }}>
                            {w.day}
                          </Text>
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tone.dot }} />
                            <Text weight="bold" style={{ fontSize: 15, flexShrink: 1 }}>
                              {s ? s.name : 'Sem matéria'}
                            </Text>
                          </View>
                          <Text weight="semibold" muted style={{ fontSize: 12 }}>
                            {s ? `${s.teacher ?? 'Sem professor'}${s.classType !== 'sala' ? ` · ${s.classType === 'campo' ? 'campo' : 'sala e campo'}` : ''}` : w.weekday === 6 ? 'Dia livre · pode ter aula aos sábados' : 'Dia livre'}
                          </Text>
                        </View>
                        {s && w.today ? (
                          <View style={{ backgroundColor: '#0B5D3B', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                            <Text weight="extrabold" style={{ color: '#fff', fontSize: 11 }}>
                              Hoje
                            </Text>
                          </View>
                        ) : null}
                        {s ? <Icon name="right" size={16} color={colors.muted} /> : null}
                      </Pressable>
                    );
                  });
                })}
              </Card>
              <Text weight="semibold" muted style={{ fontSize: 12 }}>
                Só o dia da semana e a matéria. Sem horário. Toque numa matéria para ver tudo dela.
              </Text>
            </View>

            {subjects.length === 0 ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                <Text weight="semibold" muted style={{ fontSize: 13, lineHeight: 19 }}>
                  Nenhuma matéria cadastrada neste período. Toque no “+” no topo para cadastrar a primeira.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
