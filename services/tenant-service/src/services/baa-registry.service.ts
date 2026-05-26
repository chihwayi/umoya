import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaaRegistryEntry, BaaStatus } from '../entities/baa-registry.entity';

export interface BaaComplianceSummary {
  total: number;
  signed: number;
  pending: number;
  expired: number;
  notRequired: number;
}

@Injectable()
export class BaaRegistryService {
  constructor(
    @InjectRepository(BaaRegistryEntry)
    private readonly repo: Repository<BaaRegistryEntry>,
  ) {}

  findAll(): Promise<BaaRegistryEntry[]> {
    return this.repo.find({ order: { vendorType: 'ASC', vendorName: 'ASC' } });
  }

  findOne(id: string): Promise<BaaRegistryEntry | null> {
    return this.repo.findOneBy({ id });
  }

  create(dto: Partial<BaaRegistryEntry>): Promise<BaaRegistryEntry> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: Partial<BaaRegistryEntry>): Promise<BaaRegistryEntry> {
    await this.repo.update(id, dto);
    const entry = await this.repo.findOneBy({ id });
    if (!entry) {
      throw new NotFoundException('BAA registry entry not found');
    }
    return entry;
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async getComplianceSummary(): Promise<BaaComplianceSummary> {
    const entries = await this.repo.find();
    const count = (status: BaaStatus) => entries.filter((entry) => entry.baaStatus === status).length;
    return {
      total: entries.length,
      signed: count('signed'),
      pending: count('pending'),
      expired: count('expired'),
      notRequired: count('not_required'),
    };
  }
}
