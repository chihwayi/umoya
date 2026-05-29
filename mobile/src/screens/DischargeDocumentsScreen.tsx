import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Linking,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

interface Doc {
  id: string;
  document_type: string;
  file_name: string;
  encounter_date: string;
  signed_by_name: string;
  downloaded_at: string | null;
}

const DOCTYPE_LABEL: Record<string, string> = {
  discharge_summary: 'Discharge Summary',
  prescription:      'Prescriptions',
  sick_note:         'Sick Note',
  follow_up_plan:    'Follow-Up Plan',
  referral_letter:   'Referral Letter',
};

const DOCTYPE_ICON: Record<string, string> = {
  discharge_summary: '📋',
  prescription:      '💊',
  sick_note:         '🏥',
  follow_up_plan:    '📅',
  referral_letter:   '↗',
};

export default function DischargeDocumentsScreen() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/patient/discharge-documents')
      .then((r: any) => setDocs(r.data ?? r))
      .finally(() => setLoading(false));
  }, []);

  async function openDoc(docId: string) {
    const { data } = await api.get(`/patient/discharge-documents/${docId}/url`) as any;
    await Linking.openURL(data.url);
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.blue} />;

  return (
    <FlatList
      style={styles.container}
      data={docs}
      keyExtractor={(d) => d.id}
      contentContainerStyle={{ padding: 16 }}
      ListEmptyComponent={
        <Text style={styles.empty}>No discharge documents yet.</Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => openDoc(item.id)}>
          <View style={styles.row}>
            <Text style={styles.icon}>{DOCTYPE_ICON[item.document_type] ?? '📄'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {DOCTYPE_LABEL[item.document_type] ?? item.file_name}
              </Text>
              <Text style={styles.meta}>
                {item.encounter_date
                  ? new Date(item.encounter_date).toLocaleDateString()
                  : ''}
                {item.signed_by_name ? ` · ${item.signed_by_name}` : ''}
              </Text>
            </View>
            {!item.downloaded_at && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  card:         { backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, marginBottom: 10, ...SHADOW.sm },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon:         { fontSize: 24 },
  title:        { fontFamily: FONT.uiBd, fontSize: 14, color: C.text },
  meta:         { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  newBadge:     { backgroundColor: C.blue, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  newBadgeText: { color: '#fff', fontSize: 10, fontFamily: FONT.uiBd },
  empty:        { textAlign: 'center', color: C.textMuted, marginTop: 40, fontStyle: 'italic' },
});
