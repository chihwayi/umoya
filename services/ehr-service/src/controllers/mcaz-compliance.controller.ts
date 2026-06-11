import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { McazComplianceService } from '../services/mcaz-compliance.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('MCAZ Compliance')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pharmacy/mcaz')
export class McazComplianceController {
  constructor(private readonly mcazComplianceService: McazComplianceService) {}

  @Get('controlled-register')
  @ApiOperation({ summary: 'MCAZ controlled-substance (dangerous drugs) dispensing register' })
  @ApiResponse({ status: 200, description: 'Register retrieved' })
  async getControlledRegister(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.mcazComplianceService.getControlledRegister(req.tenantDb, query);
  }

  @Get('controlled-register/export')
  @ApiOperation({ summary: 'Export the MCAZ controlled-substance register as CSV' })
  @ApiResponse({ status: 200, description: 'CSV export generated' })
  async exportControlledRegister(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.mcazComplianceService.exportControlledRegisterCsv(req.tenantDb, query);
  }
}
