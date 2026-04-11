import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { TenantService } from './tenant.service';
import { MflFacility } from '../entities/mfl-facility.entity';

@Injectable()
export class MflService {
  private readonly mflUrl = String(process.env.KENYA_MFL_API_URL || '').trim();

  constructor(private readonly tenantService: TenantService) {}

  async syncFacilities(tenantId: string): Promise<{ synced: number; errors: number }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(MflFacility);

    let nextUrl: string | null = this.mflUrl;
    let synced = 0;
    let errors = 0;
    let pageGuard = 0;

    try {
      while (nextUrl && pageGuard < 50) {
        pageGuard += 1;
        const { data } = await axios.get(nextUrl, {
          headers: { Accept: 'application/json' },
          timeout: 15000,
        });

        const rows = this.extractFacilityRows(data);
        const payloads = rows
          .map((row) => this.mapFacilityRow(row))
          .filter((row): row is Partial<MflFacility> => Boolean(row?.mflCode && row?.facilityName));

        if (payloads.length) {
          await repo.upsert(payloads, ['mflCode']);
          synced += payloads.length;
        }

        errors += Math.max(rows.length - payloads.length, 0);
        nextUrl = this.extractNextUrl(data);
      }

      return { synced, errors };
    } catch (error: any) {
      const networkCode = error?.code || '';
      const responseStatus = error?.response?.status;
      if (!responseStatus || ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'].includes(networkCode)) {
        return { synced: 0, errors: 0 };
      }
      return { synced, errors };
    }
  }

  async getFacilities(
    tenantId: string,
    filters: { county?: string; facilityType?: string; search?: string; page: number; limit: number },
  ): Promise<{ data: MflFacility[]; total: number; page: number; limit: number }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(MflFacility).createQueryBuilder('facility').orderBy('facility.updated_at', 'DESC');

    if (filters.county) {
      qb.andWhere('LOWER(facility.county) = LOWER(:county)', { county: filters.county });
    }
    if (filters.facilityType) {
      qb.andWhere('LOWER(facility.facility_type) = LOWER(:facilityType)', { facilityType: filters.facilityType });
    }
    if (filters.search) {
      qb.andWhere(
        '(LOWER(facility.facility_name) LIKE LOWER(:search) OR LOWER(facility.mfl_code) LIKE LOWER(:search))',
        { search: `%${filters.search}%` },
      );
    }

    const total = await qb.getCount();
    const data = await qb.skip((filters.page - 1) * filters.limit).take(filters.limit).getMany();
    return { data, total, page: filters.page, limit: filters.limit };
  }

  async getFacilityByMflCode(tenantId: string, mflCode: string): Promise<MflFacility | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(MflFacility).findOne({ where: { mflCode } });
  }

  private extractFacilityRows(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.data?.results)) return data.data.results;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }

  private extractNextUrl(data: any): string | null {
    return data?.next || data?.data?.next || null;
  }

  private mapFacilityRow(row: any): Partial<MflFacility> | null {
    const mflCode = this.pickString(row, [
      'code',
      'mfl_code',
      'facility_code',
      'mflCode',
      'facilityCode',
    ]);
    const facilityName = this.pickString(row, [
      'name',
      'facility_name',
      'facilityName',
      'official_name',
    ]);

    if (!mflCode || !facilityName) {
      return null;
    }

    return {
      mflCode,
      facilityName,
      county: this.pickString(row, ['county', 'county_name']),
      subCounty: this.pickString(row, ['sub_county', 'sub_county_name', 'subCounty']),
      facilityType: this.pickString(row, ['facility_type', 'facility_type_name', 'facilityType']),
      ownership: this.pickString(row, ['ownership', 'owner', 'owner_name']),
      latitude: this.pickNumber(row, ['lat', 'latitude', 'y_coordinate']),
      longitude: this.pickNumber(row, ['lng', 'longitude', 'x_coordinate']),
      phone: this.pickString(row, ['phone', 'telephone', 'cell_phone']),
      email: this.pickString(row, ['email', 'facility_email']),
      isActive: this.pickBoolean(row, ['is_active', 'active', 'isActive'], true),
      lastSyncedAt: new Date(),
      rawData: row,
    };
  }

  private pickString(row: any, keys: string[]): string | null {
    for (const key of keys) {
      const value = row?.[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  private pickNumber(row: any, keys: string[]): number | null {
    for (const key of keys) {
      const raw = row?.[key];
      if (raw !== undefined && raw !== null && raw !== '') {
        const value = Number(raw);
        if (!Number.isNaN(value)) {
          return value;
        }
      }
    }
    return null;
  }

  private pickBoolean(row: any, keys: string[], fallback: boolean): boolean {
    for (const key of keys) {
      const value = row?.[key];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
      }
      if (typeof value === 'number') return value > 0;
    }
    return fallback;
  }
}
