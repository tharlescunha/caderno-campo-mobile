import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../src/api/client';
import { Field } from '../src/components/form';
import { Icon } from '../src/components/Icon';
import { Button, Text } from '../src/components/ui';
import { useSession } from '../src/session';
import { useTheme } from '../src/theme';

// Tela "Criar conta" (design/Cadastro.dc.html).
export default function Cadastro() {
  const { colors } = useTheme();
  const router = useRouter();
  const { signUp } = useSession();
  const [form, setForm] = useState({ name: '', email: '', password: '', repeat: '', course: '', institution: '' });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Informe o seu nome.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Informe um e-mail válido.';
    if (form.password.length < 8) e.password = 'A senha precisa ter no mínimo 8 caracteres.';
    if (form.repeat !== form.password) e.repeat = 'As senhas não são iguais.';
    if (!accepted) e.accepted = 'É preciso aceitar para criar a conta.';
    setErrors(e);
    setMessage(null);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      await signUp({ name: form.name.trim(), email: form.email.trim(), password: form.password, course: form.course.trim() || undefined, institution: form.institution.trim() || undefined });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'email_in_use') setErrors({ email: 'Este e-mail já tem conta.' });
        else if (err.code === 'signup_closed') setMessage('O cadastro está fechado neste servidor. Peça ao administrador para liberar.');
        else if (err.fields) setErrors(err.fields);
        else setMessage(err.message);
      } else setMessage('Sem conexão com o servidor. Verifique a internet e tente de novo.');
    }
    setBusy(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ paddingHorizontal: 16, paddingTop: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
              <Icon name="right" size={22} color={colors.text} />
            </Pressable>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#0B5D3B', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="logo" size={22} color="#C8F169" />
            </View>
          </View>

          <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
            <Text weight="extrabold" style={{ fontSize: 30, letterSpacing: -0.9, lineHeight: 33 }}>
              Criar conta
            </Text>
            <Text muted style={{ fontSize: 15, marginTop: 8, lineHeight: 22 }}>
              Seus relatórios, anotações e matérias ficam ligados à sua conta. Só você vê os seus dados.
            </Text>
          </View>

          <View style={{ paddingHorizontal: 24, paddingTop: 22, gap: 16 }}>
            <View style={{ flexDirection: 'row' }}>
              <Field label="Nome" required placeholder="Seu nome" value={form.name} onChangeText={set('name')} error={errors.name} autoComplete="name" textContentType="name" />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Field label="E-mail" required placeholder="voce@exemplo.com" value={form.email} onChangeText={set('email')} error={errors.email} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Field label="Senha" required placeholder="Mínimo de 8 caracteres" value={form.password} onChangeText={set('password')} error={errors.password} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Field label="Repetir a senha" required placeholder="Digite a senha de novo" value={form.repeat} onChangeText={set('repeat')} error={errors.repeat} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field label="Curso" placeholder="opcional" value={form.course} onChangeText={set('course')} />
              <Field label="Instituição" placeholder="opcional" value={form.institution} onChangeText={set('institution')} />
            </View>

            <Pressable onPress={() => setAccepted(!accepted)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 44 }} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
              <View style={{ width: 22, height: 22, borderRadius: 7, marginTop: 1, backgroundColor: accepted ? '#0B5D3B' : colors.card, borderWidth: accepted ? 0 : 2, borderColor: errors.accepted ? colors.danger : colors.line, alignItems: 'center', justifyContent: 'center' }}>
                {accepted ? <Icon name="check" size={14} color="#fff" /> : null}
              </View>
              <Text weight="semibold" style={{ flex: 1, fontSize: 14, lineHeight: 21 }}>
                Li e aceito o uso dos meus dados para o funcionamento do app. A localização só é usada para buscar o clima dos registros.
              </Text>
            </Pressable>
            {errors.accepted ? (
              <Text weight="semibold" style={{ fontSize: 12, color: colors.danger, marginTop: -8 }}>
                {errors.accepted}
              </Text>
            ) : null}
          </View>

          <View style={{ flex: 1, minHeight: 24 }} />
          <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 14 }}>
            {message ? (
              <View style={{ backgroundColor: colors.dangerBg, borderRadius: 14, padding: 12 }}>
                <Text weight="semibold" style={{ color: colors.danger, fontSize: 13 }}>
                  {message}
                </Text>
              </View>
            ) : null}
            <Button label={busy ? 'Criando...' : 'Criar conta'} variant="primary" onPress={busy ? undefined : submit} />
            <Pressable onPress={() => router.back()}>
              <Text weight="semibold" muted style={{ textAlign: 'center', fontSize: 15 }}>
                Já tem conta?{' '}
                <Text weight="extrabold" style={{ color: colors.link, fontSize: 15 }}>
                  Entrar
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
