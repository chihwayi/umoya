import { Controller, Get, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { TerminologyService } from '../services/terminology.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Terminology (SNOMED CT)')
@ApiBearerAuth()
@Controller('terminology')
@UseGuards(JwtAuthGuard)
export class TerminologyController {
  constructor(private readonly terminologyService: TerminologyService) {}

  @Get('snomed/search')
  @ApiOperation({ summary: 'Search SNOMED CT concepts by term' })
  @ApiQuery({ name: 'term', description: 'Search term', required: true })
  @ApiQuery({ name: 'limit', description: 'Maximum number of results', required: false, type: Number })
  @ApiQuery({ name: 'offset', description: 'Offset for pagination', required: false, type: Number })
  @ApiQuery({ name: 'activeOnly', description: 'Only return active concepts', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Search results returned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  async searchConcepts(
    @Query('term') term: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('activeOnly') activeOnly?: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.terminologyService.searchConcepts(
      req.tenantDb,
      term,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
      activeOnly !== 'false',
    );
  }

  @Get('snomed/validate/:conceptId')
  @ApiOperation({ summary: 'Validate a SNOMED CT concept code' })
  @ApiParam({ name: 'conceptId', description: 'SNOMED CT concept ID', required: true })
  @ApiResponse({ status: 200, description: 'Concept validated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid concept ID format' })
  @ApiResponse({ status: 404, description: 'Concept not found or inactive' })
  async validateConcept(
    @Param('conceptId') conceptId: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.terminologyService.validateConcept(req.tenantDb, conceptId);
  }

  @Get('snomed/concepts/:conceptId/details')
  @ApiOperation({ summary: 'Get SNOMED CT concept details including children and parents' })
  @ApiParam({ name: 'conceptId', description: 'SNOMED CT concept ID', required: true })
  @ApiResponse({ status: 200, description: 'Concept details returned successfully' })
  @ApiResponse({ status: 404, description: 'Concept not found' })
  async getConceptDetails(
    @Param('conceptId') conceptId: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.terminologyService.getConceptDetails(req.tenantDb, conceptId);
  }

  @Get('snomed/map/:conceptId/:targetSystem')
  @ApiOperation({ summary: 'Map SNOMED CT code to another terminology system' })
  @ApiParam({ name: 'conceptId', description: 'SNOMED CT concept ID', required: true })
  @ApiParam({
    name: 'targetSystem',
    description: 'Target terminology system',
    enum: ['ICD10', 'ICD11', 'LOINC', 'CPT'],
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Mappings returned successfully' })
  @ApiResponse({ status: 404, description: 'No mappings found' })
  async mapConcept(
    @Param('conceptId') conceptId: string,
    @Param('targetSystem') targetSystem: 'ICD10' | 'ICD11' | 'LOINC' | 'CPT',
    @Request() req: RequestWithTenant,
  ) {
    return this.terminologyService.mapConcept(req.tenantDb, conceptId, targetSystem);
  }
}

