import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TravelVaccineDestination } from '../entities/travel-vaccine-destination.entity';
import { Immunization } from '../entities/immunization.entity';
import { VaccinationCertificate } from '../entities/vaccination-certificate.entity';

function normalizeVaccineToken(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v.toLowerCase().trim();
  const name = (v.name ?? v.label ?? v.code ?? '').toString();
  return name.toLowerCase().trim();
}

@Injectable()
export class TravelVaccineService {
  async listDestinations(tenantDb: DataSource, search?: string) {
    const repo = tenantDb.getRepository(TravelVaccineDestination);
    const qb = repo.createQueryBuilder('d').select([
      'd.id',
      'd.countryName',
      'd.isoCode',
      'd.region',
      'd.lastUpdated',
    ]);

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.where('LOWER(d.countryName) LIKE :s OR LOWER(d.isoCode) LIKE :s', { s });
    }

    qb.orderBy('d.countryName', 'ASC').limit(250);
    return await qb.getMany();
  }

  async getDestinationRequirements(tenantDb: DataSource, countryCode: string) {
    if (!countryCode) throw new BadRequestException('countryCode is required');
    const repo = tenantDb.getRepository(TravelVaccineDestination);
    const dest = await repo.findOne({ where: { isoCode: countryCode.toUpperCase() } });
    if (!dest) throw new NotFoundException('Destination not found');
    return dest;
  }

  async assessPatientTravelReadiness(
    tenantDb: DataSource,
    patientId: string,
    destinations: string[],
  ) {
    if (!patientId) throw new BadRequestException('patientId is required');
    if (!Array.isArray(destinations) || destinations.length === 0)
      throw new BadRequestException('destinations[] is required');

    const destRepo = tenantDb.getRepository(TravelVaccineDestination);
    const immRepo = tenantDb.getRepository(Immunization);

    const isoCodes = [...new Set(destinations.map((d) => d.toUpperCase()))];
    const dests = await destRepo
      .createQueryBuilder('d')
      .where('d.isoCode IN (:...isoCodes)', { isoCodes })
      .getMany();

    const immunizations = await immRepo.find({
      where: { patientId },
      order: { administrationDate: 'DESC' as any },
      take: 500,
    });

    const patientTokens = new Set<string>();
    for (const imm of immunizations) {
      patientTokens.add(normalizeVaccineToken(imm.vaccineCode));
      patientTokens.add(normalizeVaccineToken(imm.vaccineName));
    }

    const destinationAssessments = dests.map((d) => {
      const required = Array.isArray(d.requiredVaccines) ? d.requiredVaccines : [];
      const recommended = Array.isArray(d.recommendedVaccines) ? d.recommendedVaccines : [];

      const requiredMissing = required.filter((v) => {
        const token = normalizeVaccineToken(v);
        return token && ![...patientTokens].some((t) => t.includes(token) || token.includes(t));
      });

      const recommendedMissing = recommended.filter((v) => {
        const token = normalizeVaccineToken(v);
        return token && ![...patientTokens].some((t) => t.includes(token) || token.includes(t));
      });

      return {
        isoCode: d.isoCode,
        countryName: d.countryName,
        requiredMissing,
        recommendedMissing,
        malariaProphylaxisZones: d.malariaProphylaxisZones ?? [],
        specialNotes: d.specialNotes ?? null,
      };
    });

    return {
      patientId,
      destinations: destinationAssessments,
      totals: {
        destinations: destinationAssessments.length,
        requiredGaps: destinationAssessments.reduce((acc, d) => acc + (d.requiredMissing?.length ?? 0), 0),
        recommendedGaps: destinationAssessments.reduce((acc, d) => acc + (d.recommendedMissing?.length ?? 0), 0),
      },
    };
  }

  async generateYellowCard(
    tenantDb: DataSource,
    patientId: string,
    issuedBy: string | null,
    body?: {
      issuingCenter?: string;
      immunizationIds?: string[];
    },
  ) {
    if (!patientId) throw new BadRequestException('patientId is required');

    const repo = tenantDb.getRepository(VaccinationCertificate);
    const certificateNumber = `YC-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    const cert = repo.create({
      patientId,
      certificateNumber,
      certificateType: 'yellow_card',
      issuedDate: new Date(),
      issuedBy: issuedBy ?? null,
      issuingCenter: body?.issuingCenter ?? null,
      immunizationIds: Array.isArray(body?.immunizationIds) ? body!.immunizationIds : [],
      pdfStorageKey: null,
      isValid: true,
    });

    const saved = await repo.save(cert);

    return {
      certificate: saved,
      pdf: null,
      note: 'PDF generation not yet implemented; certificate record created.',
    };
  }
}

