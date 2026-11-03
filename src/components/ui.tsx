import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text as RNText, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { fonts, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

type Weight = keyof typeof fonts;

/** Texto com a fonte da marca (Plus Jakarta Sans) e a cor do tema. */
export function Text({ weight = 'medium', muted, style, ...rest }: TextProps & { weight?: Weight; muted?: boolean }) {
  const { colors } = useTheme();
  return <RNText {...rest} style={[{ fontFamily: fonts[weight], color: muted ? colors.muted : colors.text }, style]} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }, style]}>{children}</View>;
}

export function Chip({ label, fg, bg, style }: { label: string; fg: string; bg: string; style?: StyleProp<TextStyle> }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text weight="bold" style={[{ color: fg, fontSize: 12 }, style]}>
        {label}
      </Text>
    </View>
  );
}

export function SectionHeader({ title, aside, onAsidePress }: { title: string; aside?: string; onAsidePress?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text weight="extrabold" style={{ fontSize: 18, letterSpacing: -0.2 }}>
        {title}
      </Text>
      {aside ? (
        onAsidePress ? (
          <Pressable onPress={onAsidePress} style={styles.more} hitSlop={8}>
            <Text weight="bold" style={{ color: colors.link, fontSize: 14 }}>
              {aside}
            </Text>
            <Icon name="right" size={18} color={colors.link} />
          </Pressable>
        ) : (
          <Text weight="semibold" muted style={{ fontSize: 12 }}>
            {aside}
          </Text>
        )
      ) : null}
    </View>
  );
}

export function IconBox({ name, fg, bg, size = 40, radius = 14 }: { name: IconName; fg: string; bg: string; size?: number; radius?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={18} color={fg} />
    </View>
  );
}

export function Button({ label, icon, onPress, variant = 'accent' }: { label: string; icon?: IconName; onPress?: () => void; variant?: 'accent' | 'primary' }) {
  const { colors } = useTheme();
  const bg = variant === 'accent' ? colors.accent : colors.primary;
  const fg = variant === 'accent' ? colors.onAccent : colors.onPrimary;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }]}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text weight="extrabold" style={{ color: fg, fontSize: 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Aviso de item que ainda não foi enviado ao servidor (modo offline). */
export function PendingBadge() {
  return (
    <View style={[styles.chip, { backgroundColor: '#FCEFCB' }]}>
      <Text weight="bold" style={{ color: '#7A5300', fontSize: 11 }}>
        Aguardando envio
      </Text>
    </View>
  );
}

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <IconBox name={icon} fg={colors.link} bg={colors.pill} size={56} radius={20} />
      <Text weight="extrabold" style={{ fontSize: 17, marginTop: 14 }}>
        {title}
      </Text>
      {hint ? (
        <Text muted style={{ fontSize: 13, marginTop: 4, textAlign: 'center' }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 18, borderBottomWidth: 1, shadowColor: '#0B5D3B', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  button: { minHeight: 48, borderRadius: 999, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  empty: { alignItems: 'center', padding: 32 },
});

/** Carregando: um giro pequeno nas cores da marca, com um texto opcional. Use onde a tela precisar esperar algo. */
export function Loading({ text, size = 'small', inline }: { text?: string; size?: 'small' | 'large'; inline?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: inline ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: inline ? 0 : 24 }} accessibilityRole="progressbar" accessibilityLabel={text ?? 'Carregando'}>
      <ActivityIndicator size={size} color={colors.link} />
      {text ? (
        <Text weight="semibold" muted style={{ fontSize: 13 }}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}
