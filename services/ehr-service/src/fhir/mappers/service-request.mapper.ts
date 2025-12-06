import { LabOrder } from '../../entities/lab-order.entity';
import * as fhir from 'fhir/r4';

/**
 * ServiceRequest FHIR Mapper
 * Maps between FHIR ServiceRequest resources and LabOrder entities
 */
export class ServiceRequestMapper {
  /**
   * Convert LabOrder entity to FHIR ServiceRequest resource
   */
  static toFhir(labOrder: LabOrder, tenantId?: string): fhir.ServiceRequest {
    // Map status
    const statusMap: Record<string, fhir.ServiceRequestStatus> = {
      ordered: 'draft',
      'in_progress': 'active',
      completed: 'completed',
      cancelled: 'revoked',
      'on_hold': 'on-hold',
    };

    // Map priority
    const priorityMap: Record<string, fhir.RequestPriority> = {
      routine: 'routine',
      urgent: 'urgent',
      stat: 'stat',
      asap: 'asap',
    };

    const fhirServiceRequest: fhir.ServiceRequest = {
      resourceType: 'ServiceRequest',
      id: labOrder.id,
      status: statusMap[labOrder.status] || 'draft',
      intent: 'order',
      priority: priorityMap[labOrder.priority] || 'routine',
      code: {
        coding: labOrder.tests?.map(test => ({
          system: 'http://loinc.org',
          code: test.testCode,
          display: test.testName,
        })) || [],
        text: labOrder.tests?.map(t => t.testName).join(', ') || 'Lab Order',
      },
      subject: {
        reference: `Patient/${labOrder.patientId}`,
        type: 'Patient',
      },
      authoredOn: labOrder.createdAt?.toISOString() || new Date().toISOString(),
      requester: labOrder.orderingProviderId
        ? {
            reference: `Practitioner/${labOrder.orderingProviderId}`,
            type: 'Practitioner',
          }
        : undefined,
      ...(labOrder.scheduledDateTime && {
        occurrenceDateTime: labOrder.scheduledDateTime.toISOString(),
      }),
      ...(labOrder.clinicalInfo && {
        reasonCode: [
          {
            text: labOrder.clinicalInfo,
          },
        ],
      }),
      ...(labOrder.specimenType && {
        specimen: [
          {
            type: {
              text: labOrder.specimenType,
            },
          },
        ],
      }),
      note: labOrder.notes
        ? [
            {
              text: labOrder.notes,
            },
          ]
        : undefined,
    };

    return fhirServiceRequest;
  }

  /**
   * Convert FHIR ServiceRequest to LabOrder entity data
   */
  static fromFhir(fhirServiceRequest: fhir.ServiceRequest, tenantId?: string): Partial<LabOrder> {
    const patientId = fhirServiceRequest.subject?.reference?.split('/')[1] || 
                     fhirServiceRequest.subject?.reference;
    
    if (!patientId) {
      throw new Error('Patient reference is required');
    }

    // Extract tests from code
    const tests = fhirServiceRequest.code?.coding?.map(coding => ({
      testCode: coding.code || 'UNKNOWN',
      testName: coding.display || coding.code || 'Unknown Test',
      category: 'chemistry' as any, // Default category
      specimenType: fhirServiceRequest.specimen?.[0]?.type?.text || 'Blood',
    })) || [];

    if (tests.length === 0 && fhirServiceRequest.code?.text) {
      tests.push({
        testCode: 'UNKNOWN',
        testName: fhirServiceRequest.code.text,
        category: 'chemistry' as any,
        specimenType: fhirServiceRequest.specimen?.[0]?.type?.text || 'Blood',
      });
    }

    // Map status
    const statusMap: Record<string, LabOrderStatus> = {
      draft: 'ordered',
      active: 'in_progress',
      completed: 'completed',
      revoked: 'cancelled',
      'on-hold': 'on_hold',
    };

    // Map priority
    const priorityMap: Record<string, Priority> = {
      routine: 'routine',
      urgent: 'urgent',
      stat: 'stat',
      asap: 'asap',
    };

    // Extract ordering provider
    const orderingProviderId = fhirServiceRequest.requester?.reference?.split('/')[1];

    // Extract scheduled date
    const scheduledDateTime = fhirServiceRequest.occurrenceDateTime
      ? new Date(fhirServiceRequest.occurrenceDateTime)
      : undefined;

    // Extract clinical info
    const clinicalInfo = fhirServiceRequest.reasonCode?.[0]?.text;

    // Extract notes
    const notes = fhirServiceRequest.note?.[0]?.text;

    return {
      patientId,
      orderNumber: `LAB-${Date.now()}`,
      tests,
      status: statusMap[fhirServiceRequest.status] || 'ordered',
      priority: priorityMap[fhirServiceRequest.priority] || 'routine',
      ...(orderingProviderId && { orderingProviderId }),
      ...(scheduledDateTime && { scheduledDateTime }),
      ...(clinicalInfo && { clinicalInfo }),
      ...(notes && { notes }),
    };
  }
}

