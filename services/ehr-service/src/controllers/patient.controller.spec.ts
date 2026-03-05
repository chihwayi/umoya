import { Test, TestingModule } from '@nestjs/testing';
import { PatientController } from './patient.controller';
import { PatientService } from '../services/patient.service';

describe('PatientController', () => {
  let controller: PatientController;
  let service: PatientService;
  const mockTenantDb = {} as any;

  const mockPatientService = {
    getAllPatients: jest.fn(),
    searchPatients: jest.fn(),
    advancedSearch: jest.fn(),
    getStats: jest.fn(),
    getPatientById: jest.fn(),
    getPatientByMRN: jest.fn(),
    getPatientContext: jest.fn(),
    createPatient: jest.fn(),
    updatePatient: jest.fn(),
    deactivatePatient: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PatientController],
      providers: [
        {
          provide: PatientService,
          useValue: mockPatientService,
        },
      ],
    }).compile();

    controller = module.get<PatientController>(PatientController);
    service = module.get<PatientService>(PatientService);
    jest.clearAllMocks();
  });

  it('returns shared patient context via getPatientContext', async () => {
    const expected = {
      patient: { id: 'patient-1', fullName: 'Jane Doe' },
      latestVitals: { id: 'vitals-1' },
      modules: {
        hiv: { latestEnrollment: { id: 'hiv-enroll-1' } },
        maternity: { latestEnrollment: null },
        oncology: { latestCase: null, activeCaseCount: 0 },
      },
      generatedAt: '2026-03-05T12:00:00.000Z',
    };
    mockPatientService.getPatientContext.mockResolvedValue(expected);

    const result = await controller.getPatientContext('patient-1', { tenantDb: mockTenantDb } as any);

    expect(service.getPatientContext).toHaveBeenCalledWith('patient-1', mockTenantDb);
    expect(result).toEqual(expected);
  });
});

