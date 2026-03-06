import axios from 'axios';
import { TranscriptionService } from './transcription.service';

describe('TranscriptionService local whisper proxy forwarding', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forwards tenant and authorization headers to local whisper service', async () => {
    const service = new TranscriptionService();
    const axiosPostSpy = jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        transcription: {
          text: 'Patient reports chest pain',
          language: 'en',
          segments: [{ start: 0, end: 1.2, text: 'Patient reports chest pain' }],
          language_probability: 0.88,
        },
      },
    } as any);

    const file = {
      buffer: Buffer.from('fake-audio'),
      originalname: 'consultation.wav',
      mimetype: 'audio/wav',
    } as Express.Multer.File;

    const result = await (service as any).transcribeWithLocalWhisper(
      file,
      { language: 'en', temperature: 0, prompt: 'clinical prompt' },
      { tenantId: 'tenant-a', authorization: 'Bearer clinician-token' },
    );

    expect(axiosPostSpy).toHaveBeenCalledTimes(1);
    const call = axiosPostSpy.mock.calls[0];
    expect(call[0]).toContain('/inference');
    expect(call[2]?.timeout).toBe(300000);
    expect(call[2]?.headers?.['X-Tenant-ID']).toBe('tenant-a');
    expect(call[2]?.headers?.Authorization).toBe('Bearer clinician-token');
    expect(result).toEqual(
      expect.objectContaining({
        text: 'Patient reports chest pain',
        language: 'en',
        confidence: 0.88,
      }),
    );
  });

  it('auto-resolves base LOCAL_WHISPER_URL to whisper.cpp /inference endpoint', () => {
    const service = new TranscriptionService() as any;
    service.LOCAL_WHISPER_URL = 'http://127.0.0.1:8080';

    const resolved = service.resolveLocalWhisperUrl();
    expect(resolved).toBe('http://127.0.0.1:8080/inference');
  });
});
