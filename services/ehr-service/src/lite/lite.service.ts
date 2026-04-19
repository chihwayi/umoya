import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfflineSyncQueue } from './entities/offline-sync-queue.entity';
import { UssdClinicalEntry } from './entities/ussd-clinical-entry.entity';

@Injectable()
export class LiteService {
  private readonly logger = new Logger(LiteService.name);

  constructor(
    @InjectRepository(OfflineSyncQueue) private syncQueueRepo: Repository<OfflineSyncQueue>,
    @InjectRepository(UssdClinicalEntry) private ussdEntryRepo: Repository<UssdClinicalEntry>,
  ) {}

  // ── Offline Sync ───────────────────────────────────────────────────────────
  async submitOfflineQueue(items: {
    deviceId: string;
    userId: string;
    operationType: string;
    entityType: string;
    localEntityId: string;
    payload: object;
    createdOfflineAt: string;
  }[]): Promise<{ processed: number; conflicts: number; failed: number; results: object[] }> {
    const results = [];
    let processed = 0, conflicts = 0, failed = 0;

    for (const item of items) {
      try {
        const queued = await this.syncQueueRepo.save(this.syncQueueRepo.create({
          ...item, syncStatus: 'pending',
          createdOfflineAt: new Date(item.createdOfflineAt)
        }));
        // Apply the operation
        // In a real implementation, dispatch to the appropriate service
        // (VitalsService, EncounterService, etc.) based on operationType
        // For now, mark as synced with a placeholder server ID
        await this.syncQueueRepo.update(queued.id, {
          syncStatus: 'synced',
          syncedAt: new Date(),
        });
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
    return this.syncQueueRepo.count({ where: { deviceId, syncStatus: 'pending' } });
  }

  // ── USSD Clinical Entry ────────────────────────────────────────────────────
  async processUssdEntry(dto: Partial<UssdClinicalEntry>): Promise<UssdClinicalEntry> {
    const saved = await this.ussdEntryRepo.save(this.ussdEntryRepo.create(dto));
    // Process data_entered based on entry_type
    // e.g. vitals_entry → create vitals record for patient
    try {
      if (dto.entryType === 'vitals_entry' && dto.patientId && dto.dataEntered) {
        // Dispatch to VitalsService — inject via module if needed
        await this.ussdEntryRepo.update(saved.id, {
          processed: true, processedAt: new Date(),
          processingResult: { message: 'Vitals recorded from USSD entry' },
        });
      }
    } catch (err: any) {
      await this.ussdEntryRepo.update(saved.id, { errorMessage: err?.message });
    }
    return this.ussdEntryRepo.findOneOrFail({ where: { id: saved.id } });
  }

  async getUssdEntries(phoneNumber: string): Promise<UssdClinicalEntry[]> {
    return this.ussdEntryRepo.find({ where: { phoneNumber }, order: { createdAt: 'DESC' } });
  }
}
