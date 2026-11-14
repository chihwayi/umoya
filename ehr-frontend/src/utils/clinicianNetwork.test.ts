// S287 — error-shape helpers: Nest may serialize the PHI BadRequestException
// payload as the body itself or nested under `message`; the composer must
// highlight the right field in both cases.
import { cnErrorMessage, extractPhiError } from './clinicianNetwork';

function phiAxiosError(body: unknown) {
  return { response: { data: body } };
}

describe('clinicianNetwork error helpers', () => {
  it('extracts field + span from a flat PHI rejection body', () => {
    const err = extractPhiError(
      phiAxiosError({
        message: 'Field X was not posted.',
        field: 'presentingComplaint',
        matchedSpan: 'John Mukamuri',
      }),
    );
    expect(err).toEqual({
      field: 'presentingComplaint',
      matchedSpan: 'John Mukamuri',
      message: 'Field X was not posted.',
    });
  });

  it('extracts field + span from a message-nested body', () => {
    const err = extractPhiError(
      phiAxiosError({
        statusCode: 400,
        message: { message: 'Field X was not posted.', field: 'title', matchedSpan: 'ABC12345' },
        error: 'Bad Request',
      }),
    );
    expect(err.field).toBe('title');
    expect(err.matchedSpan).toBe('ABC12345');
  });

  it('falls back cleanly when no field info is present', () => {
    const err = extractPhiError(phiAxiosError({ message: 'Panel not found.' }));
    expect(err).toEqual({ field: null, matchedSpan: null, message: 'Panel not found.' });
    expect(cnErrorMessage(phiAxiosError({ message: 'Panel not found.' }), 'fallback')).toBe(
      'Panel not found.',
    );
    expect(cnErrorMessage({ message: 'boom' }, 'fallback')).toBe('boom');
    expect(cnErrorMessage({}, 'fallback')).toBe('fallback');
  });
});
