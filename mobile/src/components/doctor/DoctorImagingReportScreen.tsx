import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge, Card, ScreenHeader, AiPulse } from '../ui';
import { ImagingService, ApiImagingOrder, ApiImagingReport } from '../../services/imaging';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  patientId: string;
  patientName: string;
  onBack: () => void;
}

const MODALITY_COLOR: Record<string, string> = {
  CT:   C.blue,
  MRI:  C.teal,
  XR:   C.orange,
  US:   C.green,
  NM:   '#9b59b6',
  PET:  '#e67e22',
};

const STATUS_LABEL: Record<string, string> = {
  ordered:    'Ordered',
  scheduled:  'Scheduled',
  in_progress: 'In Progress',
  completed:  'Completed',
  cancelled:  'Cancelled',
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DoctorImagingReportScreen: React.FC<Props> = ({ patientId, patientName, onBack }) => {
  const insets = useSafeAreaInsets();

  const [orders, setOrders]       = useState<ApiImagingOrder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<ApiImagingOrder | null>(null);
  const [report, setReport]       = useState<ApiImagingReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    ImagingService.ordersForPatient(patientId)
      .then(data => setOrders(data.sort((a, b) =>
        new Date(b.requestedAt ?? 0).getTime() - new Date(a.requestedAt ?? 0).getTime()
      )))
      .finally(() => setLoading(false));
  }, [patientId]);

  const openReport = useCallback(async (order: ApiImagingOrder) => {
    if (!order.reportId) return;
    setSelected(order);
    setReport(null);
    setReportLoading(true);
    const r = await ImagingService.getReport(order.reportId);
    setReport(r);
    setReportLoading(false);
  }, []);

  const hasReport = (o: ApiImagingOrder) => !!o.reportId;
  const modalityColor = (m?: string) => MODALITY_COLOR[m ?? ''] ?? C.textMuted;

  // ── Report detail view ──────────────────────────────────────────────────────
  if (selected) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.subHeader}>
          <TouchableOpacity onPress={() => { setSelected(null); setReport(null); }} style={s.backBtn}>
            <Icon name="back" size={20} color={C.teal} />
            <Text style={s.backText}>Orders</Text>
          </TouchableOpacity>
          <Text style={s.subTitle} numberOfLines={1}>
            {selected.modality} · {selected.studyType ?? 'Imaging'}
          </Text>
        </View>

        {reportLoading ? (
          <View style={s.center}><ActivityIndicator size="large" color={C.teal} /></View>
        ) : !report ? (
          <View style={s.center}>
            <Icon name="book" size={44} color={C.border} />
            <Text style={s.emptyTitle}>Report unavailable</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
            {/* AI Pre-read */}
            {(report.aiSummary ?? selected.aiReviewSummary) && (
              <Card style={s.aiCard}>
                <View style={s.aiHeader}>
                  <AiPulse size={18} active />
                  <Text style={s.aiTitle}>AI Pre-read</Text>
                </View>
                <Text style={s.aiBody}>{report.aiSummary ?? selected.aiReviewSummary}</Text>
              </Card>
            )}

            {/* Impression — most important, shown first */}
            {report.impression && (
              <Card style={s.impressionCard}>
                <Text style={s.sectionLabel}>IMPRESSION</Text>
                <Text style={s.impressionText}>{report.impression}</Text>
              </Card>
            )}

            {/* Findings */}
            {report.findings && (
              <Card>
                <Text style={s.sectionLabel}>FINDINGS</Text>
                <Text style={s.bodyText}>{report.findings}</Text>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <Text style={s.sectionLabel}>REPORT INFO</Text>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Radiologist</Text>
                <Text style={s.metaValue}>{report.radiologistName ?? '—'}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Reported</Text>
                <Text style={s.metaValue}>{formatDate(report.reportedAt)}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Study</Text>
                <Text style={s.metaValue}>{selected.studyType ?? '—'}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Modality</Text>
                <Text style={[s.metaValue, { color: modalityColor(selected.modality) }]}>{selected.modality ?? '—'}</Text>
              </View>
            </Card>
          </ScrollView>
        )}
      </View>
    );
  }

  // ── Orders list ──────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.subHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Icon name="back" size={20} color={C.teal} />
          <Text style={s.backText}>Rounds</Text>
        </TouchableOpacity>
        <Text style={s.subTitle} numberOfLines={1}>Imaging — {patientName}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.teal} /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => o.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={
            <View style={s.center}>
              <Icon name="book" size={44} color={C.border} />
              <Text style={s.emptyTitle}>No imaging orders</Text>
              <Text style={s.emptyBody}>No imaging studies have been ordered for this patient.</Text>
            </View>
          }
          renderItem={({ item: o }) => {
            const mc = modalityColor(o.modality);
            const reportReady = hasReport(o);
            return (
              <TouchableOpacity
                activeOpacity={reportReady ? 0.8 : 1}
                onPress={() => reportReady && openReport(o)}
              >
                <Card style={[s.orderCard, reportReady && { borderLeftColor: mc, borderLeftWidth: 3 }]}>
                  <View style={s.orderRow}>
                    <View style={[s.modalityBox, { backgroundColor: mc + '20' }]}>
                      <Text style={[s.modalityText, { color: mc }]}>{o.modality ?? '?'}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={s.studyType}>{o.studyType ?? 'Imaging Study'}</Text>
                      <Text style={s.orderDate}>{formatDate(o.requestedAt)}</Text>
                    </View>
                    {reportReady ? (
                      <View style={s.reportBadge}>
                        <Icon name="book" size={12} color={C.teal} />
                        <Text style={s.reportBadgeText}>Report</Text>
                      </View>
                    ) : (
                      <Badge color={C.textMuted}>{STATUS_LABEL[o.status ?? ''] ?? 'Pending'}</Badge>
                    )}
                    {reportReady && <Icon name="arrow" size={16} color={C.textMuted} />}
                  </View>
                  {o.aiReviewSummary && !reportReady && (
                    <Text style={s.aiPreview} numberOfLines={2}>{o.aiReviewSummary}</Text>
                  )}
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  subHeader:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText:       { fontFamily: FONT.ui, fontSize: 14, color: C.teal },
  subTitle:       { fontFamily: FONT.uiBd, fontSize: 15, color: C.text, flex: 1 },
  emptyTitle:     { fontFamily: FONT.uiBd, fontSize: 16, color: C.textMuted },
  emptyBody:      { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 30 },
  orderCard:      { },
  orderRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalityBox:    { width: 44, height: 44, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  modalityText:   { fontFamily: FONT.uiBk, fontSize: 13 },
  studyType:      { fontFamily: FONT.uiBd, fontSize: 14, color: C.text },
  orderDate:      { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
  reportBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.teal + '18', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  reportBadgeText: { fontFamily: FONT.uiBd, fontSize: 11, color: C.teal },
  aiPreview:      { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, marginTop: 8 },
  // Report view
  aiCard:         { borderColor: C.teal + '40', borderWidth: 1 },
  aiHeader:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  aiTitle:        { fontFamily: FONT.uiBd, fontSize: 14, color: C.teal },
  aiBody:         { fontFamily: FONT.ui, fontSize: 13, color: C.text, lineHeight: 20 },
  impressionCard: { borderColor: C.blue + '40', borderWidth: 1, backgroundColor: C.blue + '08' },
  sectionLabel:   { fontFamily: FONT.uiBd, fontSize: 11, color: C.textMuted, letterSpacing: 0.8, marginBottom: 8 },
  impressionText: { fontFamily: FONT.uiBd, fontSize: 15, color: C.text, lineHeight: 22 },
  bodyText:       { fontFamily: FONT.ui, fontSize: 14, color: C.text, lineHeight: 22 },
  metaRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  metaLabel:      { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted },
  metaValue:      { fontFamily: FONT.uiBd, fontSize: 13, color: C.text },
});
