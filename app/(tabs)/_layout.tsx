import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../src/components/Icon';
import { fonts, useTheme } from '../../src/theme';

const tabs: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Hoje', icon: 'home' },
  { name: 'agenda', title: 'Agenda', icon: 'cal' },
  { name: 'relatorios', title: 'Relatórios', icon: 'note' },
  { name: 'notas', title: 'Notas', icon: 'notes' },
  { name: 'materias', title: 'Matérias', icon: 'book' },
  { name: 'mercado', title: 'Mercado', icon: 'chart' },
];

/**
 * Menu flutuante em forma de pílula. O item selecionado ganha uma bolinha arredondada com o ícone e o nome juntos
 * (como no WhatsApp). Os nomes encolhem sozinhos em telas estreitas, para não cortar nenhuma letra.
 */
function TabBar({ state }: { state: any }) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingBottom: Math.max(insets.bottom, 10) }}>
      <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 32, borderWidth: 1, borderColor: colors.line, padding: 4, shadowColor: '#000', shadowOpacity: isDark ? 0.4 : 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
        {state.routes.map((route: any, i: number) => {
          const t = tabs.find((x) => x.name === route.name);
          if (!t) return null;
          const focused = state.index === i;
          const color = focused ? '#FFFFFF' : colors.muted;
          const onPress = () => {
            if (!focused) router.navigate((route.name === 'index' ? '/' : `/${route.name}`) as any);
          };
          return (
            <Pressable key={route.key} onPress={onPress} accessibilityRole="button" accessibilityLabel={t.title} accessibilityState={{ selected: focused }} style={{ flex: 1 }}>
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 2, gap: 2, borderRadius: 26, backgroundColor: focused ? colors.primary : 'transparent' }}>
                <Icon name={t.icon} size={22} color={color} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontFamily: focused ? fonts.extrabold : fonts.semibold, fontSize: 10.5, color, maxWidth: '100%' }}>
                  {t.title}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs tabBar={(p) => <TabBar {...(p as any)} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      {tabs.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
      ))}
    </Tabs>
  );
}
