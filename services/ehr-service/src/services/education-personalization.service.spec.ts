import { EducationPersonalizationService } from './education-personalization.service';

function makeService() {
  return new EducationPersonalizationService();
}

describe('EducationPersonalizationService', () => {
  it('returns popular courses when patient has no diagnoses', async () => {
    const svc = makeService();
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce([]) // diagnoses
        .mockResolvedValueOnce([{ course_id: 'c1', title: 'Health 101', description: 'Basics', thumbnail_url: null, enrolment_count: '10' }])
        .mockResolvedValueOnce([]), // enrolments
    };
    const result = await svc.getPersonalizedCourses('p1', db);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Health 101');
  });

  it('returns ranked courses when patient has diagnoses', async () => {
    const svc = makeService();
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce([{ icd10_code: 'E11', snomed_code: null, status: 'chronic' }])
        .mockResolvedValueOnce([{
          course_id: 'c2', title: 'Diabetes Management',
          description: 'Managing T2DM', thumbnail_url: null, relevance_score: '2.5',
          matched_codes: ['E11'],
        }])
        .mockResolvedValueOnce([]) // enrolments
        .mockResolvedValueOnce([]) // recommendations
        .mockResolvedValueOnce([]), // clinician recommended
    };
    const result = await svc.getPersonalizedCourses('p1', db);
    expect(result.length).toBeGreaterThan(0);
  });

  it('excludes completed courses', async () => {
    const svc = makeService();
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce([{ icd10_code: 'E11', snomed_code: null, status: 'chronic' }])
        .mockResolvedValueOnce([{
          course_id: 'c2', title: 'DM Course', description: '',
          thumbnail_url: null, relevance_score: '1.0', matched_codes: ['E11'],
        }])
        .mockResolvedValueOnce([{ course_id: 'c2', status: 'completed' }]) // enrolments
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    const result = await svc.getPersonalizedCourses('p1', db);
    expect(result.find((r) => r.courseId === 'c2')).toBeUndefined();
  });

  it('recommendCourse upserts recommendation', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([{ id: 'rec-1' }]) };
    const result = await svc.recommendCourse('p1', 'c1', 'doc1', 'Take this course', db);
    expect(result).toMatchObject({ id: 'rec-1' });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO education_clinician_recommendations'),
      expect.any(Array),
    );
  });
});
