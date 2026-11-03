import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../src/api/client';
import { Icon } from '../src/components/Icon';
import { Button, Text } from '../src/components/ui';
import { useSession } from '../src/session';
import { fonts, useTheme } from '../src/theme';

// Tela "Entrar" (design/Login.dc.html): topo verde da marca e painel claro por cima.
export default function Login() {
  const { colors } = useTheme();
  const router = useRouter();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keep, setKeep] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Informe o e-mail e a senha.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password, keep);
    } catch (e) {
      if (e instanceof ApiError) setError(e.status === 401 ? 'E-mail ou senha incorretos.' : e.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : e.message);
      else setError('Sem conexão com o servidor. Verifique a internet e tente de novo.');
    }
    setBusy(false);
  };

  const inputBox = { minHeight: 52, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line } as const;
  const inputText = { fontFamily: fonts.medium, fontSize: 16, color: colors.text } as const;

  return (
    <View style={{ flex: 1, backgroundColor: '#0B5D3B' }}>
      <View style={{ position: 'absolute', right: -70, top: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: '#C8F169', opacity: 0.14 }} />
      <View style={{ position: 'absolute', left: -80, top: 260, width: 200, height: 200, borderRadius: 100, backgroundColor: '#2E9D63', opacity: 0.2 }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
          <SafeAreaView edges={['top']}>
            <View style={{ paddingHorizontal: 24, paddingTop: 36, paddingBottom: 28, gap: 16 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#C8F169', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="logo" size={36} color="#0B5D3B" />
              </View>
              <View>
                <Text weight="extrabold" style={{ fontSize: 34, letterSpacing: -1, lineHeight: 36, color: '#fff' }}>
                  {'Caderno\nde Campo'}
                </Text>
                <Text weight="semibold" style={{ fontSize: 15, color: '#BFE3CC', marginTop: 10 }}>
                  Aula, campo e mercado num lugar só.
                </Text>
              </View>
            </View>
          </SafeAreaView>

          <View style={{ flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20, gap: 18 }}>
            <Text weight="extrabold" style={{ fontSize: 22, letterSpacing: -0.4 }}>
              Entrar
            </Text>

            <View style={{ gap: 6 }}>
              <Text weight="bold" style={{ fontSize: 13, color: colors.muted }}>
                E-mail
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="voce@exemplo.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                accessibilityLabel="E-mail"
                style={[inputBox, inputText, { paddingHorizontal: 14 }]}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text weight="bold" style={{ fontSize: 13, color: colors.muted }}>
                Senha
              </Text>
              <View style={[inputBox, { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 6 }]}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Sua senha"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  onSubmitEditing={submit}
                  accessibilityLabel="Senha"
                  style={[inputText, { flex: 1, minHeight: 48 }]}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="eye" size={20} color={showPassword ? colors.text : colors.muted} />
                </Pressable>
              </View>
            </View>

            <Pressable onPress={() => setKeep(!keep)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }} accessibilityRole="checkbox" accessibilityState={{ checked: keep }}>
              <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: keep ? '#0B5D3B' : colors.card, borderWidth: keep ? 0 : 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
                {keep ? <Icon name="check" size={14} color="#fff" /> : null}
              </View>
              <Text weight="semibold" style={{ fontSize: 14 }}>
                Manter conectado
              </Text>
            </Pressable>

            {error ? (
              <View style={{ backgroundColor: colors.dangerBg, borderRadius: 14, padding: 12 }}>
                <Text weight="semibold" style={{ color: colors.danger, fontSize: 13 }}>
                  {error}
                </Text>
              </View>
            ) : null}

            <Button label={busy ? 'Entrando...' : 'Entrar'} variant="primary" onPress={busy ? undefined : submit} />

            <Pressable onPress={() => router.push('/cadastro')}>
              <Text weight="semibold" muted style={{ textAlign: 'center', fontSize: 15 }}>
                Ainda não tem conta?{' '}
                <Text weight="extrabold" style={{ color: colors.link, fontSize: 15 }}>
                  Criar conta
                </Text>
              </Text>
            </Pressable>

            <View style={{ flex: 1 }} />
            <Text weight="semibold" muted style={{ textAlign: 'center', fontSize: 12, lineHeight: 19 }}>
              {'Caderno de Campo · versão 1\nDesenvolvido por Tharles Cunha'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
