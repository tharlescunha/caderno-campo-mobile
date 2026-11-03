import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../src/components/Icon';
import { Card, IconBox, Text } from '../src/components/ui';
import { useTheme } from '../src/theme';

// Tela "Sobre": abre ao tocar no cadernozinho da tela Hoje. Um caderno virando as folhas, folhinhas caindo e o que o app faz.
const NOTE_W = 150;
const NOTE_H = 200;

/** Uma folha que vira ao redor da lombada, em ciclo. */
function FlipPage({ delay, lineColor }: { delay: number; lineColor: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(2200 - delay),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, t]);
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-180deg'] });
  const opacity = t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        width: NOTE_W,
        height: NOTE_H,
        borderTopRightRadius: 10,
        borderBottomRightRadius: 10,
        backgroundColor: '#FFFDF6',
        borderWidth: 1,
        borderColor: '#E4E0D2',
        opacity,
        backfaceVisibility: 'hidden',
        transform: [{ perspective: 900 }, { translateX: -NOTE_W / 2 }, { rotateY: rotate }, { translateX: NOTE_W / 2 }],
        padding: 18,
        gap: 12,
        justifyContent: 'center',
      }}
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ height: 2, borderRadius: 1, backgroundColor: lineColor, width: i % 3 === 2 ? '60%' : '100%' }} />
      ))}
    </Animated.View>
  );
}

/** Folhinha que cai balançando. */
function Leaf({ left, duration, delay, size }: { left: number; duration: number; delay: number; size: number }) {
  const { colors } = useTheme();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(t, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }), Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [delay, duration, t]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [-30, 300] });
  const translateX = t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 14, 0, -14, 0] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['-20deg', '200deg'] });
  const opacity = t.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.9, 0.9, 0] });
  return (
    <Animated.View style={{ position: 'absolute', left, top: 0, opacity, transform: [{ translateY }, { translateX }, { rotate }] }}>
      <Icon name="sprout" size={size} color={colors.link} />
    </Animated.View>
  );
}

const features: { icon: IconName; title: string; text: string }[] = [
  { icon: 'cal', title: 'Agenda das aulas', text: 'Aulas, provas, entregas e aulas de campo, com lembretes no celular.' },
  { icon: 'sprout', title: 'Relatórios de campo', text: 'Registre cada visita com clima, fotos, áudio e o que ficou para a próxima.' },
  { icon: 'notes', title: 'Anotações', text: 'Anote as aulas e as leituras, com anexos, links e tags.' },
  { icon: 'chart', title: 'Mercado', text: 'Cotações, clima e notícias do campo num só lugar.' },
  { icon: 'note', title: 'PDF do relatório', text: 'Gere um PDF com a linha do tempo e as fotos para montar o relatório da faculdade.' },
  { icon: 'cloud', title: 'Funciona sem internet', text: 'No campo, sem sinal, tudo fica salvo no celular e sobe sozinho depois.' },
];

export default function Sobre() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 20 }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
          <Icon name="right" size={22} color={colors.text} />
        </Pressable>

        {/* Caderno virando as folhas, com folhinhas caindo */}
        <View style={{ height: 300, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="none">
            <Leaf left={30} duration={5200} delay={0} size={18} />
            <Leaf left={95} duration={6400} delay={1400} size={14} />
            <Leaf left={170} duration={5600} delay={600} size={20} />
            <Leaf left={240} duration={6800} delay={2200} size={15} />
            <Leaf left={300} duration={5000} delay={3000} size={18} />
          </View>
          <View style={{ width: NOTE_W * 2 - 10, height: NOTE_H, flexDirection: 'row' }}>
            {/* capa aberta (lado esquerdo) */}
            <View style={{ width: NOTE_W - 10, height: NOTE_H, backgroundColor: '#0B5D3B', borderTopLeftRadius: 12, borderBottomLeftRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="logo" size={46} color="#C8F169" />
            </View>
            {/* lado direito: folha de baixo e as que viram */}
            <View style={{ width: NOTE_W, height: NOTE_H }}>
              <View style={{ position: 'absolute', right: 0, top: 0, width: NOTE_W, height: NOTE_H, borderTopRightRadius: 10, borderBottomRightRadius: 10, backgroundColor: '#FFFDF6', borderWidth: 1, borderColor: '#E4E0D2', padding: 18, gap: 12, justifyContent: 'center' }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={{ height: 2, borderRadius: 1, backgroundColor: '#D9D5C4', width: i % 3 === 2 ? '60%' : '100%' }} />
                ))}
              </View>
              <FlipPage delay={0} lineColor="#D9D5C4" />
              <FlipPage delay={700} lineColor="#D9D5C4" />
              <FlipPage delay={1400} lineColor="#D9D5C4" />
            </View>
            {/* argolas na lombada */}
            <View style={{ position: 'absolute', left: NOTE_W - 18, top: 14, bottom: 14, justifyContent: 'space-between' }}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} style={{ width: 16, height: 6, borderRadius: 3, backgroundColor: '#C8F169' }} />
              ))}
            </View>
          </View>
        </View>

        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text weight="extrabold" style={{ fontSize: 28, letterSpacing: -0.8 }}>
            Caderno de Campo
          </Text>
          <Text weight="semibold" muted style={{ fontSize: 14, textAlign: 'center', lineHeight: 21, paddingHorizontal: 12 }}>
            O caderno de quem estuda agronomia: aulas, anotações e visitas ao campo no mesmo lugar, com ou sem internet.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text weight="extrabold" style={{ fontSize: 19 }}>
            O que ele faz
          </Text>
          <Card style={{ paddingVertical: 6, paddingHorizontal: 16 }}>
            {features.map((f, i) => (
              <View key={f.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.lineSoft }}>
                <IconBox name={f.icon} fg={colors.link} bg={colors.chipBg} />
                <View style={{ flex: 1 }}>
                  <Text weight="extrabold" style={{ fontSize: 15 }}>
                    {f.title}
                  </Text>
                  <Text weight="semibold" muted style={{ fontSize: 12.5, lineHeight: 18 }}>
                    {f.text}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </View>

        <Text weight="semibold" muted style={{ fontSize: 12, textAlign: 'center' }}>
          Versão {version}
        </Text>
      </ScrollView>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top, backgroundColor: colors.bg }} />
    </View>
  );
}
