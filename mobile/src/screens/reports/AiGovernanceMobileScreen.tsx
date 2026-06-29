import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';
import { C, FONT, RADIUS } from '../../design/tokens';
import { Icon } from '../../components/ui/Icon';

interface ModelSummary {
  model_name: string;
  task_type: string;
  version?: string;
  drift_detected: boolean;
  last_calibration_at: string | null;
  fairness_score: number | null;
  status: string;
}

export default function AiGovernanceMobileScreen() {
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/model-registry/summary')
      .then((d: any) => setModels(d.data ?? d ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const driftCount = models.filter(m => m.drift_detected).length;
  const activeCount = models.filter(m => m.status === 'active').length;

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.teal} size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.summaryRow}>
        <SummaryChip label="Active Models" value={activeCount} color={C.green}  />
        <SummaryChip label="Drift Detected" value={driftCount} color={C.coral}  />
        <SummaryChip label="Total Models"   value={models.length} color={C.blue} />
      </View>

      {models.length === 0 ? (
        <View style={s.empty}>
          <Icon name="brain" size={40} color={C.textMuted} />
          <Text style={s.emptyText}>No models registered</Text>
        </View>
      ) : (
        <FlatList
          data={models}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={[s.card, item.drift_detected && s.cardDrift]}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.modelName} numberOfLines={1}>{item.model_name}</Text>
                  <Text style={s.taskType}>{item.task_type}{item.version ? ` v${item.version}` : ''}</Text>
                </View>
                <View style={s.statusCol}>
                  {item.drift_detected
                    ? <Icon name="alert" size={16} color={C.coral} />
                    : <Icon name="check-circle" size={16} color={C.green} />
                  }
                  <Text style={[s.statusText, { color: item.status === 'active' ? C.green : C.textMuted }]}>
                    {item.status?.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={s.metaRow}>
                <Text style={s.meta}>
                  Fairness: {item.fairness_score != null ? item.fairness_score.toFixed(2) : '—'}
                </Text>
                {item.last_calibration_at && (
                  <Text style={s.meta}>
                    Calibrated: {new Date(item.last_calibration_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const SummaryChip: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <View style={[s.chip, { borderTopColor: color }]}>
    <Text style={[s.chipValue, { color }]}>{value}</Text>
    <Text style={s.chipLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  chip: { flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, borderTopWidth: 3, alignItems: 'center' },
  chipValue: { fontFamily: FONT.uiBd, fontSize: 22 },
  chipLabel: { fontFamily: FONT.uiMd, fontSize: 10, color: C.textSecondary, marginTop: 2, textAlign: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText: { fontFamily: FONT.uiSb, fontSize: 16, color: C.textSecondary },
  card: { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10 },
  cardDrift: { borderWidth: 1, borderColor: C.coral + '66' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  modelName: { fontFamily: FONT.uiSb, fontSize: 14, color: C.text },
  taskType: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  statusCol: { alignItems: 'center', gap: 4 },
  statusText: { fontFamily: FONT.uiSb, fontSize: 10 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
});
