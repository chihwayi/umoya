import { Controller, Get, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LanguageService } from './language.service';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class LanguageController {
  constructor(private readonly languageService: LanguageService) {}

  @Get('languages')
  @ApiOperation({ summary: 'Get list of supported UI languages' })
  getSupportedLanguages() {
    return this.languageService.getSupportedLanguages();
  }

  @Get('language/:userId')
  @ApiOperation({ summary: 'Get language preference for a user' })
  getUserLanguage(@Param('userId') userId: string, @Request() req: any) {
    const tenantId = req.headers['x-tenant-id'] ?? req.tenantId;
    return this.languageService.getUserLanguage(tenantId, userId);
  }

  @Put('language/:userId')
  @ApiOperation({ summary: 'Set language preference for a user' })
  setUserLanguage(
    @Param('userId') userId: string,
    @Body() body: { uiLanguage: string; clinicalNoteLanguage?: string },
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'] ?? req.tenantId;
    return this.languageService.setUserLanguage(tenantId, userId, body.uiLanguage, body.clinicalNoteLanguage);
  }
}
