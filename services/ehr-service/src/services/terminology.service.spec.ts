import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TerminologyService, SnomedConcept, SnomedSearchResult } from './terminology.service';
import { DataSource } from 'typeorm';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TerminologyService', () => {
  let service: TerminologyService;
  let mockDataSource: Partial<DataSource>;

  beforeEach(async () => {
    // Mock DataSource
    mockDataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerminologyService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<TerminologyService>(TerminologyService);
    
    // Reset mocks
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockedAxios as any);
  });

  describe('searchConcepts', () => {
    it('should search SNOMED CT concepts successfully', async () => {
      const mockResponse = {
        data: {
          items: [
            {
              conceptId: '73211009',
              fsn: { term: 'Diabetes mellitus (disorder)' },
              pt: { term: 'Diabetes mellitus' },
              active: true,
            },
            {
              conceptId: '44054006',
              fsn: { term: 'Diabetes mellitus type 2 (disorder)' },
              pt: { term: 'Type 2 diabetes' },
              active: true,
            },
          ],
          total: 2,
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      mockDataSource.query = jest.fn().mockResolvedValue([]); // No cache

      const result = await service.searchConcepts('diabetes', 50, 0, true);

      expect(result).toBeDefined();
      expect(result.concepts).toHaveLength(2);
      expect(result.concepts[0].conceptId).toBe('73211009');
      expect(result.concepts[0].term).toContain('Diabetes');
      expect(result.total).toBe(2);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/browser/MAIN/concepts'),
        expect.objectContaining({
          params: expect.objectContaining({
            term: 'diabetes',
            limit: 50,
            offset: 0,
            activeFilter: true,
          }),
        }),
      );
    });

    it('should throw BadRequestException for short search term', async () => {
      await expect(service.searchConcepts('a')).rejects.toThrow(BadRequestException);
      await expect(service.searchConcepts('')).rejects.toThrow(BadRequestException);
    });

    it('should use cached results when available', async () => {
      const cachedResult: SnomedSearchResult = {
        concepts: [
          {
            conceptId: '73211009',
            term: 'Diabetes mellitus',
            active: true,
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      };

      mockDataSource.query = jest.fn().mockResolvedValue([{ data: cachedResult }]);

      const result = await service.searchConcepts('diabetes', 50, 0, true);

      expect(result).toEqual(cachedResult);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should fallback to cache on API failure', async () => {
      const cachedResult: SnomedSearchResult = {
        concepts: [{ conceptId: '73211009', term: 'Diabetes', active: true }],
        total: 1,
        limit: 50,
        offset: 0,
      };

      mockedAxios.get.mockRejectedValue(new Error('API Error'));
      mockDataSource.query = jest
        .fn()
        .mockResolvedValueOnce([]) // No cache on first call
        .mockResolvedValueOnce([{ data: cachedResult }]); // Cache on fallback

      const result = await service.searchConcepts('diabetes', 50, 0, true);

      expect(result).toEqual(cachedResult);
    });

    it('should limit results to maximum 100', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { items: [], total: 0 },
      });
      mockDataSource.query = jest.fn().mockResolvedValue([]);

      await service.searchConcepts('test', 200, 0, true);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 100, // Should be capped at 100
          }),
        }),
      );
    });
  });

  describe('validateConcept', () => {
    it('should validate a valid SNOMED CT concept', async () => {
      const mockResponse = {
        data: {
          conceptId: '73211009',
          fsn: { term: 'Diabetes mellitus (disorder)' },
          pt: { term: 'Diabetes mellitus' },
          active: true,
          moduleId: '900000000000207008',
          definitionStatus: '900000000000074008',
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      mockDataSource.query = jest.fn().mockResolvedValue([]);

      const result = await service.validateConcept('73211009');

      expect(result).toBeDefined();
      expect(result.conceptId).toBe('73211009');
      expect(result.active).toBe(true);
      expect(result.term).toContain('Diabetes');
    });

    it('should throw BadRequestException for invalid concept ID format', async () => {
      await expect(service.validateConcept('invalid')).rejects.toThrow(BadRequestException);
      await expect(service.validateConcept('abc123')).rejects.toThrow(BadRequestException);
      await expect(service.validateConcept('')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for inactive concept', async () => {
      const mockResponse = {
        data: {
          conceptId: '73211009',
          active: false,
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      mockDataSource.query = jest.fn().mockResolvedValue([]);

      await expect(service.validateConcept('73211009')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when concept not found', async () => {
      mockedAxios.get.mockRejectedValue({
        response: { status: 404, data: { message: 'Not found' } },
      });
      mockDataSource.query = jest.fn().mockResolvedValue([]);

      await expect(service.validateConcept('99999999')).rejects.toThrow(NotFoundException);
    });

    it('should use cached concept when available', async () => {
      const cachedConcept: SnomedConcept = {
        conceptId: '73211009',
        term: 'Diabetes mellitus',
        active: true,
      };

      mockDataSource.query = jest.fn().mockResolvedValue([{ concept_data: cachedConcept }]);

      const result = await service.validateConcept('73211009');

      expect(result).toEqual(cachedConcept);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('getConceptDetails', () => {
    it('should get concept details with children and parents', async () => {
      const conceptMock = {
        data: {
          conceptId: '73211009',
          fsn: { term: 'Diabetes mellitus' },
          active: true,
        },
      };

      const childrenMock = {
        data: {
          items: [
            { conceptId: '44054006', fsn: { term: 'Type 2 diabetes' } },
          ],
        },
      };

      const parentsMock = {
        data: {
          items: [
            { conceptId: '64572001', fsn: { term: 'Disease' } },
          ],
        },
      };

      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce(conceptMock)
        .mockResolvedValueOnce(childrenMock)
        .mockResolvedValueOnce(parentsMock);

      mockDataSource.query = jest.fn().mockResolvedValue([]);

      const result = await service.getConceptDetails('73211009');

      expect(result.concept).toBeDefined();
      expect(result.children).toHaveLength(1);
      expect(result.parents).toHaveLength(1);
      expect(result.children[0].conceptId).toBe('44054006');
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({
          data: { conceptId: '73211009', active: true },
        })
        .mockRejectedValueOnce(new Error('Children API error'))
        .mockRejectedValueOnce(new Error('Parents API error'));

      mockDataSource.query = jest.fn().mockResolvedValue([]);

      const result = await service.getConceptDetails('73211009');

      expect(result.concept).toBeDefined();
      expect(result.children).toEqual([]);
      expect(result.parents).toEqual([]);
    });
  });

  describe('mapConcept', () => {
    it('should map SNOMED CT to ICD10', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { conceptId: '73211009', active: true },
      });
      mockDataSource.query = jest
        .fn()
        .mockResolvedValueOnce([]) // validateConcept cache check
        .mockResolvedValueOnce([]) // validateConcept API call
        .mockResolvedValueOnce([]); // mapping cache check

      const result = await service.mapConcept('73211009', 'ICD10');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should use cached mappings when available', async () => {
      const cachedMappings = [
        {
          sourceCode: '73211009',
          targetCode: 'E11',
          targetSystem: 'ICD10' as const,
          active: true,
          mapCategory: 'EQUIVALENT',
        },
      ];

      mockedAxios.get.mockResolvedValue({
        data: { conceptId: '73211009', active: true },
      });
      mockDataSource.query = jest
        .fn()
        .mockResolvedValueOnce([]) // validateConcept
        .mockResolvedValueOnce([{ mapping_data: cachedMappings[0] }]); // cached mappings

      const result = await service.mapConcept('73211009', 'ICD10');

      expect(result).toEqual(cachedMappings);
    });

    it('should validate concept before mapping', async () => {
      mockedAxios.get.mockRejectedValue({
        response: { status: 404 },
      });
      mockDataSource.query = jest.fn().mockResolvedValue([]);

      await expect(service.mapConcept('99999999', 'ICD10')).rejects.toThrow();
    });
  });
});

