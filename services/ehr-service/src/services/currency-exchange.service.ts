import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SupportedCurrency } from '../entities/supported-currency.entity';
import { ExchangeRate } from '../entities/exchange-rate.entity';

@Injectable()
export class CurrencyExchangeService {
  async listCurrencies(tenantDb: DataSource) {
    return await tenantDb.getRepository(SupportedCurrency).find({ order: { code: 'ASC' as any } });
  }

  async upsertCurrency(
    tenantDb: DataSource,
    body: { code: string; name: string; symbol?: string | null; isActive?: boolean },
  ) {
    const code = (body?.code ?? '').trim().toUpperCase();
    if (!code) throw new BadRequestException('code is required');
    const name = (body?.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');

    const repo = tenantDb.getRepository(SupportedCurrency);
    const existing = await repo.findOne({ where: { code } });
    const row = repo.create({
      code,
      name,
      symbol: body?.symbol ?? (existing?.symbol ?? null),
      isActive: typeof body?.isActive === 'boolean' ? body.isActive : (existing?.isActive ?? true),
    });
    return await repo.save(row);
  }

  async listExchangeRates(
    tenantDb: DataSource,
    filters?: { baseCurrency?: string; quoteCurrency?: string; limit?: number },
  ) {
    const repo = tenantDb.getRepository(ExchangeRate);
    const qb = repo.createQueryBuilder('r');
    if (filters?.baseCurrency) qb.andWhere('r.baseCurrency = :b', { b: filters.baseCurrency.toUpperCase() });
    if (filters?.quoteCurrency) qb.andWhere('r.quoteCurrency = :q', { q: filters.quoteCurrency.toUpperCase() });
    qb.orderBy('r.effectiveAt', 'DESC').limit(Math.min(Math.max(filters?.limit ?? 100, 1), 500));
    return await qb.getMany();
  }

  async createExchangeRate(
    tenantDb: DataSource,
    createdBy: string | null,
    body: { baseCurrency: string; quoteCurrency: string; rate: number; effectiveAt?: string | Date; source?: string },
  ) {
    const baseCurrency = (body?.baseCurrency ?? '').trim().toUpperCase();
    const quoteCurrency = (body?.quoteCurrency ?? '').trim().toUpperCase();
    if (!baseCurrency) throw new BadRequestException('baseCurrency is required');
    if (!quoteCurrency) throw new BadRequestException('quoteCurrency is required');
    if (baseCurrency === quoteCurrency) throw new BadRequestException('baseCurrency and quoteCurrency must differ');
    const rate = Number(body?.rate);
    if (!Number.isFinite(rate) || rate <= 0) throw new BadRequestException('rate must be a positive number');

    const effectiveAt = body?.effectiveAt ? new Date(body.effectiveAt as any) : new Date();
    if (Number.isNaN(effectiveAt.getTime())) throw new BadRequestException('effectiveAt is invalid');

    const repo = tenantDb.getRepository(ExchangeRate);
    const row = repo.create({
      baseCurrency,
      quoteCurrency,
      rate,
      effectiveAt,
      source: (body?.source ?? 'manual').toString(),
      createdBy: createdBy ?? null,
    });
    return await repo.save(row);
  }
}

