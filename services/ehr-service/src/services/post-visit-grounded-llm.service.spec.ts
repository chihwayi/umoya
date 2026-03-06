import axios from 'axios';
import { PostVisitGroundedLlmService } from './post-visit-grounded-llm.service';

jest.mock('axios');

describe('PostVisitGroundedLlmService', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns null when LLM key is not configured', async () => {
    delete process.env.POSTVISIT_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.WHISPER_API_KEY;

    const service = new PostVisitGroundedLlmService();
    const result = await service.answerPatientQuestion({
      sessionId: 'session-1',
      question: 'What should I do next?',
      summary: 'Follow up in one week',
      checklist: ['Repeat blood pressure check'],
      citations: [],
    });

    expect(result).toBeNull();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('accepts grounded patient answer when citation IDs are valid', async () => {
    process.env.POSTVISIT_LLM_API_KEY = 'test-key';
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                abstain: false,
                answer: 'Please follow your blood pressure follow-up in one week.',
                citations_used: ['cit-1'],
                urgent_signal: false,
              }),
            },
          },
        ],
      },
    } as any);

    const service = new PostVisitGroundedLlmService();
    const result = await service.answerPatientQuestion({
      sessionId: 'session-1',
      question: 'When is my follow-up?',
      summary: 'You need a one-week follow-up.',
      checklist: ['Repeat blood pressure check in one week'],
      citations: [{ id: 'cit-1', label: 'WHO follow-up guidance' }],
    });

    expect(result).toEqual(
      expect.objectContaining({
        abstained: false,
        citationsUsed: ['cit-1'],
      }),
    );
  });

  it('rejects patient answer when citation IDs are outside allow-list', async () => {
    process.env.POSTVISIT_LLM_API_KEY = 'test-key';
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                abstain: false,
                answer: 'Unsafe ungrounded answer',
                citations_used: ['unknown-citation'],
                urgent_signal: false,
              }),
            },
          },
        ],
      },
    } as any);

    const service = new PostVisitGroundedLlmService();
    const result = await service.answerPatientQuestion({
      sessionId: 'session-1',
      question: 'Can I skip medication?',
      summary: 'Do not skip medication.',
      checklist: ['Take medication daily'],
      citations: [{ id: 'cit-1', label: 'Medication adherence guidance' }],
    });

    expect(result).toBeNull();
  });
});
