import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge, Card, ScreenHeader } from '../ui';
import { AppointmentsService, ApiAppointment } from '../../services/appointments';
import { useAuthStore } from '../../stores/useAuthStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  scheduled:  C.blue,
  confirmed:  C.teal,
  checked_in: C.teal,
  in_progress: C.orange,
  completed:  C.green,
  cancelled:  C.textMuted,
  no_show:    C.red,
};

const STATUS_LABEL: Record<string, string> = {
  scheduled:   'Scheduled',
  confirmed:   'Confirmed',
  checked_in:  'Checked In',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
  no_show:     'No Show',
};

const TYPE_OPTIONS = [
  'Consultation',
  'Follow-up',
  'Telemedicine',
  'Emergency',
  'Procedure',
];

function formatDateTime(appt: ApiAppointment): { date: string; time: string } {
  const raw = appt.appointmentDate ?? appt.scheduledAt ?? appt.startTime;
  if (!raw) return { date: '—', time: '' };
  const d = new Date(raw);
  return {
    date: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

const canCancel = (status: string) => ['scheduled', 'confirmed'].includes(status);

// ─── Component ────────────────────────────────────────────────────────────────

export const PatientAppointmentsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  // Book sheet
  const [showBook, setShowBook]     = useState(false);
  const [bookType, setBookType]     = useState('Consultation');
  const [bookDate, setBookDate]     = useState('');
  const [bookNotes, setBookNotes]   = useState('');
  const [bookLoading, setBookLoading] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await AppointmentsService.upcoming(user?.id);
      setAppointments(data);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id: string) => {
    Alert.alert('Cancel Appointment', 'Are you sure you want to cancel this appointment?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Appointment', style: 'destructive',
        onPress: async () => {
          setAppointments(prev => prev.filter(a => a.id !== id));
          try { await AppointmentsService.cancel(id); } catch { load(true); }
        },
      },
    ]);
  };

  const handleBook = async () => {
    if (!bookDate.trim()) {
      Alert.alert('Missing Date', 'Please enter your preferred date.');
      return;
    }
    setBookLoading(true);
    try {
      await AppointmentsService.book({
        appointmentType: bookType,
        notes:           bookNotes.trim() || undefined,
        appointmentDate: bookDate.trim(),
        status:          'scheduled',
      });
      setShowBook(false);
      setBookDate('');
      setBookNotes('');
      load(true);
    } catch {
      Alert.alert('Request Failed', 'Could not submit your appointment request. Please try again.');
    } finally {
      setBookLoading(false);
    }
  };

  const renderItem = ({ item }: { item: ApiAppointment }) => {
    const color = STATUS_COLOR[item.status] ?? C.textMuted;
    const { date, time } = formatDateTime(item);
    return (
      <Card testID={`patient-appointments-item-${item.id}`} style={[s.card, { borderLeftColor: color, borderLeftWidth: 3 }]}>
        <View style={s.cardRow}>
          <View style={[s.iconBox, { backgroundColor: color + '20' }]}>
            <Icon name={item.isTelemedicine ? 'telehealth' : 'calendar'} size={20} color={color} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.doctor}>{item.doctorName ?? 'Your Doctor'}</Text>
            {item.doctorSpecialty ? <Text style={s.specialty}>{item.doctorSpecialty}</Text> : null}
            <Text style={s.datetime}>{date}{time ? `  ·  ${time}` : ''}</Text>
            {(item.clinicName ?? item.location) ? (
              <Text style={s.location}>{item.clinicName ?? item.location}</Text>
            ) : null}
          </View>
          <View style={[s.statusPill, { borderColor: color + '55', backgroundColor: color + '15' }]}>
            <Text style={[s.statusText, { color }]}>{STATUS_LABEL[item.status] ?? item.status}</Text>
          </View>
        </View>
        {item.isTelemedicine && (
          <View style={s.teleBadge}>
            <Icon name="telehealth" size={12} color={C.teal} />
            <Text style={s.teleText}>Telemedicine</Text>
          </View>
        )}
        {canCancel(item.status) && (
          <TouchableOpacity testID={`patient-appointments-cancel-${item.id}`} style={s.cancelBtn} onPress={() => handleCancel(item.id)} activeOpacity={0.7}>
            <Text style={s.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScreenHeader title={t('nav.appointments')} subtitle="Upcoming & scheduled" />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.teal} />
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={a => a.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 12 }}
          onRefresh={() => load(true)}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={s.empty}>
              <Icon name="calendar" size={44} color={C.border} />
              <Text style={s.emptyTitle}>{t('common.noResults')}</Text>
              <Text style={s.emptyBody}>Tap the button below to request one.</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity testID="patient-appointments-book-fab" style={[s.fab, { bottom: insets.bottom + 24 }]} onPress={() => setShowBook(true)} activeOpacity={0.85}>
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Book sheet */}
      <Modal visible={showBook} transparent animationType="slide" onRequestClose={() => setShowBook(false)}>
        <View style={s.sheetBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowBook(false)} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Request Appointment</Text>

            <Text style={s.fieldLabel}>Appointment Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeRow}>
              {TYPE_OPTIONS.map(t => (
                <TouchableOpacity
                  key={t}
                  testID={`patient-appointments-book-type-${t}`}
                  style={[s.typeChip, bookType === t && s.typeChipActive]}
                  onPress={() => setBookType(t)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.typeChipText, bookType === t && { color: C.teal }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>Preferred Date</Text>
            <TextInput
              testID="patient-appointments-book-date-input"
              style={s.input}
              placeholder="e.g. 2026-04-10"
              placeholderTextColor={C.textMuted}
              value={bookDate}
              onChangeText={setBookDate}
            />

            <Text style={s.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="Reason for visit or any requests…"
              placeholderTextColor={C.textMuted}
              value={bookNotes}
              onChangeText={setBookNotes}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity testID="patient-appointments-book-submit" style={s.submitBtn} onPress={handleBook} activeOpacity={0.85} disabled={bookLoading}>
              {bookLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>{t('common.submit')}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card:        { marginBottom: 0 },
  cardRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox:     { width: 40, height: 40, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  doctor:      { fontFamily: FONT.uiBd, fontSize: 15, color: C.text },
  specialty:   { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
  datetime:    { fontFamily: FONT.ui, fontSize: 13, color: C.text, marginTop: 2 },
  location:    { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
  statusPill:  { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  statusText:  { fontFamily: FONT.uiBd, fontSize: 11 },
  teleBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  teleText:    { fontFamily: FONT.ui, fontSize: 11, color: C.teal },
  cancelBtn:   { marginTop: 10, alignSelf: 'flex-start', paddingVertical: 4 },
  cancelText:  { fontFamily: FONT.ui, fontSize: 12, color: C.red },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle:  { fontFamily: FONT.uiBd, fontSize: 16, color: C.textMuted },
  emptyBody:   { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, textAlign: 'center' },
  fab: {
    position: 'absolute', right: 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: C.teal, justifyContent: 'center', alignItems: 'center',
    ...SHADOW.card,
  },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, gap: 12,
  },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 4 },
  sheetTitle:   { fontFamily: FONT.uiBd, fontSize: 18, color: C.text, marginBottom: 4 },
  fieldLabel:   { fontFamily: FONT.uiBd, fontSize: 13, color: C.textMuted },
  typeRow:      { gap: 8, paddingVertical: 4 },
  typeChip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  typeChipActive: { borderColor: C.teal, backgroundColor: C.teal + '18' },
  typeChipText: { fontFamily: FONT.ui, fontSize: 13, color: C.text },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md,
    padding: 12, color: C.text, fontFamily: FONT.ui, fontSize: 14,
    backgroundColor: C.bg,
  },
  inputMulti:  { height: 80, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: C.teal, borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center', marginTop: 4,
  },
  submitText:  { fontFamily: FONT.uiBd, fontSize: 15, color: '#fff' },
});
