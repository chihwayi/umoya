import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { BackupService, BackupMetadata } from '../services/backup.service';
import { AdminRole } from '../entities/admin-user.entity';
import { BackupScheduleService, BackupScheduleView, UpdateBackupScheduleInput } from '../services/backup-schedule.service';

@ApiTags('backups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/backups')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly backupScheduleService: BackupScheduleService,
  ) {}

  private assertRole(req: any, allowed: AdminRole[]) {
    const roleRaw = String(req?.user?.role || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    const role =
      roleRaw === 'superadmin'
        ? AdminRole.SUPER_ADMIN
        : roleRaw === 'admin'
          ? AdminRole.ADMIN
          : roleRaw === 'support'
            ? AdminRole.SUPPORT
            : (roleRaw as AdminRole);
    if (!role || !allowed.includes(role)) {
      throw new ForbiddenException('Insufficient privileges for this operation');
    }
  }

  @Get()
  @ApiOperation({ summary: 'List all system backups' })
  @ApiResponse({ status: 200, description: 'List of backups retrieved successfully' })
  async listBackups(): Promise<BackupMetadata[]> {
    return this.backupService.listBackups();
  }

  @Post()
  @ApiOperation({ summary: 'Trigger a new system backup' })
  @ApiResponse({ status: 201, description: 'Backup started successfully' })
  async createBackup(@Query('type') type: 'auto' | 'manual' = 'manual'): Promise<BackupMetadata> {
    return this.backupService.createBackup(type);
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Get backup schedule configuration' })
  async getBackupSchedule(@Req() req: any): Promise<BackupScheduleView> {
    this.assertRole(req, [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.SUPPORT]);
    return this.backupScheduleService.getSchedule();
  }

  @Put('schedule')
  @ApiOperation({ summary: 'Update backup schedule configuration' })
  async updateBackupSchedule(
    @Req() req: any,
    @Body() body: UpdateBackupScheduleInput,
  ): Promise<BackupScheduleView> {
    this.assertRole(req, [AdminRole.SUPER_ADMIN, AdminRole.ADMIN]);
    return this.backupScheduleService.updateSchedule(body || {}, req?.user?.id);
  }

  @Post('schedule/run-now')
  @ApiOperation({ summary: 'Run scheduled backup immediately' })
  async runScheduledBackupNow(@Req() req: any): Promise<{ message: string; backupId: string; nextRunAt: string | null }> {
    this.assertRole(req, [AdminRole.SUPER_ADMIN, AdminRole.ADMIN]);
    return this.backupScheduleService.runScheduledBackupNow(req?.user?.id);
  }

  @Post(':key/restore')
  @ApiOperation({ summary: 'Restore system from a backup' })
  @ApiResponse({ status: 200, description: 'Restore completed successfully' })
  async restoreBackup(@Param('key') key: string): Promise<{ message: string }> {
    const decodedKey = decodeURIComponent(key);
    await this.backupService.restoreBackup(decodedKey);
    return { message: 'Database restore initiated successfully' };
  }

  @Get(':key/download')
  @ApiOperation({ summary: 'Get download URL for a backup' })
  @ApiResponse({ status: 200, description: 'Download URL retrieved successfully' })
  async getDownloadUrl(@Param('key') key: string): Promise<{ url: string }> {
    // Decode key if it was URL encoded
    const decodedKey = decodeURIComponent(key);
    const url = await this.backupService.getDownloadUrl(decodedKey);
    return { url };
  }
}
