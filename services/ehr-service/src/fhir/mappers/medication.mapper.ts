import { Drug } from '../../entities/drug.entity';
import type * as fhir from 'fhir/r4';

export class MedicationMapper {
  /**
   * Convert Drug entity to FHIR Medication resource
   */
  static toFhir(drug: Drug, tenantId?: string): fhir.Medication {
    // Build codeable concept with multiple coding systems
    const code: fhir.CodeableConcept = {
      coding: [],
      text: drug.genericName || drug.rxnormName || 'Unknown Medication',
    };

    // Add RxNorm code (primary)
    if (drug.rxnormCode) {
      code.coding.push({
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: drug.rxnormCode,
        display: drug.rxnormName || drug.genericName,
      });
    }

    // Add SNOMED CT code
    if (drug.snomedCode) {
      code.coding.push({
        system: 'http://snomed.info/sct',
        code: drug.snomedCode,
        display: drug.snomedTerm || drug.genericName,
      });
    }

    // Add ATC code if available
    if (drug.atcCode) {
      code.coding.push({
        system: 'http://www.whocc.no/atc',
        code: drug.atcCode,
        display: drug.genericName,
      });
    }

    // Add NDC code if available
    if (drug.ndcCode) {
      code.coding.push({
        system: 'http://hl7.org/fhir/sid/ndc',
        code: drug.ndcCode,
        display: drug.genericName,
      });
    }

    // Build ingredient list from active ingredients
    const ingredient: fhir.MedicationIngredient[] = [];
    if (drug.activeIngredients && drug.activeIngredients.length > 0) {
      drug.activeIngredients.forEach((ingredientName, index) => {
        ingredient.push({
          itemCodeableConcept: {
            text: ingredientName,
          },
          isActive: true,
        });
      });
    } else if (drug.genericName) {
      // If no active ingredients listed, use generic name as ingredient
      ingredient.push({
        itemCodeableConcept: {
          text: drug.genericName,
        },
        isActive: true,
      });
    }

    // Build form from dosage forms
    let form: fhir.CodeableConcept | undefined;
    if (drug.dosageForms && drug.dosageForms.length > 0) {
      form = {
        coding: drug.dosageForms.map(df => ({
          system: 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm',
          code: this.mapDosageFormToCode(df),
          display: df,
        })),
        text: drug.dosageForms.join(', '),
      };
    }

    // Build strength from strength and unit
    let amount: fhir.Ratio | undefined;
    if (drug.strength && drug.unit) {
      amount = {
        numerator: {
          value: this.parseStrengthValue(drug.strength),
          unit: drug.unit,
          system: 'http://unitsofmeasure.org',
          code: this.mapUnitToUcum(drug.unit),
        },
        denominator: {
          value: 1,
          unit: this.getDenominatorUnit(drug.dosageForms?.[0] || 'unit'),
          system: 'http://unitsofmeasure.org',
        },
      };
    }

    // Map status
    const status = this.mapStatus(drug.status || (drug.isActive ? 'active' : 'inactive'));

    // Build batch information (if available)
    // Note: Our Drug entity doesn't have batch info, but we can add it in the future

    return {
      resourceType: 'Medication',
      id: drug.id,
      meta: {
        versionId: '1',
        lastUpdated: drug.updatedAt?.toISOString() || drug.createdAt.toISOString(),
      },
      status,
      code,
      form,
      ingredient: ingredient.length > 0 ? ingredient : undefined,
      amount,
      // Add brand name as extension if available
      extension: drug.brandNames && drug.brandNames.length > 0 ? [
        {
          url: 'http://hl7.org/fhir/StructureDefinition/medication-brandName',
          valueString: drug.brandNames[0],
        },
      ] : undefined,
      // Add description as note
      note: drug.description ? [{
        text: drug.description,
      }] : undefined,
    };
  }

  /**
   * Convert FHIR Medication to Drug entity data
   */
  static fromFhir(fhirMedication: fhir.Medication): Partial<Drug> {
    const code = fhirMedication.code;
    const genericName = code?.text || 
                       code?.coding?.[0]?.display || 
                       'Unknown Medication';

    // Extract RxNorm code
    const rxnormCode = code?.coding?.find(c => 
      c.system?.includes('rxnorm') || c.system === 'http://www.nlm.nih.gov/research/umls/rxnorm'
    )?.code;

    // Extract SNOMED code
    const snomedCode = code?.coding?.find(c => 
      c.system?.includes('snomed') || c.system === 'http://snomed.info/sct'
    )?.code;

    // Extract ATC code
    const atcCode = code?.coding?.find(c => 
      c.system?.includes('atc') || c.system === 'http://www.whocc.no/atc'
    )?.code;

    // Extract NDC code
    const ndcCode = code?.coding?.find(c => 
      c.system?.includes('ndc') || c.system === 'http://hl7.org/fhir/sid/ndc'
    )?.code;

    // Extract RxNorm name
    const rxnormName = code?.coding?.find(c => 
      c.system?.includes('rxnorm') || c.system === 'http://www.nlm.nih.gov/research/umls/rxnorm'
    )?.display;

    // Extract SNOMED term
    const snomedTerm = code?.coding?.find(c => 
      c.system?.includes('snomed') || c.system === 'http://snomed.info/sct'
    )?.display;

    // Extract active ingredients from ingredient array
    const activeIngredients = fhirMedication.ingredient
      ?.filter(ing => ing.isActive !== false)
      .map(ing => {
        if (ing.itemCodeableConcept?.text) {
          return ing.itemCodeableConcept.text;
        }
        if (ing.itemCodeableConcept?.coding?.[0]?.display) {
          return ing.itemCodeableConcept.coding[0].display;
        }
        return null;
      })
      .filter((ing): ing is string => ing !== null) || [];

    // Extract dosage forms
    const dosageForms = fhirMedication.form?.coding?.map(c => c.display || c.code) || 
                        (fhirMedication.form?.text ? [fhirMedication.form.text] : []);

    // Extract strength and unit from amount
    let strength: string | undefined;
    let unit: string | undefined;
    if (fhirMedication.amount?.numerator) {
      strength = fhirMedication.amount.numerator.value?.toString();
      unit = fhirMedication.amount.numerator.unit || fhirMedication.amount.numerator.code;
    }

    // Extract brand names from extension
    const brandNames = fhirMedication.extension
      ?.filter(ext => ext.url === 'http://hl7.org/fhir/StructureDefinition/medication-brandName')
      .map(ext => (ext.valueString || ext.valueCode || '') as string)
      .filter(name => name.length > 0) || [];

    // Extract description from note
    const description = fhirMedication.note?.[0]?.text;

    return {
      genericName,
      rxnormCode,
      rxnormName,
      snomedCode,
      snomedTerm,
      atcCode,
      ndcCode,
      strength,
      unit,
      activeIngredients: activeIngredients.length > 0 ? activeIngredients : undefined,
      dosageForms: dosageForms.length > 0 ? dosageForms : undefined,
      brandNames: brandNames.length > 0 ? brandNames : undefined,
      description,
      status: this.mapStatusFromFhir(fhirMedication.status),
      isActive: fhirMedication.status === 'active',
    };
  }

  /**
   * Map Drug status to FHIR Medication status
   */
  private static mapStatus(status?: string): fhir.Medication['status'] {
    const statusMap: Record<string, fhir.Medication['status']> = {
      'active': 'active',
      'inactive': 'inactive',
      'entered-in-error': 'entered-in-error',
      'discontinued': 'inactive',
    };
    return statusMap[status?.toLowerCase() || 'active'] || 'active';
  }

  /**
   * Map FHIR Medication status to Drug status
   */
  private static mapStatusFromFhir(status?: fhir.Medication['status']): string {
    const statusMap: Record<string, string> = {
      'active': 'active',
      'inactive': 'inactive',
      'entered-in-error': 'entered-in-error',
    };
    return statusMap[status || 'active'] || 'active';
  }

  /**
   * Map dosage form to FHIR code
   */
  private static mapDosageFormToCode(form: string): string {
    const formMap: Record<string, string> = {
      'tablet': 'TAB',
      'capsule': 'CAP',
      'liquid': 'LIQ',
      'injection': 'INJ',
      'cream': 'CRM',
      'ointment': 'OINT',
      'drops': 'DRP',
      'inhaler': 'INH',
      'patch': 'PATCH',
      'syrup': 'SYR',
      'suspension': 'SUSP',
      'solution': 'SOL',
      'gel': 'GEL',
      'spray': 'SPR',
      'powder': 'PWD',
    };
    return formMap[form.toLowerCase()] || 'TAB';
  }

  /**
   * Parse strength value from string
   */
  private static parseStrengthValue(strength: string): number {
    const match = strength.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 1;
  }

  /**
   * Map unit to UCUM code
   */
  private static mapUnitToUcum(unit: string): string {
    const unitMap: Record<string, string> = {
      'mg': 'mg',
      'g': 'g',
      'ml': 'ml',
      'l': 'L',
      'mcg': 'ug',
      'units': 'U',
      'tablet': '{tablet}',
      'capsule': '{capsule}',
      'dose': '{dose}',
      'patch': '{patch}',
    };
    return unitMap[unit.toLowerCase()] || unit;
  }

  /**
   * Get denominator unit based on dosage form
   */
  private static getDenominatorUnit(form: string): string {
    const formMap: Record<string, string> = {
      'tablet': '{tablet}',
      'capsule': '{capsule}',
      'liquid': 'ml',
      'injection': 'ml',
      'cream': 'g',
      'ointment': 'g',
      'drops': '{drop}',
      'inhaler': '{dose}',
      'patch': '{patch}',
    };
    return formMap[form.toLowerCase()] || '{unit}';
  }
}

