export interface HivCdssThresholds {
  highViralLoad: number;
  eacConsecutiveHighResults: number;
  eacWindowMonthsMin: number;
  eacWindowMonthsMax: number;
  vlMonitoringStableMonths: number;
  vlMonitoringUnstableMonths: number;
  testingOverdueDaysGrace: number;
  artInitiationMaxDays: number;
}

export interface HivCdssMessages {
  eacOverview: string;
  eacCardListing: string;
  highViralLoadVisit: string;
  testingTimelinePositive: string;
  testingTimelineOverduePrefix: string;
  nurseStandardVlDue: string;
  nurseStandardTbScreening: string;
  nurseStandardCotrimoxazole: string;
  nurseStandardPregnancy: string;
}

export interface HivCdssConfig {
  thresholds: HivCdssThresholds;
  messages: HivCdssMessages;
}

const defaultHivCdssConfig: HivCdssConfig = {
  thresholds: {
    highViralLoad: 1000,
    eacConsecutiveHighResults: 2,
    eacWindowMonthsMin: 3,
    eacWindowMonthsMax: 6,
    vlMonitoringStableMonths: 6,
    vlMonitoringUnstableMonths: 3,
    testingOverdueDaysGrace: 0,
    artInitiationMaxDays: 7,
  },
  messages: {
    eacOverview:
      'Patient has 2 consecutive high viral loads. Enhanced Adherence Counseling is required per WHO guidelines.',
    eacCardListing:
      '2 consecutive high viral loads detected. EAC intervention required per WHO guidelines.',
    highViralLoadVisit:
      'If this is the second consecutive high viral load within the recommended window, the patient will require Enhanced Adherence Counseling (EAC) per WHO guidelines. Check the EAC tab in patient details after saving.',
    testingTimelinePositive:
      'WHO DAK: Ensure immediate linkage, partner services and baseline labs.',
    testingTimelineOverduePrefix: 'WHO DAK: Retesting overdue since',
    nurseStandardVlDue: 'Viral Load due if last result older than configured interval',
    nurseStandardTbScreening: 'Consider TB testing if any symptom present',
    nurseStandardCotrimoxazole: 'Ensure cotrimoxazole prophylaxis when indicated',
    nurseStandardPregnancy:
      'For pregnancy or breastfeeding: ensure PMTCT linkage and Viral Load monitoring',
  },
};

export const hivCdssConfig: HivCdssConfig = defaultHivCdssConfig;

export function getHivCdssConfig(tenantSlug?: string): HivCdssConfig {
  return hivCdssConfig;
}

