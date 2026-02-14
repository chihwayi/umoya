import { Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Response, Request } from 'express';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class SentryFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    Sentry.captureException(exception);
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const rid = (req as any)?.requestId || req.headers['x-request-id'] || req.headers['X-Request-ID'] || null;
    const message = exception instanceof HttpException ? exception.getResponse() : exception instanceof Error ? exception.message : 'Internal server error';
    res.setHeader('X-Request-ID', typeof rid === 'string' ? rid : String(rid || ''));
    res.status(status).json({
      code: exception instanceof HttpException ? (exception.getResponse() as any)?.code || 'HTTP_ERROR' : 'INTERNAL_ERROR',
      message: typeof message === 'string' ? message : (message as any)?.message || 'Internal server error',
      details: exception instanceof HttpException ? (exception.getResponse() as any)?.details || null : null,
      requestId: typeof rid === 'string' ? rid : null,
      timestamp: new Date().toISOString(),
    });
  }
}
