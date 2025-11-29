import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { MinimumNecessaryOptions } from '../guards/minimum-necessary.guard';

/**
 * Interceptor to filter response data based on Minimum Necessary rule
 * 
 * This interceptor works with MinimumNecessaryGuard to filter out
 * unnecessary PHI fields from responses.
 */
@Injectable()
export class MinimumNecessaryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const options = (request as any).minimumNecessaryOptions as MinimumNecessaryOptions | undefined;

    return next.handle().pipe(
      map((data) => {
        if (!options) {
          return data;
        }

        // Filter fields based on minimum necessary options
        if (options.fields || options.excludeFields) {
          return this.filterFields(data, options);
        }

        return data;
      }),
    );
  }

  private filterFields(data: any, options: MinimumNecessaryOptions): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.filterObjectFields(item, options));
    }

    if (data && typeof data === 'object') {
      // Handle paginated responses
      if (data.data && Array.isArray(data.data)) {
        return {
          ...data,
          data: data.data.map((item: any) => this.filterObjectFields(item, options)),
        };
      }

      return this.filterObjectFields(data, options);
    }

    return data;
  }

  private filterObjectFields(obj: any, options: MinimumNecessaryOptions): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const filtered: any = {};

    // If specific fields are allowed, only include those
    if (options.fields && options.fields.length > 0) {
      options.fields.forEach((field) => {
        if (obj.hasOwnProperty(field)) {
          filtered[field] = obj[field];
        }
      });
    } else {
      // Otherwise, include all fields except excluded ones
      Object.keys(obj).forEach((key) => {
        if (!options.excludeFields || !options.excludeFields.includes(key)) {
          filtered[key] = obj[key];
        }
      });
    }

    return filtered;
  }
}


