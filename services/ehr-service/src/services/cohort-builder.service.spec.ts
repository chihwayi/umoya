import { BadRequestException } from '@nestjs/common';
import { CohortBuilderService } from './cohort-builder.service';

describe('CohortBuilderService', () => {
  const svc = new CohortBuilderService();

  it('rejects unknown cohort fields', () => {
    expect(() =>
      svc.buildQuery({ conditions: [{ field: 'DROP TABLE', operator: 'eq', value: '1' }], logic: 'AND' }),
    ).toThrow(BadRequestException);
  });

  it('builds correct parameterised SQL for sex = M', () => {
    const { sql, params } = svc.buildQuery({
      conditions: [{ field: 'sex', operator: 'eq', value: 'M' }],
      logic: 'AND',
    });
    expect(sql).toContain('p.sex = $1');
    expect(params).toEqual(['M']);
  });

  it('builds AND query for multiple criteria', () => {
    const { sql, params } = svc.buildQuery({
      conditions: [
        { field: 'sex', operator: 'eq', value: 'F' },
        { field: 'age_min', operator: 'gte', value: 15 },
      ],
      logic: 'AND',
    });
    expect(sql).toContain('p.sex = $1');
    expect(sql).toContain('AND');
    expect(params).toEqual(['F', 15]);
  });
});
