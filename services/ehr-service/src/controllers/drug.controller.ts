import { Controller, Get, Post, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DrugService } from '../services/drug.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('drugs')
@UseGuards(JwtAuthGuard)
export class DrugController {
  constructor(
    private drugService: DrugService
  ) {}

  @Get()
  async findAll(
    @Request() req: RequestWithTenant,
    @Query('search') search?: string,
    @Query('drugClass') drugClass?: string
  ) {
    return this.drugService.findAll(req.tenantDb, search, drugClass);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: RequestWithTenant
  ) {
    return this.drugService.findOne(id, req.tenantDb);
  }

  @Post('search')
  async searchByName(
    @Request() req: RequestWithTenant,
    @Body('name') name: string
  ) {
    return this.drugService.findByName(name, req.tenantDb);
  }

  @Post('check-interactions')
  async checkInteractions(
    @Request() req: RequestWithTenant,
    @Body('drugIds') drugIds: string[]
  ) {
    return this.drugService.checkInteractions(drugIds, req.tenantDb);
  }

  @Post('seed')
  async seedDefaultDrugs(
    @Request() req: RequestWithTenant
  ) {
    return this.drugService.seedDefaultDrugs(req.tenantDb);
  }
}

