import { Injectable } from '@nestjs/common';

interface ResistanceInput {
  currentRegimen: string;
  regimenDurationMonths: number;
  recentVl: number;
  previousVl: number | null;
  regimenContains: (drug: string) => boolean;
  vlTrend: 'suppressed' | 'rising' | 'failing' | 'rebounding';
}

type ResistanceRisk = 'low' | 'moderate' | 'high';

const RESISTANCE_RULES = [
  {
    drugClass: 'NNRTI',
    check: (data: ResistanceInput) => data.regimenContains('EFV') || data.regimenContains('NVP'),
    vlTrend: 'failing',
    risk: 'high' as const,
    note: 'Prior NNRTI exposure + virological failure - high K103N/Y181C/E138A resistance probability',
  },
  {
    drugClass: 'NRTI',
    check: (data: ResistanceInput) =>
      (data.regimenContains('3TC') || data.regimenContains('FTC')) && data.regimenDurationMonths >= 3,
    vlTrend: 'failing',
    risk: 'high' as const,
    note: 'M184V emerges rapidly on 3TC/FTC with virological failure',
  },
  {
    drugClass: 'PI',
    check: (data: ResistanceInput) =>
      (data.regimenContains('LPV/r') || data.regimenContains('ATV/r')) && data.regimenDurationMonths >= 24,
    vlTrend: 'rebounding',
    risk: 'moderate' as const,
    note: 'Long-term PI use with rebound VL - PI mutations possible but uncommon with boosted regimen',
  },
  {
    drugClass: 'INSTI',
    check: (data: ResistanceInput) => data.regimenContains('RAL') && data.regimenDurationMonths >= 12,
    vlTrend: 'failing',
    risk: 'moderate' as const,
    note: 'Prior RAL exposure + failure - INSTI resistance possible',
  },
];

@Injectable()
export class HivResistanceService {
  assessResistance(params: {
    currentRegimen: string;
    regimenDurationMonths: number;
    recentVl: number;
    previousVl: number | null;
  }): {
    nnrtiRisk: ResistanceRisk;
    nrtiRisk: ResistanceRisk;
    piRisk: ResistanceRisk;
    instiRisk: ResistanceRisk;
    overallRisk: ResistanceRisk;
    resistanceTestRecommended: boolean;
    notes: string[];
  } {
    const regimenContains = (drug: string) => params.currentRegimen.toUpperCase().includes(drug.toUpperCase());
    const vlTrend = this.classifyVlTrend(params.recentVl, params.previousVl);
    const input: ResistanceInput = { ...params, regimenContains, vlTrend };
    const risks: Record<string, ResistanceRisk> = { NNRTI: 'low', NRTI: 'low', PI: 'low', INSTI: 'low' };
    const notes: string[] = [];

    for (const rule of RESISTANCE_RULES) {
      if (rule.check(input) && (rule.vlTrend === vlTrend || vlTrend === 'failing')) {
        const current = risks[rule.drugClass];
        if (current === 'low' || (current === 'moderate' && rule.risk === 'high')) {
          risks[rule.drugClass] = rule.risk;
          notes.push(rule.note);
        }
      }
    }

    const riskValues = Object.values(risks);
    const overallRisk: ResistanceRisk = riskValues.includes('high')
      ? 'high'
      : riskValues.includes('moderate') ? 'moderate' : 'low';

    return {
      nnrtiRisk: risks.NNRTI,
      nrtiRisk: risks.NRTI,
      piRisk: risks.PI,
      instiRisk: risks.INSTI,
      overallRisk,
      resistanceTestRecommended: overallRisk === 'high' || params.recentVl > 1000,
      notes,
    };
  }

  private classifyVlTrend(recent: number, previous: number | null): 'suppressed' | 'rising' | 'failing' | 'rebounding' {
    if (recent < 1000) return 'suppressed';
    if (previous === null) return 'failing';
    if (recent > previous * 1.5) return 'failing';
    if (previous < 1000 && recent >= 1000) return 'rebounding';
    return 'rising';
  }

  recommendRegimenSwitch(params: {
    currentRegimen: string;
    resistanceAssessment: ReturnType<HivResistanceService['assessResistance']>;
    isPregnant: boolean;
    creatinine: number;
    isThirdLine: boolean;
  }): { recommendation: string; rationale: string; requiresSpecialistApproval: boolean } {
    if (params.isThirdLine) {
      return {
        recommendation: 'Third-line regimen - refer to National ART Technical Committee',
        rationale: 'Third-line switching requires NATC approval and resistance test results',
        requiresSpecialistApproval: true,
      };
    }

    if (params.resistanceAssessment.nnrtiRisk === 'high' && params.currentRegimen.match(/EFV|NVP/i)) {
      const piBase = params.isPregnant ? 'LPV/r 400/100mg BD' : 'ATV/r 300/100mg OD';
      const backboneA = params.creatinine > 1.5 ? 'AZT 300mg BD' : 'TDF 300mg OD';
      return {
        recommendation: `${backboneA} + 3TC 300mg OD + ${piBase}`,
        rationale: `NNRTI failure on first-line. Switching to PI-based second-line. ${params.creatinine > 1.5 ? 'TDF avoided (creatinine > 1.5).' : ''} ${params.isPregnant ? 'LPV/r preferred in pregnancy.' : ''}`,
        requiresSpecialistApproval: false,
      };
    }

    if (params.resistanceAssessment.piRisk !== 'low' && params.currentRegimen.match(/LPV|ATV|DRV/i)) {
      return {
        recommendation: 'DRV/r 800/100mg OD + DTG 50mg OD + optimised NRTI backbone (after resistance test)',
        rationale: 'Second-line PI failure. DTG-based third-line after resistance testing. Requires NATC approval.',
        requiresSpecialistApproval: true,
      };
    }

    return {
      recommendation: 'Continue current regimen. Intensify adherence counselling (EAC).',
      rationale: 'Resistance risk is low. No regimen switch indicated at this time.',
      requiresSpecialistApproval: false,
    };
  }
}
