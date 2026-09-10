import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import { C, FONT, RADIUS } from '../../design/tokens';
import { Icon } from '../../components/ui/Icon';

interface ModelCard {
  modelName: string;
  modelFamily: string;
  currentVersion: string | null;
  deploymentStage: string;
  lastReviewedAt: string | null;
  governanceSummary?: { driftDetected?: boolean; fairnessScore?: number };
}

export default function AiGovernanceMobileScreen() {
  const tenant = useAuthStore(st => st.tenant);
  const [models, setModels] = useState<ModelCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.slug) { setLoading(false); return; }
    api.get(`/model-registry/cards?subdomain=${tenant.slug}`)
      .then((d: any) => setModels((d.data ?? d) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenant?.slug]);

  const driftCount = models.filter(m => m.governanceSummary?.driftDetected).length;
  const productionCount = models.filter(m => m.deploymentStage === 'production').length;

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
        <SummaryChip label="In Production" value={productionCount} color={C.green}  />
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
          keyExtractor={(item, i) => item.modelName ?? String(i)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const drift = item.governanceSummary?.driftDetected ?? false;
            return (
              <View style={[s.card, drift && s.cardDrift]}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modelName} numberOfLines={1}>{item.modelName}</Text>
                    <Text style={s.taskType}>{item.modelFamily}{item.currentVersion ? ` v${item.currentVersion}` : ''}</Text>
                  </View>
                  <View style={s.statusCol}>
                    {drift
                      ? <Icon name="alert" size={16} color={C.coral} />
                      : <Icon name="check" size={16} color={C.green} />
                    }
                    <Text style={[s.statusText, { color: item.deploymentStage === 'production' ? C.green : C.textMuted }]}>
                      {item.deploymentStage?.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={s.metaRow}>
                  <Text style={s.meta}>
                    Fairness: {item.governanceSummary?.fairnessScore != null ? item.governanceSummary.fairnessScore.toFixed(2) : '—'}
                  </Text>
                  {item.lastReviewedAt && (
                    <Text style={s.meta}>
                      Reviewed: {new Date(item.lastReviewedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
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
