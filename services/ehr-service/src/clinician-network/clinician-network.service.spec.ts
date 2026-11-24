// S286 — service-layer enforcement spec. PHI checks run with mocked
// dependencies (no DB, no embedding model); the live adversarial + duplicate
// verification is done manually against real services (see PR description).
import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
    // AllExceptionsFilter only forwards code/message/details — the composer
    // highlight depends on this channel, not the top-level keys.
    expect(payload.code).toBe('PHI_REJECTED');
    expect(payload.details).toMatchObject({
      field: 'presentingComplaint',
      matchedSpan: expect.stringContaining('John Mukamuri'),
    });
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

// S287 — anonymized views: isOwnPost computed server-side, raw
// author_clinician_id never present in returned objects.
function makeAnonService(viewerId: string | null = 'clinician-1', identityId = 'clinician-1') {
  const queries: Array<{ sql: string; params: any[] }> = [];
  const masterDbService = {
    query: jest.fn(async (sql: string, params?: any[]) => {
      queries.push({ sql, params: params ?? [] });
      if (sql.includes('FROM clinician_network.panels p')) {
        return [
          {
            id: 'panel-1',
            name: 'General Practice',
            specialty: 'General Practice',
            description: 'd',
            visibility: 'open',
            member_count: 3,
            topic_count: 2,
            is_joined: true,
          },
        ];
      }
      if (sql.includes('FROM clinician_network.panels WHERE id')) {
        return [{ id: 'panel-1', visibility: 'invite', invite_token: 'tok-1' }];
      }
      if (sql.includes('FROM clinician_network.topics t') && sql.includes('GROUP BY')) {
        return [
          {
            id: 'topic-1',
            panel_id: 'panel-1',
            title: 't1',
            body_redacted: 'b1',
            structured_fields: {},
            tags: [],
            status: 'open',
            resolved_reply_id: null,
            created_at: '2026-01-01',
            author_handle: 'CalmDoctor123',
            reply_count: 2,
            is_own_post: true,
          },
          {
            id: 'topic-2',
            panel_id: 'panel-1',
            title: 't2',
            body_redacted: 'b2',
            structured_fields: {},
            tags: [],
            status: 'open',
            resolved_reply_id: null,
            created_at: '2026-01-02',
            author_handle: 'WiseDoctor456',
            reply_count: 0,
            is_own_post: false,
          },
        ];
      }
      if (sql.includes('FROM clinician_network.topics t') && sql.includes('WHERE t.id = $1')) {
        return [
          {
            id: 'topic-1',
            panel_id: 'panel-1',
            title: 't1',
            body_redacted: 'b1',
            structured_fields: {},
            tags: [],
            status: 'open',
            resolved_reply_id: null,
            created_at: '2026-01-01',
            author_handle: 'CalmDoctor123',
            reply_count: 2,
            is_own_post: true,
          },
        ];
      }
      if (sql.includes('SELECT id, author_clinician_id FROM clinician_network.topics')) {
        return [{ id: 'topic-1', author_clinician_id: 'clinician-1' }];
      }
      if (sql.includes('FROM clinician_network.topics WHERE id')) {
        return [{ id: 'topic-1' }];
      }
      if (sql.includes('FROM clinician_network.replies r')) {
        return [
          {
            id: 'reply-1',
            topic_id: 'topic-1',
            parent_reply_id: null,
            body_redacted: 'b',
            created_at: '2026-01-01',
            author_handle: 'WiseDoctor456',
            is_own_post: false,
          },
        ];
      }
      if (sql.includes('SELECT display_handle FROM clinician_network.clinicians')) {
        return [{ display_handle: 'CalmDoctor123' }];
      }
      return [];
    }),
  };
  const clinicianIdentityService = {
    resolveOrCreateClinicianIdentity: jest.fn(async () => ({ clinicianId: identityId, isNew: false })),
    findClinicianIdForUser: jest.fn(async () => viewerId),
  };
  const service = new ClinicianNetworkService(
    clinicianIdentityService as any,
    masterDbService as any,
    { getEmbedding: jest.fn(async () => [0.1]) } as any,
  );
  return { service, masterDbService, queries };
}

describe('ClinicianNetworkService anonymized views (S287)', () => {
  it('listTopics computes isOwnPost and never exposes author_clinician_id', async () => {
    const { service } = makeAnonService();
    const topics = await service.listTopics('panel-1', 'clinician-1', 'recent');
    expect(topics).toHaveLength(2);
    expect(topics[0]).toMatchObject({ isOwnPost: true, authorHandle: 'CalmDoctor123' });
    expect(topics[1]).toMatchObject({ isOwnPost: false, authorHandle: 'WiseDoctor456' });
    for (const topic of topics) {
      expect(topic).not.toHaveProperty('author_clinician_id');
      expect(topic).not.toHaveProperty('authorClinicianId');
    }
    expect(JSON.stringify(topics)).not.toContain('clinician');
  });

  it('listReplies computes isOwnPost and never exposes author_clinician_id', async () => {
    const { service } = makeAnonService('clinician-1');
    const replies = await service.listReplies('topic-1', 'clinician-1');
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ isOwnPost: false, authorHandle: 'WiseDoctor456' });
    expect(replies[0]).not.toHaveProperty('author_clinician_id');
    expect(JSON.stringify(replies)).not.toContain('clinician-1');
  });

  it('listPanels reports membership without exposing member clinician_ids', async () => {
    const { service } = makeAnonService();
    const panels = await service.listPanels('clinician-1');
    expect(panels).toEqual([
      {
        id: 'panel-1',
        name: 'General Practice',
        specialty: 'General Practice',
        description: 'd',
        visibility: 'open',
        memberCount: 3,
        topicCount: 2,
        isJoined: true,
      },
    ]);
    expect(JSON.stringify(panels)).not.toContain('clinician');
  });

  it('joinPanel rejects an invite-only panel without a valid token', async () => {
    const { service } = makeAnonService();
    await expect(service.joinPanel({} as any, 'user-1', 'panel-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.joinPanel({} as any, 'user-1', 'panel-1', 'wrong'),
    ).rejects.toBeInstanceOf(BadRequestException);
    const ok = await service.joinPanel({} as any, 'user-1', 'panel-1', 'tok-1');
    expect(ok).toEqual({ joined: true });
  });

  it('resolveTopic rejects a non-author and resolves for the author', async () => {
    const { service } = makeAnonService();
    // Non-author: the topic mock is authored by clinician-1, so resolving as
    // clinician-9 must fail.
    const { service: foreignService } = makeAnonService('clinician-9', 'clinician-9');
    await expect(foreignService.resolveTopic({} as any, 'user-9', 'topic-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const resolved = await service.resolveTopic({} as any, 'user-1', 'topic-1', null);
    expect(resolved.status).toBe('open');
    expect(resolved).toMatchObject({ isOwnPost: true });
  });

  it('getMe returns clinicianId + displayHandle', async () => {
    const { service } = makeAnonService();
    await expect(service.getMe({} as any, 'user-1')).resolves.toEqual({
      clinicianId: 'clinician-1',
      displayHandle: 'CalmDoctor123',
    });
  });
});

// S288 — moderation, reporting & participation record.
function makeModService(opts?: {
  moderator?: boolean;
  linkUserId?: string | null;
  linkClinicianId?: string;
}) {
  const isModerator = opts?.moderator !== false;
  const masterQueries: string[] = [];
  const masterDbService = {
    query: jest.fn(async (sql: string) => {
      masterQueries.push(sql);
      if (sql.includes('SELECT is_moderator FROM clinician_network.clinicians')) {
        return [{ is_moderator: isModerator }];
      }
      if (sql.includes('INSERT INTO clinician_network.reports')) {
        return [{ id: 'report-1', status: 'open' }];
      }
      if (sql.includes('FROM clinician_network.reports r')) {
        return [
          {
            id: 'report-1',
            topic_id: 'topic-1',
            reply_id: null,
            reason: 'Suspected PHI leak',
            status: 'open',
            created_at: '2026-01-02',
            topic_title: 't1',
            reply_excerpt: null,
            reporter_handle: 'KeenDoctor789',
          },
        ];
      }
      if (sql.includes('UPDATE clinician_network.reports SET status')) {
        return [{ id: 'report-1', status: 'dismissed' }];
      }
      if (sql.includes('SELECT author_clinician_id FROM clinician_network.topics')) {
        return [{ author_clinician_id: opts?.linkClinicianId ?? 'clinician-author' }];
      }
      if (sql.includes('FROM clinician_network.topics WHERE id')) {
        return [{ id: 'topic-1' }];
      }
      if (sql.includes('FROM clinician_network.replies WHERE id')) {
        return [{ id: 'reply-1' }];
      }
      if (sql.includes('FROM clinician_network.topics t') && sql.includes('WHERE t.author_clinician_id')) {
        return [
          {
            id: 'topic-1',
            panel_id: 'panel-1',
            title: 't1',
            body_redacted: 'b1',
            structured_fields: {},
            tags: [],
            status: 'open',
            resolved_reply_id: null,
            created_at: '2026-01-01',
            author_handle: 'CalmDoctor123',
            reply_count: 1,
          },
        ];
      }
      if (sql.includes('FROM clinician_network.replies r') && sql.includes('WHERE r.author_clinician_id')) {
        return [
          {
            id: 'reply-1',
            topic_id: 'topic-1',
            parent_reply_id: null,
            body_redacted: 'b',
            created_at: '2026-01-01',
            author_handle: 'CalmDoctor123',
            topic_title: 't1',
          },
        ];
      }
      return [];
    }),
  };
  const tenantDb = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('FROM clinician_network_identity_links')) {
        return opts?.linkUserId === null || opts?.linkUserId === undefined
          ? []
          : [{ user_id: opts.linkUserId ?? 'user-author' }];
      }
      if (sql.includes('FROM users WHERE id')) {
        return [{ id: 'user-author', first_name: 'Amina', last_name: 'Dube', email: 'amina@example.org' }];
      }
      return [];
    }),
  };
  const clinicianIdentityService = {
    resolveOrCreateClinicianIdentity: jest.fn(async () => ({
      clinicianId: 'clinician-mod',
      isNew: false,
    })),
  };
  const service = new ClinicianNetworkService(
    clinicianIdentityService as any,
    masterDbService as any,
    { getEmbedding: jest.fn(async () => [0.1]) } as any,
  );
  return { service, masterDbService, tenantDb, masterQueries };
}

describe('ClinicianNetworkService moderation (S288)', () => {
  it('reportTopic files a report and rejects an empty reason', async () => {
    const { service, masterDbService } = makeModService();
    await expect(service.reportTopic({} as any, 'user-1', 'topic-1', '  ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const res = await service.reportTopic({} as any, 'user-1', 'topic-1', 'Suspected PHI leak');
    expect(res).toEqual({ id: 'report-1', status: 'open' });
    expect(masterDbService.query).toHaveBeenCalled();
  });

  it('reportReply rejects an unknown reply', async () => {
    const { service, masterDbService } = makeModService();
    masterDbService.query.mockImplementationOnce(async () => []);
    // First call in reportReply is the reply-existence check.
    masterDbService.query.mockReset();
    masterDbService.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT is_moderator')) return [{ is_moderator: true }];
      return [];
    });
    await expect(
      service.reportReply({} as any, 'user-1', 'reply-missing', 'Off-topic'),
    ).rejects.toThrow('Reply not found');
  });

  it('listReports 403s for non-moderators and hides author identity for moderators', async () => {
    const { service } = makeModService({ moderator: false });
    await expect(service.listReports({} as any, 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const { service: modService, masterQueries } = makeModService({ moderator: true });
    const reports = await modService.listReports({} as any, 'user-1');
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ id: 'report-1', reason: 'Suspected PHI leak' });
    expect(JSON.stringify(reports)).not.toContain('author_clinician_id');
    const queueSql = masterQueries.find((sql) => sql.includes('FROM clinician_network.reports r'));
    expect(queueSql).toBeDefined();
    expect(queueSql).not.toContain('author_clinician_id');
  });

  it('resolveReport validates the action and requires moderation rights', async () => {
    const { service } = makeModService({ moderator: false });
    await expect(
      service.resolveReport({} as any, 'user-1', 'report-1', 'dismissed'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const { service: modService } = makeModService({ moderator: true });
    await expect(
      modService.resolveReport({} as any, 'user-1', 'report-1', 'delete'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      modService.resolveReport({} as any, 'user-1', 'report-1', 'dismissed'),
    ).resolves.toEqual({ id: 'report-1', status: 'dismissed' });
  });

  it('resolveAuthor returns the tenant user when linked, else a not-resolvable response', async () => {
    const noLinkSetup = makeModService({ moderator: true, linkUserId: null });
    await expect(
      noLinkSetup.service.resolveAuthor(noLinkSetup.tenantDb as any, 'user-mod', 'topic-1'),
    ).rejects.toThrow('not resolvable from this tenant');

    const { service, tenantDb } = makeModService({ moderator: true, linkUserId: 'user-author' });
    const resolved = await service.resolveAuthor(tenantDb as any, 'user-mod', 'topic-1');
    expect(resolved).toEqual({
      userId: 'user-author',
      name: 'Amina Dube',
      email: 'amina@example.org',
    });
    expect(JSON.stringify(resolved)).not.toContain('clinician-author');
    // The lookup never fans out beyond the caller's own tenant DB: exactly
    // the identity_links + users queries, no cross-tenant search.
    expect(tenantDb.query.mock.calls.length).toBe(2);
  });

  it('resolveAuthor 403s for non-moderators', async () => {
    const { service, tenantDb } = makeModService({ moderator: false });
    await expect(service.resolveAuthor(tenantDb as any, 'user-1', 'topic-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('getParticipation returns only the caller-owned content', async () => {
    const { service } = makeModService();
    const record = await service.getParticipation({} as any, 'user-1');
    expect(record.topics).toHaveLength(1);
    expect(record.replies).toHaveLength(1);
    expect(record.topics[0]).toMatchObject({ isOwnPost: true });
    expect(record.replies[0]).toMatchObject({ isOwnPost: true, topicTitle: 't1' });
    expect(JSON.stringify(record)).not.toContain('author_clinician_id');
  });
});
