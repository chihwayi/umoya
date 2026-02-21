import { TranscriptionService } from './transcription.service';

describe('TranscriptionService local response contract', () => {
  it('accepts nested CDSS transcription contract', () => {
    const service = new TranscriptionService();
    const parsed = (service as any).parseLocalWhisperResponse(
      {
        transcription: {
          text: 'Patient reports fever',
          language: 'en',
          segments: [{ start: 0, end: 1.2, text: 'Patient reports fever' }],
          language_probability: 0.95,
        },
        soap_note: { subjective: 'fever', objective: '', assessment: '', plan: '' },
        audio_url: 'https://example.com/audio.wav',
      },
      'en',
    );

    expect(parsed.text).toBe('Patient reports fever');
    expect(parsed.language).toBe('en');
    expect(parsed.segments).toEqual([{ start: 0, end: 1.2, text: 'Patient reports fever' }]);
    expect(parsed.confidence).toBe(0.95);
  });

  it('rejects malformed contract without transcription text', () => {
    const service = new TranscriptionService();
    expect(() =>
      (service as any).parseLocalWhisperResponse(
        {
          transcription: {
            language: 'en',
            segments: [],
          },
        },
        'en',
      ),
    ).toThrow('Invalid transcription response contract');
  });
});
