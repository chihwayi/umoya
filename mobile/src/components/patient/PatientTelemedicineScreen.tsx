import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, ActivityIndicator, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Card, AiBadge, AiPulse, Badge } from '../ui';
import { useAuthStore } from '../../stores/useAuthStore';
import { TelemedicineService, ApiConsultation, MeetingAccess } from '../../services/telemedicine';

// ─── Types ────────────────────────────────────────────────────────────────────

type CallState = 'idle' | 'connecting' | 'in_call' | 'ended';

const STATUS_COLOR: Record<string, string> = {
  scheduled: C.blue,
  confirmed:  C.blue,
  waiting:    C.amber,
  active:     C.green,
  completed:  C.textMuted,
  cancelled:  C.red,
  no_show:    C.red,
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  confirmed:  'Confirmed',
  waiting:    'Waiting Room',
  active:     'Live Now',
  completed:  'Completed',
  cancelled:  'Cancelled',
  no_show:    'No Show',
};

// ─── Post-call Rating ─────────────────────────────────────────────────────────

const RatingModal: React.FC<{
  visible: boolean;
  consultationId: string;
  onDone: () => void;
}> = ({ visible, consultationId, onDone }) => {
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    setSubmitted(true);
    await TelemedicineService.rateSatisfaction(consultationId, rating);
    onDone();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={rStyles.backdrop}>
        <View style={rStyles.card}>
          <AiPulse size={36} active={false} />
          <Text style={rStyles.title}>How was your consultation?</Text>
          <Text style={rStyles.sub}>Your feedback helps us improve telehealth care.</Text>
          <View style={rStyles.stars}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => setRating(n)} activeOpacity={0.7}>
                <Text style={[rStyles.star, { color: n <= rating ? C.amber : C.border }]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <TouchableOpacity style={rStyles.btn} onPress={submit} disabled={submitted}>
              <Text style={rStyles.btnText}>{submitted ? 'Submitting…' : 'Submit Rating'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onDone} style={rStyles.skip}>
            <Text style={rStyles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const rStyles = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: '#000A', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.xl, padding: 28, alignItems: 'center', gap: 12, width: '100%', ...SHADOW.heavy },
  title:     { fontFamily: FONT.uiBk, fontSize: 18, color: C.text, textAlign: 'center' },
  sub:       { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 18 },
  stars:     { flexDirection: 'row', gap: 8, marginTop: 4 },
  star:      { fontSize: 36 },
  btn:       { backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingHorizontal: 32, paddingVertical: 12, marginTop: 4 },
  btnText:   { fontFamily: FONT.uiBd, fontSize: 14, color: '#fff' },
  skip:      { paddingVertical: 8 },
  skipText:  { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted },
});

// ─── In-Call WebView ──────────────────────────────────────────────────────────

const CallView: React.FC<{
  access: MeetingAccess;
  onEnd: () => void;
}> = ({ access, onEnd }) => {
  const insets = useSafeAreaInsets();
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Build Daily.co prebuilt URL with meeting token
  const callUrl = `${access.roomUrl}?t=${encodeURIComponent(access.token)}`;

  const toggleMute = () => {
    setMuted(m => !m);
    // Inject JS to toggle Daily.co audio
    webViewRef.current?.injectJavaScript(
      `window.callFrame && window.callFrame.setLocalAudio(${muted});`
    );
  };

  const toggleCam = () => {
    setCamOff(c => !c);
    webViewRef.current?.injectJavaScript(
      `window.callFrame && window.callFrame.setLocalVideo(${camOff});`
    );
  };

  const confirmEnd = () => {
    Alert.alert('End Call', 'Are you sure you want to end this consultation?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Call', style: 'destructive', onPress: onEnd },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <WebView
        ref={webViewRef}
        source={{ uri: callUrl }}
        style={{ flex: 1 }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        allowsProtectedMedia
        originWhitelist={['*']}
        onError={() => Alert.alert('Connection Error', 'Could not connect to the call. Please try again.')}
      />

      {/* Floating call controls */}
      <View style={[callStyles.controls, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[callStyles.ctrlBtn, muted && callStyles.ctrlActive]}
          onPress={toggleMute}
          activeOpacity={0.85}
        >
          <Icon name={muted ? 'escalate' : 'pulse'} size={20} color={muted ? C.amber : '#fff'} />
          <Text style={[callStyles.ctrlLabel, muted && { color: C.amber }]}>
            {muted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={callStyles.endBtn} onPress={confirmEnd} activeOpacity={0.85}>
          <Icon name="escalate" size={22} color="#fff" />
          <Text style={callStyles.endLabel}>End</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[callStyles.ctrlBtn, camOff && callStyles.ctrlActive]}
          onPress={toggleCam}
          activeOpacity={0.85}
        >
          <Icon name={camOff ? 'rounds' : 'telehealth'} size={20} color={camOff ? C.amber : '#fff'} />
          <Text style={[callStyles.ctrlLabel, camOff && { color: C.amber }]}>
            {camOff ? 'Show Cam' : 'Hide Cam'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const callStyles = StyleSheet.create({
  controls:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingTop: 12, backgroundColor: 'rgba(0,0,0,0.75)' },
  ctrlBtn:   { alignItems: 'center', gap: 4, padding: 10, borderRadius: RADIUS.md, minWidth: 68 },
  ctrlActive:{ backgroundColor: 'rgba(255,255,255,0.1)' },
  ctrlLabel: { fontFamily: FONT.uiBd, fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  endBtn:    { alignItems: 'center', gap: 4, backgroundColor: C.red, borderRadius: 36, width: 72, height: 72, justifyContent: 'center', ...SHADOW.heavy },
  endLabel:  { fontFamily: FONT.uiBd, fontSize: 11, color: '#fff' },
});

// ─── Consultation Card ────────────────────────────────────────────────────────

const ConsultationCard: React.FC<{
  c: ApiConsultation;
  onJoin: (c: ApiConsultation) => void;
}> = ({ c, onJoin }) => {
  const statusColor = STATUS_COLOR[c.status] ?? C.textMuted;
  const dt = c.scheduledAt ?? c.patientJoinedAt;
  const dateLabel = dt
    ? new Date(dt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : '—';
  const timeLabel = dt
    ? new Date(dt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';
  const canJoin = ['scheduled', 'confirmed', 'waiting', 'active'].includes(c.status);

  return (
    <Card style={[cStyles.card, { borderLeftColor: statusColor, borderLeftWidth: 3 }]}>
      <View style={cStyles.row}>
        <View style={[cStyles.iconBox, { backgroundColor: statusColor + '20' }]}>
          <Icon name="telehealth" size={20} color={statusColor} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={cStyles.doctor}>{c.doctorName ?? 'Your Doctor'}</Text>
          {c.doctorSpecialty ? <Text style={cStyles.specialty}>{c.doctorSpecialty}</Text> : null}
          <Text style={cStyles.datetime}>{dateLabel}{timeLabel ? `  ·  ${timeLabel}` : ''}</Text>
        </View>
        <View style={[cStyles.statusPill, { borderColor: statusColor + '55', backgroundColor: statusColor + '15' }]}>
          <Text style={[cStyles.statusText, { color: statusColor }]}>
            {STATUS_LABEL[c.status] ?? c.status}
          </Text>
        </View>
      </View>

      {canJoin && (
        <TouchableOpacity style={cStyles.joinBtn} onPress={() => onJoin(c)} activeOpacity={0.85}>
          <Icon name="telehealth" size={16} color="#fff" />
          <Text style={cStyles.joinText}>
            {c.status === 'active' ? 'Rejoin Call' : 'Join Call'}
          </Text>
        </TouchableOpacity>
      )}
    </Card>
  );
};

const cStyles = StyleSheet.create({
  card:      { gap: 12 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox:   { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  doctor:    { fontFamily: FONT.uiBd, fontSize: 14, color: C.text },
  specialty: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  datetime:  { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 1 },
  statusPill:{ borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:{ fontFamily: FONT.uiBd, fontSize: 10, letterSpacing: 0.4 },
  joinBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingVertical: 11 },
  joinText:  { fontFamily: FONT.uiBd, fontSize: 14, color: '#fff' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

interface PatientTelemedicineScreenProps {
  navigation?: any;
}

export const PatientTelemedicineScreen: React.FC<PatientTelemedicineScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [consultations, setConsultations] = useState<ApiConsultation[]>([]);
  const [loading, setLoading]             = useState(true);
  const [callState, setCallState]         = useState<CallState>('idle');
  const [meetingAccess, setMeetingAccess] = useState<MeetingAccess | null>(null);
  const [activeConsultation, setActiveConsultation] = useState<ApiConsultation | null>(null);
  const [showRating, setShowRating]       = useState(false);

  const loadConsultations = useCallback(() => {
    setLoading(true);
    const id = user?.patientMrn ?? user?.id;
    TelemedicineService.list(id).then(data => {
      setConsultations(data ?? []);
    }).catch(() => {
      setConsultations([]);
    }).finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => { loadConsultations(); }, [loadConsultations]);

  useEffect(() => {
    const socket = (globalThis as any).telemedicineSocket;
    if (!socket?.on) return undefined;

    const handlePostVisitReady = (payload: { sessionId: string; hasRecording: boolean }) => {
      navigation?.replace?.('PostVisitSummary', {
        sessionId: payload.sessionId,
        hasRecording: payload.hasRecording,
      });
    };

    socket.on('tele:postvisit_ready', handlePostVisitReady);
    return () => socket.off?.('tele:postvisit_ready', handlePostVisitReady);
  }, [navigation]);

  const handleJoin = async (consultation: ApiConsultation) => {
    setCallState('connecting');
    setActiveConsultation(consultation);
    try {
      // Register participant then get meeting access
      await TelemedicineService.join(consultation.id, 'patient').catch(() => {});
      const access = await TelemedicineService.getMeetingAccess(consultation.id, 'patient');
      setMeetingAccess(access);
      setCallState('in_call');
    } catch {
      setCallState('idle');
      Alert.alert(
        'Cannot Join Call',
        'Unable to connect to your telehealth session. Please check your connection and try again.',
      );
    }
  };

  const handleEndCall = async () => {
    setCallState('ended');
    setMeetingAccess(null);
    setShowRating(true);
    loadConsultations();
  };

  const handleRatingDone = () => {
    setShowRating(false);
    setActiveConsultation(null);
    setCallState('idle');
  };

  // ── In-call full-screen view ───────────────────────────────────────────────
  if (callState === 'in_call' && meetingAccess) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CallView access={meetingAccess} onEnd={handleEndCall} />
      </View>
    );
  }

  // ── Connecting spinner ─────────────────────────────────────────────────────
  if (callState === 'connecting') {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', paddingTop: insets.top }]}>
        <AiPulse size={64} active />
        <Text style={styles.connectingText}>Connecting to your doctor…</Text>
        <Text style={styles.connectingSub}>Please ensure your camera and microphone are ready.</Text>
      </View>
    );
  }

  const upcoming = consultations.filter(c => ['scheduled', 'confirmed', 'waiting', 'active'].includes(c.status));
  const past     = consultations.filter(c => ['completed', 'cancelled', 'no_show'].includes(c.status));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={['#030B18', C.bg]} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Telehealth</Text>
            <Text style={styles.headerSub}>Video consultations with your doctor</Text>
          </View>
          <AiBadge text="Daily.co" />
        </View>

        {/* HIPAA badge */}
        <View style={styles.hipaaRow}>
          <Icon name="sparkle" size={11} color={C.green} />
          <Text style={styles.hipaaText}>End-to-end encrypted  ·  HIPAA compliant  ·  Daily.co powered</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.teal} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* Hero banner */}
          <LinearGradient
            colors={[C.teal + 'CC', C.blue + 'AA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBanner}
          >
            <AiPulse size={48} active />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.heroTitle}>HD Video Consultations</Text>
              <Text style={styles.heroSub}>
                See your doctor face-to-face from anywhere. No travel required.
              </Text>
            </View>
          </LinearGradient>

          {/* Upcoming / Active */}
          {upcoming.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>UPCOMING & ACTIVE</Text>
              <View style={styles.list}>
                {upcoming.map(c => (
                  <ConsultationCard key={c.id} c={c} onJoin={handleJoin} />
                ))}
              </View>
            </View>
          )}

          {upcoming.length === 0 && (
            <Card style={styles.emptyCard}>
              <Icon name="telehealth" size={32} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No upcoming consultations</Text>
              <Text style={styles.emptySub}>
                Ask your doctor to schedule a telehealth appointment, or request one below.
              </Text>
              <TouchableOpacity style={styles.requestBtn} activeOpacity={0.85}>
                <Text style={styles.requestBtnText}>Request Telehealth Appointment</Text>
              </TouchableOpacity>
            </Card>
          )}

          {/* Past consultations */}
          {past.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PAST CONSULTATIONS</Text>
              <View style={styles.list}>
                {past.slice(0, 5).map(c => (
                  <ConsultationCard key={c.id} c={c} onJoin={handleJoin} />
                ))}
              </View>
            </View>
          )}

          {/* How it works */}
          <Card style={styles.howCard}>
            <Text style={styles.howTitle}>How telehealth works</Text>
            {[
              { step: '1', text: 'Your doctor schedules a video call with you' },
              { step: '2', text: 'You receive a notification when the call is ready' },
              { step: '3', text: 'Tap "Join Call" to connect — no app download needed' },
              { step: '4', text: 'Consult, get prescriptions, and follow-up — all from home' },
            ].map(item => (
              <View key={item.step} style={styles.howRow}>
                <View style={styles.howStep}>
                  <Text style={styles.howStepText}>{item.step}</Text>
                </View>
                <Text style={styles.howText}>{item.text}</Text>
              </View>
            ))}
          </Card>
        </ScrollView>
      )}

      {/* Post-call rating */}
      {activeConsultation && (
        <RatingModal
          visible={showRating}
          consultationId={activeConsultation.id}
          onDone={handleRatingDone}
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:  { paddingHorizontal: 20, paddingBottom: 14 },

  headerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingBottom: 8 },
  headerTitle:{ fontFamily: FONT.uiBk, fontSize: 22, color: C.text, letterSpacing: -0.4 },
  headerSub:  { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, marginTop: 1 },

  hipaaRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hipaaText: { fontFamily: FONT.uiBd, fontSize: 10, color: C.green, letterSpacing: 0.3 },

  content: { padding: 16, gap: 20, paddingBottom: 48 },

  heroBanner:  {
    borderRadius: RADIUS.xl, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14, ...SHADOW.heavy,
  },
  heroTitle:   { fontFamily: FONT.uiBd, fontSize: 15, color: '#fff', lineHeight: 21 },
  heroSub:     { fontFamily: FONT.ui, fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 17, marginTop: 2 },

  section:      { gap: 10 },
  sectionTitle: { fontFamily: FONT.uiBd, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  list:         { gap: 10 },

  emptyCard:    { alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyTitle:   { fontFamily: FONT.uiBd, fontSize: 15, color: C.text },
  emptySub:     { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 18 },
  requestBtn:   { backgroundColor: C.teal + '22', borderRadius: RADIUS.pill, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: C.teal + '55', marginTop: 4 },
  requestBtnText:{ fontFamily: FONT.uiBd, fontSize: 13, color: C.teal },

  howCard:    { gap: 12 },
  howTitle:   { fontFamily: FONT.uiBd, fontSize: 13, color: C.text },
  howRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  howStep:    { width: 24, height: 24, borderRadius: 12, backgroundColor: C.teal + '22', borderWidth: 1, borderColor: C.teal + '44', alignItems: 'center', justifyContent: 'center' },
  howStepText:{ fontFamily: FONT.uiBd, fontSize: 12, color: C.teal },
  howText:    { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, flex: 1, lineHeight: 19 },

  connectingText: { fontFamily: FONT.uiBd, fontSize: 18, color: C.text, marginTop: 20 },
  connectingSub:  { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 6, paddingHorizontal: 32 },
});
