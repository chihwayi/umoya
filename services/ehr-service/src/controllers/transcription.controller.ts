/**
 * Transcription Controller
 * Handles voice-to-text transcription requests
 */

import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { TranscriptionService } from '../services/transcription.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Transcription')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transcription')
export class TranscriptionController {
  constructor(private transcriptionService: TranscriptionService) {}

  @Post('whisper')
  @ApiOperation({ 
    summary: 'Transcribe audio using Whisper',
    description: 'Transcribes audio recordings to text using OpenAI Whisper or self-hosted Whisper instance. Supports English, Shona, and Ndebele languages.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          format: 'binary',
          description: 'Audio file (WAV, MP3, M4A, etc.)',
        },
        language: {
          type: 'string',
          enum: ['en', 'sn', 'nd', 'auto'],
          description: 'Language code: en (English), sn (Shona), nd (Ndebele), or auto (auto-detect)',
          default: 'auto',
        },
        temperature: {
          type: 'number',
          description: 'Temperature for sampling (0.0 to 1.0). Lower = more deterministic.',
          default: 0.0,
        },
        prompt: {
          type: 'string',
          description: 'Optional prompt to guide the transcription',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Transcription successful',
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Transcribed text' },
        language: { type: 'string', description: 'Detected language' },
        segments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              start: { type: 'number' },
              end: { type: 'number' },
              text: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid audio file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Transcription failed' })
  @UseInterceptors(FileInterceptor('audio', {
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB limit (Whisper API limit)
    },
    fileFilter: (req, file, callback) => {
      const allowedMimes = [
        'audio/wav',
        'audio/mpeg',
        'audio/mp3',
        'audio/m4a',
        'audio/webm',
        'audio/ogg',
        'audio/x-m4a',
      ];
      if (allowedMimes.includes(file.mimetype)) {
        callback(null, true);
      } else {
        callback(
          new HttpException(
            `Invalid file type. Allowed types: ${allowedMimes.join(', ')}`,
            HttpStatus.BAD_REQUEST,
          ),
          false,
        );
      }
    },
  }))
  async transcribeWithWhisper(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { language?: string; temperature?: string; prompt?: string },
    @Request() req: RequestWithTenant,
  ) {
    if (!file) {
      throw new HttpException('Audio file is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const options = {
        language: (body.language as 'en' | 'sn' | 'nd' | 'auto') || 'auto',
        temperature: body.temperature ? parseFloat(body.temperature) : 0.0,
        prompt: body.prompt || 'This is a medical consultation between a doctor and patient. Medical terminology, vitals, symptoms, and diagnoses should be transcribed accurately.',
      };

      const result = await this.transcriptionService.transcribe(file, options, {
        tenantId: req.tenantId,
        authorization: req.headers?.authorization as string | undefined,
      });

      // Format the transcription
      const formattedText = this.transcriptionService.formatTranscription(result.text);

      return {
        transcription: {
          text: formattedText,
          language: result.language,
          language_probability: typeof result.confidence === 'number' ? result.confidence : 0,
          duration: 0,
          segments: result.segments || [],
        },
        soap_note: result.soap_note,
        audio_url: result.audio_url,
        text: formattedText,
        rawText: result.text,
        language: result.language,
        segments: result.segments,
        confidence: result.confidence,
      };
    } catch (error: any) {
      throw new HttpException(
        `Transcription failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
