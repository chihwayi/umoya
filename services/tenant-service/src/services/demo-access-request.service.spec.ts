import { Repository, DataSource } from 'typeorm';
import { DemoAccessRequestService } from './demo-access-request.service';
import { DemoAccessRequest } from '../entities/demo-access-request.entity';
import { TenantService } from './tenant.service';
import { Tenant } from '../entities/tenant.entity';

describe('DemoAccessRequestService', () => {
  let service: DemoAccessRequestService;
  let repository: jest.Mocked<Repository<DemoAccessRequest>>;
  let tenantRepository: jest.Mocked<Repository<Tenant>>;
  let dataSource: jest.Mocked<DataSource>;
  let tenantService: jest.Mocked<TenantService>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<DemoAccessRequest>>;

    tenantRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Tenant>>;

    dataSource = {
      query: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;

    tenantService = {
      createTenant: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<TenantService>;

    service = new DemoAccessRequestService(repository, tenantRepository, dataSource, tenantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates the backing table on module init', async () => {
    await service.onModuleInit();
    expect(dataSource.query).toHaveBeenCalled();
  });

  it('creates a normalized request payload', async () => {
    repository.create.mockImplementation((payload: any) => payload);
    repository.save.mockImplementation(async (payload: any) => payload);

    const result = await service.createRequest({
      fullName: ' Dr Tariro Moyo ',
      clinicName: ' Borrowdale Specialist Centre ',
      workEmail: 'Doctor@Clinic.co.zw ',
      phone: ' +263771234567 ',
      roleTitle: ' Consultant physician ',
      specialization: ' HIV Medicine ',
      currentSystem: ' Paper notes ',
      interestSummary: 'We need DHIS2 and HIV workflow validation for our clinic.',
      interestAreas: ['HIV program workflows', 'DHIS2 reporting'],
      preferredContactMethod: 'email',
    });

    expect(result.workEmail).toBe('doctor@clinic.co.zw');
    expect(result.fullName).toBe('Dr Tariro Moyo');
    expect(result.interestAreas).toEqual(['HIV program workflows', 'DHIS2 reporting']);
    expect(repository.save).toHaveBeenCalled();
  });

  it('updates request review fields', async () => {
    repository.findOne.mockResolvedValue({
      id: 'req-1',
      fullName: 'Dr Tariro Moyo',
      clinicName: 'Borrowdale Specialist Centre',
      workEmail: 'doctor@clinic.co.zw',
      phone: '+263771234567',
      roleTitle: 'Consultant physician',
      specialization: 'HIV Medicine',
      currentSystem: 'Paper notes',
      interestSummary: 'Summary',
      interestAreas: ['DHIS2 reporting'],
      preferredContactMethod: 'email',
      status: 'new',
      adminNotes: null,
      assignedTenantId: null,
      assignedSubdomain: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as DemoAccessRequest);
    repository.save.mockImplementation(async (payload: any) => payload);

    const result = await service.updateRequest('req-1', {
      status: 'approved',
      adminNotes: 'Provision approved',
      assignedSubdomain: 'borrowdale-trial',
    });

    expect(result.status).toBe('approved');
    expect(result.assignedSubdomain).toBe('borrowdale-trial');
    expect(result.adminNotes).toBe('Provision approved');
  });

  it('provisions a testing tenant from a request', async () => {
    repository.findOne.mockResolvedValue({
      id: 'req-1',
      fullName: 'Dr Tariro Moyo',
      clinicName: 'Borrowdale Specialist Centre',
      workEmail: 'doctor@clinic.co.zw',
      phone: '+263771234567',
      roleTitle: 'Consultant physician',
      specialization: 'HIV Medicine',
      currentSystem: 'Paper notes',
      interestSummary: 'Summary',
      interestAreas: ['DHIS2 reporting'],
      preferredContactMethod: 'email',
      status: 'approved',
      adminNotes: null,
      assignedTenantId: null,
      assignedSubdomain: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as DemoAccessRequest);
    tenantRepository.findOne.mockResolvedValue(null as any);
    tenantService.createTenant.mockResolvedValue({
      id: 'tenant-1',
      clinicName: 'Borrowdale Specialist Centre Trial',
      subdomain: 'borrowdale-specialist-centre-trial',
    } as Tenant);
    repository.save.mockImplementation(async (payload: any) => payload);

    const result = await service.provisionTestingTenant('req-1');

    expect(tenantService.createTenant).toHaveBeenCalledWith(expect.objectContaining({
      clinicName: 'Borrowdale Specialist Centre Trial',
      subscriptionTier: 'enterprise',
    }));
    expect(result.request.status).toBe('provisioned');
    expect(result.request.assignedSubdomain).toBe('borrowdale-specialist-centre-trial');
  });
});
