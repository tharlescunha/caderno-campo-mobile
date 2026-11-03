import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../src/components/Icon';
import { Button, Card, IconBox, Text } from '../src/components/ui';
import { formatUpdated } from '../src/data/market';
import { discardItem, listQueue, retryItem, type QueueItem } from '../src/data/queue';
import { useSync } from '../src/sync';
import { useTheme } from '../src/theme';

// Tela "Itens não enviados" (design/ErrosEnvio.dc.html): o que o servidor recusou e o que ainda espera para subir.
export default function ItensNaoEnviados() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lastSyncAt, syncNow, syncing } = useSync();
  const [data, setData] = useState<{ failed: QueueItem[]; waiting: QueueItem[] } | null>(null);

  const load = useCallback(() => listQueue().then(setData), []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, lastSyncAt]),
  );

  const retry = async (item: QueueItem) => {
    await retryItem(item);
    await load();
    void syncNow();
  };
  const discard = (item: QueueItem) =>
    Alert.alert(
      'Descartar este item?',
      item.operation === 'criar' ? 'Ele será apagado do celular e não vai para o servidor. Isso não pode ser desfeito.' : 'A alteração feita no celular será abandonada e a versão do servidor volta. Isso não pode ser desfeito.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: async () => {
            await discardItem(item);
            await load();
          },
        },
      ],
    );
  const retryAll = async () => {
    for (const i of data?.failed ?? []) await retryItem(i);
    await load();
    void syncNow();
  };

  const failed = data?.failed ?? [];
  const waiting = data?.waiting ?? [];
  const plural = (n: number) => `${n} ${n === 1 ? 'item' : 'itens'}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
            <Icon name="right" size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text weight="semibold" muted style={{ fontSize: 12 }}>
              envio para o servidor
            </Text>
            <Text weight="extrabold" style={{ fontSize: 24, letterSpacing: -0.6 }}>
              Itens não enviados
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor: failed.length ? colors.pill : colors.card, borderRadius: 20, padding: 14 }}>
          <Text weight="semibold" style={{ fontSize: 14, lineHeight: 21 }}>
            {failed.length ? (
              <>
                O servidor recusou {plural(failed.length)}. <Text weight="extrabold">Tudo continua guardado no seu celular</Text> e o resto já foi enviado.
              </>
            ) : (
              'Nenhum item foi recusado pelo servidor.'
            )}
          </Text>
        </View>

        {failed.length ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text weight="extrabold" style={{ fontSize: 19 }}>
                Precisam de atenção
              </Text>
              <Text weight="semibold" muted style={{ fontSize: 12 }}>
                {plural(failed.length)}
              </Text>
            </View>
            {failed.map((i) => (
              <Card key={i.id} style={{ gap: 12, padding: 16 }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <IconBox name="warn" fg={colors.danger} bg={colors.dangerBg} />
                  <View style={{ flex: 1 }}>
                    <Text weight="semibold" muted style={{ fontSize: 12 }}>
                      {i.kind}
                    </Text>
                    <Text weight="extrabold" style={{ fontSize: 16, lineHeight: 21, marginTop: 2 }}>
                      {i.title}
                    </Text>
                    <Text weight="semibold" muted style={{ fontSize: 12, marginTop: 2 }}>
                      {i.operation === 'criar' ? 'Criado' : i.operation === 'excluir' ? 'Excluído' : 'Alterado'} {formatUpdated(i.when)}
                    </Text>
                  </View>
                </View>
                <View style={{ backgroundColor: colors.dangerBg, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
                  <Text style={{ fontSize: 13, lineHeight: 19, color: colors.danger }}>
                    <Text weight="extrabold" style={{ fontSize: 13, color: colors.danger }}>
                      Motivo:{' '}
                    </Text>
                    {i.reason}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {i.fix ? (
                    <Pressable onPress={() => router.push({ pathname: i.fix!.pathname as any, params: i.fix!.params })} style={{ flex: 1, minHeight: 44, borderRadius: 999, backgroundColor: '#0B5D3B', alignItems: 'center', justifyContent: 'center' }}>
                      <Text weight="extrabold" style={{ fontSize: 14, color: '#fff' }}>
                        {i.fix.label}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => void retry(i)} style={{ flex: 1, minHeight: 44, borderRadius: 999, backgroundColor: colors.pill, alignItems: 'center', justifyContent: 'center' }}>
                    <Text weight="extrabold" style={{ fontSize: 14 }}>
                      Tentar de novo
                    </Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => discard(i)} style={{ minHeight: 44, borderRadius: 999, borderWidth: 2, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
                  <Text weight="extrabold" style={{ fontSize: 14, color: colors.danger }}>
                    Descartar este item
                  </Text>
                </Pressable>
              </Card>
            ))}
            <Text weight="semibold" muted style={{ fontSize: 12, lineHeight: 19 }}>
              Ao descartar, o item é apagado do celular e não vai para o servidor. Antes de apagar, o app pergunta de novo.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text weight="extrabold" style={{ fontSize: 19 }}>
              Aguardando envio
            </Text>
            <Text weight="semibold" muted style={{ fontSize: 12 }}>
              {plural(waiting.length)} · sobem sozinhos
            </Text>
          </View>
          <Card style={{ paddingVertical: 6, paddingHorizontal: 18 }}>
            {waiting.length === 0 ? (
              <Text weight="semibold" muted style={{ fontSize: 13, paddingVertical: 12 }}>
                Nada esperando para subir.
              </Text>
            ) : (
              waiting.map((w, k) => (
                <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: k ? 1 : 0, borderTopColor: colors.lineSoft }}>
                  <Text weight="bold" style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>
                    {w.kind}: {w.title}
                  </Text>
                  <Text weight="semibold" muted style={{ fontSize: 12 }}>
                    {formatUpdated(w.when)}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </View>

        <View style={{ gap: 8 }}>
          <Button label={syncing ? "Enviando..." : "Tentar enviar tudo agora"} variant="primary" onPress={syncing ? undefined : failed.length ? retryAll : () => void syncNow()} />
          <Text weight="semibold" muted style={{ fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
            {lastSyncAt ? `Última sincronização ${formatUpdated(lastSyncAt.toISOString())}` : 'Ainda não sincronizou nesta abertura'}
          </Text>
        </View>
      </ScrollView>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top, backgroundColor: colors.bg }} />
    </View>
  );
}
