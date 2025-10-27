import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UsersService } from '../services/users.service';
import { CreateUserDto, UpdateUserDto } from '../dto/users.dto';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('User Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all clinic users' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getAllUsers(@Request() req: RequestWithTenant, @Query('role') role?: string) {
    return this.usersService.getAllUsers(req.tenantDb, role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  async getUserById(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.usersService.getUserById(id, req.tenantDb);
  }

  @Post()
  @ApiOperation({ summary: 'Create new clinic user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async createUser(@Body() createUserDto: CreateUserDto, @Request() req: RequestWithTenant) {
    return this.usersService.createUser(createUserDto, req.tenantDb);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: RequestWithTenant
  ) {
    return this.usersService.updateUser(id, updateUserDto, req.tenantDb);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate user' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  async deactivateUser(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.usersService.deactivateUser(id, req.tenantDb);
  }

  @Put(':id/reset-password')
  @ApiOperation({ summary: 'Reset user password' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async resetPassword(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.usersService.resetPassword(id, req.tenantDb);
  }

  @Put(':id/activate')
  @ApiOperation({ summary: 'Activate user' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  async activateUser(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.usersService.activateUser(id, req.tenantDb);
  }
}