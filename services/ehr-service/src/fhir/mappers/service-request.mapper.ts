import { LabOrder, LabOrderStatus, Priority } from '../../entities/lab-order.entity';
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
    const statusMap: Record<string, any> = {
      [LabOrderStatus.ORDERED]: 'draft',
      [LabOrderStatus.IN_PROGRESS]: 'active',
      [LabOrderStatus.COMPLETED]: 'completed',
      [LabOrderStatus.CANCELLED]: 'revoked',
      [LabOrderStatus.AWAITING_PAYMENT]: 'on-hold',
    };

    // Map priority
    const priorityMap: Record<string, any> = {
      [Priority.ROUTINE]: 'routine',
      [Priority.URGENT]: 'urgent',
      [Priority.STAT]: 'stat',
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
      // Specimen mapping removed as it requires proper Reference handling
      note: labOrder.specialInstructions
        ? [
            {
              text: labOrder.specialInstructions,
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
      specimenType: fhirServiceRequest.specimen?.[0]?.display || 'Blood',
    })) || [];

    if (tests.length === 0 && fhirServiceRequest.code?.text) {
      tests.push({
        testCode: 'UNKNOWN',
        testName: fhirServiceRequest.code.text,
        category: 'chemistry' as any,
        specimenType: fhirServiceRequest.specimen?.[0]?.display || 'Blood',
      });
    }

    // Map status
    const statusMap: Record<string, LabOrderStatus> = {
      draft: LabOrderStatus.ORDERED,
      active: LabOrderStatus.IN_PROGRESS,
      completed: LabOrderStatus.COMPLETED,
      revoked: LabOrderStatus.CANCELLED,
      'on-hold': LabOrderStatus.AWAITING_PAYMENT,
      'entered-in-error': LabOrderStatus.CANCELLED,
    };

    // Map priority
    const priorityMap: Record<string, Priority> = {
      routine: Priority.ROUTINE,
      urgent: Priority.URGENT,
      stat: Priority.STAT,
      asap: Priority.URGENT,
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
      status: statusMap[fhirServiceRequest.status] || LabOrderStatus.ORDERED,
      priority: priorityMap[fhirServiceRequest.priority || 'routine'] || Priority.ROUTINE,
      ...(orderingProviderId && { orderingProviderId }),
      ...(scheduledDateTime && { scheduledDateTime }),
      ...(clinicalInfo && { clinicalInfo }),
      ...(notes && { specialInstructions: notes }),
    };
  }
}

