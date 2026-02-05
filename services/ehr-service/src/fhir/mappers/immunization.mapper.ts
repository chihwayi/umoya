import { Immunization } from '../../entities/immunization.entity';
import type * as fhir from 'fhir/r4';

export class ImmunizationMapper {
  /**
   * Convert Immunization entity to FHIR Immunization resource
   */
  static toFhir(immunization: Immunization, tenantId?: string): fhir.Immunization {
    // Map status
    const status: fhir.Immunization['status'] = 
      immunization.completionStatus === 'completed' ? 'completed' :
      immunization.completionStatus === 'entered-in-error' ? 'entered-in-error' :
      immunization.completionStatus === 'not-done' ? 'not-done' :
      'completed'; // default

    // Build vaccine code
    const vaccineCode: fhir.CodeableConcept = {
      coding: [],
      text: immunization.vaccineName,
    };

    // Add CVX code if available (vaccineCode might be CVX)
    if (immunization.vaccineCode) {
      vaccineCode.coding.push({
        system: 'http://hl7.org/fhir/sid/cvx',
        code: immunization.vaccineCode,
        display: immunization.vaccineName,
      });
    }

    // Build patient reference
    const patient: fhir.Reference = {
      reference: `Patient/${immunization.patientId}`,
    };
    if (tenantId) {
      patient.identifier = {
        system: `http://${tenantId}.co.zw/patients`,
        value: immunization.patientId,
      };
    }

    // Build occurrence (administration date/time)
    // Handle administrationDate which might be Date or string
    const adminDate = immunization.administrationDate
      ? (typeof immunization.administrationDate === 'string'
          ? new Date(immunization.administrationDate)
          : immunization.administrationDate)
      : null;
    
    const occurrenceDateTime = adminDate
      ? (immunization.administrationTime
          ? `${adminDate.toISOString().split('T')[0]}T${immunization.administrationTime}`
          : adminDate.toISOString())
      : undefined;

    // Build performer (who administered)
    const performer: fhir.ImmunizationPerformer[] = [];
    if (immunization.administeredBy) {
      performer.push({
        actor: {
          reference: `Practitioner/${immunization.administeredBy}`,
        },
      });
    }

    // Build protocol applied (dose information)
    const protocolApplied: fhir.ImmunizationProtocolApplied[] = [];
    if (immunization.doseNumber) {
      protocolApplied.push({
        doseNumberPositiveInt: immunization.doseNumber,
        series: immunization.vaccineName, // Could be enhanced with series tracking
      });
    }

    // Build lot number
    const lotNumber = immunization.lotNumber || undefined;

    // Build manufacturer
    const manufacturer: fhir.Reference | undefined = immunization.manufacturer
      ? {
          display: immunization.manufacturer,
        }
      : undefined;

    // Build route
    const route: fhir.CodeableConcept | undefined = immunization.route
      ? {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-RouteOfAdministration',
            code: this.mapRouteToCode(immunization.route),
            display: immunization.route,
          }],
          text: immunization.route,
        }
      : undefined;

    // Build site
    const site: fhir.CodeableConcept | undefined = immunization.site
      ? {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActSite',
            code: this.mapSiteToCode(immunization.site),
            display: immunization.site,
          }],
          text: immunization.site,
        }
      : undefined;

    // Build dose quantity
    const doseQuantity: fhir.Quantity | undefined = 
      immunization.doseQuantity && immunization.doseUnit
        ? {
            value: immunization.doseQuantity,
            unit: immunization.doseUnit,
            system: 'http://unitsofmeasure.org',
          }
        : undefined;

    // Build reaction (if observed)
    const reaction: fhir.ImmunizationReaction[] | undefined = 
      immunization.reactionObserved && immunization.reactionDetails
        ? [{
            date: immunization.updatedAt?.toISOString() || immunization.createdAt.toISOString(),
            detail: {
              display: immunization.reactionDetails,
            },
            reported: immunization.reportedToVaers || false,
          }]
        : undefined;

    // Build note
    const note: fhir.Annotation[] | undefined = immunization.notes
      ? [{
          text: immunization.notes,
          time: immunization.updatedAt?.toISOString() || immunization.createdAt.toISOString(),
        }]
      : undefined;

    // Build reason code (if status is not-done)
    const reasonCode: fhir.CodeableConcept[] | undefined = 
      immunization.completionStatus === 'not-done' && immunization.statusReason
        ? [{
            text: immunization.statusReason,
          }]
        : undefined;

    return {
      resourceType: 'Immunization',
      id: immunization.id,
      meta: {
        versionId: '1',
        lastUpdated: immunization.updatedAt?.toISOString() || immunization.createdAt.toISOString(),
      },
      status,
      vaccineCode,
      patient,
      occurrenceDateTime,
      recorded: immunization.createdAt.toISOString(),
      primarySource: !immunization.historical,
      location: immunization.appointmentId
        ? {
            reference: `Location/clinic`,
            display: 'Clinic',
          }
        : undefined,
      manufacturer,
      lotNumber,
      expirationDate: immunization.expirationDate
        ? new Date(immunization.expirationDate).toISOString().split('T')[0]
        : undefined,
      site,
      route,
      doseQuantity,
      performer: performer.length > 0 ? performer : undefined,
      protocolApplied: protocolApplied.length > 0 ? protocolApplied : undefined,
      reaction,
      note,
      reasonCode,
    };
  }

  /**
   * Convert FHIR Immunization to Immunization entity data
   */
  static fromFhir(fhirImmunization: fhir.Immunization, tenantId?: string): Partial<Immunization> {
    const vaccineCode = fhirImmunization.vaccineCode;
    const vaccineName = vaccineCode?.text || vaccineCode?.coding?.[0]?.display || 'Unknown Vaccine';
    const cvxCode = vaccineCode?.coding?.find(c => c.system?.includes('cvx'))?.code;

    // Extract occurrence date/time
    const occurrenceDateTime = fhirImmunization.occurrenceDateTime
      ? new Date(fhirImmunization.occurrenceDateTime)
      : new Date();
    const occurrenceDate = new Date(occurrenceDateTime.toISOString().split('T')[0]);
    const occurrenceTime = occurrenceDateTime.toISOString().split('T')[1]?.split('.')[0] || null;

    // Extract dose information
    const doseNumber = fhirImmunization.protocolApplied?.[0]?.doseNumberPositiveInt || undefined;
    const doseQuantity = fhirImmunization.doseQuantity?.value;
    const doseUnit = fhirImmunization.doseQuantity?.unit;

    // Extract route
    const route = fhirImmunization.route?.text || fhirImmunization.route?.coding?.[0]?.display || undefined;

    // Extract site
    const site = fhirImmunization.site?.text || fhirImmunization.site?.coding?.[0]?.display || undefined;

    // Extract manufacturer
    const manufacturer = fhirImmunization.manufacturer?.display || undefined;

    // Extract lot number
    const lotNumber = fhirImmunization.lotNumber || undefined;

    // Extract expiration date
    const expirationDate = fhirImmunization.expirationDate
      ? new Date(fhirImmunization.expirationDate)
      : undefined;

    // Extract performer (administered by)
    const administeredBy = fhirImmunization.performer?.[0]?.actor?.reference?.split('/')[1] || undefined;

    // Extract notes
    const notes = fhirImmunization.note?.[0]?.text || undefined;

    // Extract status reason
    const statusReason = fhirImmunization.reasonCode?.[0]?.text || undefined;

    // Map status
    const completionStatus = fhirImmunization.status === 'completed' ? 'completed' :
                             fhirImmunization.status === 'entered-in-error' ? 'entered-in-error' :
                             fhirImmunization.status === 'not-done' ? 'not-done' :
                             'completed';

    // Extract reaction information
    const reactionObserved = fhirImmunization.reaction && fhirImmunization.reaction.length > 0;
    const reactionDetails = fhirImmunization.reaction?.[0]?.detail?.display || undefined;
    const reportedToVaers = fhirImmunization.reaction?.[0]?.reported || false;

    return {
      immunizationNumber: `IMM-${Date.now()}`,
      vaccineCode: cvxCode || 'UNKNOWN',
      vaccineName,
      manufacturer,
      lotNumber,
      expirationDate,
      administrationDate: occurrenceDate,
      administrationTime: occurrenceTime,
      doseNumber,
      doseQuantity,
      doseUnit,
      route,
      site,
      administeredBy,
      completionStatus,
      statusReason,
      notes,
      reactionObserved,
      reactionDetails,
      reportedToVaers,
      historical: !fhirImmunization.primarySource,
    };
  }

  /**
   * Map route to HL7 code
   */
  private static mapRouteToCode(route: string): string {
    const routeMap: Record<string, string> = {
      'intramuscular': 'IM',
      'subcutaneous': 'SQ',
      'intranasal': 'IN',
      'oral': 'PO',
      'intradermal': 'ID',
      'transdermal': 'TD',
    };
    return routeMap[route.toLowerCase()] || 'IM';
  }

  /**
   * Map site to HL7 code
   */
  private static mapSiteToCode(site: string): string {
    const siteMap: Record<string, string> = {
      'left arm': 'LA',
      'right arm': 'RA',
      'left thigh': 'LT',
      'right thigh': 'RT',
      'left deltoid': 'LD',
      'right deltoid': 'RD',
    };
    return siteMap[site.toLowerCase()] || 'LA';
  }
}

