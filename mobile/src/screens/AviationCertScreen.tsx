import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Shield, AlertTriangle, Clock } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

export default function AviationCertScreen({ route }: { route: any }) {
  const { applicantId, applicantName } = route.params;
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/aviation/certificates/${applicantId}`)
      .then((r: any) => setCerts(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [applicantId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>Aviation Medical Certificates</Text>
      <Text style={s.sub}>{applicantName}</Text>
      <FlatList
        data={certs}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<Text style={s.empty}>No certificates found.</Text>}
        renderItem={({ item }) => {
          const expiring = item.days_to_expiry < 60 && item.is_valid;
          const expired = !item.is_valid;
          return (
            <View style={[s.card, { borderLeftColor: expired ? C.coral : expiring ? C.amber : C.teal, borderLeftWidth: 4 }]}>
              <View style={s.row}>
                <Shield size={16} color={expired ? C.coral : C.teal} />
                <Text style={s.certClass}> {item.cert_class?.toUpperCase()}</Text>
              </View>
              <Text style={s.certNum}>{item.cert_number}</Text>
              <View style={s.row}>
                <Clock size={12} color={C.textMuted} />
                <Text style={s.expiry}> Expires: {item.expiry_date} ({item.days_to_expiry} days)</Text>
              </View>
              {expiring && (
                <View style={s.row}>
                  <AlertTriangle size={12} color={C.amber} />
                  <Text style={s.warnText}> Renewal required soon</Text>
                </View>
              )}
              {expired && <Text style={s.expiredText}>EXPIRED</Text>}
              {item.limitations_text && <Text style={s.limit}>Limitations: {item.limitations_text}</Text>}
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:         { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:         { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  certClass:   { fontFamily: FONT.uiBd, fontSize: 16, color: C.text },
  certNum:     { fontFamily: FONT.mono, fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  expiry:      { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
  warnText:    { fontFamily: FONT.uiSb, fontSize: 12, color: C.amber },
  expiredText: { fontFamily: FONT.uiSb, fontSize: 13, color: C.coral, marginTop: 6 },
  limit:       { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 4 },
  empty:       { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
