import { MedicalRecord } from '../../entities/medical-record.entity';
import * as fhir from 'fhir/r4';
import { DataSource } from 'typeorm';

/**
 * DocumentReference FHIR Mapper
 * Maps between FHIR DocumentReference resources and MedicalRecord entities
 */
export class DocumentReferenceMapper {
  /**
   * Convert MedicalRecord entity to FHIR DocumentReference resource
   */
  static toFhir(medicalRecord: MedicalRecord, tenantId?: string): fhir.DocumentReference {
    // Map record type to document type
    const typeMap: Record<string, { system: string; code: string; display: string }> = {
      consultation: {
        system: 'http://loinc.org',
        code: '51848-0',
        display: 'Consultation note',
      },
      diagnosis: {
        system: 'http://loinc.org',
        code: '11502-2',
        display: 'Diagnosis',
      },
      treatment: {
        system: 'http://loinc.org',
        code: '18726-0',
        display: 'Treatment plan',
      },
      procedure: {
        system: 'http://loinc.org',
        code: '28570-0',
        display: 'Procedure note',
      },
      lab_result: {
        system: 'http://loinc.org',
        code: '26436-6',
        display: 'Laboratory report',
      },
      imaging: {
        system: 'http://loinc.org',
        code: '18748-4',
        display: 'Diagnostic imaging study',
      },
      prescription: {
        system: 'http://loinc.org',
        code: '57833-6',
        display: 'Prescription',
      },
      vaccination: {
        system: 'http://loinc.org',
        code: '11369-6',
        display: 'Immunization record',
      },
      discharge: {
        system: 'http://loinc.org',
        code: '18842-5',
        display: 'Discharge summary',
      },
    };

    const docType = typeMap[medicalRecord.type] || {
      system: 'http://loinc.org',
      code: '11506-3',
      display: 'Progress note',
    };

    // Map status
    const status = medicalRecord.isConfidential ? 'entered-in-error' : 'current';

    const fhirDocRef: fhir.DocumentReference = {
      resourceType: 'DocumentReference',
      id: medicalRecord.id,
      status,
      type: {
        coding: [docType],
        text: docType.display,
      },
      subject: {
        reference: `Patient/${medicalRecord.patientId}`,
        type: 'Patient',
      },
      date: medicalRecord.recordDate?.toISOString() || medicalRecord.createdAt?.toISOString(),
      author: [
        {
          reference: `Practitioner/${medicalRecord.providerId}`,
          type: 'Practitioner',
        },
      ],
      description: medicalRecord.chiefComplaint || medicalRecord.assessment || 'Medical record',
      content: [
        {
          attachment: {
            contentType: 'text/plain',
            title: `${docType.display}${medicalRecord.recordNumber ? ` - ${medicalRecord.recordNumber}` : ''}`,
            creation: medicalRecord.recordDate?.toISOString() || medicalRecord.createdAt?.toISOString(),
            ...(medicalRecord.attachments && medicalRecord.attachments.length > 0 && {
              url: medicalRecord.attachments[0].url,
            }),
          },
        },
      ],
      context: {
        ...(medicalRecord.appointmentId && {
          encounter: [
            {
              reference: `Encounter/${medicalRecord.appointmentId}`,
              type: 'Encounter',
            },
          ],
        }),
        period: {
          start: medicalRecord.recordDate?.toISOString(),
          end: medicalRecord.updatedAt?.toISOString(),
        },
      },
      ...(medicalRecord.assessment && {
        relatesTo: [
          {
            code: 'replaces',
            target: {
              reference: `DocumentReference/${medicalRecord.id}`,
            },
          },
        ],
      }),
    };

    return fhirDocRef;
  }

  /**
   * Convert FHIR DocumentReference to MedicalRecord entity data (async version with tenantDb)
   */
  static fromFhir(fhirDocRef: fhir.DocumentReference, tenantDb: DataSource, tenantId?: string): Promise<Partial<MedicalRecord>>;
  
  /**
   * Convert FHIR DocumentReference to MedicalRecord entity data (sync version)
   */
  static async fromFhir(fhirDocRef: fhir.DocumentReference, tenantDb: DataSource, tenantId?: string): Promise<Partial<MedicalRecord>>;
  
  static async fromFhir(
    fhirDocRef: fhir.DocumentReference, 
    tenantDbOrTenantId?: DataSource | string, 
    tenantId?: string
  ): Promise<Partial<MedicalRecord>> {
    // Determine if first param is DataSource or tenantId
    const isDataSource = tenantDbOrTenantId instanceof DataSource;
    const tenantDb = isDataSource ? tenantDbOrTenantId : undefined;
    const actualTenantId = isDataSource ? tenantId : (tenantDbOrTenantId as string | undefined);
    
    const patientId = fhirDocRef.subject?.reference?.split('/')[1] || 
                     fhirDocRef.subject?.reference;
    
    if (!patientId) {
      throw new Error('Patient reference is required');
    }

    // Extract provider
    const providerId = fhirDocRef.author?.[0]?.reference?.split('/')[1];

    if (!providerId) {
      throw new Error('Author (provider) reference is required');
    }

    // Map document type to record type
    const code = fhirDocRef.type?.coding?.[0]?.code;
    const typeMap: Record<string, string> = {
      '51848-0': 'consultation',
      '11502-2': 'diagnosis',
      '18726-0': 'treatment',
      '28570-0': 'procedure',
      '26436-6': 'lab_result',
      '18748-4': 'imaging',
      '57833-6': 'prescription',
      '11369-6': 'vaccination',
      '18842-5': 'discharge',
    };

    const recordType = typeMap[code] || 'consultation';

    // Extract appointment ID from context
    const appointmentId = fhirDocRef.context?.encounter?.[0]?.reference?.split('/')[1];

    // Extract record date
    const recordDate = fhirDocRef.date 
      ? new Date(fhirDocRef.date)
      : fhirDocRef.context?.period?.start
      ? new Date(fhirDocRef.context.period.start)
      : new Date();

    // Extract description/chief complaint
    const chiefComplaint = fhirDocRef.description || fhirDocRef.content?.[0]?.attachment?.title || '';

    // Extract assessment from relatesTo or content
    const assessment = fhirDocRef.content?.[0]?.attachment?.title || '';

    // Extract attachments
    const attachments = fhirDocRef.content
      ?.filter(c => c.attachment?.url)
      .map(c => ({
        filename: c.attachment?.title || 'document',
        url: c.attachment?.url || '',
        type: c.attachment?.contentType || 'application/octet-stream',
        uploadedAt: c.attachment?.creation ? new Date(c.attachment.creation) : new Date(),
      }));

    // Generate record number if tenantDb is provided
    let recordNumber: string | undefined;
    if (tenantDb) {
      const medicalRecordRepository = tenantDb.getRepository(MedicalRecord);
      const count = await medicalRecordRepository.count();
      recordNumber = `MR-${String(count + 1).padStart(6, '0')}`;
    }

    return {
      ...(recordNumber && { recordNumber }),
      patientId,
      providerId,
      type: recordType as any,
      recordDate,
      ...(appointmentId && { appointmentId }),
      chiefComplaint,
      assessment: assessment || chiefComplaint,
      ...(attachments && attachments.length > 0 && { attachments }),
      isConfidential: fhirDocRef.status === 'entered-in-error',
    };
  }
}

