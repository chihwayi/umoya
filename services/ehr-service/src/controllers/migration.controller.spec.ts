import { MigrationController } from './migration.controller';

describe('MigrationController', () => {
  let controller: MigrationController;

  beforeEach(() => {
    controller = new MigrationController();
  });

  it('parses supported patient CSV headers', async () => {
    const file = {
      originalname: 'patients.csv',
      buffer: Buffer.from('first_name,last_name,date_of_birth,gender,id_number\nJane,Doe,1990-01-01,F,ID-1\n'),
    } as Express.Multer.File;

    const job = await controller.uploadPatients(file);

    expect(job.totalRows).toBe(1);
    expect(job.records[0]).toMatchObject({
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      gender: 'F',
      nationalId: 'ID-1',
    });
  });

  it('flags missing required patient fields during dry run', async () => {
    const tenantDb = { query: jest.fn().mockResolvedValue([]) };
    const job = await controller.uploadPatients({
      originalname: 'patients.csv',
      buffer: Buffer.from('first_name,last_name,date_of_birth,gender\nJane,,1990-01-01,female\n'),
    } as Express.Multer.File);

    const result = await controller.dryRun(job.id, { tenantDb } as any);

    expect(result.errorRows).toBe(1);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'lastName', severity: 'error' }),
      ]),
    );
  });

  it('skips existing patients instead of importing duplicates', async () => {
    const queries: string[] = [];
    const tenantDb = {
      query: jest.fn().mockImplementation((sql: string) => {
        queries.push(sql);
        if (sql.includes('SELECT id FROM patients')) {
          return Promise.resolve([{ id: 'existing-patient' }]);
        }
        return Promise.resolve([]);
      }),
    };
    const job = await controller.uploadPatients({
      originalname: 'patients.csv',
      buffer: Buffer.from('patient_number,first_name,last_name,date_of_birth,gender\nP-1,Jane,Doe,1990-01-01,female\n'),
    } as Express.Multer.File);

    const result = await controller.importPatients(job.id, { tenantDb } as any, { confirm: true });

    expect(result.insertedRows).toBe(0);
    expect(result.skippedRows).toBe(1);
    expect(queries.some((sql) => sql.includes('INSERT INTO patients'))).toBe(false);
  });
});
