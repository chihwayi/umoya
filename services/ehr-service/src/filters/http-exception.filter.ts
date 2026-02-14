import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException ? exception.getResponse() : exception instanceof Error ? exception.message : 'Internal server error';

    const errorDetails = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: typeof message === 'string' ? message : (message as any)?.message || message,
      error:
        exception instanceof Error
          ? {
              name: exception.name,
              message: exception.message,
              stack: exception.stack,
            }
          : exception,
    };

    Sentry.captureException(exception);

    const rid = (request as any)?.requestId || request.headers['x-request-id'] || request.headers['X-Request-ID'] || null;

    response.setHeader('X-Request-ID', typeof rid === 'string' ? rid : String(rid || ''));
    response.status(status).json({
      code: exception instanceof HttpException ? (exception.getResponse() as any)?.code || 'HTTP_ERROR' : 'INTERNAL_ERROR',
      message: typeof message === 'string' ? message : (message as any)?.message || 'Internal server error',
      details: exception instanceof HttpException ? (exception.getResponse() as any)?.details || null : null,
      requestId: typeof rid === 'string' ? rid : null,
      timestamp: new Date().toISOString(),
    });
  }
}

