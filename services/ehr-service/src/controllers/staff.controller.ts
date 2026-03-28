import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UsersService } from '../services/users.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Returns active doctors for mobile escalation / assignment panels.
   * Mobile calls: GET /staff/doctors/available
   */
  @Get('doctors/available')
  @ApiOperation({ summary: 'Get available doctors for mobile escalation' })
  @ApiResponse({ status: 200, description: 'List of active doctors' })
  async getAvailableDoctors(@Request() req: RequestWithTenant) {
    const doctors = await this.usersService.getAllUsers(req.tenantDb, 'doctor');
    return (Array.isArray(doctors) ? doctors : (doctors as any).users ?? []).map((u: any) => ({
      id: u.id,
      name: `${u.firstName ?? u.first_name ?? ''} ${u.lastName ?? u.last_name ?? ''}`.trim(),
      role: u.role ?? 'doctor',
      specialty: u.specialization ?? u.specialty ?? null,
      available: u.isActive ?? u.is_active ?? true,
    }));
  }
}
