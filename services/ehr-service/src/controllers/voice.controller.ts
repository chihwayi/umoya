import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { VoiceTranscriptionService } from '../services/voice-transcription.service';

@UseGuards(JwtAuthGuard)
@Controller('voice')
export class VoiceController {
  constructor(private readonly voice: VoiceTranscriptionService) {}

  @Post('transcribe')
  async transcribe(@Body() body: any, @Req() req: any) {
    return this.voice.transcribeAudio(
      body.audioBase64,
      body.language ?? 'en',
      req.tenantDb,
      req.user.sub,
      { patientId: body.patientId, encounterId: body.encounterId },
    );
  }

  @Post('parse-clinical')
  async parseClinical(@Body() body: any, @Req() req: any) {
    return this.voice.parseClinical(body.transcriptId, body.transcriptText ?? '', req.tenantDb);
  }

  @Get(':id')
  async getTranscription(@Param('id') id: string, @Req() req: any) {
    return this.voice.getTranscription(id, req.tenantDb);
  }
}
