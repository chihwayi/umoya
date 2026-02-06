import { Controller, Get, Post, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { BackupService, BackupMetadata } from '../services/backup.service';

@ApiTags('backups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/backups')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

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
