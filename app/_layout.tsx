import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SessionProvider, useSession } from '../src/session';
import { setupNotifications, type NotificationTarget } from '../src/notifications/local';
import { SyncProvider } from '../src/sync';
import { ThemeProvider, useTheme } from '../src/theme';

SplashScreen.preventAutoHideAsync();
setupNotifications();

function Root() {
  const { colors, isDark } = useTheme();
  const { status, firstAccessDone } = useSession();
  const router = useRouter();

  // tocar num lembrete do celular abre o item dele
  useEffect(() => {
    if (status !== 'signedIn' || !firstAccessDone) return;
    const open = (data: unknown) => {
      const target = (data as { target?: NotificationTarget } | undefined)?.target;
      if (!target) return;
      if (target.type === 'report') router.push({ pathname: '/relatorio/[id]', params: { id: target.id } });
      else if (target.type === 'subject') router.push({ pathname: '/materia/[id]', params: { id: target.id } });
      else router.push({ pathname: '/novo-evento', params: { id: target.id } });
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    return () => sub.remove();
  }, [status, firstAccessDone, router]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={status === 'signedIn' && firstAccessDone}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="sobre" />
          <Stack.Screen name="novo-periodo" options={{ presentation: 'modal' }} />
          <Stack.Screen name="nova-materia" options={{ presentation: 'modal' }} />
          <Stack.Screen name="novo-relatorio" options={{ presentation: 'modal' }} />
          <Stack.Screen name="novo-registro" options={{ presentation: 'modal' }} />
          <Stack.Screen name="novo-evento" options={{ presentation: 'modal' }} />
          <Stack.Screen name="nova-nota" options={{ presentation: 'modal' }} />
          <Stack.Screen name="noticia/[id]" />
          <Stack.Screen name="historico" />
          <Stack.Screen name="materia/[id]" />
          <Stack.Screen name="busca" />
          <Stack.Screen name="notificacoes" />
          <Stack.Screen name="configuracoes" />
          <Stack.Screen name="alterar-senha" />
          <Stack.Screen name="editar-perfil" />
          <Stack.Screen name="periodos" />
          <Stack.Screen name="itens-nao-enviados" />
          <Stack.Screen name="periodo/[id]" />
          <Stack.Screen name="resumo/[id]" />
          <Stack.Screen name="relatorio/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedIn' && !firstAccessDone}>
          <Stack.Screen name="primeiro-acesso" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="login" />
          <Stack.Screen name="cadastro" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

function Gate() {
  const { status } = useSession();
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const ready = (loaded || error) && status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  return ready ? <Root /> : null;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <SyncProvider>
          <Gate />
        </SyncProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
