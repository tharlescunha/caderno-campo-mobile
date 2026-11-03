import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, Share, View } from 'react-native';
import { api } from '../../src/api/client';
import { shareReportPdf } from '../../src/export/reportPdf';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { TagChip } from '../../src/components/TagField';
import { Card, EmptyState, Loading, PendingBadge, Text } from '../../src/components/ui';
import { activityLabel, cropLabel, getReportDetail, irrigationLabel, listEntries, type EntryItem, type ReportDetail } from '../../src/data/entries';
import { listReportPhotos, setReportCover, setReportFinished, type ReportPhoto } from '../../src/data/reports';
import { useSync } from '../../src/sync';
import { subjectTones, tones, useTheme } from '../../src/theme';

// Tela "Relatório" (design/Relatorio.dc.html): título e etiquetas, área acompanhada, situação atual e a linha do tempo dos registros.
const weekday = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const pad = (n: number) => String(n).padStart(2, '0');
const dm = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${weekday[d.getDay()]}, ${dm(iso)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function Tag({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
      <Text weight="extrabold" style={{ fontSize: 11, color: fg }}>
        {label}
      </Text>
    </View>
  );
}

function Fact({ label, value, color }: { label: string; value: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.chipBg, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10 }}>
      <Text weight="semibold" muted style={{ fontSize: 11 }}>
        {label}
      </Text>
      <Text weight="extrabold" style={{ fontSize: 15, color: color ?? colors.text, marginTop: 1 }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function Relatorio() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lastSyncAt, syncNow } = useSync();
  const [report, setReport] = useState<ReportDetail | null | undefined>(undefined);
  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [making, setMaking] = useState(false);
  const [picking, setPicking] = useState<{ photos: ReportPhoto[]; chosen: string | null } | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setReport(await getReportDetail(id));
        setEntries(await listEntries(id));
      })();
    }, [id, lastSyncAt]),
  );

  if (report === undefined) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (report === null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <EmptyState icon="note" title="Relatório não encontrado" hint="Volte e abra a lista de novo." />
      </SafeAreaView>
    );
  }
  const tone = subjectTones[report.subjectColor];
  const sit = report.situation;
  const area = report.area;

  const openCoverPicker = async () => {
    const data = await listReportPhotos(id);
    if (!data.photos.length) return Alert.alert('Sem fotos ainda', 'Adicione fotos aos registros para escolher uma capa.');
    setPicking(data);
  };
  const chooseCover = async (photoId: string | null) => {
    setPicking(null);
    await setReportCover(id, photoId);
    setReport(await getReportDetail(id));
    void syncNow();
  };

  const toggleFinished = () =>
    Alert.alert(
      report.finished ? 'Reabrir o relatório?' : 'Finalizar o relatório?',
      report.finished ? 'Ele volta para "Em andamento" e você pode adicionar registros de novo.' : 'Ele sai de "Em andamento" e vai para "Finalizados". Os dados continuam guardados e você pode reabrir depois.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: report.finished ? 'Reabrir' : 'Finalizar',
          onPress: async () => {
            await setReportFinished(report.id, !report.finished);
            setReport(await getReportDetail(id));
            void syncNow();
          },
        },
      ],
    );

  const shareText = async () => {
    try {
      const out = await api<{ text: string }>('GET', `/reports/${id}/export?copy=true`);
      await Share.share({ title: report.title, message: out.text });
    } catch (e) {
      Alert.alert('Não foi possível compartilhar', e instanceof Error ? e.message : 'Precisa de internet. Tente de novo.');
    }
  };

  const sharePdf = async () => {
    setMaking(true);
    try {
      await shareReportPdf(id);
    } catch (e) {
      Alert.alert('Não foi possível montar o PDF', e instanceof Error ? e.message : 'Tente de novo.');
    }
    setMaking(false);
  };

  const shareReport = () =>
    Alert.alert('Compartilhar o relatório', 'O PDF leva o texto de todos os registros e as fotos. Ele é montado no celular, sem internet, e sai do aplicativo Caderno de Campo.', [
      { text: 'PDF com fotos', onPress: () => void sharePdf() },
      { text: 'Só o texto', onPress: () => void shareText() },
      { text: 'Cancelar', style: 'cancel' },
    ]);

  const roundButton = (icon: 'right' | 'pencil' | 'share', label: string, onPress: () => void, flip?: boolean) => (
    <Pressable onPress={onPress} accessibilityLabel={label} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: flip ? [{ scaleX: -1 }] : [] }}>
      <Icon name={icon} size={22} color={colors.text} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 150 }} showsVerticalScrollIndicator={false}>
        {/* Voltar e editar: rolam junto com o conteúdo, como na tela da matéria */}
        <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {roundButton('right', 'Voltar', () => router.back(), true)}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {roundButton('pencil', 'Editar relatório', () => router.push({ pathname: '/novo-relatorio', params: { id: report.id } }))}
            {roundButton('share', 'Compartilhar o relatório em texto', () => shareReport())}
          </View>
        </View>
        {/* Título e etiquetas */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
          <Text weight="extrabold" style={{ fontSize: 13, color: tone.fg }}>
            {report.subjectName}
            {report.teacher ? ` · ${report.teacher}` : ''}
          </Text>
          <Text weight="extrabold" style={{ fontSize: 27, lineHeight: 31, letterSpacing: -0.7 }}>
            {report.title}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Tag label={report.kind === 'continuo' ? 'Relatório contínuo' : 'Relatório pontual'} fg="#fff" bg="#0B5D3B" />
            <Tag label={report.finished ? 'Finalizado' : 'Em andamento'} fg={report.finished ? '#2F463C' : '#14663F'} bg={report.finished ? colors.chipBg : '#DDF1E5'} />
            <Tag label={`${report.entryCount} ${report.entryCount === 1 ? 'registro' : 'registros'}`} fg={colors.muted} bg={colors.chipBg} />
            <Tag label={`desde ${dm(report.sinceDate)}`} fg={colors.muted} bg={colors.chipBg} />
            {report.tags.map((t) => (
              <TagChip key={t} name={t} />
            ))}
          </View>
        </View>

        {/* Área acompanhada (relatório contínuo) */}
        {report.kind === 'continuo' && (area || report.areaPhotoUri) ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <View style={{ height: 150, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
                {report.areaPhotoUri ? <Image source={{ uri: report.areaPhotoUri }} resizeMode="cover" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} /> : <Icon name="camera" size={30} color={tone.fg} />}
                <Pressable onPress={() => void openCoverPicker()} accessibilityLabel="Trocar a foto de capa" style={{ position: 'absolute', right: 12, top: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, minHeight: 36, paddingHorizontal: 12 }}>
                  <Icon name="camera" size={14} color="#0F2A1D" />
                  <Text weight="extrabold" style={{ fontSize: 12, color: '#0F2A1D' }}>
                    Trocar capa
                  </Text>
                </Pressable>
                {report.areaPhotoDate ? (
                  <View style={{ position: 'absolute', left: 12, bottom: 10, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                    <Text weight="extrabold" style={{ fontSize: 12, color: '#0F2A1D' }}>
                      Foto da área · {dm(report.areaPhotoDate)}
                    </Text>
                  </View>
                ) : null}
              </View>
              {area ? (
                <View style={{ padding: 16, gap: 12 }}>
                  <Text weight="extrabold" style={{ fontSize: 15 }}>
                    Área acompanhada
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Fact label="Cultura" value={area.crop || '—'} />
                    <Fact label="Tamanho" value={area.lengthM && area.widthM ? `${num(area.lengthM)} × ${num(area.widthM)} m` : '—'} />
                    <Fact label="Área" value={area.m2 ? `${num(area.m2)} m²` : '—'} />
                  </View>
                  {area.place ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Icon name="pin" size={14} color={colors.muted} />
                      <Text weight="semibold" muted style={{ fontSize: 12 }}>
                        {area.place}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>
          </View>
        ) : null}

        {/* Situação atual */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Card style={{ gap: 10, padding: 16 }}>
            <Text weight="extrabold" style={{ fontSize: 15 }}>
              Situação atual
            </Text>
            {sit ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Fact label="Cultura" value={sit.crop || sit.stage ? [sit.crop ? cropLabel[sit.crop] : null, sit.stage].filter(Boolean).join(' · ') : '—'} />
                <Fact label="Irrigação" value={sit.irrigation ? irrigationLabel[sit.irrigation] : '—'} color={sit.irrigation === 'funcionando' ? '#14663F' : undefined} />
                <Fact label="Praga" value={sit.pest ?? 'Nenhuma'} color={sit.pest ? colors.danger : undefined} />
              </View>
            ) : (
              <Text weight="semibold" muted style={{ fontSize: 13 }}>
                Aparece aqui depois do primeiro registro concluído.
              </Text>
            )}
          </Card>
        </View>

        {/* Linha do tempo */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text weight="extrabold" style={{ fontSize: 19 }}>
              {report.kind === 'continuo' ? 'Registros desta área' : 'Registros'}
            </Text>
            <Text weight="semibold" muted style={{ fontSize: 12 }}>
              mais recente primeiro
            </Text>
          </View>
          {entries.length === 0 ? <EmptyState icon="pencil" title="Nenhum registro ainda" hint="Cada visita ao campo vira um registro." /> : null}
          {entries.map((e, i) => (
            <View key={e.id} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'center', width: 14, paddingTop: 18 }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: e.draft ? '#E0A21B' : '#1E8A5A' }} />
                {i < entries.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: colors.line, marginTop: 4 }} /> : null}
              </View>
              <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/novo-registro', params: { reportId: report.id, id: e.id } })} accessibilityLabel="Abrir registro">
                <Card style={{ padding: 0 }}>
                  <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text weight="extrabold" style={{ fontSize: 15 }}>
                          {fmtDate(e.recordedAt)}
                        </Text>
                        <Text weight="semibold" muted style={{ fontSize: 12 }}>
                          {e.activities.length ? e.activities.map((a) => activityLabel[a]).join(' · ') : 'Registro de campo'}
                        </Text>
                      </View>
                      <Tag label={e.draft ? 'Rascunho' : 'Concluído'} fg={e.draft ? tones.amber.fg : '#14663F'} bg={e.draft ? tones.amber.bg : '#DDF1E5'} />
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {e.weather ? <Tag label={e.weather} fg={tones.blue.fg} bg={tones.blue.bg} /> : e.weatherPending ? <Tag label="clima pendente" fg={colors.muted} bg={colors.chipBg} /> : null}
                      {e.pest ? <Tag label={`Praga: ${e.pest}`} fg={colors.danger} bg={colors.dangerBg} /> : null}
                      {e.tags.map((t) => (
                        <TagChip key={t} name={t} />
                      ))}
                      {e.pending ? <PendingBadge /> : null}
                    </View>

                    {e.notes ? (
                      <Text style={{ fontSize: 14, lineHeight: 21 }} numberOfLines={4}>
                        {e.notes}
                      </Text>
                    ) : null}

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                      {e.irrigation ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Icon name="sprout" size={13} color={colors.muted} />
                          <Text weight="semibold" muted style={{ fontSize: 12 }}>
                            Irrigação: {irrigationLabel[e.irrigation].toLowerCase()}
                          </Text>
                        </View>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name="camera" size={13} color={colors.muted} />
                        <Text weight="semibold" muted style={{ fontSize: 12 }}>
                          {e.photoCount} {e.photoCount === 1 ? 'foto' : 'fotos'}
                        </Text>
                      </View>
                      {e.audioCount ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Icon name="notes" size={13} color={colors.muted} />
                          <Text weight="semibold" muted style={{ fontSize: 12 }}>
                            {e.audioCount} {e.audioCount === 1 ? 'áudio' : 'áudios'} · {e.audioReady === e.audioCount ? 'transcrito' : 'transcrevendo'}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {e.nextVisit.length ? (
                      <View style={{ backgroundColor: tones.amber.bg, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 }}>
                        <Text style={{ fontSize: 13, lineHeight: 20, color: '#5E4100' }}>
                          <Text weight="extrabold" style={{ fontSize: 13, color: '#5E4100' }}>
                            Para a próxima visita:{' '}
                          </Text>
                          {e.nextVisit.join(' · ')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            </View>
          ))}
        </View>
        <Text weight="semibold" muted style={{ fontSize: 12, textAlign: 'center', paddingHorizontal: 24, paddingTop: 20 }}>
          Ao finalizar, o relatório sai de “Em andamento” e vai para “Finalizados”. A exportação completa dos dados (planilha e fotos) é feita pelo computador.
        </Text>
      </ScrollView>

      {/* Botões fixos embaixo, sem faixa de fundo */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom - 6, 10), gap: 8 }}>
        {!report.finished ? (
          <Pressable onPress={() => router.push({ pathname: '/novo-registro', params: { reportId: report.id } })} style={{ minHeight: 52, borderRadius: 999, backgroundColor: '#0B5D3B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}>
            <Icon name="plus" size={18} color="#fff" />
            <Text weight="extrabold" style={{ fontSize: 15, color: '#fff' }}>
              Adicionar registro de hoje
            </Text>
          </Pressable>
        ) : null}
        <Pressable onPress={toggleFinished} style={{ minHeight: 46, borderRadius: 999, backgroundColor: colors.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}>
          <Icon name="check" size={18} color={colors.text} />
          <Text weight="extrabold" style={{ fontSize: 15 }}>
            {report.finished ? 'Reabrir relatório' : 'Finalizar relatório'}
          </Text>
        </Pressable>
      </View>
      <Modal visible={picking !== null} transparent animationType="slide" onRequestClose={() => setPicking(null)}>
        <Pressable onPress={() => setPicking(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '80%', paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 }}>
              <Text weight="extrabold" style={{ fontSize: 18 }}>
                Foto de capa
              </Text>
              <Pressable onPress={() => setPicking(null)} accessibilityLabel="Fechar" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="x" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
              <Pressable onPress={() => void chooseCover(null)} style={{ minHeight: 52, borderRadius: 18, borderWidth: 2, borderColor: picking?.chosen == null ? '#0B5D3B' : colors.line, backgroundColor: picking?.chosen == null ? colors.chipBg : colors.card, paddingHorizontal: 16, justifyContent: 'center' }}>
                <Text weight="extrabold" style={{ fontSize: 15 }}>
                  Capa automática
                </Text>
                <Text weight="semibold" muted style={{ fontSize: 12 }}>
                  A foto da área ou a mais recente dos registros
                </Text>
              </Pressable>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {picking?.photos.map((p) => {
                  const on = p.id === picking.chosen;
                  return (
                    <Pressable key={p.id} onPress={p.pending ? () => Alert.alert('Foto ainda não enviada', 'Espere a foto subir para o servidor para usá-la como capa.') : () => void chooseCover(p.id)} accessibilityLabel={'Foto de ' + dm(p.date)} style={{ width: '31.5%', aspectRatio: 1, borderRadius: 18, overflow: 'hidden', borderWidth: 3, borderColor: on ? '#0B5D3B' : 'transparent', opacity: p.pending ? 0.45 : 1 }}>
                      <Image source={{ uri: p.uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
                      <View style={{ position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
                        <Text weight="extrabold" style={{ fontSize: 11, color: '#0F2A1D' }}>
                          {dm(p.date)}
                        </Text>
                      </View>
                      {on ? (
                        <View style={{ position: 'absolute', right: 6, top: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: '#0B5D3B', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="check" size={14} color="#fff" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {making ? (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, minWidth: 220 }}>
            <Loading text="Montando o PDF..." size="large" />
          </View>
        </View>
      ) : null}

      {/* Faixa da cor do app atrás do relógio, para o conteúdo não passar por baixo dele */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top, backgroundColor: colors.bg }} />
    </View>
  );
}
