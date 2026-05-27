import { Injectable } from '@nestjs/common';

interface PreConsultForm {
  chiefComplaint: string;
  symptoms: string[];
  currentMedications?: string;
  allergies?: string;
  recentLabResults?: string;
  questionForDoctor?: string;
}

@Injectable()
export class TeleconsultBridgeService {
  buildSubjectiveNotes(form: PreConsultForm): string {
    return [
      form.currentMedications ? `Medications: ${form.currentMedications}` : '',
      form.allergies ? `Allergies: ${form.allergies}` : '',
      form.questionForDoctor ? `Patient question: ${form.questionForDoctor}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  async linkPreConsultToEhr(
    teleconsultId: string,
    patientId: string,
    formData: PreConsultForm,
    db: any,
  ): Promise<{ linkId: string; ehrVisitDraftId: string }> {
    const linkRows: { id: string }[] = await db.query(
      `INSERT INTO teleconsult_ehr_links (teleconsult_id, patient_id, pre_consult_data, chief_complaint, symptoms, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
      [teleconsultId, patientId, JSON.stringify(formData), formData.chiefComplaint, formData.symptoms],
    );

    const visitRows: { id: string }[] = await db.query(
      `INSERT INTO hiv_clinical_visits (
         patient_id, visit_date, visit_type, chief_complaint, subjective_notes,
         status, source, created_at
       ) VALUES ($1, CURRENT_DATE, 'telemedicine', $2, $3, 'draft', 'teleconsult', NOW())
       RETURNING id`,
      [patientId, formData.chiefComplaint, this.buildSubjectiveNotes(formData)],
    );

    await db.query(
      `UPDATE teleconsult_ehr_links SET ehr_visit_id = $2, linked_at = NOW(), status = 'linked' WHERE id = $1`,
      [linkRows[0].id, visitRows[0].id],
    );

    return { linkId: linkRows[0].id, ehrVisitDraftId: visitRows[0].id };
  }

  async getEhrDraftForTeleconsult(teleconsultId: string, db: any) {
    const rows = await db.query(
      `SELECT l.*, v.id as visit_id, v.chief_complaint, v.subjective_notes, v.status as visit_status
       FROM teleconsult_ehr_links l
       LEFT JOIN hiv_clinical_visits v ON v.id = l.ehr_visit_id
       WHERE l.teleconsult_id = $1`,
      [teleconsultId],
    );
    return rows?.[0] ?? null;
  }
}
