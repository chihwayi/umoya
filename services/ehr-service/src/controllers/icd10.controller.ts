import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Icd10Service } from '../services/icd10.service';

@Controller('terminology/icd10')
@UseGuards(JwtAuthGuard)
export class Icd10Controller {
  constructor(private readonly icd10Service: Icd10Service) {}

  /**
   * Search ICD-10 codes by term
   * GET /api/terminology/icd10/search?term=chest pain&limit=20
   */
  @Get('search')
  async searchIcd10(@Query('term') term: string, @Query('limit') limit?: string, @Query('offset') offset?: string, @Query('billableOnly') billableOnly?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const billable = billableOnly === 'true' ? true : billableOnly === 'false' ? false : null;

    const results = await this.icd10Service.searchIcd10Codes(term, limitNum, offsetNum, billable);

    return {
      codes: results,
      total: results.length,
      limit: limitNum,
      offset: offsetNum,
    };
  }

  /**
   * Get ICD-10 code details
   * GET /api/terminology/icd10/code/I21.0
   */
  @Get('code/:code')
  async getIcd10Code(@Query('code') code: string) {
    return await this.icd10Service.getIcd10CodeDetails(code);
  }

  /**
   * Get ICD-10 codes by category
   * GET /api/terminology/icd10/category/I21
   */
  @Get('category/:category')
  async getIcd10ByCategory(@Query('category') category: string, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return await this.icd10Service.getIcd10ByCategory(category, limitNum);
  }

  /**
   * Get SNOMED to ICD-10 mappings
   * GET /api/terminology/icd10/map-from-snomed/29857009
   */
  @Get('map-from-snomed/:snomedCode')
  async mapSnomedToIcd10(@Query('snomedCode') snomedCode: string) {
    return await this.icd10Service.getSnomedToIcd10Mappings(snomedCode);
  }
}

