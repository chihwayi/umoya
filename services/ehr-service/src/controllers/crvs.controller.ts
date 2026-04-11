import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { CrvsService } from '../services/crvs.service';

@UseGuards(JwtAuthGuard)
@Controller('crvs')
export class CrvsController {
  constructor(private readonly crvsService: CrvsService) {}

  @Post('birth')
  registerBirth(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.crvsService.registerBirth(req.tenantId, body);
  }

  @Get('birth')
  listBirths(@Request() req: RequestWithTenant) {
    return this.crvsService.listBirths(req.tenantId);
  }

  @Post('death')
  registerDeath(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.crvsService.registerDeath(req.tenantId, body);
  }

  @Get('death')
  listDeaths(@Request() req: RequestWithTenant) {
    return this.crvsService.listDeaths(req.tenantId);
  }

  @Get('death/:patientId')
  getDeathCertificate(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.crvsService.getDeathCertificate(req.tenantId, patientId);
  }

  @Post('mdsr')
  submitMdsr(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.crvsService.submitMdsr(req.tenantId, body);
  }

  @Get('mdsr')
  listMdsr(@Request() req: RequestWithTenant) {
    return this.crvsService.listMdsr(req.tenantId);
  }

  @Patch('mdsr/:id/review')
  reviewMdsr(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.crvsService.reviewMdsr(req.tenantId, id, body);
  }
}
