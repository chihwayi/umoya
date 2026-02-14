import { AllExceptionsFilter } from './http-exception.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

describe('AllExceptionsFilter (contract)', () => {
  const makeHost = (rid = 'test-rid') => {
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
    const filter = new AllExceptionsFilter();
    const { res, host } = makeHost('rid-123');
    const httpExc = new HttpException({ code: 'BAD_REQUEST', message: 'Oops', details: { a: 1 } }, HttpStatus.BAD_REQUEST);
    filter.catch(httpExc, host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'rid-123');
    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(payload).toHaveProperty('code', 'BAD_REQUEST');
    expect(payload).toHaveProperty('message', 'Oops');
    expect(payload).toHaveProperty('requestId', 'rid-123');
    expect(payload).toHaveProperty('timestamp');
  });

  it('wraps generic Error into internal envelope and sets X-Request-ID', () => {
    const filter = new AllExceptionsFilter();
    const { res, host } = makeHost('rid-xyz');
    const err = new Error('Boom');
    filter.catch(err as any, host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'rid-xyz');
    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(payload).toHaveProperty('code', 'INTERNAL_ERROR');
    expect(payload).toHaveProperty('message', 'Boom');
    expect(payload).toHaveProperty('requestId', 'rid-xyz');
    expect(payload).toHaveProperty('timestamp');
  });
});
