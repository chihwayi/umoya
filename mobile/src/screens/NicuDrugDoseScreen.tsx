import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Icon } from '../components/ui/Icon';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

type Drug = {
  drug_code: string; drug_name: string; category: string;
  dose_mg_per_kg: number; frequency: string; route: string;
  monitoring_required?: string;
};

export default function NicuDrugDoseScreen({ route }: { route: any }) {
  const { admissionId } = route.params ?? {};
  const [formulary, setFormulary]       = useState<Drug[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [weight, setWeight]             = useState('');
  const [result, setResult]             = useState<any>(null);
  const [loading, setLoading]           = useState(false);
  const [formularyLoading, setFormularyLoading] = useState(true);

  useEffect(() => {
    api.get('/nicu/advanced/formulary')
      .then((r: any) => setFormulary(r.data ?? r))
      .catch(() => Alert.alert('Error', 'Could not load NICU formulary.'))
      .finally(() => setFormularyLoading(false));
  }, []);

  const calculate = async () => {
    if (!selectedDrug) { Alert.alert('Select Drug', 'Please select a drug from the list.'); return; }
    if (!weight || isNaN(parseFloat(weight))) { Alert.alert('Enter Weight', 'Please enter valid weight in kg.'); return; }
    if (!admissionId) { Alert.alert('Error', 'No admission ID provided.'); return; }
    setLoading(true);
    try {
      const r: any = await api.post('/nicu/advanced/drug-orders', {
        admissionId, drugCode: selectedDrug.drug_code, weightKg: parseFloat(weight),
      });
      setResult(r.data ?? r);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e.message ?? 'Failed to calculate dose.');
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>Neonatal Drug Dosing</Text>
      <Text style={s.sub}>Weight-based calculator with toxicity guards</Text>

      <Text style={s.label}>Patient Weight (kg)</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. 1.25"
        placeholderTextColor={C.textMuted}
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={setWeight}
      />

      <Text style={s.label}>Select Drug</Text>
      {formularyLoading ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 12 }} />
      ) : (
        <FlatList
          data={formulary}
          keyExtractor={i => i.drug_code}
          scrollEnabled={false}
          style={{ marginBottom: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.drugItem, selectedDrug?.drug_code === item.drug_code && s.drugSelected]}
              onPress={() => setSelectedDrug(item)}
            >
              <Text style={s.drugName}>{item.drug_name}</Text>
              <Text style={s.drugMeta}>{item.dose_mg_per_kg} mg/kg · {item.frequency} · {item.route}</Text>
              {item.monitoring_required && (
                <Text style={s.drugMonitor}>Monitor: {item.monitoring_required}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={s.calcBtn} onPress={calculate} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={C.bg} size="small" />
        ) : (
          <>
            <Icon name="zap" size={16} color={C.bg} />
            <Text style={s.calcText}> Calculate &amp; Order</Text>
          </>
        )}
      </TouchableOpacity>

      {result && (
        <View style={s.resultCard}>
          <Text style={s.resultTitle}>Recommended Dose</Text>
          <Text style={s.doseNum}>{result.recommended_dose_mg} mg</Text>
          <Text style={s.drugLabel}>
            {selectedDrug?.drug_name} · {selectedDrug?.route} · {selectedDrug?.frequency}
          </Text>
          {(result.cdss_alerts ?? []).map((a: string, i: number) => (
            <View key={i} style={s.alert}>
              <Icon name="alert-triangle" size={14} color={a.includes('EXCEEDS') ? C.coral : C.amber} />
              <Text style={[s.alertText, { color: a.includes('EXCEEDS') ? C.coral : C.amber }]}>
                {' '}{a}
              </Text>
            </View>
          ))}
          {(result.cdss_alerts?.length ?? 0) === 0 && (
            <Text style={s.safeText}>No safety alerts — dose within normal range.</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text, marginBottom: 4 },
  sub:         { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 20 },
  label:       { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary, marginBottom: 6 },
  input:       { backgroundColor: C.surface, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontFamily: FONT.ui, marginBottom: 18, fontSize: 16 },
  drugItem:    { backgroundColor: C.surface, borderRadius: RADIUS.sm, padding: 12, marginBottom: 6, borderWidth: 1.5, borderColor: 'transparent' },
  drugSelected:{ borderColor: C.teal },
  drugName:    { fontFamily: FONT.uiSb, fontSize: 14, color: C.text },
  drugMeta:    { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  drugMonitor: { fontFamily: FONT.ui, fontSize: 11, color: C.amber, marginTop: 2 },
  calcBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingVertical: 14, marginBottom: 20 },
  calcText:    { fontFamily: FONT.uiSb, fontSize: 15, color: C.bg },
  resultCard:  { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, ...SHADOW.teal },
  resultTitle: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary, marginBottom: 4 },
  doseNum:     { fontFamily: FONT.uiBd, fontSize: 36, color: C.teal, marginBottom: 4 },
  drugLabel:   { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginBottom: 12 },
  alert:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  alertText:   { fontFamily: FONT.ui, fontSize: 12, flex: 1 },
  safeText:    { fontFamily: FONT.ui, fontSize: 13, color: C.teal },
});
