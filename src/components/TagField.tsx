import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { cleanTags, suggestTags } from '../data/tags';
import { fonts, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './ui';

/** Uma tag (etiqueta) pequena; tocar faz a ação, se houver. */
export function TagChip({ name, onPress }: { name: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ backgroundColor: colors.chipBg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
      <Text weight="bold" style={{ fontSize: 11, color: colors.muted }}>
        #{name}
      </Text>
    </Pressable>
  );
}

/** Campo de tags: digite e toque em "+" (ou no enter); sugere as que você já usou. */
export function TagField({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [known, setKnown] = useState<string[]>([]);

  useEffect(() => {
    void suggestTags().then(setKnown);
  }, []);

  const add = (value: string) => {
    const next = cleanTags([...tags, ...value.split(',')]);
    onChange(next);
    setText('');
  };
  const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const chosen = new Set(tags.map(key));
  const typed = key(text.trim());
  const suggestions = known.filter((k) => !chosen.has(key(k)) && (!typed || key(k).includes(typed))).slice(0, 8);

  return (
    <View style={{ gap: 8 }}>
      <Text weight="bold" style={{ fontSize: 13, color: colors.muted }}>
        Tags (opcional)
      </Text>
      {tags.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tags.map((t) => (
            <Pressable key={t} onPress={() => onChange(tags.filter((x) => x !== t))} accessibilityLabel={`Remover tag ${t}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0B5D3B', borderRadius: 999, paddingVertical: 6, paddingLeft: 12, paddingRight: 8 }}>
              <Text weight="extrabold" style={{ fontSize: 13, color: '#fff' }}>
                #{t}
              </Text>
              <Icon name="x" size={13} color="#fff" />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => text.trim() && add(text)}
          placeholder="ex.: milho, praga"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={60}
          accessibilityLabel="Nova tag"
          style={{ flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line, paddingHorizontal: 14, fontFamily: fonts.medium, fontSize: 15, color: colors.text }}
        />
        <Pressable onPress={() => text.trim() && add(text)} accessibilityLabel="Adicionar tag" style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#0B5D3B', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={22} color="#fff" />
        </Pressable>
      </View>
      {suggestions.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {suggestions.map((s) => (
            <Pressable key={s} onPress={() => add(s)} style={{ borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card }}>
              <Text weight="bold" style={{ fontSize: 12, color: colors.muted }}>
                + {s}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
