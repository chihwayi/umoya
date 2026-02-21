import { BadRequestException } from '@nestjs/common';
import { DocumentService } from './document.service';

describe('DocumentService', () => {
  const makeTenantDb = () => ({
    query: jest.fn(async (sql: string) => {
      if (sql.includes('INSERT INTO patient_documents')) {
        return [{ id: 'doc-1' }];
      }
      return [];
    }),
  });

  it('uses request tenant context for MinIO key generation', async () => {
    const minioService = {
      generateFileKey: jest.fn((tenantId: string, patientId: string, documentName: string) => (
        `${tenantId}/patients/${patientId}/documents/${documentName}`
      )),
      uploadFile: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new DocumentService(minioService);
    const tenantDb = makeTenantDb() as any;

    await service.uploadDocument(
      'patient-1',
      {
        documentType: 'lab',
        documentName: 'report.pdf',
        mimeType: 'application/pdf',
      },
      'user-1',
      tenantDb,
      Buffer.from('file'),
      'Tenant-A',
    );

    expect(minioService.generateFileKey).toHaveBeenCalledWith('tenant-a', 'patient-1', 'report.pdf');
    expect(minioService.uploadFile).toHaveBeenCalledTimes(1);
  });

  it('does not leak storage key between tenants', async () => {
    const minioService = {
      generateFileKey: jest.fn((tenantId: string, patientId: string, documentName: string) => (
        `${tenantId}/patients/${patientId}/documents/${documentName}`
      )),
      uploadFile: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new DocumentService(minioService);
    const tenantDb = makeTenantDb() as any;

    await service.uploadDocument(
      'patient-1',
      { documentType: 'lab', documentName: 'a.pdf', mimeType: 'application/pdf' },
      'user-1',
      tenantDb,
      Buffer.from('a'),
      'tenant-one',
    );
    await service.uploadDocument(
      'patient-1',
      { documentType: 'lab', documentName: 'b.pdf', mimeType: 'application/pdf' },
      'user-1',
      tenantDb,
      Buffer.from('b'),
      'tenant-two',
    );

    const firstTenant = minioService.generateFileKey.mock.calls[0][0];
    const secondTenant = minioService.generateFileKey.mock.calls[1][0];
    expect(firstTenant).toBe('tenant-one');
    expect(secondTenant).toBe('tenant-two');
    expect(firstTenant).not.toBe(secondTenant);
  });

  it('fails closed when tenant context is missing for file upload', async () => {
    const minioService = {
      generateFileKey: jest.fn(),
      uploadFile: jest.fn(),
    } as any;
    const service = new DocumentService(minioService);
    const tenantDb = makeTenantDb() as any;

    await expect(
      service.uploadDocument(
        'patient-1',
        { documentType: 'lab', documentName: 'report.pdf', mimeType: 'application/pdf' },
        'user-1',
        tenantDb,
        Buffer.from('file'),
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(minioService.generateFileKey).not.toHaveBeenCalled();
  });
});
