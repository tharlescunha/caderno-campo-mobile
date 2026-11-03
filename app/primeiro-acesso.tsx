import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../src/api/client';
import { rescheduleReminders } from '../src/notifications/local';
import { Icon, type IconName } from '../src/components/Icon';
import { Button, Text } from '../src/components/ui';
import { useSession } from '../src/session';
import { useTheme } from '../src/theme';

// Tela "Primeiro acesso" (design/PrimeiroAcesso.dc.html): 3 passos logo depois de criar a conta.
const steps: { icon: IconName; title: string; text: string; points: { icon: IconName; text: string }[] }[] = [
  {
    icon: 'pin',
    title: 'Clima certo em cada registro',
    text: 'Quando você registrar uma visita ao campo, o app usa a localização do celular para buscar temperatura, umidade, vento e chuva do momento e guardar junto com o registro.',
    points: [
      { icon: 'check', text: 'Usada só na hora de criar um registro ou uma foto.' },
      { icon: 'lock', text: 'O app não fica seguindo você. Só você vê os seus dados.' },
      { icon: 'cloud', text: 'Sem permissão, você digita o clima à mão no registro.' },
    ],
  },
  {
    icon: 'bell',
    title: 'Lembretes que ajudam',
    text: 'Receba um aviso quando uma prova ou entrega estiver chegando e na véspera das aulas de campo, com a previsão do tempo.',
    points: [
      { icon: 'cal', text: 'Provas, trabalhos, entregas e eventos da faculdade.' },
      { icon: 'cloud', text: 'Véspera da aula de campo, com a previsão.' },
      { icon: 'check', text: 'Você escolhe quando ser avisado em cada evento.' },
    ],
  },
  {
    icon: 'book',
    title: 'Falta só o seu período',
    text: 'As matérias ficam dentro de um período. Cadastre o período em que você está e depois as matérias e os dias da semana de cada uma.',
    points: [
      { icon: 'book', text: 'Exemplo: 5º período, de agosto a dezembro.' },
      { icon: 'cal', text: 'Quando o período acabar, você cria o próximo e o anterior fica guardado.' },
    ],
  },
];

export default function PrimeiroAcesso() {
  const { colors } = useTheme();
  const router = useRouter();
  const { completeFirstAccess } = useSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const s = steps[step];
  const last = step === steps.length - 1;
  const next = () => setStep((n) => n + 1);

  const allowLocation = async () => {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        // Posição de apoio para a previsão de amanhã; sem internet, simplesmente não envia.
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await api('PATCH', '/users/me', { default_location: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } }).catch(() => {});
      }
    } catch {
      // permissão negada ou sem GPS: o registro de campo pede o clima à mão
    }
    setBusy(false);
    next();
  };

  const allowNotifications = async () => {
    setBusy(true);
    try {
      const r = await Notifications.requestPermissionsAsync();
      if (r.granted) void rescheduleReminders();
    } catch {
      // sem permissão, não há lembretes; dá para ligar depois nas configurações do celular
    }
    setBusy(false);
    next();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {steps.map((_, i) => (
            <View key={i} style={{ width: i <= step ? 32 : 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? '#0B5D3B' : colors.line }} />
          ))}
        </View>
        <Text weight="bold" muted style={{ fontSize: 13 }}>
          Passo {step + 1} de 3
        </Text>
      </View>

      {/* O conteúdo rola; os botões ficam sempre visíveis embaixo. */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, gap: 22 }}>
          <View style={{ height: 220, borderRadius: 32, backgroundColor: '#0B5D3B', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: '#1E5A43', opacity: 0.7 }} />
            <View style={{ position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#2E7A5B', opacity: 0.7 }} />
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#C8F169', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={s.icon} size={44} color="#0B5D3B" />
            </View>
          </View>

          <View>
            <Text weight="extrabold" style={{ fontSize: 30, letterSpacing: -0.9, lineHeight: 33 }}>
              {s.title}
            </Text>
            <Text muted style={{ fontSize: 15, marginTop: 10, lineHeight: 23 }}>
              {s.text}
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            {s.points.map((p) => (
              <View key={p.text} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: colors.pill, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={p.icon} size={18} color={colors.text} />
                </View>
                <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, paddingTop: 5 }}>{p.text}</Text>
              </View>
            ))}
          </View>

      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16, gap: 6, backgroundColor: colors.bg }}>
            {step === 0 ? <Button label="Permitir localização" icon="pin" variant="primary" onPress={busy ? undefined : allowLocation} /> : null}
            {step === 1 ? <Button label="Ativar lembretes" icon="bell" variant="primary" onPress={busy ? undefined : allowNotifications} /> : null}
            {last ? (
              <Button
                label="Cadastrar período"
                variant="primary"
                onPress={async () => {
                  await completeFirstAccess();
                  // a tela troca para o app principal; só então abre o cadastro por cima
                  setTimeout(() => router.push('/novo-periodo'), 400);
                }}
              />
            ) : null}
            <Pressable onPress={last ? completeFirstAccess : next} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Text weight="extrabold" style={{ fontSize: 15, color: colors.muted }}>
                {last ? 'Fazer depois' : 'Agora não'}
              </Text>
            </Pressable>
            {step === 0 ? (
              <Text weight="semibold" muted style={{ textAlign: 'center', fontSize: 12 }}>
                Você pode mudar isso depois nas configurações do celular.
              </Text>
            ) : null}
      </View>
    </SafeAreaView>
  );
}
