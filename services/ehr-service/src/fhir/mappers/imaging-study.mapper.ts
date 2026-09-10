import { DicomStudy } from '../../entities/dicom-study.entity';
import type * as fhir from 'fhir/r4';

/**
 * ImagingStudy FHIR Mapper
 * Maps DicomStudy entities (the system's actual imaging record — see
 * dicom-study.entity.ts) to FHIR ImagingStudy resources. Read-only by
 * design: like most FHIR ImagingStudy integrations, studies are created by
 * the imaging acquisition/upload pipeline (see imaging-order-ai-review /
 * radiology services), not via a generic FHIR POST — there is no clinical
 * workflow in this system for fabricating a DICOM study from a bare FHIR
 * payload with no actual pixel data behind it.
 */
export class ImagingStudyMapper {
  static toFhir(study: DicomStudy, tenantId?: string): fhir.ImagingStudy {
    const statusMap: Record<string, fhir.ImagingStudy['status']> = {
      pending: 'registered',
      processing: 'available',
      complete: 'available',
      failed: 'cancelled',
    };

    return {
      resourceType: 'ImagingStudy',
      id: study.id,
      status: statusMap[study.aiAnalysisStatus] || 'available',
      identifier: [
        {
          system: 'urn:dicom:uid',
          value: study.studyUid.startsWith('urn:oid:') ? study.studyUid : `urn:oid:${study.studyUid}`,
        },
      ],
      modality: study.modality
        ? [
            {
              system: 'http://dicom.nema.org/resources/ontology/DCM',
              code: study.modality,
            },
          ]
        : undefined,
      subject: {
        reference: `Patient/${study.patientId}`,
      },
      started: (study.acquiredAt || study.uploadedAt)?.toISOString(),
      numberOfSeries: 1,
      numberOfInstances: 1,
      series: [
        {
          uid: study.studyUid,
          modality: {
            system: 'http://dicom.nema.org/resources/ontology/DCM',
            code: study.modality,
          },
          bodySite: study.bodyPart
            ? {
                display: study.bodyPart,
              }
            : undefined,
          numberOfInstances: 1,
        },
      ],
    };
  }
}
