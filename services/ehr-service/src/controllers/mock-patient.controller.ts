import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { MockPatientService } from '../services/mock-patient.service';
import { CreatePatientDto, UpdatePatientDto, PatientQueryDto } from '../dto/patient.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('patients')
@UseGuards(JwtAuthGuard)
export class MockPatientController {
  constructor(private readonly patientService: MockPatientService) {}

  @Post()
  create(@Body() createPatientDto: CreatePatientDto, @Req() req: any) {
    return this.patientService.create(createPatientDto, req.user.userId);
  }

  @Get()
  findAll(@Query() query: PatientQueryDto) {
    return this.patientService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.patientService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePatientDto: UpdatePatientDto) {
    return this.patientService.update(id, updatePatientDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.patientService.remove(id);
  }
}


