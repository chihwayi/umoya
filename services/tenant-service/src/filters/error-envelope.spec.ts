import { SentryFilter } from './sentry.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

describe('SentryFilter (contract)', () => {
  const makeHost = (rid = 'tenant-rid') => {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };
    const req: any = {
      url: '/__test__',
      method: 'GET',
      headers: { 'x-request-id': rid },
      requestId: rid,
    };
    const host: any = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => req,
      }),
    };
    return { res, req, host: host as unknown as ArgumentsHost };
  };

  it('wraps HttpException into standard envelope and sets X-Request-ID', () => {
    const filter = new SentryFilter();
    const { res, host } = makeHost('rid-aaa');
    const httpExc = new HttpException({ code: 'FORBIDDEN', message: 'Nope' }, HttpStatus.FORBIDDEN);
    filter.catch(httpExc, host);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'rid-aaa');
    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(payload).toHaveProperty('code', 'FORBIDDEN');
    expect(payload).toHaveProperty('message', 'Nope');
    expect(payload).toHaveProperty('requestId', 'rid-aaa');
    expect(payload).toHaveProperty('timestamp');
  });

  it('wraps generic Error into internal envelope and sets X-Request-ID', () => {
    const filter = new SentryFilter();
    const { res, host } = makeHost('rid-bbb');
    const err = new Error('Kaboom');
    filter.catch(err as any, host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'rid-bbb');
    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(payload).toHaveProperty('code', 'INTERNAL_ERROR');
    expect(payload).toHaveProperty('message', 'Kaboom');
    expect(payload).toHaveProperty('requestId', 'rid-bbb');
    expect(payload).toHaveProperty('timestamp');
  });
});
