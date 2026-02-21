import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from '../services/transcription.service';
import { UploadSecurityService } from '../services/upload-security.service';

describe('TranscriptionController', () => {
  let controller: TranscriptionController;

  const mockTranscriptionService = {
    transcribe: jest.fn(),
    formatTranscription: jest.fn(),
  };

  const mockUploadSecurityService = {
    assertCleanUpload: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TranscriptionController],
      providers: [
        {
          provide: TranscriptionService,
          useValue: mockTranscriptionService,
        },
        {
          provide: UploadSecurityService,
          useValue: mockUploadSecurityService,
        },
      ],
    }).compile();

    controller = module.get<TranscriptionController>(TranscriptionController);
    jest.clearAllMocks();
  });

  it('forwards tenant/auth context and returns the expected whisper contract', async () => {
    const file = {
      buffer: Buffer.from('fake-audio'),
      originalname: 'consultation.wav',
      mimetype: 'audio/wav',
    } as Express.Multer.File;

    mockUploadSecurityService.assertCleanUpload.mockResolvedValue(undefined);
    mockTranscriptionService.transcribe.mockResolvedValue({
      text: 'raw transcript',
      language: 'en',
      segments: [{ start: 0, end: 1.5, text: 'raw transcript' }],
      confidence: 0.92,
      soap_note: {
        subjective: 'fever',
        objective: 'tachycardia',
        assessment: 'suspected infection',
        plan: 'cbc and cultures',
      },
      audio_url: 'https://example.com/audio/1',
    });
    mockTranscriptionService.formatTranscription.mockReturnValue('Raw transcript');

    const req = {
      tenantId: 'tenant-a',
      headers: {
        authorization: 'Bearer user-jwt-token',
      },
    } as any;

    const result = await controller.transcribeWithWhisper(
      file,
      { language: 'sn', temperature: '0.2', prompt: 'clinical prompt' },
      req,
    );

    expect(mockUploadSecurityService.assertCleanUpload).toHaveBeenCalledWith(file, 'audio');
    expect(mockTranscriptionService.transcribe).toHaveBeenCalledWith(
      file,
      {
        language: 'sn',
        temperature: 0.2,
        prompt: 'clinical prompt',
      },
      {
        tenantId: 'tenant-a',
        authorization: 'Bearer user-jwt-token',
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        transcription: expect.objectContaining({
          text: 'Raw transcript',
          language: 'en',
          language_probability: 0.92,
          segments: [{ start: 0, end: 1.5, text: 'raw transcript' }],
        }),
        text: 'Raw transcript',
        rawText: 'raw transcript',
        language: 'en',
        confidence: 0.92,
      }),
    );
  });

  it('rejects requests without audio file', async () => {
    await expect(
      controller.transcribeWithWhisper(undefined as any, {}, { tenantId: 'tenant-a', headers: {} } as any),
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      controller.transcribeWithWhisper(undefined as any, {}, { tenantId: 'tenant-a', headers: {} } as any),
    ).rejects.toThrow('Audio file is required');
  });
});
