import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe } from '@nestjs/common';
import { TenantUserService } from '../services/tenant-user.service';
import { CreateTenantUserDto } from '../dto/create-tenant-user.dto';
import { TenantUser, UserStatus } from '../entities/tenant-user.entity';

@Controller('tenants/:tenantId/users')
export class TenantUserController {
  constructor(private readonly tenantUserService: TenantUserService) {}

  @Post()
  async createUser(
    @Param('tenantId') tenantId: string,
    @Body(ValidationPipe) createUserDto: CreateTenantUserDto
  ): Promise<{ user: TenantUser; message: string }> {
    const user = await this.tenantUserService.createTenantUser(tenantId, createUserDto);
    return {
      user,
      message: 'User created successfully. They must change password on first login.'
    };
  }

  @Get()
  async getTenantUsers(@Param('tenantId') tenantId: string): Promise<TenantUser[]> {
    return this.tenantUserService.getTenantUsers(tenantId);
  }

  @Put(':userId/status')
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body('status') status: UserStatus
  ): Promise<TenantUser> {
    return this.tenantUserService.updateUserStatus(userId, status);
  }

  @Put(':userId/reset-password')
  async resetPassword(
    @Param('userId') userId: string,
    @Body('newPassword') newPassword: string
  ): Promise<{ message: string }> {
    await this.tenantUserService.resetUserPassword(userId, newPassword);
    return { message: 'Password reset successfully. User must change password on next login.' };
  }

  @Delete(':userId')
  async deleteUser(@Param('userId') userId: string): Promise<{ message: string }> {
    await this.tenantUserService.deleteUser(userId);
    return { message: 'User deleted successfully' };
  }
}