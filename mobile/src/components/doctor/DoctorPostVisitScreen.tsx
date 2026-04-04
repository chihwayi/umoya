import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  FlatList,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge, Card, ScreenHeader, SectionHeader, AiBadge, AiPulse } from '../ui';
import { PostVisitService, ApiPostVisitSession } from '../../services/postVisit';

// ─── Types ────────────────────────────────────────────────────────────────────

type SignoffStatus = 'pending' | 'reviewing' | 'signed' | 'amended';

interface SOAPSection {
  key: string;
  label: string;       // clinical label for doctor
  icon: string;
  content: string;     // AI-drafted content
  edited: boolean;
}

interface PostVisitNote {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  mrn: string;
  ward: string;
  bed: string;
  visitDate: string;
  visitTime: string;
  consultDuration: string;
  diagnosis: string[];
  status: SignoffStatus;
  aiGeneratedAt: string;
  soap: SOAPSection[];
  medications: MedChange[];
  followUp: string;
  referrals: string[];
  audioTranscriptAvailable: boolean;
}

interface MedChange {
  drug: string;
  action: 'started' | 'stopped' | 'modified' | 'continued';
  dose?: string;
  reason: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<SignoffStatus, string> = {
  pending:   C.amber,
  reviewing: C.blue,
  signed:    C.green,
  amended:   C.purple,
};

const STATUS_LABEL: Record<SignoffStatus, string> = {
  pending:   'Awaiting Signoff',
  reviewing: 'Reviewing',
  signed:    'Signed',
  amended:   'Amended & Signed',
};

const MED_ACTION_COLOR: Record<MedChange['action'], string> = {
  started:   C.teal,
  stopped:   C.red,
  modified:  C.amber,
  continued: C.textSecondary,
};

const MED_ACTION_LABEL: Record<MedChange['action'], string> = {
  started:   'Started',
  stopped:   'Stopped',
  modified:  'Modified',
  continued: 'Continued',
};

// ─── Note Queue Card ──────────────────────────────────────────────────────────

interface NoteCardProps {
  note: PostVisitNote;
  onPress: (n: PostVisitNote) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onPress }) => {
  const statusColor = STATUS_COLOR[note.status];

  return (
    <TouchableOpacity onPress={() => onPress(note)} activeOpacity={0.85}>
      <Card accent={statusColor} accentSide style={queueStyles.card}>
        <View style={queueStyles.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={queueStyles.name}>{note.patientName}</Text>
            <Text style={queueStyles.meta}>{note.age}y · {note.mrn} · {note.bed}</Text>
          </View>
          <Badge color={statusColor} size="xs">{STATUS_LABEL[note.status]}</Badge>
        </View>

        {/* Diagnoses */}
        <View style={queueStyles.diagList}>
          {note.diagnosis.map((d, i) => (
            <Text key={i} style={queueStyles.diag} numberOfLines={1}>• {d}</Text>
          ))}
        </View>

        {/* Footer */}
        <View style={queueStyles.footer}>
          <View style={queueStyles.footerItem}>
            <Icon name="calendar" size={12} color={C.textMuted} />
            <Text style={queueStyles.footerText}>{note.visitTime} · {note.consultDuration}</Text>
          </View>
          <View style={queueStyles.footerItem}>
            <AiBadge text="AI Drafted" />
            <Text style={queueStyles.footerText}>{note.aiGeneratedAt}</Text>
          </View>
          {note.audioTranscriptAvailable && (
            <View style={queueStyles.footerItem}>
              <Icon name="mic" size={12} color={C.purple} />
              <Text style={[queueStyles.footerText, { color: C.purple }]}>Transcript</Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const queueStyles = StyleSheet.create({
  card: { marginBottom: 10, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontFamily: FONT.uiBd, fontSize: 15, color: C.textPrimary },
  meta: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  diagList: { gap: 2 },
  diag: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
});

// ─── SOAP Editor ──────────────────────────────────────────────────────────────

interface SOAPEditorProps {
  sections: SOAPSection[];
  onChange: (sections: SOAPSection[]) => void;
}

const SOAPEditor: React.FC<SOAPEditorProps> = ({ sections, onChange }) => {
  const [expandedKey, setExpandedKey] = useState<string | null>('S');

  const handleEdit = (key: string, text: string) => {
    onChange(
      sections.map((s) =>
        s.key === key ? { ...s, content: text, edited: text !== s.content } : s
      )
    );
  };

  return (
    <View style={soapStyles.container}>
      {sections.map((section) => {
        const isOpen = expandedKey === section.key;
        return (
          <Card
            key={section.key}
            accent={section.edited ? C.amber : C.teal}
            accentSide
            style={soapStyles.card}
          >
            <TouchableOpacity
              style={soapStyles.sectionHeader}
              onPress={() => setExpandedKey(isOpen ? null : section.key)}
              activeOpacity={0.75}
            >
              <View style={soapStyles.sectionTitle}>
                <View style={[soapStyles.sectionKey, { backgroundColor: C.teal + '22' }]}>
                  <Text style={soapStyles.sectionKeyText}>{section.key}</Text>
                </View>
                <Text style={soapStyles.sectionLabel}>{section.label}</Text>
                {section.edited && <Badge color={C.amber} size="xs">Edited</Badge>}
              </View>
              <Icon
                name="chevron"
                size={16}
                color={C.textMuted}
              />
            </TouchableOpacity>

            {isOpen && (
              <View style={soapStyles.editorArea}>
                <View style={soapStyles.aiLabelRow}>
                  <AiBadge text="AI Drafted — Review & Edit" />
                </View>
                <TextInput
                  value={section.content}
                  onChangeText={(text) => handleEdit(section.key, text)}
                  multiline
                  style={soapStyles.textInput}
                  textAlignVertical="top"
                  scrollEnabled={false}
                />
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
};

const soapStyles = StyleSheet.create({
  container: { gap: 8 },
  card: { gap: 0 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionKey: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionKeyText: { fontFamily: FONT.uiBk, fontSize: 13, color: C.teal },
  sectionLabel: { fontFamily: FONT.uiBd, fontSize: 14, color: C.textPrimary },
  editorArea: { marginTop: 12, gap: 8 },
  aiLabelRow: {},
  textInput: {
    fontFamily: FONT.uiMd,
    fontSize: 13,
    color: C.textPrimary,
    lineHeight: 21,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.md,
    padding: 12,
    minHeight: 120,
  },
});

// ─── Note Review Modal ─────────────────────────────────────────────────────────

interface NoteReviewProps {
  note: PostVisitNote | null;
  onClose: () => void;
  onSign: (noteId: string) => void;
}

const NoteReview: React.FC<NoteReviewProps> = ({ note, onClose, onSign }) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(800)).current;
  const [sections, setSections] = useState<SOAPSection[]>([]);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (note) {
      setSections(note.soap.map((s) => ({ ...s })));
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 55,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(800);
    }
  }, [note]);

  if (!note) return null;

  const hasEdits = sections.some((s) => s.edited);

  const handleSign = () => {
    Alert.alert(
      hasEdits ? 'Sign Amended Note' : 'Sign Note',
      hasEdits
        ? 'You have made edits. The note will be signed with your amendments and the AI draft will be archived.'
        : 'Sign this AI-drafted note as accurate? Your digital signature will be applied.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign & Publish',
          style: 'default',
          onPress: () => {
            setSigning(true);
            PostVisitService.publish(note.id, {
              note: hasEdits ? 'Doctor amended AI-drafted note' : undefined,
              publishMetadata: hasEdits
                ? { amendedSoap: Object.fromEntries(sections.filter(s => s.edited).map(s => [s.key, s.content])) }
                : undefined,
            })
              .then(() => {
                setSigning(false);
                onSign(note.id);
                handleClose();
              })
              .catch(() => {
                setSigning(false);
                Alert.alert('Sign failed', 'Unable to publish note. Please try again.');
              });
          },
        },
      ]
    );
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 800,
      duration: 220,
      useNativeDriver: true,
    }).start(onClose);
  };

  return (
    <Modal transparent visible={!!note} animationType="none" onRequestClose={handleClose}>
      <Animated.View
        style={[
          reviewStyles.fullSheet,
          { paddingTop: insets.top, paddingBottom: insets.bottom, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Sticky header */}
        <View style={reviewStyles.header}>
          <TouchableOpacity onPress={handleClose} style={reviewStyles.closeBtn} activeOpacity={0.7}>
            <Icon name="close" size={18} color={C.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={reviewStyles.headerTitle}>{note.patientName}</Text>
            <Text style={reviewStyles.headerMeta}>{note.visitDate} · {note.ward} · {note.bed}</Text>
          </View>
          <AiBadge text="AI Drafted" />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={reviewStyles.content}>

          {/* Visit overview */}
          <Card style={reviewStyles.section}>
            <SectionHeader>Visit Overview</SectionHeader>
            <View style={reviewStyles.overviewGrid}>
              <View style={reviewStyles.overviewItem}>
                <Text style={reviewStyles.overviewLabel}>Date</Text>
                <Text style={reviewStyles.overviewValue}>{note.visitDate}</Text>
              </View>
              <View style={reviewStyles.overviewItem}>
                <Text style={reviewStyles.overviewLabel}>Time</Text>
                <Text style={reviewStyles.overviewValue}>{note.visitTime}</Text>
              </View>
              <View style={reviewStyles.overviewItem}>
                <Text style={reviewStyles.overviewLabel}>Duration</Text>
                <Text style={reviewStyles.overviewValue}>{note.consultDuration}</Text>
              </View>
            </View>

            <View style={reviewStyles.diagSection}>
              <Text style={reviewStyles.overviewLabel}>Diagnoses</Text>
              {note.diagnosis.map((d, i) => (
                <Text key={i} style={reviewStyles.diagText}>• {d}</Text>
              ))}
            </View>

            {note.audioTranscriptAvailable && (
              <TouchableOpacity style={reviewStyles.transcriptBtn} activeOpacity={0.8}>
                <Icon name="mic" size={14} color={C.purple} />
                <Text style={reviewStyles.transcriptBtnText}>View Audio Transcript</Text>
                <Icon name="arrow" size={14} color={C.purple} />
              </TouchableOpacity>
            )}
          </Card>

          {/* SOAP Editor */}
          <View style={reviewStyles.section}>
            <SectionHeader>SOAP Note — Review & Edit</SectionHeader>
            <SOAPEditor sections={sections} onChange={setSections} />
          </View>

          {/* Medications */}
          <View style={reviewStyles.section}>
            <SectionHeader>Medication Changes</SectionHeader>
            {note.medications.map((med, i) => (
              <Card key={i} style={reviewStyles.medCard} accentSide accent={MED_ACTION_COLOR[med.action]}>
                <View style={reviewStyles.medRow}>
                  <Badge color={MED_ACTION_COLOR[med.action]} size="xs">{MED_ACTION_LABEL[med.action]}</Badge>
                  <View style={{ flex: 1 }}>
                    <Text style={reviewStyles.medName}>{med.drug}{med.dose ? ` — ${med.dose}` : ''}</Text>
                    <Text style={reviewStyles.medReason}>{med.reason}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          {/* Follow-up & referrals */}
          <Card style={reviewStyles.section}>
            <SectionHeader>Follow-up & Referrals</SectionHeader>
            <Text style={reviewStyles.followUpText}>{note.followUp}</Text>
            {note.referrals.length > 0 && (
              <View style={reviewStyles.referralsList}>
                {note.referrals.map((r, i) => (
                  <View key={i} style={reviewStyles.referralItem}>
                    <Icon name="arrow" size={12} color={C.teal} />
                    <Text style={reviewStyles.referralText}>{r}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* Sign button area */}
          <View style={reviewStyles.signArea}>
            {hasEdits && (
              <View style={reviewStyles.editBanner}>
                <Icon name="edit" size={14} color={C.amber} />
                <Text style={reviewStyles.editBannerText}>
                  You have amended {sections.filter((s) => s.edited).length} section{sections.filter((s) => s.edited).length > 1 ? 's' : ''} — changes will be highlighted in the record.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                reviewStyles.signBtn,
                hasEdits && { backgroundColor: C.amber + '22', borderColor: C.amber },
              ]}
              onPress={handleSign}
              activeOpacity={0.85}
              disabled={signing}
            >
              {signing ? (
                <ActivityIndicator color={hasEdits ? C.amber : C.teal} />
              ) : (
                <>
                  <Icon name="sign" size={20} color={hasEdits ? C.amber : C.teal} />
                  <Text style={[reviewStyles.signBtnText, hasEdits && { color: C.amber }]}>
                    {hasEdits ? 'Sign Amended Note' : 'Sign & Publish Note'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={reviewStyles.signDisclaimer}>
              By signing you confirm this note is clinically accurate and authorise its entry into the patient record.
            </Text>
          </View>

        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const reviewStyles = StyleSheet.create({
  fullSheet: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: FONT.uiBk, fontSize: 17, color: C.textPrimary, letterSpacing: -0.2 },
  headerMeta: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  section: { gap: 8 },
  overviewGrid: { flexDirection: 'row', gap: 0 },
  overviewItem: { flex: 1, gap: 2 },
  overviewLabel: { fontFamily: FONT.uiBd, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  overviewValue: { fontFamily: FONT.uiSb, fontSize: 14, color: C.textPrimary },
  diagSection: { marginTop: 12, gap: 4 },
  diagText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary, lineHeight: 20 },
  transcriptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.purple + '18',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.purple + '35',
  },
  transcriptBtnText: { fontFamily: FONT.uiSb, fontSize: 13, color: C.purple, flex: 1 },
  medCard: { marginBottom: 6 },
  medRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  medName: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary },
  medReason: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  followUpText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textPrimary, lineHeight: 20 },
  referralsList: { marginTop: 8, gap: 6 },
  referralItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  referralText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.teal },
  signArea: { gap: 12, marginTop: 4 },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.amber + '18',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.amber + '35',
    padding: 12,
  },
  editBannerText: { flex: 1, fontFamily: FONT.uiMd, fontSize: 12, color: C.amber, lineHeight: 18 },
  signBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    backgroundColor: C.teal + '22',
    borderWidth: 1.5,
    borderColor: C.teal,
  },
  signBtnText: {
    fontFamily: FONT.uiBk,
    fontSize: 16,
    color: C.teal,
    letterSpacing: -0.2,
  },
  signDisclaimer: {
    fontFamily: FONT.ui,
    fontSize: 11,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});

// ─── API Mapper ───────────────────────────────────────────────────────────────

function mapApiSession(s: ApiPostVisitSession): PostVisitNote {
  const SOAP_KEYS = [
    { key: 'S', label: 'Subjective', icon: 'chat'    },
    { key: 'O', label: 'Objective',  icon: 'pulse'   },
    { key: 'A', label: 'Assessment', icon: 'brain'   },
    { key: 'P', label: 'Plan',       icon: 'sparkle' },
  ];
  const soap: SOAPSection[] = SOAP_KEYS.map(sk => ({
    ...sk,
    edited: false,
    content: s.soap?.[sk.key.toLowerCase() as keyof typeof s.soap] ?? '',
  }));

  const dt = s.appointmentDate ?? s.createdAt;
  const d = dt ? new Date(dt) : null;

  return {
    id:                       s.id,
    patientId:                s.patientId,
    patientName:              s.patientName ?? 'Patient',
    age:                      0,
    mrn:                      '',
    ward:                     '',
    bed:                      '',
    visitDate:                d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—',
    visitTime:                d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—',
    consultDuration:          '—',
    diagnosis:                (s.diagnoses ?? []).map(dx => `${dx.name}${dx.icd ? ` (${dx.icd})` : ''}`),
    status:                   (s.status === 'signed' || s.status === 'amended') ? s.status as SignoffStatus : 'pending',
    aiGeneratedAt:            d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—',
    soap,
    medications:              (s.medications ?? []).map(m => ({
      drug:   m.name,
      action: 'continued' as MedChange['action'],
      dose:   m.dose,
      reason: m.instruction ?? '',
    })),
    followUp:                 s.followUpInstructions ?? s.followUpDate ?? '',
    referrals:                [],
    audioTranscriptAvailable: false,
  };
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const DoctorPostVisitScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<PostVisitNote[]>([]);
  const [selected, setSelected] = useState<PostVisitNote | null>(null);

  useEffect(() => {
    PostVisitService.sessions().then(data => {
      if (data?.length) setNotes(data.map(mapApiSession));
    }).catch(() => {});
  }, []);

  const pending = notes.filter((n) => n.status === 'pending');
  const signed  = notes.filter((n) => n.status === 'signed' || n.status === 'amended');

  const handleSign = useCallback((noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        const hadEdits = n.soap.some((s) => s.edited);
        return { ...n, status: hadEdits ? 'amended' : 'signed' };
      })
    );
  }, []);

  return (
    <View style={[mainStyles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />

      <ScreenHeader
        title="PostVisit AI"
        subtitle="Signoff Queue"
        accent={C.purple}
        rightSlot={
          <View style={mainStyles.headerBadge}>
            <Text style={mainStyles.headerBadgeText}>{pending.length}</Text>
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={mainStyles.content}>

        {/* Hero pulse when there are pending notes */}
        {pending.length > 0 && (
          <View style={mainStyles.heroSection}>
            <AiPulse size={56} active />
            <View style={{ flex: 1 }}>
              <Text style={mainStyles.heroTitle}>
                {pending.length} note{pending.length > 1 ? 's' : ''} awaiting your signature
              </Text>
              <Text style={mainStyles.heroSub}>
                AI drafted from consultation audio and EHR data. Review, edit if needed, then sign.
              </Text>
            </View>
          </View>
        )}

        {/* Pending queue */}
        {pending.length > 0 && (
          <View style={mainStyles.section}>
            <SectionHeader action={`${pending.length} pending`}>
              Awaiting Signoff
            </SectionHeader>
            {pending.map((note) => (
              <NoteCard key={note.id} note={note} onPress={setSelected} />
            ))}
          </View>
        )}

        {/* All clear state */}
        {pending.length === 0 && (
          <View style={mainStyles.allClear}>
            <View style={mainStyles.allClearIcon}>
              <Icon name="check" size={32} color={C.teal} />
            </View>
            <Text style={mainStyles.allClearTitle}>All notes signed</Text>
            <Text style={mainStyles.allClearSub}>You're up to date. New notes will appear here after consultations.</Text>
          </View>
        )}

        {/* Signed today */}
        {signed.length > 0 && (
          <View style={mainStyles.section}>
            <SectionHeader>Completed Today</SectionHeader>
            {signed.map((note) => (
              <NoteCard key={note.id} note={note} onPress={setSelected} />
            ))}
          </View>
        )}

        {/* Info strip */}
        <Card style={mainStyles.infoCard}>
          <View style={mainStyles.infoRow}>
            <AiBadge text="How AI PostVisit Works" />
          </View>
          <Text style={mainStyles.infoText}>
            After each consultation, our AI listens to the audio (with patient consent), cross-references the EHR, and drafts a structured SOAP note. You review, edit any inaccuracies, and sign. Your signature locks the record. Amendments are tracked with a full audit trail.
          </Text>
        </Card>

      </ScrollView>

      {/* Note review modal */}
      <NoteReview
        note={selected}
        onClose={() => setSelected(null)}
        onSign={handleSign}
      />
    </View>
  );
};

const mainStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.purple,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: { fontFamily: FONT.uiBd, fontSize: 12, color: '#fff' },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: C.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: C.purple + '40',
    padding: 16,
  },
  heroTitle: { fontFamily: FONT.uiBd, fontSize: 15, color: C.textPrimary, lineHeight: 21 },
  heroSub: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 4, lineHeight: 18 },
  section: { gap: 4 },
  allClear: { alignItems: 'center', paddingVertical: 48, gap: 14 },
  allClearIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.teal + '20',
    borderWidth: 1.5,
    borderColor: C.teal + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allClearTitle: { fontFamily: FONT.uiBk, fontSize: 20, color: C.textPrimary },
  allClearSub: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  infoCard: { gap: 8 },
  infoRow: {},
  infoText: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, lineHeight: 19 },
});
