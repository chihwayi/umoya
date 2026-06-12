import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, of, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

/**
 * S225 — global idempotency for offline replays.
 *
 * When a POST/PATCH carries an `X-Client-Op-Id` header (set by the mobile
 * offline queue on every replay), the first successful execution stores its
 * response in the tenant's idempotency_keys table; a retry of the same op id
 * returns the stored response without re-executing the mutation. Requests
 * without the header are untouched.
 *
 * Known v1 bounds (deliberate): the route's default status code is used on
 * replay, and two *concurrent* first-attempts can both execute (the unique
 * index keeps a single stored response) — load-shedding replays are
 * sequential retries, which this fully covers.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  async interceptAsync(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const opId = request?.headers?.['x-client-op-id'];
    const method = request?.method;
    const tenantDb = request?.tenantDb;

    if (!opId || !tenantDb || (method !== 'POST' && method !== 'PATCH')) {
      return next.handle();
    }

    const key = String(opId).slice(0, 80);
    try {
      const [existing] = await tenantDb.query(
        `SELECT response FROM idempotency_keys WHERE op_id = $1 LIMIT 1`,
        [key],
      );
      if (existing) {
        this.logger.debug(`Idempotent replay served for op ${key} (${method} ${request.url})`);
        return of(existing.response);
      }
    } catch {
      // Table not provisioned on this tenant yet — behave as before.
      return next.handle();
    }

    return next.handle().pipe(
      mergeMap((body) =>
        from(
          tenantDb
            .query(
              `INSERT INTO idempotency_keys (op_id, method, path, response)
               VALUES ($1, $2, $3, $4::jsonb)
               ON CONFLICT DO NOTHING`,
              [key, method, request.originalUrl || request.url, JSON.stringify(body ?? null)],
            )
            .then(() => body)
            .catch(() => body),
        ),
      ),
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return from(this.interceptAsync(context, next)).pipe(mergeMap((observable) => observable));
  }
}
