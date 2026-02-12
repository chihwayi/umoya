import { Test, TestingModule } from '@nestjs/testing';
import { TerminologyController } from './terminology.controller';
import { TerminologyService } from '../services/terminology.service';
import { TerminologyImportService } from '../services/terminology-import.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TerminologyController', () => {
  let controller: TerminologyController;
  let service: TerminologyService;
  const mockTenantDb = {} as any;

  const mockTerminologyService = {
    searchConcepts: jest.fn(),
    validateConcept: jest.fn(),
    getConceptDetails: jest.fn(),
    mapConcept: jest.fn(),
  };

  const mockTerminologyImportService = {
    importFile: jest.fn(),
    getAllJobs: jest.fn(),
    getStats: jest.fn(),
    getImportStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TerminologyController],
      providers: [
        {
          provide: TerminologyService,
          useValue: mockTerminologyService,
        },
        {
          provide: TerminologyImportService,
          useValue: mockTerminologyImportService,
        },
      ],
    }).compile();

    controller = module.get<TerminologyController>(TerminologyController);
    service = module.get<TerminologyService>(TerminologyService);

    jest.clearAllMocks();
  });

  describe('searchConcepts', () => {
    it('should call service.searchConcepts with correct parameters', async () => {
      const mockResult = {
        concepts: [
          { conceptId: '73211009', term: 'Diabetes mellitus', active: true },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      };

      mockTerminologyService.searchConcepts.mockResolvedValue(mockResult);

      const result = await controller.searchConcepts(
        { tenantDb: mockTenantDb } as any,
        'diabetes',
        '50',
        '0',
        'true',
      );

      expect(service.searchConcepts).toHaveBeenCalledWith(mockTenantDb, 'diabetes', 50, 0, true, undefined, undefined);
      expect(result).toEqual(mockResult);
    });

    it('should handle default parameters', async () => {
      const mockResult = {
        concepts: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      mockTerminologyService.searchConcepts.mockResolvedValue(mockResult);

      await controller.searchConcepts({ tenantDb: mockTenantDb } as any, 'test', undefined, undefined, undefined);

      expect(service.searchConcepts).toHaveBeenCalledWith(mockTenantDb, 'test', 50, 0, true, undefined, undefined);
    });

    it('should propagate service errors', async () => {
      mockTerminologyService.searchConcepts.mockRejectedValue(
        new BadRequestException('Invalid search term'),
      );

      await expect(
        controller.searchConcepts({ tenantDb: mockTenantDb } as any, 'a', '50', '0', 'true'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateConcept', () => {
    it('should call service.validateConcept with concept ID', async () => {
      const mockConcept = {
        conceptId: '73211009',
        term: 'Diabetes mellitus',
        active: true,
      };

      mockTerminologyService.validateConcept.mockResolvedValue(mockConcept);

      const result = await controller.validateConcept('73211009', { tenantDb: mockTenantDb } as any);

      expect(service.validateConcept).toHaveBeenCalledWith(mockTenantDb, '73211009');
      expect(result).toEqual(mockConcept);
    });

    it('should propagate NotFoundException', async () => {
      mockTerminologyService.validateConcept.mockRejectedValue(
        new NotFoundException('Concept not found'),
      );

      await expect(controller.validateConcept('99999999', { tenantDb: mockTenantDb } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getConceptDetails', () => {
    it('should call service.getConceptDetails', async () => {
      const mockDetails = {
        concept: { conceptId: '73211009', term: 'Diabetes' },
        children: [],
        parents: [],
      };

      mockTerminologyService.getConceptDetails.mockResolvedValue(mockDetails);

      const result = await controller.getConceptDetails('73211009', { tenantDb: mockTenantDb } as any);

      expect(service.getConceptDetails).toHaveBeenCalledWith(mockTenantDb, '73211009');
      expect(result).toEqual(mockDetails);
    });
  });

  describe('mapConcept', () => {
    it('should call service.mapConcept with correct parameters', async () => {
      const mockMappings = [
        {
          sourceCode: '73211009',
          targetCode: 'E11',
          targetSystem: 'ICD10' as const,
          active: true,
        },
      ];

      mockTerminologyService.mapConcept.mockResolvedValue(mockMappings);

      const result = await controller.mapConcept('73211009', 'ICD10', { tenantDb: mockTenantDb } as any);

      expect(service.mapConcept).toHaveBeenCalledWith(mockTenantDb, '73211009', 'ICD10');
      expect(result).toEqual(mockMappings);
    });

    it('should handle different target systems', async () => {
      mockTerminologyService.mapConcept.mockResolvedValue([]);

      await controller.mapConcept('73211009', 'ICD11', { tenantDb: mockTenantDb } as any);
      expect(service.mapConcept).toHaveBeenCalledWith(mockTenantDb, '73211009', 'ICD11');

      await controller.mapConcept('73211009', 'LOINC', { tenantDb: mockTenantDb } as any);
      expect(service.mapConcept).toHaveBeenCalledWith(mockTenantDb, '73211009', 'LOINC');

      await controller.mapConcept('73211009', 'CPT', { tenantDb: mockTenantDb } as any);
      expect(service.mapConcept).toHaveBeenCalledWith(mockTenantDb, '73211009', 'CPT');
    });
  });
});

