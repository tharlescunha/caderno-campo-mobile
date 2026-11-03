import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../src/api/client';
import { Field } from '../src/components/form';
import { Icon } from '../src/components/Icon';
import { Button, Text } from '../src/components/ui';
import { useSession } from '../src/session';
import { useTheme } from '../src/theme';

export default function AlterarSenha() {
  const { colors } = useTheme();
  const router = useRouter();
  const { signOut } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!current) e.current = 'Informe a senha atual.';
    if (next.length < 8) e.next = 'A nova senha precisa ter no mínimo 8 caracteres.';
    if (repeat !== next) e.repeat = 'As senhas não são iguais.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api('PATCH', '/users/me/password', { current_password: current, new_password: next });
      // o servidor encerra todas as sessões ao trocar a senha: entra de novo com a nova
      Alert.alert('Senha alterada', 'Entre de novo com a senha nova.', [{ text: 'OK', onPress: () => void signOut() }]);
    } catch (err) {
      if (err instanceof ApiError && err.fields?.current_password) setErrors({ current: 'A senha atual está errada.' });
      else Alert.alert('Não foi possível alterar', err instanceof Error ? err.message : 'Verifique a internet e tente de novo.');
    }
    setBusy(false);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
          <Icon name="right" size={22} color={colors.text} />
        </Pressable>
        <Text weight="extrabold" style={{ fontSize: 22, letterSpacing: -0.5 }}>
          Alterar senha
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row' }}>
          <Field label="Senha atual" secureTextEntry autoCapitalize="none" value={current} onChangeText={setCurrent} error={errors.current} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Field label="Senha nova" placeholder="Mínimo de 8 caracteres" secureTextEntry autoCapitalize="none" value={next} onChangeText={setNext} error={errors.next} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Field label="Repetir a senha nova" secureTextEntry autoCapitalize="none" value={repeat} onChangeText={setRepeat} error={errors.repeat} />
        </View>
        <Text weight="semibold" muted style={{ fontSize: 12, lineHeight: 18 }}>
          Ao trocar a senha, você sai de todos os aparelhos e entra de novo com a senha nova.
        </Text>
        <Button label={busy ? 'Salvando...' : 'Alterar senha'} variant="primary" onPress={busy ? undefined : save} />
      </ScrollView>
    </SafeAreaView>
  );
}
