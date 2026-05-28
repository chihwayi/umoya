import { FollowUpRecommendationService } from './followup-recommendation.service';

function makeService() {
  return new FollowUpRecommendationService(undefined as any, undefined as any, undefined as any);
}

function makeDb() {
  return { query: jest.fn().mockResolvedValue([{ id: 42 }]) };
}

describe('FollowUpRecommendationService', () => {
  it('recommends 2-day in-person for critical risk', async () => {
    const svc = makeService();
    const db = makeDb();
    const res = await svc.generateRecommendation(db, {
      patientId: 1, encounterType: 'consultation',
      riskBand: 'critical', diagnoses: [],
      openCareGapsCount: 0, medicationsChanged: false,
      subdomain: 'test',
    });
    expect(res.recommendedDays).toBe(2);
    expect(res.recommendedModality).toBe('in_person');
    expect(res.urgency).toBe('urgent');
  });

  it('recommends 7-day in-person for discharge', async () => {
    const svc = makeService();
    const db = makeDb();
    const res = await svc.generateRecommendation(db, {
      patientId: 2, encounterType: 'discharge',
      riskBand: 'low', diagnoses: [],
      openCareGapsCount: 0, medicationsChanged: false,
      subdomain: 'test',
    });
    expect(res.recommendedDays).toBe(7);
    expect(res.recommendedModality).toBe('in_person');
  });

  it('recommends 14-day in-person for moderate risk with cancer dx', async () => {
    const svc = makeService();
    const db = makeDb();
    const res = await svc.generateRecommendation(db, {
      patientId: 3, encounterType: 'consultation',
      riskBand: 'moderate', diagnoses: ['Breast cancer'],
      openCareGapsCount: 1, medicationsChanged: true,
      subdomain: 'test',
    });
    expect(res.recommendedDays).toBe(14);
    expect(res.recommendedModality).toBe('in_person');
  });

  it('persists recommendation to DB', async () => {
    const svc = makeService();
    const db = makeDb();
    await svc.generateRecommendation(db, {
      patientId: 4, encounterType: 'telemedicine',
      riskBand: 'low', diagnoses: [],
      openCareGapsCount: 0, medicationsChanged: false,
      subdomain: 'test',
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO followup_recommendations'),
      expect.any(Array),
    );
  });

  it('accepts recommendation and updates DB', async () => {
    const svc = makeService();
    const db = makeDb();
    await svc.acceptRecommendation(db, 42, 99);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE followup_recommendations'),
      expect.arrayContaining([99]),
    );
  });
});
