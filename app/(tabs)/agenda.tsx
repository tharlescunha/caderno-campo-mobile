import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { Card, EmptyState, Text } from '../../src/components/ui';
import { addDays, getAgenda, kindLabel, kindTone, matchesFilter, parseDate, type AgendaFilter, type AgendaItem } from '../../src/data/agenda';
import { localDate } from '../../src/data/today';
import { useSync } from '../../src/sync';
import { useTheme } from '../../src/theme';

// Aba "Agenda" (design/Agenda.dc.html): semana com pontos, filtros, compromissos do dia e próximos.
const filters: { value: AgendaFilter; label: string }[] = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'aulas', label: 'Aulas' },
  { value: 'campo', label: 'Campo' },
  { value: 'provas', label: 'Provas' },
  { value: 'entregas', label: 'Entregas' },
];
const dow = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dowLong = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const monthShort = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const mondayOf = (d: Date) => localDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));

export default function Agenda() {
  const { colors } = useTheme();
  const router = useRouter();
  const { lastSyncAt } = useSync();
  const today = localDate();
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
  const [selected, setSelected] = useState(today);
  const [filter, setFilter] = useState<AgendaFilter>('tudo');
  const [week, setWeek] = useState<AgendaItem[]>([]);
  // o dia escolhido é carregado por conta própria (não depende da semana já ter chegado)
  const [dayData, setDayData] = useState<{ date: string; items: AgendaItem[] } | null>(null);
  const [visits, setVisits] = useState(0);
  const [upcoming, setUpcoming] = useState<AgendaItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [calMonth, setCalMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [monthItems, setMonthItems] = useState<AgendaItem[]>([]);

  // ao voltar para esta aba, recarrega tudo
  useFocusEffect(useCallback(() => setVisits((n) => n + 1), []));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const w = await getAgenda(weekStart, addDays(weekStart, 6));
      if (!cancelled) setWeek(w);
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart, lastSyncAt, visits]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const items = await getAgenda(selected, selected);
      if (!cancelled) setDayData({ date: selected, items });
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, lastSyncAt, visits]);

  useEffect(() => {
    if (!picking) return;
    let cancelled = false;
    void (async () => {
      const first = localDate(calMonth);
      const last = localDate(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0));
      const items = await getAgenda(first, last);
      if (!cancelled) setMonthItems(items);
    })();
    return () => {
      cancelled = true;
    };
  }, [picking, calMonth, lastSyncAt, visits]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // próximos compromissos: a partir de amanhã, 21 dias à frente
      const u = (await getAgenda(addDays(today, 1), addDays(today, 21))).slice(0, 6);
      if (!cancelled) setUpcoming(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [today, lastSyncAt, visits]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthOf = parseDate(addDays(weekStart, 3));
  const dayItems = (dayData?.date === selected ? dayData.items : []).filter((i) => matchesFilter(i, filter));
  const sel = parseDate(selected);
  const goTo = (date: Date) => {
    const d = localDate(date);
    setWeekStart(mondayOf(date));
    setSelected(d);
    setFilter('tudo');
    setPicking(false);
  };
  const shiftWeek = (n: number) => {
    const next = addDays(weekStart, 7 * n);
    setWeekStart(next);
    setSelected(next <= today && today <= addDays(next, 6) ? today : next);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text weight="semibold" muted style={{ fontSize: 12 }}>
              {months[monthOf.getMonth()]} de {monthOf.getFullYear()}
            </Text>
            <Text weight="extrabold" style={{ fontSize: 26, letterSpacing: -0.8, marginTop: 2 }}>
              Agenda
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => { setCalMonth(new Date(sel.getFullYear(), sel.getMonth(), 1)); setPicking(true); }} accessibilityLabel="Ir para uma data" style={{ width: 48, height: 48, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="cal" size={22} color={colors.text} />
            </Pressable>
            <Pressable onPress={() => router.push('/novo-evento')} accessibilityLabel="Novo evento" style={{ width: 48, height: 48, borderRadius: 18, backgroundColor: '#0B5D3B', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card, borderRadius: 28, padding: 6 }}>
            <Pressable onPress={() => shiftWeek(-1)} accessibilityLabel="Semana anterior" hitSlop={6} style={{ width: 24, alignItems: 'center', transform: [{ scaleX: -1 }] }}>
              <Icon name="right" size={16} color={colors.muted} />
            </Pressable>
            {days.map((d) => {
              const date = parseDate(d);
              const on = d === selected;
              const dots = [...new Set(week.filter((i) => i.date === d).map((i) => kindTone[i.kind].dot))].slice(0, 3);
              return (
                <Pressable key={d} onPress={() => setSelected(d)} style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 22, backgroundColor: on ? '#0B5D3B' : 'transparent' }}>
                  <Text weight="bold" style={{ fontSize: 11, opacity: 0.8, color: on ? '#fff' : colors.text }}>
                    {dow[date.getDay()]}
                  </Text>
                  <Text weight="extrabold" style={{ fontSize: 18, color: on ? '#fff' : d === today ? colors.link : colors.text }}>
                    {date.getDate()}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 3, height: 6 }}>
                    {dots.map((c) => (
                      <View key={c} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on ? '#C8F169' : c }} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
            <Pressable onPress={() => shiftWeek(1)} accessibilityLabel="Próxima semana" hitSlop={6} style={{ width: 24, alignItems: 'center' }}>
              <Icon name="right" size={16} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {filters.map((f) => (
            <Pressable key={f.value} onPress={() => setFilter(f.value)} style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', borderWidth: 2, borderColor: filter === f.value ? '#0B5D3B' : colors.line, backgroundColor: filter === f.value ? '#0B5D3B' : colors.card }}>
              <Text weight="extrabold" style={{ fontSize: 13, color: filter === f.value ? '#fff' : colors.text }}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text weight="extrabold" style={{ fontSize: 19 }}>
              {dowLong[sel.getDay()][0].toUpperCase() + dowLong[sel.getDay()].slice(1)}, {sel.getDate()} de {months[sel.getMonth()]}
            </Text>
            <Text weight="semibold" muted style={{ fontSize: 12 }}>
              {dayItems.length} {dayItems.length === 1 ? 'compromisso' : 'compromissos'}
            </Text>
          </View>
          {dayItems.length === 0 ? <EmptyState icon="cal" title="Nada marcado" hint="Dia livre. Toque no “+” para marcar uma prova, entrega ou atividade." /> : null}
          {dayItems.map((i) => {
            const tone = kindTone[i.kind];
            return (
              <Pressable
                key={i.id}
                disabled={!i.eventId}
                onPress={() => (i.reportId ? router.push({ pathname: '/relatorio/[id]', params: { id: i.reportId } }) : router.push({ pathname: '/novo-evento', params: { id: i.eventId! } }))}
              >
              <Card style={{ gap: 8, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={i.kind === 'campo' || i.kind === 'atividade' ? 'sprout' : i.kind === 'aula' ? 'book' : i.kind === 'entrega' ? 'flag' : i.kind === 'prova' || i.kind === 'trabalho' ? 'pencil' : 'cal'} size={18} color={tone.fg} />
                  </View>
                  <Text weight="extrabold" style={{ fontSize: 13, color: tone.fg }}>
                    {kindLabel[i.kind]}
                  </Text>
                </View>
                <Text weight="extrabold" style={{ fontSize: 17, lineHeight: 22 }}>
                  {i.title}
                </Text>
                {i.detail ? (
                  <Text weight="semibold" muted style={{ fontSize: 12 }}>
                    {i.detail}
                  </Text>
                ) : null}
                {i.eventId ? (
                  <Text weight="bold" style={{ fontSize: 12, color: colors.link }}>
                    Toque para abrir
                  </Text>
                ) : null}
              </Card>
              </Pressable>
            );
          })}
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 10 }}>
          <Text weight="extrabold" style={{ fontSize: 19 }}>
            Próximos compromissos
          </Text>
          <Card style={{ paddingVertical: 4, paddingHorizontal: 16 }}>
            {upcoming.length === 0 ? (
              <Text weight="semibold" muted style={{ fontSize: 13, paddingVertical: 14 }}>
                Nada nos próximos dias.
              </Text>
            ) : null}
            {upcoming.map((e, idx) => {
              const tone = kindTone[e.kind];
              const d = parseDate(e.date);
              return (
                <Pressable key={e.id} onPress={() => goTo(parseDate(e.date))} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: idx === upcoming.length - 1 ? 0 : 1, borderBottomColor: colors.lineSoft }}>
                  <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={e.kind === 'campo' || e.kind === 'atividade' ? 'sprout' : e.kind === 'aula' ? 'book' : e.kind === 'entrega' ? 'flag' : e.kind === 'prova' || e.kind === 'trabalho' ? 'pencil' : 'cal'} size={22} color={tone.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text weight="bold" style={{ fontSize: 15, lineHeight: 19 }}>
                      {e.title}
                    </Text>
                    <Text weight="semibold" muted style={{ fontSize: 12 }}>
                      {dowLong[d.getDay()]}, {d.getDate()} de {monthShort[d.getMonth()]}
                      {e.lesson ? ` · ${e.kind === 'campo' ? 'aula de campo' : 'aula'}` : ''}
                    </Text>
                  </View>
                  <Text weight="extrabold" style={{ fontSize: 12, color: tone.fg }}>
                    {kindLabel[e.kind].replace('Aula de campo', 'Campo')}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        </View>
      </ScrollView>

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable onPress={() => setPicking(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderRadius: 28, padding: 16, gap: 8 }}>
            <Text weight="extrabold" style={{ fontSize: 18, paddingHorizontal: 4 }}>
              Ir para uma data
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
              <Pressable onPress={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} accessibilityLabel="Mês anterior" hitSlop={10} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
                <Icon name="right" size={20} color={colors.text} />
              </Pressable>
              <Text weight="extrabold" style={{ fontSize: 16 }}>
                {months[calMonth.getMonth()]} de {calMonth.getFullYear()}
              </Text>
              <Pressable onPress={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} accessibilityLabel="Próximo mês" hitSlop={10} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="right" size={20} color={colors.text} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                <Text key={d} weight="bold" muted style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Array.from({ length: (calMonth.getDay() + 6) % 7 }, (_, i) => (
                <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 50 }} />
              ))}
              {Array.from({ length: new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate() }, (_, i) => {
                const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), i + 1);
                const key = localDate(date);
                const dots = [...new Set(monthItems.filter((m) => m.date === key).map((m) => kindTone[m.kind].dot))].slice(0, 3);
                const on = key === selected;
                return (
                  <Pressable key={key} onPress={() => goTo(date)} style={{ width: `${100 / 7}%`, height: 50, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#0B5D3B' : 'transparent', borderWidth: key === today && !on ? 2 : 0, borderColor: colors.link }}>
                      <Text weight="bold" style={{ fontSize: 15, color: on ? '#fff' : colors.text }}>
                        {i + 1}
                      </Text>
                      <View style={{ position: 'absolute', bottom: 3, flexDirection: 'row', gap: 2, height: 5 }}>
                        {dots.map((c) => (
                          <View key={c} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? '#C8F169' : c }} />
                        ))}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Pressable onPress={() => goTo(new Date())} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                <Text weight="extrabold" style={{ fontSize: 15, color: colors.link }}>
                  Hoje
                </Text>
              </Pressable>
              <Pressable onPress={() => setPicking(false)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                <Text weight="extrabold" muted style={{ fontSize: 15 }}>
                  Fechar
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
