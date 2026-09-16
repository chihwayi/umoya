import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from './tenant.service';

/**
 * active_staff_sessions gets a new row on every staff login and is never
 * pruned — over the life of a deployment it grows unboundedly (every
 * re-login, every 2FA intermediate token), which eventually degrades the
 * per-request session lookup JwtAuthGuard does on every authenticated
 * request, and the "list my sessions" query. Nightly job deletes sessions
 * whose expiry is well in the past; a 30-day retention window is generous
 * for any forensic/support need while keeping the table bounded.
 */
@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    @Optional() @Inject(TenantService) private readonly tenantService?: TenantService,
  ) {}

  @Cron(process.env.SESSION_CLEANUP_CRON || '0 2 * * *')
  async runNightlyCleanup(): Promise<void> {
    if (!this.tenantService) {
      this.logger.warn('SessionCleanupService: TenantService not injected, skipping');
      return;
    }

    let processed = 0;
    let totalDeleted = 0;

    try {
      const tenants = await this.tenantService.getAllActiveTenants();

      for (const tenant of tenants) {
        try {
          const tenantDb = await this.tenantService.getTenantDatabase(tenant.subdomain);
          if (!tenantDb) continue;

          const result = await tenantDb.query(
            `DELETE FROM active_staff_sessions WHERE expires_at < NOW() - INTERVAL '30 days'`,
          );
          const deleted = Array.isArray(result) ? result.length : (result?.rowCount ?? 0);
          totalDeleted += deleted;
          processed += 1;
        } catch (err: any) {
          this.logger.warn(`Session cleanup failed for tenant ${tenant.subdomain}: ${err?.message}`);
        }
      }

      this.logger.log(`Session cleanup complete: ${processed} tenants processed, ${totalDeleted} expired sessions removed`);
    } catch (err: any) {
      this.logger.error(`Session cleanup run failed: ${err?.message}`);
    }
  }
}
