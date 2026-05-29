import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { TenantService } from './tenant.service';
import { OpenmrsPatientLink } from '../entities/openmrs-patient-link.entity';
import { OpenmrsSyncLog } from '../entities/openmrs-sync-log.entity';
import { Patient } from '../entities/patient.entity';

@Injectable()
export class OpenmrsFhirService {
  constructor(private readonly tenantService: TenantService) {}

  async linkPatient(
    tenantId: string,
    patientId: string,
    openmrsUuid: string,
    openmrsBaseUrl: string,
  ): Promise<OpenmrsPatientLink> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(OpenmrsPatientLink);
    const normalizedBaseUrl = this.normalizeBaseUrl(openmrsBaseUrl);

    const existing =
      (await repo.findOne({ where: { patientId } })) ||
      (await repo.findOne({ where: { openmrsUuid } }));

    const entity = repo.create({
      ...(existing || {}),
      patientId,
      openmrsUuid,
      openmrsBaseUrl: normalizedBaseUrl,
      syncStatus: existing?.syncStatus || 'pending',
    });

    return repo.save(entity) as unknown as OpenmrsPatientLink;
  }

  async pushPatientToOpenmrs(tenantId: string, patientId: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const patientRepo = db.getRepository(Patient);
    const linkRepo = db.getRepository(OpenmrsPatientLink);
    const logRepo = db.getRepository(OpenmrsSyncLog);

    const patient = await patientRepo.findOne({ where: { id: patientId } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const link = await linkRepo.findOne({ where: { patientId } });
    if (!link) {
      throw new NotFoundException('OpenMRS link not found for patient');
    }

    const resource = this.buildFhirPatientResource(patient, link.openmrsUuid);

    try {
      const response = await axios.post(
        `${this.normalizeBaseUrl(link.openmrsBaseUrl)}/ws/fhir2/R4/Patient`,
        resource,
        {
          auth: {
            username: process.env.OPENMRS_USERNAME || '',
            password: process.env.OPENMRS_PASSWORD || '',
          },
          headers: {
            'Content-Type': 'application/fhir+json',
            Accept: 'application/fhir+json',
          },
          timeout: 15000,
        },
      );

      await linkRepo.update(link.id, {
        openmrsUuid: response.data?.id || link.openmrsUuid,
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
      });

      await logRepo.save(
        logRepo.create({
          patientId,
          openmrsUuid: response.data?.id || link.openmrsUuid,
          direction: 'push',
          resourceType: 'Patient',
          status: 'synced',
          payload: {
            request: resource,
            response: response.data,
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'OpenMRS patient push failed';
      await linkRepo.update(link.id, { syncStatus: 'failed' });
      await logRepo.save(
        logRepo.create({
          patientId,
          openmrsUuid: link.openmrsUuid,
          direction: 'push',
          resourceType: 'Patient',
          status: 'failed',
          payload: { request: resource, response: error?.response?.data || null },
          errorMessage: message,
        }),
      );
      throw error;
    }
  }

  async pullPatientFromOpenmrs(tenantId: string, patientId: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const patientRepo = db.getRepository(Patient);
    const linkRepo = db.getRepository(OpenmrsPatientLink);
    const logRepo = db.getRepository(OpenmrsSyncLog);

    const patient = await patientRepo.findOne({ where: { id: patientId } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const link = await linkRepo.findOne({ where: { patientId } });
    if (!link) {
      throw new NotFoundException('OpenMRS link not found for patient');
    }

    try {
      const response = await axios.get(
        `${this.normalizeBaseUrl(link.openmrsBaseUrl)}/ws/fhir2/R4/Patient/${link.openmrsUuid}`,
        {
          auth: {
            username: process.env.OPENMRS_USERNAME || '',
            password: process.env.OPENMRS_PASSWORD || '',
          },
          headers: {
            Accept: 'application/fhir+json',
          },
          timeout: 15000,
        },
      );

      const updates = this.mapFhirPatientToLocal(response.data, patient);
      const savedPatient = await patientRepo.save(patientRepo.create({ ...patient, ...updates })) as unknown as Patient;

      await linkRepo.update(link.id, {
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
      });

      await logRepo.save(
        logRepo.create({
          patientId,
          openmrsUuid: link.openmrsUuid,
          direction: 'pull',
          resourceType: 'Patient',
          status: 'synced',
          payload: {
            response: response.data,
            appliedUpdates: updates,
          },
        }),
      );

      return {
        patient: savedPatient,
        resource: response.data,
      };
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'OpenMRS patient pull failed';
      await linkRepo.update(link.id, { syncStatus: 'failed' });
      await logRepo.save(
        logRepo.create({
          patientId,
          openmrsUuid: link.openmrsUuid,
          direction: 'pull',
          resourceType: 'Patient',
          status: 'failed',
          payload: { response: error?.response?.data || null },
          errorMessage: message,
        }),
      );
      throw error;
    }
  }

  async getLinks(tenantId: string, patientId?: string): Promise<OpenmrsPatientLink[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const where = patientId ? { patientId } : {};
    return db.getRepository(OpenmrsPatientLink).find({
      where,
      order: { lastSyncedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async getSyncLogs(
    tenantId: string,
    filters: { patientId?: string; direction?: string; page: number; limit: number },
  ): Promise<{ data: OpenmrsSyncLog[]; total: number; page: number; limit: number }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(OpenmrsSyncLog).createQueryBuilder('log').orderBy('log.synced_at', 'DESC');

    if (filters.patientId) {
      qb.andWhere('log.patient_id = :patientId', { patientId: filters.patientId });
    }
    if (filters.direction) {
      qb.andWhere('log.direction = :direction', { direction: filters.direction });
    }

    const total = await qb.getCount();
    const data = await qb.skip((filters.page - 1) * filters.limit).take(filters.limit).getMany();
    return { data, total, page: filters.page, limit: filters.limit };
  }

  private buildFhirPatientResource(patient: Patient, openmrsUuid: string) {
    return {
      resourceType: 'Patient',
      id: openmrsUuid,
      identifier: patient.nationalId
        ? [
            {
              system: 'urn:umoya:national-id',
              value: patient.nationalId,
            },
          ]
        : [],
      name: [
        {
          use: 'official',
          family: patient.lastName,
          given: [patient.firstName],
        },
      ],
      gender: String(patient.gender || '').toLowerCase() || 'unknown',
      birthDate: patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().slice(0, 10) : undefined,
      telecom: [
        patient.phone
          ? { system: 'phone', value: patient.phone, use: 'mobile' }
          : null,
        patient.email
          ? { system: 'email', value: patient.email, use: 'home' }
          : null,
      ].filter(Boolean),
      address: [
        {
          text: patient.address || undefined,
          line: patient.address ? [patient.address] : [],
          city: patient.city || undefined,
        },
      ],
    };
  }

  private mapFhirPatientToLocal(resource: any, patient: Patient): Partial<Patient> {
    const firstName = resource?.name?.[0]?.given?.[0] || patient.firstName;
    const lastName = resource?.name?.[0]?.family || patient.lastName;
    const phone = resource?.telecom?.find((item: any) => item?.system === 'phone')?.value || patient.phone;
    const email = resource?.telecom?.find((item: any) => item?.system === 'email')?.value || patient.email;
    const address =
      resource?.address?.[0]?.text ||
      resource?.address?.[0]?.line?.join(', ') ||
      patient.address;
    const city = resource?.address?.[0]?.city || patient.city;
    const nationalId =
      resource?.identifier?.find((item: any) => item?.value)?.value ||
      patient.nationalId;

    return {
      firstName,
      lastName,
      dateOfBirth: resource?.birthDate ? new Date(resource.birthDate) : patient.dateOfBirth,
      gender: resource?.gender || patient.gender,
      nationalId,
      phone,
      email,
      address,
      city,
    };
  }

  private normalizeBaseUrl(url: string): string {
    return String(url || '').trim().replace(/\/+$/, '');
  }
}
