import { MonthlyReportBundleService } from './monthly-report-bundle.service';
import { ReportExportService } from './report-export.service';

describe('MonthlyReportBundleService', () => {
  // Regression test for the DI/tenancy-model bug found 2026-09-04: the service
  // used to @InjectDataSource() a global DataSource that ehr-service never
  // provides (this codebase is database-per-tenant, not schema-per-tenant),
  // which crashed the entire app at Nest startup. Fixed to take tenantDb as a
  // method parameter, matching every other service in this codebase.
  it('generates a bundle using the per-request tenantDb, not a global DataSource', async () => {
    const exportSvc = {
      generatePdf: jest.fn(async () => Buffer.from('pdf')),
    } as unknown as ReportExportService;
    const service = new MonthlyReportBundleService(exportSvc);

    const tenantDb = {
      query: jest.fn(async () => []),
    } as any;

    const zip = await service.generateMonthlyBundle(tenantDb, 'demo-clinic', '2026-08');

    expect(zip).toBeInstanceOf(Buffer);
    expect(zip.length).toBeGreaterThan(0);
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM programme_indicators'),
      expect.any(Array),
    );
    expect(exportSvc.generatePdf).toHaveBeenCalledTimes(7);
  });
});
