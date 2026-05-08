import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import * as childProcess from 'child_process';
import { UploadSecurityService } from './upload-security.service';

jest.mock('child_process', () => ({
  spawnSync: jest.fn(),
}));

describe('UploadSecurityService', () => {
  const ENV_KEYS = [
    'EHR_MALWARE_SCAN_ENABLED',
    'EHR_MALWARE_SCAN_COMMAND',
    'EHR_MALWARE_SCAN_ARGS',
    'EHR_MALWARE_SCAN_TIMEOUT_MS',
    'EHR_MALWARE_SCAN_FAIL_CLOSED',
    'EHR_MALWARE_SCAN_INFECTED_EXIT_CODES',
  ] as const;
  const envSnapshot: Record<string, string | undefined> = {};

  const sampleFile = {
    buffer: Buffer.from('sample'),
    originalname: 'upload.wav',
    mimetype: 'audio/wav',
  } as any;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      envSnapshot[key] = process.env[key];
      delete process.env[key];
    }
    jest.restoreAllMocks();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const original = envSnapshot[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
    jest.restoreAllMocks();
  });

  it('skips scanner when disabled', async () => {
    const spy = childProcess.spawnSync as jest.Mock;
    const service = new UploadSecurityService();
    await service.assertCleanUpload(sampleFile, 'audio');
    expect(spy).not.toHaveBeenCalled();
  });

  it('blocks infected uploads', async () => {
    process.env.EHR_MALWARE_SCAN_ENABLED = 'true';
    (childProcess.spawnSync as jest.Mock).mockReturnValue({
      status: 1,
      stderr: 'FOUND',
      error: undefined,
    } as any);
    const service = new UploadSecurityService();
    await expect(service.assertCleanUpload(sampleFile, 'audio')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks scanner failures when fail-closed', async () => {
    process.env.EHR_MALWARE_SCAN_ENABLED = 'true';
    process.env.EHR_MALWARE_SCAN_FAIL_CLOSED = 'true';
    (childProcess.spawnSync as jest.Mock).mockReturnValue({
      status: 2,
      stderr: 'scanner down',
      error: undefined,
    } as any);
    const service = new UploadSecurityService();
    await expect(service.assertCleanUpload(sampleFile, 'audio')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('allows scanner failures when fail-open is enabled', async () => {
    process.env.EHR_MALWARE_SCAN_ENABLED = 'true';
    process.env.EHR_MALWARE_SCAN_FAIL_CLOSED = 'false';
    (childProcess.spawnSync as jest.Mock).mockReturnValue({
      status: 2,
      stderr: 'scanner down',
      error: undefined,
    } as any);
    const service = new UploadSecurityService();
    await expect(service.assertCleanUpload(sampleFile, 'audio')).resolves.toBeUndefined();
  });
});
