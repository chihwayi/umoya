import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { PatientHero, PatientMetricGrid } from '../../features/patient/ui/PatientHero';
import { PatientSectionHeader } from '../../features/patient/ui/SectionHeader';
import { PatientStatusPill } from '../../features/patient/ui/StatusPill';
import {
  usePatientPostVisitAnnotatedSummary,
  usePatientPostVisitLabTrends,
  usePatientPostVisitMessages,
  usePatientPostVisitMutations,
  usePatientPostVisitRecording,
  usePatientPostVisitSessions,
  usePatientPostVisitSummary
} from '../../features/patient/hooks/usePatientPostVisit';
import { formatRelative, formatStatusLabel, safeArray } from '../../features/patient/utils/format';
import { patientApiUtils, type PatientPostVisitSession } from '../../services/api/patient';

function postVisitTone(status?: string | null) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'published') return 'success' as const;
  if (normalized === 'doctor_reviewed') return 'info' as const;
  if (normalized === 'closed') return 'neutral' as const;
  return 'warning' as const;
}

function stringifySummary(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return 'Summary not available.';

  const compact = JSON.stringify(value);
  if (!compact) return 'Summary not available.';

  return compact.length > 680 ? `${compact.slice(0, 680)}...` : compact;
}

function getSessionLabel(session: PatientPostVisitSession): string {
  const id = session.id.slice(0, 8);
  const title = String(session.title || session.session_title || '').trim();
  if (title) return `${title} · ${id}`;
  return `Session ${id}`;
}

export default function PatientPostVisitScreen() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
  const [question, setQuestion] = useState('');
  const [sectionType, setSectionType] = useState('summary');
  const [messageDraft, setMessageDraft] = useState('');
  const [latestAnswer, setLatestAnswer] = useState<string | null>(null);

  const sessionsQuery = usePatientPostVisitSessions();
  const summaryQuery = usePatientPostVisitSummary(selectedSessionId);
  const annotatedQuery = usePatientPostVisitAnnotatedSummary(selectedSessionId);
  const labTrendsQuery = usePatientPostVisitLabTrends(selectedSessionId);
  const recordingQuery = usePatientPostVisitRecording(selectedSessionId);
  const messagesQuery = usePatientPostVisitMessages(selectedSessionId);
  const { askSection, sendMessage, acknowledge } = usePatientPostVisitMutations(selectedSessionId);

  const sessions = sessionsQuery.data?.sessions || [];
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) || null;

  const recordingUrl = useMemo(
    () => String(recordingQuery.data?.url || recordingQuery.data?.recordingUrl || '').trim(),
    [recordingQuery.data]
  );

  const summaryText = useMemo(() => {
    const source = summaryQuery.data || {};
    return stringifySummary(source.summary || source.patientSummary || source.visitSummary || source);
  }, [summaryQuery.data]);

  const labTrends = useMemo(
    () => safeArray<Record<string, unknown>>(labTrendsQuery.data?.trends || labTrendsQuery.data?.items || []),
    [labTrendsQuery.data]
  );

  const annotatedEntities = useMemo(
    () => safeArray<Record<string, unknown>>(annotatedQuery.data?.entities || []),
    [annotatedQuery.data]
  );

  const companionMessages = messagesQuery.data?.messages || [];

  const metrics = useMemo(
    () => [
      { label: 'Published Sessions', value: sessions.length, tone: 'info' as const },
      {
        label: 'Companion Messages',
        value: companionMessages.length,
        tone: companionMessages.length > 0 ? ('success' as const) : ('neutral' as const)
      },
      {
        label: 'Lab Trends',
        value: labTrends.length,
        tone: labTrends.length > 0 ? ('info' as const) : ('neutral' as const)
      },
      {
        label: 'Entities',
        value: annotatedEntities.length,
        tone: annotatedEntities.length > 0 ? ('warning' as const) : ('neutral' as const)
      }
    ],
    [annotatedEntities.length, companionMessages.length, labTrends.length, sessions.length]
  );

  async function submitSectionQuestion() {
    if (!selectedSessionId || !question.trim()) return;

    const response = await askSection.mutateAsync({
      question: question.trim(),
      sectionType: sectionType.trim() || 'summary'
    });

    const answer = String(response.answer || response.response || response.message || '').trim();
    setLatestAnswer(answer || 'No grounded answer returned for this section.');
    setQuestion('');
  }

  async function submitMessage() {
    if (!selectedSessionId || !messageDraft.trim()) return;

    await sendMessage.mutateAsync({
      message: messageDraft.trim(),
      messageType: 'question'
    });

    setMessageDraft('');
  }

  async function submitAcknowledgement(
    acknowledgementType:
      | 'teach_back'
      | 'medication_adherence'
      | 'follow_up_commitment'
      | 'warning_sign_understanding'
  ) {
    if (!selectedSessionId) return;

    await acknowledge.mutateAsync({
      acknowledgementType,
      acknowledged: true,
      details: {
        source: 'patient_mobile_postvisit'
      }
    });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <PatientHero
          title="PostVisit Companion"
          subtitle="Review published summaries, ask grounded questions, and acknowledge your care plan."
        >
          <PatientMetricGrid items={metrics} />
        </PatientHero>

        {sessionsQuery.isLoading ? (
          <StatePanel state="loading" title="Loading sessions" message="Syncing your published post-visit sessions..." />
        ) : null}
        {sessionsQuery.isError ? (
          <StatePanel state="error" title="Sessions unavailable" message="Could not load post-visit sessions." />
        ) : null}

        <Card>
          <PatientSectionHeader title="Published Sessions" subtitle="Select a session to open companion details" />

          {sessions.map((session) => (
            <Pressable
              key={session.id}
              style={[styles.sessionCard, selectedSessionId === session.id && styles.sessionCardActive]}
              onPress={() => setSelectedSessionId(session.id)}
            >
              <View style={styles.rowTop}>
                <PatientStatusPill
                  label={formatStatusLabel(session.status || 'published')}
                  tone={postVisitTone(session.status)}
                />
                <Text style={styles.metaText}>{formatRelative(session.updated_at || session.created_at || null)}</Text>
              </View>
              <Text style={styles.titleText}>{getSessionLabel(session)}</Text>
            </Pressable>
          ))}

          {!sessionsQuery.isLoading && sessions.length === 0 ? (
            <StatePanel state="empty" title="No post-visit sessions" message="Published summaries will appear here after doctor signoff." />
          ) : null}
        </Card>

        {selectedSession ? (
          <Card>
            <PatientSectionHeader
              title="Session Summary"
              subtitle={`${getSessionLabel(selectedSession)} · ${formatStatusLabel(selectedSession.status || 'published')}`}
            />

            {summaryQuery.isLoading ? (
              <StatePanel state="loading" title="Loading summary" message="Fetching approved patient-safe summary..." />
            ) : null}

            {summaryQuery.isError ? (
              <StatePanel state="error" title="Summary unavailable" message="Could not load summary for this session." />
            ) : (
              <Text style={styles.summaryText}>{summaryText}</Text>
            )}

            {recordingUrl ? (
              <Text style={styles.recordingText}>Recording URL available for playback: {recordingUrl}</Text>
            ) : (
              <Text style={styles.recordingText}>Recording URL not available for this session.</Text>
            )}

            {labTrends.length > 0 ? (
              <>
                <PatientSectionHeader title="Lab Trends" subtitle={`${labTrends.length} tracked markers`} />
                {labTrends.slice(0, 4).map((trend, index) => (
                  <View key={String(trend.key || trend.name || `trend-${index}`)} style={styles.miniCard}>
                    <Text style={styles.titleText}>{String(trend.name || trend.key || `Trend ${index + 1}`)}</Text>
                    <Text style={styles.subText}>
                      Latest: {String(trend.latest ?? 'n/a')} {String(trend.unit || '')}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            <PatientSectionHeader title="Ask About This Summary" subtitle="Grounded Q&A from published session context" />
            <TextInput
              value={sectionType}
              onChangeText={setSectionType}
              style={styles.input}
              placeholder="Section type (summary, medications, warnings)"
              placeholderTextColor={theme.colors.textMuted}
            />
            <TextInput
              value={question}
              onChangeText={setQuestion}
              style={[styles.input, styles.textarea]}
              placeholder="Ask a follow-up question"
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />
            <Pressable
              disabled={askSection.isPending || !question.trim()}
              style={[styles.primaryButton, (askSection.isPending || !question.trim()) && styles.disabled]}
              onPress={submitSectionQuestion}
            >
              <Text style={styles.primaryButtonText}>{askSection.isPending ? 'Asking...' : 'Ask Companion'}</Text>
            </Pressable>

            {latestAnswer ? (
              <StatePanel state="empty" title="Companion answer" message={latestAnswer} />
            ) : null}

            <PatientSectionHeader title="Companion Chat" subtitle={`${companionMessages.length} message(s)`} />
            {messagesQuery.isLoading ? (
              <StatePanel state="loading" title="Loading chat" message="Syncing companion messages..." />
            ) : null}

            {companionMessages.slice(-8).map((message) => (
              <View key={message.id} style={styles.chatCard}>
                <View style={styles.rowTop}>
                  <PatientStatusPill
                    label={formatStatusLabel(String(message.message_type || message.role || 'message'))}
                    tone={String(message.role || '').toLowerCase().includes('patient') ? 'info' : 'success'}
                  />
                  <Text style={styles.metaText}>{formatRelative(message.created_at || null)}</Text>
                </View>
                <Text style={styles.subText}>{String(message.message || 'No text body')}</Text>
              </View>
            ))}

            {!messagesQuery.isLoading && companionMessages.length === 0 ? (
              <StatePanel state="empty" title="No chat history" message="Start by asking a follow-up question." />
            ) : null}

            <TextInput
              value={messageDraft}
              onChangeText={setMessageDraft}
              style={[styles.input, styles.textarea]}
              placeholder="Send a companion message"
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />
            <Pressable
              disabled={sendMessage.isPending || !messageDraft.trim()}
              style={[styles.secondaryButton, (sendMessage.isPending || !messageDraft.trim()) && styles.disabled]}
              onPress={submitMessage}
            >
              <Text style={styles.secondaryButtonText}>{sendMessage.isPending ? 'Sending...' : 'Send Message'}</Text>
            </Pressable>

            <PatientSectionHeader
              title="Acknowledge Plan"
              subtitle="Record understanding events for your care continuity"
            />
            <View style={styles.ackGrid}>
              {[
                { key: 'teach_back', label: 'Teach Back' },
                { key: 'medication_adherence', label: 'Medication' },
                { key: 'follow_up_commitment', label: 'Follow Up' },
                { key: 'warning_sign_understanding', label: 'Warning Signs' }
              ].map((ack) => (
                <Pressable
                  key={ack.key}
                  disabled={acknowledge.isPending}
                  style={[styles.ackButton, acknowledge.isPending && styles.disabled]}
                  onPress={() =>
                    submitAcknowledgement(
                      ack.key as
                        | 'teach_back'
                        | 'medication_adherence'
                        | 'follow_up_commitment'
                        | 'warning_sign_understanding'
                    )
                  }
                >
                  <Text style={styles.ackText}>{ack.label}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}

        {(askSection.isError || sendMessage.isError || acknowledge.isError) && (
          <StatePanel
            state="error"
            title="Companion action failed"
            message="One or more actions failed. Retry after refreshing this session."
          />
        )}

        {!selectedSessionId && sessions.length > 0 ? (
          <StatePanel state="empty" title="Select a session" message="Open a published session to continue." />
        ) : null}

        {patientApiUtils.toNumber(summaryQuery.data?.pendingChecklistCount) > 0 ? (
          <StatePanel
            state="empty"
            title="Checklist pending"
            message={`You still have ${patientApiUtils.toNumber(summaryQuery.data?.pendingChecklistCount)} pending checklist item(s).`}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl
  },
  sessionCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 4
  },
  sessionCardActive: {
    borderColor: theme.colors.accentPurple,
    shadowColor: theme.colors.accentPurple,
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  titleText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700'
  },
  subText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16
  },
  summaryText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: theme.spacing.sm
  },
  recordingText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginBottom: theme.spacing.sm
  },
  miniCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 4
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 13,
    marginBottom: theme.spacing.sm
  },
  textarea: {
    minHeight: 76,
    textAlignVertical: 'top'
  },
  primaryButton: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentPurple,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  primaryButtonText: {
    color: '#F3EEFF',
    fontSize: 13,
    fontWeight: '700'
  },
  secondaryButton: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  secondaryButtonText: {
    color: '#EEF4FF',
    fontSize: 13,
    fontWeight: '700'
  },
  chatCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 4
  },
  ackGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  ackButton: {
    minWidth: 126,
    flexGrow: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  ackText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600'
  },
  disabled: {
    opacity: 0.5
  }
});
