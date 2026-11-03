import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { fonts, useTheme } from '../theme';
import { Icon } from './Icon';
import { Chip, Text } from './ui';

export function Field({ label, error, required, ...input }: TextInputProps & { label: string; error?: string; required?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text weight="bold" style={{ fontSize: 13, color: colors.muted }}>
        {label}
        {required ? <Text weight="bold" style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        {...input}
        style={{ minHeight: 52, borderRadius: 16, paddingHorizontal: 14, backgroundColor: colors.card, color: colors.text, fontFamily: fonts.medium, fontSize: 16, borderWidth: 2, borderColor: error ? colors.danger : colors.line }}
      />
      {error ? (
        <Text weight="semibold" style={{ fontSize: 12, color: colors.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Escolha de uma opção entre poucas (tipo de evento, situação, etc.). */
export function Selector<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text weight="bold" style={{ fontSize: 13 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => onChange(o.value)}>
              <Chip label={o.label} fg={on ? colors.onPrimary : colors.text} bg={on ? colors.primary : colors.card} style={{ fontSize: 14 }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Cabeçalho de tela interna: título, botão de voltar opcional e ação à direita. */
export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
            <Icon name="right" size={22} color={colors.text} />
          </Pressable>
        ) : null}
        <Text weight="extrabold" style={{ flex: 1, fontSize: 24, letterSpacing: -0.5 }} numberOfLines={1}>
          {title}
        </Text>
        {right}
      </View>
    </SafeAreaView>
  );
}
