import { Controller, Post, Body, Request, UseGuards, Get, Put, Delete, Param, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService, LoginDto } from '../services/auth.service';
import { AuditService } from '../services/audit.service';
import { AdminRole } from '../entities/admin-user.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private auditService: AuditService,
  ) {}

  private assertRole(req: any, allowed: AdminRole[]) {
    const roleRaw = String(req?.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const role =
      roleRaw === 'superadmin' ? AdminRole.SUPER_ADMIN
      : roleRaw === 'admin' ? AdminRole.ADMIN
      : roleRaw === 'support' ? AdminRole.SUPPORT
      : (roleRaw as AdminRole);
    if (!role || !allowed.includes(role)) {
      throw new ForbiddenException('Insufficient privileges for this operation');
    }
  }

  private ctx(req: any) {
    return {
      userId: req?.user?.id || null,
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || undefined,
      ua: req?.get?.('User-Agent') || undefined,
    };
  }

  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto, @Request() req) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Request() req,
    @Body() body: { oldPassword: string; newPassword: string }
  ) {
    await this.authService.changePassword(req.user.id, body.oldPassword, body.newPassword);
    return { message: 'Password changed successfully' };
  }

  // ── Admin team management (RBAC) ───────────────────────────────────────────
  // super_admin: full management. admin: view only. support: no access.

  @UseGuards(JwtAuthGuard)
  @Get('admins')
  @ApiOperation({ summary: 'List admin users' })
  async listAdmins(@Request() req) {
    this.assertRole(req, [AdminRole.SUPER_ADMIN, AdminRole.ADMIN]);
    return this.authService.listAdmins();
  }

  @UseGuards(JwtAuthGuard)
  @Post('admins')
  @ApiOperation({ summary: 'Create a new admin user (returns one-time temp password)' })
  async createAdmin(
    @Request() req,
    @Body() body: { email: string; firstName: string; lastName: string; role: string },
  ) {
    this.assertRole(req, [AdminRole.SUPER_ADMIN]);
    if (!body?.email || !body?.firstName || !body?.lastName || !body?.role) {
      throw new BadRequestException('email, firstName, lastName and role are required');
    }
    const result = await this.authService.provisionAdmin(body);
    const c = this.ctx(req);
    await this.auditService.safeLog(c.userId, 'user_create', 'admin_user', result.admin.id,
      null, { email: result.admin.email, role: result.admin.role }, c.ip, c.ua);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Put('admins/:id/role')
  @ApiOperation({ summary: 'Change an admin user role' })
  async setAdminRole(@Request() req, @Param('id') id: string, @Body('role') role: string) {
    this.assertRole(req, [AdminRole.SUPER_ADMIN]);
    const admin = await this.authService.setAdminRole(id, role);
    const c = this.ctx(req);
    await this.auditService.safeLog(c.userId, 'update', 'admin_user', id, null, { role: admin.role, event: 'role_change' }, c.ip, c.ua);
    return admin;
  }

  @UseGuards(JwtAuthGuard)
  @Put('admins/:id/status')
  @ApiOperation({ summary: 'Enable or disable an admin user' })
  async setAdminStatus(@Request() req, @Param('id') id: string, @Body('isActive') isActive: boolean) {
    this.assertRole(req, [AdminRole.SUPER_ADMIN]);
    const admin = await this.authService.setAdminStatus(id, !!isActive, this.ctx(req).userId);
    const c = this.ctx(req);
    await this.auditService.safeLog(c.userId, 'update', 'admin_user', id, null, { isActive: admin.isActive, event: 'status_change' }, c.ip, c.ua);
    return admin;
  }

  @UseGuards(JwtAuthGuard)
  @Post('admins/:id/reset-password')
  @ApiOperation({ summary: 'Reset an admin user password (returns one-time temp password)' })
  async resetAdminPassword(@Request() req, @Param('id') id: string) {
    this.assertRole(req, [AdminRole.SUPER_ADMIN]);
    const result = await this.authService.resetAdminPassword(id);
    const c = this.ctx(req);
    await this.auditService.safeLog(c.userId, 'password_change', 'admin_user', id, null, { event: 'admin_password_reset' }, c.ip, c.ua);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admins/:id')
  @ApiOperation({ summary: 'Delete an admin user' })
  async deleteAdmin(@Request() req, @Param('id') id: string) {
    this.assertRole(req, [AdminRole.SUPER_ADMIN]);
    const result = await this.authService.deleteAdmin(id, this.ctx(req).userId);
    const c = this.ctx(req);
    await this.auditService.safeLog(c.userId, 'user_delete', 'admin_user', id, null, null, c.ip, c.ua);
    return result;
  }
}
