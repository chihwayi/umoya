import { Controller, Put, Get, Body, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

const ALLOWED_LANGUAGES = ['en', 'sn', 'nd'] as const;
type Language = typeof ALLOWED_LANGUAGES[number];

@ApiTags('Preferences')
@Controller('preferences')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PreferencesController {
  @Put('language')
  @ApiOperation({ summary: 'Set preferred language for patient or staff' })
  async setLanguage(
    @Body() body: { language: string; entityType: 'patient' | 'staff'; entityId: string },
    @Req() req: any,
  ) {
    if (!ALLOWED_LANGUAGES.includes(body.language as Language)) {
      throw new BadRequestException(`Unsupported language: ${body.language}. Allowed: ${ALLOWED_LANGUAGES.join(', ')}`);
    }
    if (!['patient', 'staff'].includes(body.entityType)) {
      throw new BadRequestException('entityType must be patient or staff');
    }
    const table = body.entityType === 'patient' ? 'patients' : 'staff';
    await req.tenantDb.query(
      `UPDATE ${table} SET preferred_language = $1 WHERE id = $2`,
      [body.language, body.entityId],
    );
    return { language: body.language, updated: true };
  }

  @Get('language/:entityType/:entityId')
  @ApiOperation({ summary: 'Get preferred language for patient or staff' })
  async getLanguage(@Param('entityType') entityType: string, @Param('entityId') entityId: string, @Req() req: any) {
    if (!['patient', 'staff'].includes(entityType)) {
      throw new BadRequestException('entityType must be patient or staff');
    }
    const table = entityType === 'patient' ? 'patients' : 'staff';
    const [row] = await req.tenantDb.query(
      `SELECT preferred_language FROM ${table} WHERE id = $1`,
      [entityId],
    );
    return { language: row?.preferred_language ?? 'en' };
  }
}
