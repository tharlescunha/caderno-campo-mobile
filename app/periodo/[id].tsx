import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { Card, Text } from '../../src/components/ui';
import { listPeriods, type PeriodRow } from '../../src/data/periodsPage';
import { subjectTones, useTheme } from '../../src/theme';

// Matérias de um período anterior (somente leitura): tocar abre a tela da matéria.
export default function PeriodoMaterias() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [period, setPeriod] = useState<PeriodRow | null>(null);

  useEffect(() => {
    void listPeriods().then((l) => setPeriod(l.find((p) => p.id === id) ?? null));
  }, [id]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
          <Icon name="right" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text weight="semibold" muted style={{ fontSize: 12 }}>
            matérias do período · somente leitura
          </Text>
          <Text weight="extrabold" style={{ fontSize: 24, letterSpacing: -0.6 }}>
            {period?.name ?? 'Período'}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {period && period.subjects.length === 0 ? (
          <Card>
            <Text weight="semibold" muted style={{ fontSize: 13 }}>
              Este período não teve matérias cadastradas.
            </Text>
          </Card>
        ) : null}
        {period?.subjects.map((s) => (
          <Pressable key={s.id} onPress={() => router.push({ pathname: '/materia/[id]', params: { id: s.id } })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: subjectTones[s.color].dot }} />
              <Text weight="extrabold" style={{ flex: 1, fontSize: 16 }}>
                {s.name}
              </Text>
              <Icon name="right" size={18} color={colors.muted} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
