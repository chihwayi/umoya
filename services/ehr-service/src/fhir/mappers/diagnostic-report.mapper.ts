import { LabOrder, LabOrderStatus, Priority, LabTestCategory } from '../../entities/lab-order.entity';
import * as fhir from 'fhir/r4';

export class DiagnosticReportMapper {
  /**
   * Convert LabOrder entity to FHIR DiagnosticReport resource
   */
  static toFhir(labOrder: LabOrder, tenantId?: string): fhir.DiagnosticReport {
    // Map status
    const status = this.mapStatus(labOrder.status);
    
    // Build code (LOINC preferred, fallback to SNOMED)
    const code: fhir.CodeableConcept = {
      coding: [],
      text: labOrder.tests?.[0]?.testName || 'Laboratory Test',
    };
    
    if (labOrder.loincCode) {
      code.coding.push({
        system: 'http://loinc.org',
        code: labOrder.loincCode,
        display: labOrder.loincLongName || labOrder.tests?.[0]?.testName,
      });
    }
    
    if (labOrder.snomedConceptId) {
      code.coding.push({
        system: 'http://snomed.info/sct',
        code: labOrder.snomedConceptId,
        display: labOrder.snomedTerm || labOrder.tests?.[0]?.testName,
      });
    }
    
    // Add CPT code if available
    if (labOrder.cptCode) {
      code.coding.push({
        system: 'http://www.ama-assn.org/go/cpt',
        code: labOrder.cptCode,
        display: labOrder.tests?.[0]?.testName,
      });
    }
    
    // Build category
    const category: fhir.CodeableConcept = {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
        code: this.mapCategoryToV2Code(labOrder.tests?.[0]?.category),
        display: labOrder.tests?.[0]?.category || 'LAB',
      }],
      text: labOrder.tests?.[0]?.category || 'Laboratory',
    };
    
    // Build subject (patient)
    const subject: fhir.Reference = {
      reference: `Patient/${labOrder.patientId}`,
    };
    if (tenantId) {
      subject.identifier = {
        system: `http://${tenantId}.co.zw/patients`,
        value: labOrder.patientId,
      };
    }
    
    // Build effectiveDateTime (when test was performed)
    const effectiveDateTime = labOrder.collectedAt || labOrder.scheduledDateTime || labOrder.createdAt;
    
    // Build issued (when report was finalized)
    const issued = labOrder.reviewedAt || labOrder.collectedAt || labOrder.createdAt;
    
    // Build performer (who performed the test)
    const performer: fhir.Reference[] = [];
    if (labOrder.collectedById) {
      performer.push({
        reference: `Practitioner/${labOrder.collectedById}`,
        identifier: tenantId ? {
          system: `http://${tenantId}.co.zw/users`,
          value: labOrder.collectedById,
        } : undefined,
      });
    }
    if (labOrder.reviewedById && labOrder.reviewedById !== labOrder.collectedById) {
      performer.push({
        reference: `Practitioner/${labOrder.reviewedById}`,
        identifier: tenantId ? {
          system: `http://${tenantId}.co.zw/users`,
          value: labOrder.reviewedById,
        } : undefined,
      });
    }
    
    // Build result (link to Observation resources)
    const result: fhir.Reference[] = [];
    if (labOrder.results && labOrder.results.length > 0) {
      // For each result, create a reference to an Observation
      // In a full implementation, these would be actual Observation resources
      labOrder.results.forEach((resultItem, index) => {
        result.push({
          reference: `Observation/${labOrder.id}-result-${index}`,
          display: `${resultItem.testName}: ${resultItem.value} ${resultItem.unit}`,
        });
      });
    }
    
    // Build specimen (if available)
    const specimen: fhir.Reference[] | undefined = labOrder.tests?.[0]?.specimenType
      ? [{
          display: labOrder.tests[0].specimenType,
        }]
      : undefined;
    
    // Build conclusion (interpretation)
    const conclusion = labOrder.interpretation || undefined;
    
    // Build conclusionCode (if available)
    const conclusionCode: fhir.CodeableConcept[] | undefined = labOrder.interpretation
      ? [{
          text: labOrder.interpretation,
        }]
      : undefined;
    
    // Build presentedForm (attachments)
    const presentedForm: fhir.Attachment[] | undefined = labOrder.attachments?.map(att => ({
      contentType: att.type,
      url: att.url,
      title: att.filename,
      creation: att.uploadedAt?.toISOString(),
    })) || undefined;
    
    return {
      resourceType: 'DiagnosticReport',
      id: labOrder.id,
      meta: {
        versionId: '1',
        lastUpdated: labOrder.updatedAt?.toISOString() || labOrder.createdAt.toISOString(),
      },
      status,
      category: [category],
      code,
      subject,
      effectiveDateTime: effectiveDateTime.toISOString(),
      issued: issued.toISOString(),
      performer: performer.length > 0 ? performer : undefined,
      result: result.length > 0 ? result : undefined,
      specimen: specimen,
      conclusion,
      conclusionCode,
      presentedForm,
    };
  }

  /**
   * Convert FHIR DiagnosticReport to LabOrder entity data
   */
  /**
   * Convert FHIR DiagnosticReport to LabOrder entity data
   */
  static fromFhir(fhirDiagnosticReport: fhir.DiagnosticReport, tenantId?: string): Partial<LabOrder> {
    const code = fhirDiagnosticReport.code;
    const testName = code?.text || code?.coding?.[0]?.display || 'Unknown Test';
    const loincCode = code?.coding?.find(c => c.system?.includes('loinc'))?.code;
    const snomedCode = code?.coding?.find(c => c.system?.includes('snomed'))?.code;
    const cptCode = code?.coding?.find(c => c.system?.includes('cpt'))?.code;
    
    const category = fhirDiagnosticReport.category?.[0]?.coding?.[0]?.code || 'chemistry';
    
    // Extract tests array
    const tests = [{
      testCode: loincCode || snomedCode || 'UNKNOWN',
      testName: testName,
      category: this.mapV2CodeToCategory(category) as LabTestCategory,
      specimenType: fhirDiagnosticReport.specimen?.[0]?.display || 'blood',
    }];
    
    // Extract results if available
    const results = fhirDiagnosticReport.result?.map((ref, index) => {
      // In a full implementation, we'd fetch the actual Observation
      // For now, parse from display if available
      const display = ref.display || '';
      const match = display.match(/(.+):\s*(.+)\s+(.+)/);
      return {
        testCode: loincCode || snomedCode || 'UNKNOWN',
        testName: match ? match[1] : testName,
        value: match ? match[2] : '',
        unit: match ? match[3] : '',
        referenceRange: '',
        flag: 'normal' as const,
        resultDate: fhirDiagnosticReport.effectiveDateTime ? new Date(fhirDiagnosticReport.effectiveDateTime) : new Date(),
        performedBy: fhirDiagnosticReport.performer?.[0]?.reference?.split('/')[1] || '',
      };
    });
    
    // Extract dates
    const effectiveDateTime = fhirDiagnosticReport.effectiveDateTime
      ? new Date(fhirDiagnosticReport.effectiveDateTime)
      : new Date();
    const issued = fhirDiagnosticReport.issued
      ? new Date(fhirDiagnosticReport.issued)
      : new Date();

    // Extract performers
    const performers = fhirDiagnosticReport.performer || [];
    const collectedById = performers.length > 0 ? performers[0].reference?.split('/')[1] : undefined;
    const reviewedById = performers.length > 1 ? performers[1].reference?.split('/')[1] : undefined;

    // Extract attachments
    const attachments = fhirDiagnosticReport.presentedForm?.map(att => ({
      filename: att.title || 'attachment',
      url: att.url || '',
      type: att.contentType || 'application/pdf',
      uploadedAt: att.creation ? new Date(att.creation) : new Date(),
    }));
    
    return {
      orderNumber: `LAB-${Date.now()}`,
      tests,
      loincCode,
      loincLongName: testName,
      snomedConceptId: snomedCode,
      snomedTerm: testName,
      cptCode,
      status: this.mapStatusFromFhir(fhirDiagnosticReport.status),
      priority: Priority.ROUTINE,
      scheduledDateTime: effectiveDateTime,
      collectedAt: effectiveDateTime,
      collectedById,
      results,
      interpretation: fhirDiagnosticReport.conclusion || fhirDiagnosticReport.conclusionCode?.[0]?.text,
      reviewedById,
      reviewedAt: reviewedById ? issued : undefined,
      attachments,
    };
  }

  /**
   * Map LabOrderStatus to FHIR DiagnosticReport status
   */
  private static mapStatus(status: LabOrderStatus): fhir.DiagnosticReport['status'] {
    const statusMap: Record<LabOrderStatus, fhir.DiagnosticReport['status']> = {
      [LabOrderStatus.AWAITING_PAYMENT]: 'registered',
      [LabOrderStatus.ORDERED]: 'registered',
      [LabOrderStatus.COLLECTED]: 'partial',
      [LabOrderStatus.IN_PROGRESS]: 'preliminary',
      [LabOrderStatus.COMPLETED]: 'final',
      [LabOrderStatus.CANCELLED]: 'cancelled',
    };
    return statusMap[status] || 'registered';
  }
  
  /**
   * Map FHIR DiagnosticReport status to LabOrderStatus
   */
  private static mapStatusFromFhir(status?: fhir.DiagnosticReport['status']): LabOrderStatus {
    const statusMap: Record<string, LabOrderStatus> = {
      'registered': LabOrderStatus.ORDERED,
      'partial': LabOrderStatus.COLLECTED,
      'preliminary': LabOrderStatus.IN_PROGRESS,
      'final': LabOrderStatus.COMPLETED,
      'amended': LabOrderStatus.COMPLETED,
      'corrected': LabOrderStatus.COMPLETED,
      'appended': LabOrderStatus.COMPLETED,
      'cancelled': LabOrderStatus.CANCELLED,
    };
    return statusMap[status || 'registered'] || LabOrderStatus.ORDERED;
  }
  
  /**
   * Map test category to HL7 v2 code
   */
  private static mapCategoryToV2Code(category?: string): string {
    const categoryMap: Record<string, string> = {
      'hematology': 'HEM',
      'chemistry': 'CH',
      'microbiology': 'MB',
      'immunology': 'IMM',
      'pathology': 'PAT',
      'radiology': 'RAD',
      'cardiology': 'CUS',
    };
    return categoryMap[category?.toLowerCase() || ''] || 'CH';
  }
  
  /**
   * Map HL7 v2 code to test category
   */
  private static mapV2CodeToCategory(v2Code: string): string {
    const codeMap: Record<string, string> = {
      'HEM': 'hematology',
      'CH': 'chemistry',
      'MB': 'microbiology',
      'IMM': 'immunology',
      'PAT': 'pathology',
      'RAD': 'radiology',
      'CUS': 'cardiology',
    };
    return codeMap[v2Code?.toUpperCase()] || 'chemistry';
  }
}

