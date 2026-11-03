import { SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';
import type { IconName } from './Icon';
import { EmptyState, Text } from './ui';
import { useTheme } from '../theme';

/** Tela ainda não construída: aparece só para a navegação já funcionar. */
export function Placeholder({ title, icon }: { title: string; icon: IconName }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <Text weight="extrabold" style={{ fontSize: 26, letterSpacing: -0.5 }}>
          {title}
        </Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState icon={icon} title="Em construção" hint="Esta tela chega nas próximas etapas." />
      </View>
    </SafeAreaView>
  );
}
