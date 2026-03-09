import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { DietaryService } from '../services/dietary.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Dietary Services')
@ApiBearerAuth()
@Controller('dietary')
@UseGuards(JwtAuthGuard)
export class DietaryController {
  constructor(
    private readonly dietaryService: DietaryService,
    private readonly tenantService: TenantService,
  ) {}

  @Post('orders')
  async orderDiet(@Body() dietData: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.dietaryService.orderDiet(dietData, ((req.user as any)?.userId ?? (req.user as any)?.id), tenantDb);
  }

  @Get('orders/patient/:patientId')
  async getActiveDietOrders(@Param('patientId') patientId: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.dietaryService.getActiveDietOrders(patientId, tenantDb);
  }

  @Post('assessments')
  async createAssessment(@Body() data: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.dietaryService.createNutritionalAssessment(data, ((req.user as any)?.userId ?? (req.user as any)?.id), tenantDb);
  }
}




