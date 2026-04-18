import { Controller, Get, Post, Body, Headers, Query } from '@nestjs/common';
import { NtdService } from './ntd.service';

@Controller('ntd')
export class NtdController {
  constructor(private readonly ntdService: NtdService) {}

  // Leprosy
  @Post('leprosy')
  async createLeprosyCase(@Headers('x-tenant-id') tenantId: string, @Body() data: any) {
    return this.ntdService.createLeprosyCase(tenantId, data);
  }

  @Get('leprosy')
  async getLeprosyCases(@Headers('x-tenant-id') tenantId: string, @Query('patientId') patientId?: string) {
    return this.ntdService.getLeprosyCases(tenantId, patientId);
  }

  @Post('leprosy/mdt-guidance')
  async getLeprosyMdtGuidance(@Headers('x-tenant-id') tenantId: string, @Body() payload: any) {
    return this.ntdService.getLeprosyMdtGuidance(tenantId, payload);
  }

  // Onchocerciasis
  @Post('onchocerciasis')
  async createOnchocerciasisCase(@Headers('x-tenant-id') tenantId: string, @Body() data: any) {
    return this.ntdService.createOnchocerciasisCase(tenantId, data);
  }

  @Get('onchocerciasis')
  async getOnchocerciasisCases(@Headers('x-tenant-id') tenantId: string, @Query('patientId') patientId?: string) {
    return this.ntdService.getOnchocerciasisCases(tenantId, patientId);
  }

  // Filariasis
  @Post('filariasis')
  async createFilariasisCase(@Headers('x-tenant-id') tenantId: string, @Body() data: any) {
    return this.ntdService.createFilariasisCase(tenantId, data);
  }

  @Get('filariasis')
  async getFilariasisCases(@Headers('x-tenant-id') tenantId: string, @Query('patientId') patientId?: string) {
    return this.ntdService.getFilariasisCases(tenantId, patientId);
  }

  @Post('filariasis/safety-check')
  async checkFilariasisSafety(@Headers('x-tenant-id') tenantId: string, @Body() payload: any) {
    return this.ntdService.checkFilariasisSafety(tenantId, payload);
  }
}
