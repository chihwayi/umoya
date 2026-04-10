import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { TenantService } from './tenant.service';
import { EtrNetNotification } from '../entities/etr-net-notification.entity';

@Injectable()
export class EtrNetService {
  constructor(private readonly tenantService: TenantService) {}

  async notifyCase(tenantId: string, tbCaseId: string): Promise<EtrNetNotification> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(EtrNetNotification);

    const tbCaseRows = await db.query(
      `SELECT
         c.id,
         c.patient_id,
         c.registration_date,
         c.patient_category,
         p.id_number
       FROM tb_cases c
       INNER JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1
       LIMIT 1`,
      [tbCaseId],
    );

    const tbCase = tbCaseRows[0];
    if (!tbCase) {
      throw new NotFoundException('TB case not found');
    }

    const treatmentRows = await db.query(
      `SELECT start_date
       FROM tb_treatment_records
       WHERE case_id = $1
       ORDER BY start_date ASC
       LIMIT 1`,
      [tbCaseId],
    );

    const notificationDate = new Date().toISOString().slice(0, 10);
    const payload = {
      caseId: tbCaseId,
      patientIdNumber: tbCase.id_number || null,
      notificationDate,
      facilityCode: process.env.FACILITY_CODE || null,
      tbCategory: tbCase.patient_category || null,
      diagnosisDate: tbCase.registration_date || null,
      treatmentStartDate: treatmentRows[0]?.start_date || null,
    };

    const baseUrl = (process.env.ETR_NET_BASE_URL || '').trim();
    const apiKey = (process.env.ETR_NET_API_KEY || '').trim();

    if (!baseUrl || !apiKey) {
      const failed = repo.create({
        patientId: tbCase.patient_id,
        tbCaseId,
        notificationDate,
        exportStatus: 'failed',
        payloadJson: payload,
        errorMessage: 'ETR.net configuration missing',
      });
      return repo.save(failed) as unknown as EtrNetNotification;
    }

    try {
      const response = await axios.post(
        `${baseUrl.replace(/\/$/, '')}/api/case-notification`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      const entity = repo.create({
        patientId: tbCase.patient_id,
        tbCaseId,
        notificationDate,
        exportStatus: 'submitted',
        etrReference: response.data?.etrReference || response.data?.reference || response.data?.id || null,
        payloadJson: payload,
        submittedAt: new Date(),
      });
      return repo.save(entity) as unknown as EtrNetNotification;
    } catch (error: any) {
      const failed = repo.create({
        patientId: tbCase.patient_id,
        tbCaseId,
        notificationDate,
        exportStatus: 'failed',
        payloadJson: payload,
        errorMessage: error?.response?.data?.message || error?.message || 'ETR.net request failed',
      });
      return repo.save(failed) as unknown as EtrNetNotification;
    }
  }

  async getNotifications(tenantId: string): Promise<EtrNetNotification[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(EtrNetNotification).find({
      order: { createdAt: 'DESC' },
    });
  }
}
