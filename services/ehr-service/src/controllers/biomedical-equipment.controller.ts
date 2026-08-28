import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { BiomedicalEquipmentService } from '../services/biomedical-equipment.service';

@UseGuards(JwtAuthGuard)
@Controller('biomedical-equipment')
export class BiomedicalEquipmentController {
  constructor(private readonly svc: BiomedicalEquipmentService) {}

  @Post()
  registerEquipment(@Req() req: any, @Body() body: any) {
    return this.svc.registerEquipment(req.tenantDb, req.tenantId, body);
  }

  @Get()
  listEquipment(@Req() req: any, @Query() query: any) {
    return this.svc.listEquipment(req.tenantDb, req.tenantId, query);
  }

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.svc.getDashboard(req.tenantDb, req.tenantId);
  }

  @Get(':id')
  getEquipment(@Req() req: any, @Param('id') id: string) {
    return this.svc.getEquipment(req.tenantDb, req.tenantId, id);
  }

  @Post(':id/maintenance-log')
  logMaintenanceEvent(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.logMaintenanceEvent(req.tenantDb, req.tenantId, id, req.user.id, body);
  }
}
