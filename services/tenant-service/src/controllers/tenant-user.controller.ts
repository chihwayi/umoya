import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe, UseGuards, Req } from '@nestjs/common';
import { TenantDatabaseService, TenantUser } from '../services/tenant-database.service';
import { CreateClinicUserDto } from '../dto/create-clinic-user.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuditService } from '../services/audit.service';

@Controller('tenants/:tenantId/users')
@UseGuards(JwtAuthGuard)
export class TenantUserController {
  constructor(
    private readonly tenantDatabaseService: TenantDatabaseService,
    private readonly auditService: AuditService,
  ) {}

  // User events are logged against the TENANT id so they appear in that
  // tenant's audit trail alongside lifecycle events.
  private actor(req: any): { userId: string | null; ip?: string; ua?: string } {
    return {
      userId: req?.user?.id || null,
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || undefined,
      ua: req?.headers?.['user-agent'] || undefined,
    };
  }

  @Post()
  async createUser(
    @Param('tenantId') tenantId: string,
    @Body(ValidationPipe) createUserDto: CreateClinicUserDto,
    @Req() req: any
  ): Promise<{ user: TenantUser; message: string }> {
    const user = await this.tenantDatabaseService.createUser(tenantId, createUserDto);
    const ctx = this.actor(req);
    await this.auditService.safeLog(
      ctx.userId, 'user_create', 'tenant', tenantId,
      null, { email: createUserDto.email, role: (createUserDto as any).role }, ctx.ip, ctx.ua,
    );
    return {
      user,
      message: 'User created successfully in tenant database. They must change password on first login.'
    };
  }

  @Get()
  async getTenantUsers(@Param('tenantId') tenantId: string): Promise<TenantUser[]> {
    return this.tenantDatabaseService.getTenantUsers(tenantId);
  }

  @Put(':userId/status')
  async updateUserStatus(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body('isActive') isActive: boolean,
    @Req() req: any
  ): Promise<TenantUser> {
    const result = await this.tenantDatabaseService.updateUserStatus(tenantId, userId, isActive);
    const ctx = this.actor(req);
    await this.auditService.safeLog(
      ctx.userId, 'update', 'tenant', tenantId,
      null, { userId, isActive, event: 'user_status_change' }, ctx.ip, ctx.ua,
    );
    return result;
  }

  @Put(':userId/change-password')
  async changePassword(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body('newPassword') newPassword: string
  ): Promise<{ user: TenantUser; message: string }> {
    const user = await this.tenantDatabaseService.changePassword(tenantId, userId, newPassword);
    return {
      user,
      message: 'Password changed successfully. User can now access the system normally.'
    };
  }

  @Put(':userId/reset-password')
  async resetPassword(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Req() req: any
  ): Promise<{ user: TenantUser; temporaryPassword: string; message: string }> {
    const { user, temporaryPassword } = await this.tenantDatabaseService.resetPassword(tenantId, userId);
    const ctx = this.actor(req);
    await this.auditService.safeLog(
      ctx.userId, 'password_change', 'tenant', tenantId,
      null, { userId, event: 'user_password_reset' }, ctx.ip, ctx.ua,
    );
    return {
      user,
      temporaryPassword,
      message: 'Password reset successfully. User must change password on first login.'
    };
  }

  @Delete(':userId')
  async deleteUser(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Req() req: any
  ): Promise<{ message: string }> {
    await this.tenantDatabaseService.deleteUser(tenantId, userId);
    const ctx = this.actor(req);
    await this.auditService.safeLog(
      ctx.userId, 'user_delete', 'tenant', tenantId, null, { userId }, ctx.ip, ctx.ua,
    );
    return { message: 'User deactivated successfully' };
  }
}
