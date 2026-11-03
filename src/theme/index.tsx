import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export interface Palette {
  bg: string;
  card: string;
  text: string;
  muted: string;
  line: string;
  lineSoft: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  pill: string;
  link: string;
  danger: string;
  dangerBg: string;
  chipBg: string;
}

export const light: Palette = {
  bg: '#F2F6EE',
  card: '#FFFFFF',
  text: '#0F2A1D',
  muted: '#5C7066',
  line: '#DCE4D5',
  lineSoft: '#E7EEE1',
  primary: '#0B5D3B',
  onPrimary: '#FFFFFF',
  accent: '#C8F169',
  onAccent: '#0F2A1D',
  pill: '#E3F4C3',
  link: '#14663F',
  danger: '#A3221B',
  dangerBg: '#FBE4E1',
  chipBg: '#EAF0E6',
};

export const dark: Palette = {
  bg: '#08140E',
  card: '#10241A',
  text: '#E9F3EC',
  muted: '#8FB9A2',
  line: '#1F3A2E',
  lineSoft: '#1A3328',
  primary: '#1E8A5A',
  onPrimary: '#FFFFFF',
  accent: '#C8F169',
  onAccent: '#0F2A1D',
  pill: '#1E5A43',
  link: '#8FD6AB',
  danger: '#FF9C92',
  dangerBg: '#3A1B18',
  chipBg: '#1A3328',
};

/** Cores das matérias/eventos (fundo + texto), iguais nos dois temas para manter a identidade. */
export const tones = {
  amber: { fg: '#7A5300', bg: '#FCEFCB' },
  purple: { fg: '#5B3A99', bg: '#EBE2F7' },
  green: { fg: '#14663F', bg: '#DDF1E5' },
  brown: { fg: '#7A4B0C', bg: '#F5E8D3' },
  blue: { fg: '#1B5C83', bg: '#E3F1F8' },
} as const;

/** Cores que o usuário escolhe para cada matéria (os mesmos nomes do banco). `solid` é a bolinha/seletor. */
export const subjectTones = {
  azul: { fg: '#1F4FA8', bg: '#DCE8FB', dot: '#1F4FA8', solid: '#1F4FA8', label: 'Azul' },
  verde: { fg: '#14663F', bg: '#DDF1E5', dot: '#2E9D63', solid: '#14663F', label: 'Verde' },
  terra: { fg: '#7A4B0C', bg: '#F5E8D3', dot: '#B7791F', solid: '#7A4B0C', label: 'Terra' },
  roxo: { fg: '#5B3A99', bg: '#EBE2F7', dot: '#7A4FB8', solid: '#5B3A99', label: 'Roxo' },
  vermelho: { fg: '#A3221B', bg: '#FBE4E1', dot: '#D9483B', solid: '#A3221B', label: 'Vermelho' },
} as const;
export type SubjectColor = keyof typeof subjectTones;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type ThemeMode = 'light' | 'dark' | 'system';

interface Theme {
  colors: Palette;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<Theme>({ colors: light, isDark: false, mode: 'light', setMode: () => {} });

/** Claro (padrão), escuro ou o do aparelho. A escolha fica guardada no cofre do aparelho. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  // padrão: tema claro (a marca fica mais bonita). Quem escolher Escuro ou Sistema nas Configurações mantém a escolha.
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    SecureStore.getItemAsync('theme_mode')
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
      })
      .catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    SecureStore.setItemAsync('theme_mode', m).catch(() => {});
  }, []);

  const isDark = mode === 'system' ? scheme === 'dark' : mode === 'dark';
  const value = useMemo<Theme>(() => ({ colors: isDark ? dark : light, isDark, mode, setMode }), [isDark, mode, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
