import { Controller, Post, Get, Body, Param, Req } from '@nestjs/common';
import { NursingNotesService } from '../services/nursing-notes.service';

@Controller('api/nursing-notes')
export class NursingNotesController {
  constructor(private readonly notesService: NursingNotesService) {}

  @Post()
  async record(@Body() body: any, @Req() req: any) {
    const tenantId = req.tenantId;
    const saved = await this.notesService.recordNote(body, tenantId);
    return { success: true, note: saved };
  }

  @Get('patient/:patientId')
  async getByPatient(@Param('patientId') patientId: string, @Req() req: any) {
    const tenantId = req.tenantId;
    const notes = await this.notesService.getByPatient(patientId, tenantId);
    return { notes, total: notes.length };
  }
}


