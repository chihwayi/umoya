import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { buildApiClient } from '../../services/api';

const WAZ_CATEGORY: Record<string, { label: string; color: string }> = {
  severe_underweight: { label: 'Severe Underweight', color: '#c53030' },
  underweight:        { label: 'Underweight',        color: '#dd6b20' },
  normal:             { label: 'Normal',             color: '#276749' },
  overweight:         { label: 'Overweight',         color: '#b7791f' },
  unknown:            { label: 'Not assessed',       color: '#a0aec0' },
};

export const GrowthMeasurementScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const patientId: string = route.params?.patientId ?? '';

  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [muac, setMuac] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);

  const submit = async () => {
    if (!weightKg || !heightCm) {
      Alert.alert('Missing fields', 'Weight and height are required.');
      return;
    }
    setSaving(true);
    try {
      const api = buildApiClient('');
      const { data } = await api.post(`/clinical/growth/measurements`, {
        patientId,
        weightKg: parseFloat(weightKg),
        heightCm: parseFloat(heightCm),
        muacCm: muac ? parseFloat(muac) : undefined,
      });
      setResult(data);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to save measurement.');
    } finally {
      setSaving(false);
    }
  };

  const wazBadge = WAZ_CATEGORY[result?.wazCategory ?? 'unknown'];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backTxt}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Growth Measurement</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Weight (kg) *</Text>
          <TextInput
            style={styles.input}
            value={weightKg}
            onChangeText={setWeightKg}
            keyboardType="decimal-pad"
            placeholder="e.g. 12.5"
            placeholderTextColor={C.textSecondary}
          />

          <Text style={styles.label}>Height (cm) *</Text>
          <TextInput
            style={styles.input}
            value={heightCm}
            onChangeText={setHeightCm}
            keyboardType="decimal-pad"
            placeholder="e.g. 85"
            placeholderTextColor={C.textSecondary}
          />

          <Text style={styles.label}>MUAC (cm)</Text>
          <TextInput
            style={styles.input}
            value={muac}
            onChangeText={setMuac}
            keyboardType="decimal-pad"
            placeholder="Optional"
            placeholderTextColor={C.textSecondary}
          />

          <TouchableOpacity style={styles.btn} onPress={submit} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnTxt}>Save Measurement</Text>
            )}
          </TouchableOpacity>
        </View>

        {result && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Result</Text>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>WAZ</Text>
              <Text style={styles.rowValue}>{result.waz ?? '—'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>HAZ</Text>
              <Text style={styles.rowValue}>{result.haz ?? '—'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Weight Status</Text>
              <Text style={[styles.rowValue, { color: wazBadge.color, fontWeight: '600' }]}>
                {wazBadge.label}
              </Text>
            </View>

            {result.nutritionReferralNeeded && (
              <View style={styles.alert}>
                <Text style={styles.alertTxt}>⚠ Nutrition referral recommended</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: C.purple,
  },
  backBtn: { marginBottom: 8 },
  backTxt: { color: '#fff', fontSize: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', fontFamily: FONT.bold },
  card: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    padding: 16,
    ...SHADOW.sm,
  },
  label: { fontSize: 13, color: C.textSecondary, marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: RADIUS.md,
    padding: 10,
    fontSize: 15,
    color: C.text,
  },
  btn: {
    marginTop: 20,
    backgroundColor: C.purple,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
  },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: C.text },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: { fontSize: 14, color: C.textSecondary },
  rowValue: { fontSize: 14, color: C.text },
  alert: {
    marginTop: 12,
    backgroundColor: '#fff5f5',
    borderRadius: RADIUS.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fc8181',
  },
  alertTxt: { color: '#c53030', fontWeight: '600', fontSize: 14 },
});
