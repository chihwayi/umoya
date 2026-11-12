// S286 — service-layer enforcement spec. PHI checks run with mocked
// dependencies (no DB, no embedding model); the live adversarial + duplicate
// verification is done manually against real services (see PR description).
import { BadRequestException } from '@nestjs/common';
import { ClinicianNetworkService } from './clinician-network.service';
import { CreateTopicDto } from './dto/create-topic.dto';

function makeService(deps?: {
  clinicianId?: string;
  similar?: Array<{ id: string; title: string; similarity: number }>;
  existingPanel?: boolean;
  embedding?: number[];
}) {
  const clinicianId = deps?.clinicianId ?? 'clinician-1';
  const masterQueries: Array<{ sql: string; params: any[] }> = [];
  const masterDbService = {
    query: jest.fn(async (sql: string, params?: any[]) => {
      masterQueries.push({ sql, params: params ?? [] });
      if (sql.includes('FROM clinician_network.panels')) {
        return deps?.existingPanel === false ? [] : [{ id: 'panel-1' }];
      }
      if (sql.includes('FROM clinician_network.topics') && sql.includes('SELECT id, title')) {
        return (deps?.similar ?? []).map((s) => ({ ...s }));
      }
      if (sql.includes('INSERT INTO clinician_network.topics')) {
        return [
          {
            id: 'topic-1',
            panel_id: 'panel-1',
            title: 't',
            body_redacted: 'b',
            structured_fields: {},
            tags: [],
            status: 'open',
            resolved_reply_id: null,
            created_at: '2026-01-01',
          },
        ];
      }
      if (sql.includes('INSERT INTO clinician_network.replies')) {
        return [
          {
            id: 'reply-1',
            topic_id: 'topic-1',
            parent_reply_id: null,
            body_redacted: 'b',
            created_at: '2026-01-01',
          },
        ];
      }
      if (sql.includes('FROM clinician_network.replies') && sql.includes('SELECT id')) {
        return [{ id: 'topic-1' }];
      }
      return [{ id: 'topic-1' }];
    }),
  };
  const clinicianIdentityService = {
    resolveOrCreateClinicianIdentity: jest.fn(async () => ({ clinicianId, isNew: false })),
  };
  const cdssService = {
    getEmbedding: jest.fn(async () => deps?.embedding ?? [0.1, 0.2, 0.3]),
  };
  const service = new ClinicianNetworkService(
    clinicianIdentityService as any,
    masterDbService as any,
    cdssService as any,
  );
  return { service, masterDbService, clinicianIdentityService, cdssService, masterQueries };
}

function cleanDto(): CreateTopicDto {
  return {
    panelId: 'panel-1',
    title: 'Recurrent fever in a school-age child',
    ageBand: '0-17',
    sex: 'female',
    presentingComplaint: 'Recurrent fever for three weeks without focal signs.',
    relevantHistory: 'Fully immunised. No recent travel.',
    question: 'What workup is recommended before referral?',
    tags: ['paediatrics'],
  };
}

describe('ClinicianNetworkService PHI enforcement', () => {
  it('rejects a labeled name with field + span, without touching the DB', async () => {
    const { service, masterDbService } = makeService();
    const dto = { ...cleanDto(), presentingComplaint: 'Patient name: John Mukamuri has fever.' };
    let error: any = null;
    try {
      await service.createTopic({} as any, 'user-1', dto);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(BadRequestException);
    const payload = (error as BadRequestException).getResponse() as any;
    expect(payload.field).toBe('presentingComplaint');
    expect(payload.matchedSpan).toContain('John Mukamuri');
    expect(masterDbService.query).not.toHaveBeenCalled();
  });

  it('rejects a bare DOB via the additive bare-date layer', async () => {
    const { service } = makeService();
    const dto = { ...cleanDto(), relevantHistory: 'Born 12/03/1987, otherwise healthy.' };
    const promise = service.createTopic({} as any, 'user-1', dto);
    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    const payload = ((await promise.catch((e) => e)) as BadRequestException).getResponse() as any;
    expect(payload.field).toBe('relevantHistory');
    expect(payload.matchedSpan).toBe('12/03/1987');
  });

  it.each(['title', 'presentingComplaint', 'relevantHistory', 'question'] as const)(
    'rejects PHI in field %s',
    async (field) => {
      const { service } = makeService();
      const dto = { ...cleanDto(), [field]: 'Contact MRN: ABC12345 for records.' };
      await expect(service.createTopic({} as any, 'user-1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('rejects a bad age band and unknown panel', async () => {
    const { service } = makeService({ existingPanel: false });
    await expect(service.createTopic({} as any, 'user-1', { ...cleanDto(), ageBand: '34' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createTopic({} as any, 'user-1', cleanDto())).rejects.toThrow('Panel not found');
  });

  it('returns similar topics instead of creating when forcePost is false', async () => {
    const similar = [{ id: 'topic-9', title: 'Fever workup in children', similarity: 0.91 }];
    const { service, masterDbService } = makeService({ similar });
    const result = await service.createTopic({} as any, 'user-1', cleanDto());
    expect(result).toEqual({ created: false, similarTopics: similar });
    expect(
      masterDbService.query.mock.calls.some(([sql]: [string]) =>
        sql.includes('INSERT INTO clinician_network.topics'),
      ),
    ).toBe(false);
  });

  it('creates the topic when forcePost is true despite similar matches', async () => {
    const similar = [{ id: 'topic-9', title: 'Fever workup in children', similarity: 0.91 }];
    const { service } = makeService({ similar });
    const result = await service.createTopic({} as any, 'user-1', cleanDto(), true);
    expect(result.created).toBe(true);
    if (result.created) {
      expect(result.topic.id).toBe('topic-1');
    }
  });

  it('rejects PHI in a reply body', async () => {
    const { service, masterDbService } = makeService();
    await expect(
      service.createReply({} as any, 'user-1', { topicId: 'topic-1', body: 'DOB: 1985-07-11' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(masterDbService.query).not.toHaveBeenCalled();
  });
});
