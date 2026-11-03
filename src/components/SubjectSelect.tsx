import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SubjectItem } from '../data/subjects';
import { subjectTones, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './ui';

/**
 * Campo de seleção de matéria: uma linha só (bolinha, nome e setinha). Ao tocar abre a lista, com o professor de cada matéria.
 * Com `optional`, a lista tem a opção "Sem matéria".
 */
export function SubjectSelect({ subjects, value, onChange, optional, error }: { subjects: SubjectItem[]; value: string | null; onChange: (id: string | null) => void; optional?: boolean; error?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = subjects.find((s) => s.id === value) ?? null;
  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <View style={{ gap: 6 }}>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Escolher matéria" style={{ minHeight: 52, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: error ? colors.danger : colors.line, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {current ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: subjectTones[current.color].dot }} /> : null}
        <Text weight={current ? 'extrabold' : 'semibold'} style={{ flex: 1, fontSize: 15, color: current ? colors.text : colors.muted }} numberOfLines={1}>
          {current ? current.name : subjects.length ? (optional ? 'Sem matéria' : 'Escolha a matéria') : 'Nenhuma matéria cadastrada'}
        </Text>
        <Icon name="down" size={18} color={colors.muted} />
      </Pressable>
      {error ? (
        <Text weight="semibold" style={{ fontSize: 12, color: colors.danger }}>
          {error}
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '70%', paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 }}>
              <Text weight="extrabold" style={{ fontSize: 18 }}>
                Matéria
              </Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Fechar" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="x" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
              {optional ? (
                <Pressable onPress={() => pick(null)} style={{ minHeight: 56, borderRadius: 18, borderWidth: 2, borderColor: value === null ? '#0B5D3B' : colors.line, backgroundColor: value === null ? colors.chipBg : colors.card, paddingHorizontal: 16, justifyContent: 'center' }}>
                  <Text weight="extrabold" style={{ fontSize: 15 }}>
                    Sem matéria
                  </Text>
                </Pressable>
              ) : null}
              {subjects.map((s) => {
                const on = s.id === value;
                return (
                  <Pressable key={s.id} onPress={() => pick(s.id)} accessibilityState={{ selected: on }} style={{ minHeight: 56, borderRadius: 18, borderWidth: 2, borderColor: on ? '#0B5D3B' : colors.line, backgroundColor: on ? colors.chipBg : colors.card, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: subjectTones[s.color].dot }} />
                    <View style={{ flex: 1 }}>
                      <Text weight="extrabold" style={{ fontSize: 15 }} numberOfLines={1}>
                        {s.name}
                      </Text>
                      {s.teacher ? (
                        <Text weight="semibold" muted style={{ fontSize: 12 }} numberOfLines={1}>
                          {s.teacher}
                        </Text>
                      ) : null}
                    </View>
                    {on ? <Icon name="check" size={18} color={colors.text} /> : null}
                  </Pressable>
                );
              })}
              {subjects.length === 0 ? (
                <Text weight="semibold" muted style={{ fontSize: 13, padding: 8 }}>
                  Cadastre uma matéria antes, na aba Matérias.
                </Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
