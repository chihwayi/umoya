import { Injectable } from '@nestjs/common';

export interface WeightBandDose {
  weightMin: number;
  weightMax: number;
  abcLtcFdc?: string;
  efv?: string;
  lpvR?: string;
  nvp?: string;
  note?: string;
}

const WEIGHT_BAND_TABLE: WeightBandDose[] = [
  {
    weightMin: 3, weightMax: 5.9,
    abcLtcFdc: '30/15 mg BID',
    lpvR: '16/4 mg/kg BID (liquid)',
    nvp: '5 mg/kg OD for 2 weeks then 5 mg/kg BID',
    note: 'EFV not recommended <3 years',
  },
  {
    weightMin: 6, weightMax: 9.9,
    abcLtcFdc: '60/30 mg BID',
    lpvR: '13/3.25 mg/kg BID (liquid)',
    nvp: '5 mg/kg OD for 2 weeks then 5 mg/kg BID',
  },
  {
    weightMin: 10, weightMax: 13.9,
    abcLtcFdc: 'ABC/3TC 1 tab OD (adult FDC)',
    efv: '200 mg OD',
    lpvR: '200/50 mg BID (tablet)',
  },
  {
    weightMin: 14, weightMax: 19.9,
    abcLtcFdc: 'ABC/3TC 1.5 tabs OD',
    efv: '200 mg OD',
    lpvR: '200/50 mg BID',
  },
  {
    weightMin: 20, weightMax: 24.9,
    abcLtcFdc: 'ABC/3TC 2 tabs OD',
    efv: '300 mg OD',
    lpvR: '300/75 mg BID',
  },
  {
    weightMin: 25, weightMax: 999,
    abcLtcFdc: 'Adult dosing — TDF/3TC/DTG 1 tab OD',
    efv: 'Adult: EFV 600 mg OD',
    lpvR: 'Adult: LPV/r 400/100 mg BID',
    note: '≥25 kg — use adult formulations',
  },
];

@Injectable()
export class PaediatricDosingService {
  getDoseForWeight(weightKg: number): WeightBandDose | null {
    return WEIGHT_BAND_TABLE.find(
      (band) => weightKg >= band.weightMin && weightKg <= band.weightMax,
    ) ?? null;
  }

  detectWeightBandChange(
    previousWeight: number,
    currentWeight: number,
  ): { changed: boolean; previousBand: string; newBand: string } {
    const prevBand = this.getDoseForWeight(previousWeight);
    const newBand = this.getDoseForWeight(currentWeight);
    const bandLabel = (b: WeightBandDose | null) =>
      b ? `${b.weightMin}–${b.weightMax} kg` : 'unknown';

    return {
      changed: prevBand?.weightMin !== newBand?.weightMin,
      previousBand: bandLabel(prevBand),
      newBand: bandLabel(newBand),
    };
  }

  getFullDoseTable(): WeightBandDose[] {
    return WEIGHT_BAND_TABLE;
  }

  isNearBandBoundary(weightKg: number, thresholdKg = 1): boolean {
    const band = this.getDoseForWeight(weightKg);
    return band !== null && weightKg >= band.weightMax - thresholdKg;
  }
}
