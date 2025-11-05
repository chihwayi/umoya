import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class HivPediatricDosingService {
  private readonly logger = new Logger(HivPediatricDosingService.name);

  /**
   * Calculate pediatric ARV dosing based on weight and BSA
   * Based on WHO guidelines for pediatric HIV treatment
   */
  calculatePediatricDose(
    regimenCode: string,
    weightKg: number,
    ageMonths: number,
    bsa?: number
  ): {
    dose: string;
    frequency: string;
    formulation: string;
    notes: string;
  } | null {
    if (!regimenCode || !weightKg || weightKg <= 0) {
      return null;
    }

    // Common pediatric dosing guidelines (simplified - should reference WHO guidelines)
    const dosingTable: { [key: string]: any } = {
      // TLD (TDF+3TC+DTG) - Pediatric
      '4k': {
        weightBands: [
          { min: 14, max: 20, dose: 'TDF 150mg + 3TC 75mg + DTG 5mg', frequency: 'Once daily', formulation: 'FDC' },
          { min: 20, max: 25, dose: 'TDF 200mg + 3TC 100mg + DTG 10mg', frequency: 'Once daily', formulation: 'FDC' },
          { min: 25, max: 35, dose: 'TDF 250mg + 3TC 150mg + DTG 25mg', frequency: 'Once daily', formulation: 'FDC' },
        ],
        notes: 'Based on WHO weight bands. Adjust based on actual product availability.'
      },
      // ABC+3TC+DTG - Pediatric
      '4j': {
        weightBands: [
          { min: 14, max: 20, dose: 'ABC 60mg + 3TC 30mg + DTG 5mg', frequency: 'Twice daily', formulation: 'Separate tabs' },
          { min: 20, max: 25, dose: 'ABC 120mg + 3TC 60mg + DTG 10mg', frequency: 'Twice daily', formulation: 'Separate tabs' },
        ],
        notes: 'Dosing based on weight. Use weight bands for dosing.'
      },
      // AZT+3TC+LPV/r - Pediatric
      '4e': {
        weightBands: [
          { min: 3, max: 5, dose: 'AZT 60mg + 3TC 30mg + LPV/r 12/3mg', frequency: 'Twice daily', formulation: 'Liquid' },
          { min: 5, max: 10, dose: 'AZT 60mg + 3TC 30mg + LPV/r 40/10mg', frequency: 'Twice daily', formulation: 'Liquid/Tabs' },
          { min: 10, max: 14, dose: 'AZT 60mg + 3TC 30mg + LPV/r 80/20mg', frequency: 'Twice daily', formulation: 'Tabs' },
        ],
        notes: 'Pediatric dosing - adjust LPV/r based on age and weight'
      }
    };

    const regimenDosing = dosingTable[regimenCode];
    if (!regimenDosing) {
      return {
        dose: 'Consult pediatric dosing guidelines',
        frequency: 'As per WHO guidelines',
        formulation: 'N/A',
        notes: `Dosing for regimen ${regimenCode} not in lookup table. Please consult WHO pediatric ARV dosing guidelines or product insert.`
      };
    }

    // Find appropriate weight band
    const weightBand = regimenDosing.weightBands.find(
      (band: any) => weightKg >= band.min && weightKg < band.max
    );

    if (weightBand) {
      return {
        dose: weightBand.dose,
        frequency: weightBand.frequency,
        formulation: weightBand.formulation,
        notes: regimenDosing.notes
      };
    }

    // If weight is outside bands, use BSA calculation if available
    if (bsa && bsa > 0) {
      // Simplified BSA-based dosing (should reference specific guidelines)
      return {
        dose: `Calculate based on BSA: ${bsa.toFixed(2)} m²`,
        frequency: 'As per BSA calculation',
        formulation: 'Individualized',
        notes: `BSA-based dosing for patient with BSA ${bsa.toFixed(2)} m². Consult dosing calculator or product insert.`
      };
    }

    return {
      dose: 'Weight outside standard bands',
      frequency: 'Consult guidelines',
      formulation: 'N/A',
      notes: `Patient weight (${weightKg} kg) is outside standard dosing bands. Please consult WHO pediatric ARV dosing guidelines or use BSA-based calculation.`
    };
  }

  /**
   * Calculate BSA (Body Surface Area) using Mosteller formula
   * BSA (m²) = √(height(cm) × weight(kg) / 3600)
   */
  calculateBSA(heightCm: number, weightKg: number): number {
    if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) {
      return 0;
    }
    return Math.sqrt((heightCm * weightKg) / 3600);
  }
}

