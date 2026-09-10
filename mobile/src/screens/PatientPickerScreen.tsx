import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { Icon } from '../components/ui/Icon';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { PatientsService, patientName, ApiPatient } from '../services/patients';

interface RouteParams {
  targetRoute: string;
  title?: string;
  /** Param name the target screen expects for the patient id (default 'patientId'). */
  idParam?: string;
  /** Param name the target screen expects for the patient name (default 'patientName'). */
  nameParam?: string;
  extraParams?: Record<string, unknown>;
}

export default function PatientPickerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as RouteParams;
  const {
    targetRoute, title = 'Select Patient',
    idParam = 'patientId', nameParam = 'patientName', extraParams,
  } = params;

  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    PatientsService.list(1, 50)
      .then(r => setPatients(r.patients ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!query.trim()) return;
    const handle = setTimeout(() => {
      PatientsService.search(query.trim()).then(setPatients).catch(() => {});
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const select = (p: ApiPatient) => {
    navigation.navigate(targetRoute, {
      [idParam]: p.id,
      [nameParam]: patientName(p),
      ...extraParams,
    });
  };

  return (
    <View style={s.container}>
      <ScreenHeader title={title} accent={C.teal} onBack={() => navigation.goBack()} />
      <View style={s.searchBox}>
        <Icon name="search" size={16} color={C.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or MRN..."
          placeholderTextColor={C.textMuted}
          style={s.searchInput}
        />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.teal} /></View>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} activeOpacity={0.8} onPress={() => select(item)}>
              <Text style={s.name}>{patientName(item)}</Text>
              <Text style={s.meta}>{item.mrn ?? '—'}{item.ward ? ` · ${item.ward}` : ''}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={s.empty}>No patients found.</Text>}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchBox:   {
    flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 0,
    backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontFamily: FONT.uiMd, fontSize: 14, color: C.text },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, ...SHADOW.sm },
  name:        { fontFamily: FONT.uiSb, fontSize: 15, color: C.text },
  meta:        { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  empty:       { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
