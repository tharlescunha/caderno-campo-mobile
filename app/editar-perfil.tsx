import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field } from '../src/components/form';
import { Icon } from '../src/components/Icon';
import { Button, Text } from '../src/components/ui';
import { getProfile, updateProfile } from '../src/data/settings';
import { useSync } from '../src/sync';
import { useTheme } from '../src/theme';

// Editar perfil: nome, curso e instituição (o e-mail é o login e não muda por aqui).
export default function EditarPerfil() {
  const { colors } = useTheme();
  const router = useRouter();
  const { syncNow } = useSync();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [course, setCourse] = useState('');
  const [institution, setInstitution] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getProfile().then((p) => {
      if (!p) return;
      setName(p.name);
      setEmail(p.email);
      setCourse(p.course ?? '');
      setInstitution(p.institution ?? '');
    });
  }, []);

  const save = async () => {
    if (!name.trim()) return setError('Informe o seu nome.');
    setError(null);
    setBusy(true);
    try {
      await updateProfile({ name: name.trim(), course: course.trim(), institution: institution.trim() });
      void syncNow();
      router.back();
    } catch (e) {
      Alert.alert('Não foi possível salvar', e instanceof Error ? e.message : String(e));
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
          Editar perfil
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={{ flexDirection: 'row' }}>
          <Field label="Nome" required value={name} onChangeText={setName} error={error ?? undefined} autoComplete="name" />
        </View>
        <View style={{ gap: 6 }}>
          <Text weight="bold" style={{ fontSize: 13, color: colors.muted }}>
            E-mail
          </Text>
          <View style={{ minHeight: 52, borderRadius: 16, backgroundColor: colors.chipBg, borderWidth: 2, borderColor: colors.line, paddingHorizontal: 14, justifyContent: 'center' }}>
            <Text weight="semibold" muted style={{ fontSize: 16 }}>
              {email}
            </Text>
          </View>
          <Text weight="semibold" muted style={{ fontSize: 12 }}>
            O e-mail é o seu login e não pode ser alterado aqui.
          </Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Field label="Curso" placeholder="ex.: Agronomia" value={course} onChangeText={setCourse} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Field label="Instituição" placeholder="ex.: nome da faculdade" value={institution} onChangeText={setInstitution} />
        </View>
        <Button label={busy ? 'Salvando...' : 'Salvar'} icon="check" variant="primary" onPress={busy ? undefined : save} />
      </ScrollView>
    </SafeAreaView>
  );
}
