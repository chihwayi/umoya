import { AlhivTransitionService } from './alhiv-transition.service';

describe('AlhivTransitionService', () => {
  const svc = new AlhivTransitionService();

  it('classifies low readiness when total < 12', () => {
    const result = svc.calculateTransitionReadiness({
      knowsDiagnosis: 1, knowsMedications: 2, managesOwnMedications: 1,
      attendsAppointmentsAlone: 2, communicatesWithProvider: 2, understandsConfidentiality: 1,
    });
    expect(result.readinessLevel).toBe('low');
    expect(result.totalScore).toBe(9);
  });

  it('classifies moderate readiness when total is 12–20', () => {
    const result = svc.calculateTransitionReadiness({
      knowsDiagnosis: 3, knowsMedications: 3, managesOwnMedications: 2,
      attendsAppointmentsAlone: 3, communicatesWithProvider: 3, understandsConfidentiality: 2,
    });
    expect(result.readinessLevel).toBe('moderate');
    expect(result.totalScore).toBe(16);
  });

  it('classifies high readiness when total >= 21', () => {
    const result = svc.calculateTransitionReadiness({
      knowsDiagnosis: 5, knowsMedications: 4, managesOwnMedications: 4,
      attendsAppointmentsAlone: 4, communicatesWithProvider: 5, understandsConfidentiality: 4,
    });
    expect(result.readinessLevel).toBe('high');
  });
});
