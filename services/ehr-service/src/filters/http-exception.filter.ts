import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
        ? exception.message
        : 'Internal server error';

    const errorDetails = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: typeof message === 'string' ? message : (message as any)?.message || message,
      error: exception instanceof Error ? {
        name: exception.name,
        message: exception.message,
        stack: exception.stack,
      } : exception,
    };

    // Log the full error
    console.error('🚨 [EXCEPTION FILTER] Caught exception:');
    
    // Send to Sentry
    Sentry.captureException(exception);

    console.error('🚨 [EXCEPTION FILTER] Status:', status);
    console.error('🚨 [EXCEPTION FILTER] Path:', request.url);
    console.error('🚨 [EXCEPTION FILTER] Method:', request.method);
    console.error('🚨 [EXCEPTION FILTER] Error:', errorDetails.error);
    console.error('🚨 [EXCEPTION FILTER] Full details:', JSON.stringify(errorDetails, null, 2));

    response.status(status).json({
      statusCode: status,
      message: typeof message === 'string' ? message : (message as any)?.message || 'Internal server error',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}


