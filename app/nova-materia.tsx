import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field } from '../src/components/form';
import { Icon } from '../src/components/Icon';
import { Button, Card, Text } from '../src/components/ui';
import { createSubject, getActivePeriodName, getSubject, listTeachers, updateSubject, weekdayName, type ClassType, type Teacher } from '../src/data/subjects';
import { useSync } from '../src/sync';
import { subjectTones, useTheme, type SubjectColor } from '../src/theme';

// Tela "Nova matéria" (design/NovaMateria.dc.html).
const classTypes: { value: ClassType; label: string; hint: string }[] = [
  { value: 'sala', label: 'Em sala', hint: '' },
  { value: 'campo', label: 'De campo', hint: 'Aula de campo libera o registro de campo, com clima e fotos.' },
  { value: 'sala_e_campo', label: 'Sala e campo', hint: 'Aula de campo libera o registro de campo, com clima e fotos.' },
];

export default function NovaMateria() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);
  const { syncNow } = useSync();
  const [period, setPeriod] = useState<{ id: string; name: string } | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [name, setName] = useState('');
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [newTeacher, setNewTeacher] = useState('');
  const [classType, setClassType] = useState<ClassType>('sala');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [color, setColor] = useState<SubjectColor>('verde');
  const [remindEve, setRemindEve] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getActivePeriodName().then(setPeriod);
    void listTeachers().then(setTeachers);
    if (id) {
      void getSubject(id).then((s) => {
        if (!s) return;
        setName(s.name);
        setTeacherId(s.teacherId);
        setClassType(s.classType);
        setWeekdays(s.weekdays);
        setColor(s.color);
        setRemindEve(s.remindEve);
      });
    }
  }, [id]);

  const sel = (on: boolean, dashed = false) => ({
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: dashed ? ('dashed' as const) : ('solid' as const),
    borderColor: on ? '#0B5D3B' : colors.line,
    backgroundColor: on ? '#0B5D3B' : colors.card,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    justifyContent: 'center' as const,
  });

  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe o nome da matéria.';
    if (weekdays.length === 0) e.weekdays = 'Escolha ao menos um dia da semana.';
    if (addingTeacher && !newTeacher.trim()) e.teacher = 'Informe o nome do professor ou escolha um da lista.';
    if (!period) e.period = 'Cadastre um período antes.';
    setErrors(e);
    if (Object.keys(e).length || !period) return;
    setBusy(true);
    try {
      const input = {
        name: name.trim(),
        teacherId: addingTeacher ? null : teacherId,
        newTeacherName: addingTeacher ? newTeacher.trim() : null,
        classType,
        weekdays: [...weekdays].sort(),
        color,
        remindEve,
      };
      if (id) await updateSubject(id, input);
      else await createSubject({ ...input, periodId: period.id });
      void syncNow();
      router.back();
    } catch (err) {
      Alert.alert('Não foi possível salvar', err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  const label = (text: string) => (
    <Text weight="bold" style={{ fontSize: 13, color: colors.muted }}>
      {text}
    </Text>
  );
  const hint = (text: string) => (
    <Text weight="semibold" muted style={{ fontSize: 12, lineHeight: 18 }}>
      {text}
    </Text>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, width: 96 }}>
          <Icon name="x" size={18} color={colors.muted} />
          <Text weight="bold" muted style={{ fontSize: 15 }}>
            Cancelar
          </Text>
        </Pressable>
        <Text weight="extrabold" style={{ fontSize: 16 }}>
          {editing ? 'Editar matéria' : 'Nova matéria'}
        </Text>
        <View style={{ width: 96 }} />
      </View>

      <ScrollView style={{ flex: 1 }} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 150, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row' }}>
          <Field label="Nome da matéria" placeholder="ex.: Prática Extensionista em Fitossanidade" value={name} onChangeText={setName} error={errors.name} />
        </View>

        {!editing ? (
        <View style={{ gap: 8 }}>
          {label('Período')}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {period ? (
              <View style={sel(true)}>
                <Text weight="extrabold" style={{ color: '#fff', fontSize: 14 }}>
                  {period.name} · ativo
                </Text>
              </View>
            ) : null}
            <Pressable onPress={() => router.push('/novo-periodo')} style={sel(false, true)}>
              <Icon name="plus" size={15} color={colors.text} />
              <Text weight="extrabold" style={{ fontSize: 14 }}>
                Novo período
              </Text>
            </Pressable>
          </View>
          {errors.period ? <Text weight="semibold" style={{ fontSize: 12, color: colors.danger }}>{errors.period}</Text> : null}
          {hint('A matéria vale só durante o período. Ao finalizar o período, ela é desativada e os dados continuam guardados.')}
        </View>
        ) : null}

        <View style={{ gap: 8 }}>
          {label('Professor(a)')}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {teachers.map((t) => {
              const on = !addingTeacher && teacherId === t.id;
              return (
                <Pressable key={t.id} onPress={() => { setAddingTeacher(false); setTeacherId(on ? null : t.id); }} style={sel(on)}>
                  <Text weight="extrabold" style={{ fontSize: 14, color: on ? '#fff' : colors.text }}>
                    {t.name}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => { setAddingTeacher(!addingTeacher); setTeacherId(null); }} style={sel(addingTeacher, true)}>
              <Icon name="plus" size={15} color={addingTeacher ? '#fff' : colors.text} />
              <Text weight="extrabold" style={{ fontSize: 14, color: addingTeacher ? '#fff' : colors.text }}>
                Novo professor
              </Text>
            </Pressable>
          </View>
          {addingTeacher ? (
            <View style={{ flexDirection: 'row' }}>
              <Field label="Nome do professor(a)" placeholder="ex.: Profª Rita" value={newTeacher} onChangeText={setNewTeacher} error={errors.teacher} />
            </View>
          ) : null}
          {hint('O mesmo professor pode ficar em várias matérias. Os relatórios ficam ligados a ele.')}
        </View>

        <View style={{ gap: 8 }}>
          {label('Tipo de aula')}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {classTypes.map((c) => (
              <Pressable key={c.value} onPress={() => setClassType(c.value)} style={sel(classType === c.value)}>
                <Text weight="extrabold" style={{ fontSize: 14, color: classType === c.value ? '#fff' : colors.text }}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {hint('Aula de campo libera o registro de campo, com clima e fotos.')}
        </View>

        <View style={{ gap: 8 }}>
          {label('Dias da semana')}
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
            {[1, 2, 3, 4, 5, 6].map((d) => {
              const on = weekdays.includes(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => setWeekdays(on ? weekdays.filter((x) => x !== d) : [...weekdays, d])}
                  accessibilityState={{ selected: on }}
                  style={{ flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 2, borderColor: on ? '#0B5D3B' : colors.line, backgroundColor: on ? '#0B5D3B' : colors.card, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text weight="extrabold" style={{ fontSize: 13, color: on ? '#fff' : colors.text }}>
                    {weekdayName[d]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.weekdays ? <Text weight="semibold" style={{ fontSize: 12, color: colors.danger }}>{errors.weekdays}</Text> : null}
          {hint('Só os dias. Sem horário. A matéria aparece no seu dia, toda semana.')}
        </View>

        <View style={{ gap: 8 }}>
          {label('Cor da matéria')}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {(Object.keys(subjectTones) as SubjectColor[]).map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                accessibilityLabel={subjectTones[c].label}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: subjectTones[c].solid, borderWidth: 3, borderColor: colors.card, shadowColor: '#0B5D3B', shadowOpacity: color === c ? 1 : 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, outlineWidth: 0, ...(color === c ? { transform: [{ scale: 1.12 }] } : {}) }}
              >
                {color === c ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={18} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.pill, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={18} color={colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="bold" style={{ fontSize: 15 }}>
              Lembrar na véspera
            </Text>
            <Text weight="semibold" muted style={{ fontSize: 12 }}>
              Aviso no dia anterior à aula, com a previsão do tempo
            </Text>
          </View>
          <Switch value={remindEve} onValueChange={setRemindEve} trackColor={{ true: '#0B5D3B' }} />
        </Card>
      </ScrollView>

      <View pointerEvents="box-none" style={{  paddingHorizontal: 16, position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom - 6, 10) }}>
        <Button label={busy ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar matéria'} icon="check" variant="primary" onPress={busy ? undefined : save} />
      </View>
    </SafeAreaView>
  );
}
