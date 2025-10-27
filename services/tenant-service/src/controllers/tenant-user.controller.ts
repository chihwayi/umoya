import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe } from '@nestjs/common';
import { TenantDatabaseService, TenantUser } from '../services/tenant-database.service';
import { CreateClinicUserDto } from '../dto/create-clinic-user.dto';

@Controller('tenants/:tenantId/users')
export class TenantUserController {
  constructor(private readonly tenantDatabaseService: TenantDatabaseService) {}

  @Post()
  async createUser(
    @Param('tenantId') tenantId: string,
    @Body(ValidationPipe) createUserDto: CreateClinicUserDto
  ): Promise<{ user: TenantUser; message: string }> {
    const user = await this.tenantDatabaseService.createUser(tenantId, createUserDto);
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
    @Body('isActive') isActive: boolean
  ): Promise<TenantUser> {
    return this.tenantDatabaseService.updateUserStatus(tenantId, userId, isActive);
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
    @Param('userId') userId: string
  ): Promise<{ user: TenantUser; message: string }> {
    const user = await this.tenantDatabaseService.resetPassword(tenantId, userId);
    return {
      user,
      message: 'Password reset successfully. User must change password on first login.'
    };
  }

  @Delete(':userId')
  async deleteUser(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string
  ): Promise<{ message: string }> {
    await this.tenantDatabaseService.deleteUser(tenantId, userId);
    return { message: 'User deactivated successfully' };
  }
}