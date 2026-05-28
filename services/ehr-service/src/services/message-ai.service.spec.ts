import { MessageAiService } from './message-ai.service';

function makeService(cdss?: any) {
  return new MessageAiService(cdss ?? null);
}

function makeDb() {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO message_ai_enrichment'))
        return Promise.resolve([{ id: 'e1', urgency: 'routine' }]);
      if (sql.includes('UPDATE message_ai_enrichment')) return Promise.resolve([]);
      if (sql.includes('reply_draft FROM message_ai_enrichment'))
        return Promise.resolve([{ reply_draft: 'Your labs are fine.' }]);
      if (sql.includes('FROM messages WHERE id'))
        return Promise.resolve([{ thread_id: 't1', patient_id: 'p1' }]);
      if (sql.includes('INSERT INTO messages')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('MessageAiService', () => {
  it('enriches message using CDSS triageInboxItem', async () => {
    const cdss = {
      triageInboxItem: jest.fn().mockResolvedValue({
        priority: 'urgent',
        triage_score: 80,
        draft_reply: 'Please go to the ER immediately.',
        abstained: false,
      }),
    };
    const svc = makeService(cdss);
    const db = makeDb();
    await svc.enrichMessage('msg1', 'I have chest pain', 'p1', 'en', db);
    expect(cdss.triageInboxItem).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'I have chest pain' }),
    );
  });

  it('ruleBasedUrgency detects urgent keywords', () => {
    const svc = makeService(null) as any;
    expect(svc.ruleBasedUrgency('I have chest pain')).toBe('urgent');
    expect(svc.ruleBasedUrgency('Please cancel my appointment')).toBe('administrative');
    expect(svc.ruleBasedUrgency('How are my lab results?')).toBe('follow_up');
    expect(svc.ruleBasedUrgency('Just checking in')).toBe('routine');
  });

  it('falls back to rule-based when CDSS unavailable', async () => {
    const svc = makeService(null);
    const db = makeDb();
    const result = await svc.enrichMessage('msg2', 'I have chest pain urgent!', 'p1', 'en', db);
    expect(result).toBeDefined();
  });

  it('approveDraft sends message and marks draft as sent', async () => {
    const svc = makeService(null);
    const db = makeDb();
    const result = await svc.approveDraft('msg1', 'doc1', null, db);
    expect(result.replyContent).toBe('Your labs are fine.');
  });
});
