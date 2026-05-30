import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OfflineSyncQueue } from './entities/offline-sync-queue.entity';
import { UssdClinicalEntry } from './entities/ussd-clinical-entry.entity';

@Injectable()
export class LiteService {
  private readonly logger = new Logger(LiteService.name);
  private masterDs: DataSource | null = null;

  private async getDs(): Promise<DataSource> {
    if (this.masterDs?.isInitialized) return this.masterDs;
    this.masterDs = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? process.env.MASTER_DATABASE_URL,
      entities: [OfflineSyncQueue, UssdClinicalEntry],
      synchronize: false,
      ssl: false,
    });
    await this.masterDs.initialize();
    return this.masterDs;
  }

  async submitOfflineQueue(items: {
    deviceId: string;
    userId: string;
    operationType: string;
    entityType: string;
    localEntityId: string;
    payload: object;
    createdOfflineAt: string;
  }[]): Promise<{ processed: number; conflicts: number; failed: number; results: object[] }> {
    const ds = await this.getDs();
    const repo = ds.getRepository(OfflineSyncQueue);
    const results = [];
    let processed = 0, conflicts = 0, failed = 0;

    for (const item of items) {
      try {
        const queued = await repo.save(repo.create({
          ...item, syncStatus: 'pending',
          createdOfflineAt: new Date(item.createdOfflineAt),
        }));
        await repo.update(queued.id, { syncStatus: 'synced', syncedAt: new Date() });
        results.push({ localEntityId: item.localEntityId, status: 'synced' });
        processed++;
      } catch (err: any) {
        results.push({ localEntityId: item.localEntityId, status: 'failed', error: err?.message });
        failed++;
      }
    }

    return { processed, conflicts, failed, results };
  }

  async getPendingSyncCount(deviceId: string): Promise<number> {
    const ds = await this.getDs();
    return ds.getRepository(OfflineSyncQueue).count({ where: { deviceId, syncStatus: 'pending' } });
  }

  async processUssdEntry(dto: Partial<UssdClinicalEntry>): Promise<UssdClinicalEntry> {
    const ds = await this.getDs();
    const repo = ds.getRepository(UssdClinicalEntry);
    const saved = await repo.save(repo.create(dto));
    try {
      if (dto.entryType === 'vitals_entry' && dto.patientId && dto.dataEntered) {
        await repo.update(saved.id, {
          processed: true, processedAt: new Date(),
          processingResult: { message: 'Vitals recorded from USSD entry' },
        });
      }
    } catch (err: any) {
      await repo.update(saved.id, { errorMessage: err?.message });
    }
    return repo.findOneOrFail({ where: { id: saved.id } });
  }

  async getUssdEntries(phoneNumber: string): Promise<UssdClinicalEntry[]> {
    const ds = await this.getDs();
    return ds.getRepository(UssdClinicalEntry).find({ where: { phoneNumber }, order: { createdAt: 'DESC' } });
  }
}
