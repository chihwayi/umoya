import { TranscriptionService } from './transcription.service';

describe('TranscriptionService local response contract', () => {
  it('accepts nested CDSS transcription contract', () => {
    const service = new TranscriptionService();
    const parsed = (service as any).parseLocalWhisperResponse(
      {
        transcription: {
          text: 'Patient reports fever',
          language: 'English',
          segments: [{ start: 0, end: 1.2, text: 'Patient reports fever' }],
          language_probability: 0.95,
        },
        soap_note: { subjective: 'fever', objective: '', assessment: '', plan: '', original_language_detected: 'Shona' },
        audio_url: 'https://example.com/audio.wav',
      },
      'en',
    );

    expect(parsed.text).toBe('Patient reports fever');
    expect(parsed.language).toBe('en');
    expect(parsed.segments).toEqual([{ start: 0, end: 1.2, text: 'Patient reports fever' }]);
    expect(parsed.confidence).toBe(0.95);
    expect(parsed.soap_note?.original_language_detected).toBe('sn');
  });

  it('normalizes Shona and Ndebele language variants', () => {
    const service = new TranscriptionService();
    const parsedShona = (service as any).parseLocalWhisperResponse(
      { text: 'Murwere ane kupisa muviri', language: 'Shona' },
      'auto',
    );
    const parsedNdebele = (service as any).parseLocalWhisperResponse(
      { text: 'Umguli ulomkhuhlane', language: 'Ndebele' },
      'auto',
    );
    expect(parsedShona.language).toBe('sn');
    expect(parsedNdebele.language).toBe('nd');
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

  it('rejects malformed soap_note contract', () => {
    const service = new TranscriptionService();
    expect(() =>
      (service as any).parseLocalWhisperResponse(
        {
          text: 'Patient reports fever',
          language: 'en',
          soap_note: 'invalid-soap',
        },
        'en',
      ),
    ).toThrow('Invalid transcription response contract: soap_note must be an object');
  });
});
