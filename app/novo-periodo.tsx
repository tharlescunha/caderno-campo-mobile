import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field } from '../src/components/form';
import { Icon } from '../src/components/Icon';
import { Button, Text } from '../src/components/ui';
import { createPeriod, getActivePeriod, type ActivePeriod } from '../src/data/periods';
import { localDate } from '../src/data/today';
import { useSync } from '../src/sync';
import { useTheme } from '../src/theme';

// Tela "Novo período" (design/NovoPeriodo.dc.html). Grava no celular e envia ao servidor em seguida.
const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export default function NovoPeriodo() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { syncNow } = useSync();
  const [active, setActive] = useState<ActivePeriod | null>(null);
  const [name, setName] = useState('');
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState<Date | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getActivePeriod().then(setActive);
  }, []);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe o nome do período.';
    if (end && localDate(end) < localDate(start)) e.end = 'O fim não pode ser antes do início.';
    if (active && !understood) e.understood = 'Confirme para continuar.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await createPeriod({ name: name.trim(), startDate: localDate(start), endDate: end ? localDate(end) : null });
      void syncNow(); // envia agora se houver internet; senão fica na fila
      router.back();
    } catch (err) {
      Alert.alert('Não foi possível salvar', err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  const dateBox = { minHeight: 52, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line, paddingHorizontal: 12, justifyContent: 'center' } as const;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, width: 96 }}>
          <Icon name="x" size={18} color={colors.muted} />
          <Text weight="bold" muted style={{ fontSize: 15 }}>
            Cancelar
          </Text>
        </Pressable>
        <Text weight="extrabold" style={{ fontSize: 16 }}>
          Novo período
        </Text>
        <View style={{ width: 96 }} />
      </View>

      <ScrollView style={{ flex: 1 }} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 150, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row' }}>
          <Field label="Nome do período" required placeholder="ex.: 6º período" value={name} onChangeText={setName} error={errors.name} />
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text weight="bold" style={{ fontSize: 13, color: colors.muted }}>
              Início
            </Text>
            <View style={[dateBox, { alignItems: 'flex-start' }]}>
              <DateTimePicker value={start} mode="date" display="compact" onChange={(_, d) => d && setStart(d)} locale="pt-BR" />
            </View>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text weight="bold" style={{ fontSize: 13, color: colors.muted }}>
              Fim (opcional)
            </Text>
            <View style={[dateBox, { alignItems: 'flex-start', borderColor: errors.end ? colors.danger : colors.line }]}>
              {end ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <DateTimePicker value={end} mode="date" display="compact" onChange={(_, d) => d && setEnd(d)} locale="pt-BR" />
                  <Pressable onPress={() => setEnd(null)} accessibilityLabel="Limpar data de fim" hitSlop={10}>
                    <Icon name="x" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setEnd(new Date(start.getTime() + 120 * 86_400_000))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
                  <Icon name="cal" size={18} color={colors.muted} />
                  <Text weight="semibold" muted style={{ fontSize: 16 }}>
                    —
                  </Text>
                </Pressable>
              )}
            </View>
            {errors.end ? (
              <Text weight="semibold" style={{ fontSize: 12, color: colors.danger }}>
                {errors.end}
              </Text>
            ) : null}
          </View>
        </View>

        {active ? (
          <>
            <View style={{ backgroundColor: '#FFFBF0', borderWidth: 2, borderColor: '#F2DFA9', borderRadius: 24, padding: 18, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name="warn" size={22} color="#7A5300" />
                <Text weight="extrabold" style={{ fontSize: 18, color: '#7A5300' }}>
                  O que acontece ao ativar
                </Text>
              </View>
              {[
                <>O <B>{active.name}</B> é finalizado.</>,
                <>As <B>{active.subjects} {active.subjects === 1 ? 'matéria' : 'matérias'}</B> dele ficam desativadas e saem da agenda, de Hoje e do quadro da semana.</>,
                <>Os relatórios em andamento deste período são finalizados.</>,
                <>Provas, entregas e eventos futuros ligados a essas matérias são encerrados{active.futureEvents ? ` (${active.futureEvents} agora)` : ''}.</>,
                <>Nada é apagado: relatórios, registros, fotos e anotações das matérias continuam guardados, em “Períodos anteriores”.</>,
                <>Anotações sem matéria e as configurações não mudam.</>,
              ].map((line, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#F2DFA9', alignItems: 'center', justifyContent: 'center' }}>
                    <Text weight="extrabold" style={{ fontSize: 12, color: '#7A5300' }}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: '#3A2A00' }}>{line}</Text>
                </View>
              ))}
            </View>

            <Pressable onPress={() => setUnderstood(!understood)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 44 }} accessibilityRole="checkbox" accessibilityState={{ checked: understood }}>
              <View style={{ width: 22, height: 22, borderRadius: 7, marginTop: 1, backgroundColor: understood ? '#0B5D3B' : colors.card, borderWidth: understood ? 0 : 2, borderColor: errors.understood ? colors.danger : colors.line, alignItems: 'center', justifyContent: 'center' }}>
                {understood ? <Icon name="check" size={14} color="#fff" /> : null}
              </View>
              <Text weight="semibold" style={{ flex: 1, fontSize: 14, lineHeight: 21 }}>
                Entendi. Só um período fica ativo, e o {active.name} será finalizado agora.
              </Text>
            </Pressable>
            {errors.understood ? (
              <Text weight="semibold" style={{ fontSize: 12, color: colors.danger, marginTop: -12 }}>
                {errors.understood}
              </Text>
            ) : null}
          </>
        ) : null}

        <Text weight="semibold" muted style={{ fontSize: 12, lineHeight: 19 }}>
          Depois de criar o período, cadastre as matérias dele em Matérias, escolhendo os dias da semana de cada uma.
        </Text>
      </ScrollView>

      <View pointerEvents="box-none" style={{  paddingHorizontal: 16, position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom - 6, 10) }}>
        <Button label={busy ? 'Salvando...' : 'Ativar novo período'} icon="check" variant="primary" onPress={busy ? undefined : save} />
      </View>
    </SafeAreaView>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return (
    <Text weight="extrabold" style={{ color: '#3A2A00' }}>
      {children}
    </Text>
  );
}
