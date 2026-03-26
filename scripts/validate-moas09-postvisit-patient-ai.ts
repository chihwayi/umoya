import { PostVisitService } from '../services/ehr-service/src/services/post-visit.service';

type RepoRow = Record<string, any>;

function makeRepo(rows: RepoRow[], prefix: string) {
  return {
    create: (value: RepoRow) => value,
    save: async (value: RepoRow) => {
      const row = { id: value.id || `${prefix}-${rows.length + 1}`, ...value };
      const index = rows.findIndex((entry) => entry.id === row.id);
      if (index >= 0) {
        rows[index] = { ...rows[index], ...row };
        return rows[index];
      }
      rows.push(row);
      return row;
    },
    findOneBy: async ({ id }: { id: string }) => rows.find((entry) => entry.id === id) ?? null,
  };
}

async function main() {
  const patientAiSessionRows: RepoRow[] = [];
  const patientAiEscalationRows: RepoRow[] = [];
  const followupRows: RepoRow[] = [];
  const escalationMetadataWrites: RepoRow[] = [];

  const tenantDb = {
    query: async (sql: string, params: any[] = []) => {
      if (sql.includes('UPDATE post_visit_escalation_events') && sql.includes("SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb")) {
        escalationMetadataWrites.push({
          escalationId: params[0],
          metadata: JSON.parse(String(params[1] || '{}')),
        });
      }
      return [];
    },
    getRepository: (entity: any) => {
      switch (entity?.name) {
        case 'PatientAiSession':
          return makeRepo(patientAiSessionRows, 'patient-ai-session');
        case 'PatientAiEscalation':
          return makeRepo(patientAiEscalationRows, 'patient-ai-escalation');
        case 'PatientFollowupOrchestration':
          return makeRepo(followupRows, 'patient-followup');
        default:
          return null;
      }
    },
  };

  const service = new PostVisitService({} as any, {} as any);
  const created = await (service as any).createPostVisitPatientAiArtifacts(tenantDb as any, {
    sessionId: 'pv-session-1',
    threadId: 'thread-1',
    patientId: 'patient-1',
    patientMessageId: 'msg-patient-1',
    assistantMessageId: 'msg-assistant-1',
    messageText: 'I have chest pain and difficulty breathing.',
    assistantAnswer: {
      answer: 'Please seek emergency care now.',
      abstained: false,
      abstainReason: null,
      citationsUsed: ['cite-1'],
      model: 'gpt-4o-mini',
      source: 'llm',
    },
    detection: {
      detected: true,
      severity: 'critical',
      routeTarget: 'emergency',
      confidence: 0.97,
      temporality: 'current',
      classifierSource: 'hybrid_v2',
    },
    postVisitEscalationId: 'pv-escalation-1',
  });

  if (!created.patientAiSession?.id || !created.patientAiEscalation?.id || !created.followupOrchestration?.id) {
    throw new Error('Failed to create patient-ai orchestration artifacts from post-visit companion message');
  }

  await (service as any).syncResolvedPostVisitEscalationIntoPatientAi(
    tenantDb as any,
    {
      metadata: {
        patient_ai_session_id: created.patientAiSession.id,
        patient_ai_escalation_id: created.patientAiEscalation.id,
        patient_followup_orchestration_id: created.followupOrchestration.id,
      },
    },
    {
      status: 'resolved',
      resolutionNote: 'Patient contacted and stable.',
      actorUserId: 'doctor-1',
    },
  );

  if (patientAiEscalationRows[0]?.status !== 'resolved') {
    throw new Error('Patient-ai escalation did not sync to resolved');
  }
  if (followupRows[0]?.status !== 'completed') {
    throw new Error('Patient follow-up orchestration did not complete after escalation resolution');
  }
  if (patientAiSessionRows[0]?.status !== 'closed') {
    throw new Error('Patient-ai session did not close after escalation resolution');
  }
  if (escalationMetadataWrites.length !== 1) {
    throw new Error('Post-visit escalation metadata was not linked back to patient-ai artifacts');
  }

  console.log(JSON.stringify({
    ok: true,
    patientAiSessionId: created.patientAiSession.id,
    patientAiEscalationId: created.patientAiEscalation.id,
    patientFollowupOrchestrationId: created.followupOrchestration.id,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
