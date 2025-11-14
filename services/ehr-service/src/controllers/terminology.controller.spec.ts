import { Test, TestingModule } from '@nestjs/testing';
import { TerminologyController } from './terminology.controller';
import { TerminologyService } from '../services/terminology.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TerminologyController', () => {
  let controller: TerminologyController;
  let service: TerminologyService;

  const mockTerminologyService = {
    searchConcepts: jest.fn(),
    validateConcept: jest.fn(),
    getConceptDetails: jest.fn(),
    mapConcept: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TerminologyController],
      providers: [
        {
          provide: TerminologyService,
          useValue: mockTerminologyService,
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
        'diabetes',
        '50',
        '0',
        'true',
        {} as any,
      );

      expect(service.searchConcepts).toHaveBeenCalledWith('diabetes', 50, 0, true);
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

      await controller.searchConcepts('test', undefined, undefined, undefined, {} as any);

      expect(service.searchConcepts).toHaveBeenCalledWith('test', 50, 0, true);
    });

    it('should propagate service errors', async () => {
      mockTerminologyService.searchConcepts.mockRejectedValue(
        new BadRequestException('Invalid search term'),
      );

      await expect(
        controller.searchConcepts('a', '50', '0', 'true', {} as any),
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

      const result = await controller.validateConcept('73211009', {} as any);

      expect(service.validateConcept).toHaveBeenCalledWith('73211009');
      expect(result).toEqual(mockConcept);
    });

    it('should propagate NotFoundException', async () => {
      mockTerminologyService.validateConcept.mockRejectedValue(
        new NotFoundException('Concept not found'),
      );

      await expect(controller.validateConcept('99999999', {} as any)).rejects.toThrow(
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

      const result = await controller.getConceptDetails('73211009', {} as any);

      expect(service.getConceptDetails).toHaveBeenCalledWith('73211009');
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

      const result = await controller.mapConcept('73211009', 'ICD10', {} as any);

      expect(service.mapConcept).toHaveBeenCalledWith('73211009', 'ICD10');
      expect(result).toEqual(mockMappings);
    });

    it('should handle different target systems', async () => {
      mockTerminologyService.mapConcept.mockResolvedValue([]);

      await controller.mapConcept('73211009', 'ICD11', {} as any);
      expect(service.mapConcept).toHaveBeenCalledWith('73211009', 'ICD11');

      await controller.mapConcept('73211009', 'LOINC', {} as any);
      expect(service.mapConcept).toHaveBeenCalledWith('73211009', 'LOINC');

      await controller.mapConcept('73211009', 'CPT', {} as any);
      expect(service.mapConcept).toHaveBeenCalledWith('73211009', 'CPT');
    });
  });
});

