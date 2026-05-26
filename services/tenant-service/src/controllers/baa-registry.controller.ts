import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { BaaRegistryEntry } from '../entities/baa-registry.entity';
import { BaaRegistryService } from '../services/baa-registry.service';

@ApiTags('baa-registry')
@ApiBearerAuth()
@Controller('admin/baa-registry')
@UseGuards(JwtAuthGuard)
export class BaaRegistryController {
  constructor(private readonly baaRegistryService: BaaRegistryService) {}

  @Get()
  findAll(): Promise<BaaRegistryEntry[]> {
    return this.baaRegistryService.findAll();
  }

  @Get('summary')
  summary() {
    return this.baaRegistryService.getComplianceSummary();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<BaaRegistryEntry | null> {
    return this.baaRegistryService.findOne(id);
  }

  @Post()
  create(@Body() dto: Partial<BaaRegistryEntry>): Promise<BaaRegistryEntry> {
    return this.baaRegistryService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<BaaRegistryEntry>): Promise<BaaRegistryEntry> {
    return this.baaRegistryService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.baaRegistryService.remove(id);
  }
}
