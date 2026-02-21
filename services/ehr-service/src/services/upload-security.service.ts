import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadSecurityService {
  private readonly logger = new Logger(UploadSecurityService.name);

  private parseBool(raw: string | undefined, fallback: boolean): boolean {
    if (raw === undefined || raw === null || raw.trim() === '') {
      return fallback;
    }
    return ['1', 'true', 'yes', 'y', 'on'].includes(raw.trim().toLowerCase());
  }

  private parseIntSet(raw: string | undefined, fallback: Set<number>): Set<number> {
    if (!raw || raw.trim() === '') {
      return new Set(fallback);
    }
    const out = new Set<number>();
    for (const part of raw.split(',')) {
      const n = Number(part.trim());
      if (Number.isFinite(n)) {
        out.add(Math.trunc(n));
      }
    }
    return out.size > 0 ? out : new Set(fallback);
  }

  private splitArgs(raw: string | undefined): string[] {
    if (!raw || raw.trim() === '') {
      return [];
    }
    return raw
      .trim()
      .split(/\s+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  private async withTempFile(buffer: Buffer, originalName: string, fn: (filePath: string) => Promise<void>): Promise<void> {
    const suffix = path.extname(String(originalName || '').trim()) || '.bin';
    const tempPath = path.join(os.tmpdir(), `ehr_scan_${randomUUID()}${suffix}`);
    await fs.writeFile(tempPath, buffer);
    try {
      await fn(tempPath);
    } finally {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  }

  async assertCleanUpload(
    file: Pick<Express.Multer.File, 'buffer' | 'originalname' | 'mimetype'>,
    fileLabel: string,
  ): Promise<void> {
    const enabled = this.parseBool(process.env.EHR_MALWARE_SCAN_ENABLED, false);
    if (!enabled) {
      return;
    }

    if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException(`Invalid ${fileLabel} upload`);
    }

    const command = (process.env.EHR_MALWARE_SCAN_COMMAND || 'clamscan').trim();
    const args = this.splitArgs(process.env.EHR_MALWARE_SCAN_ARGS || '--no-summary');
    const timeoutMs = Math.max(1000, Number(process.env.EHR_MALWARE_SCAN_TIMEOUT_MS || 15000));
    const failClosed = this.parseBool(process.env.EHR_MALWARE_SCAN_FAIL_CLOSED, true);
    const infectedExitCodes = this.parseIntSet(process.env.EHR_MALWARE_SCAN_INFECTED_EXIT_CODES || '1', new Set([1]));

    await this.withTempFile(file.buffer, file.originalname || `${fileLabel}.bin`, async (tempPath) => {
      let status = -1;
      try {
        const result = spawnSync(command, [...args, tempPath], {
          encoding: 'utf8',
          timeout: timeoutMs,
        });
        if (result.error) {
          throw result.error;
        }
        status = typeof result.status === 'number' ? result.status : -1;
        if (infectedExitCodes.has(status)) {
          throw new BadRequestException(`Malware detected in uploaded ${fileLabel}`);
        }
        if (status !== 0 && failClosed) {
          const stderrText = String(result.stderr || '').trim();
          const suffix = stderrText ? `: ${stderrText.slice(0, 200)}` : '';
          throw new ServiceUnavailableException(`Malware scan failed for uploaded ${fileLabel}${suffix}`);
        }
      } catch (error: any) {
        if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) {
          throw error;
        }
        if (failClosed) {
          throw new ServiceUnavailableException(`Malware scanner unavailable for ${fileLabel}`);
        }
        this.logger.warn(`Malware scanner error (fail-open) for ${fileLabel}: ${error?.message || 'unknown error'}`);
      }

      if (status === 0) {
        this.logger.debug(`Malware scan passed for ${fileLabel}`);
      }
    });
  }
}
