import { SecurityHeadersMiddleware } from './security-headers.middleware';

describe('SecurityHeadersMiddleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('sets HSTS and frame headers', () => {
    const middleware = new SecurityHeadersMiddleware();
    const setHeader = jest.fn();
    const next = jest.fn();

    middleware.use({ headers: {}, url: '/api' } as any, { setHeader } as any, next);

    expect(setHeader).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    expect(setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(next).toHaveBeenCalled();
  });

  it('redirects HTTP to HTTPS in production', () => {
    process.env.NODE_ENV = 'production';
    const middleware = new SecurityHeadersMiddleware();
    const redirect = jest.fn();
    const next = jest.fn();

    middleware.use(
      { headers: { 'x-forwarded-proto': 'http', host: 'ehr.test' }, url: '/patients' } as any,
      { redirect } as any,
      next,
    );

    expect(redirect).toHaveBeenCalledWith(301, 'https://ehr.test/patients');
    expect(next).not.toHaveBeenCalled();
  });
});
