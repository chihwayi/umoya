import {
  Controller, Get, Post, Query, Body, UseGuards,
  Request, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RegistrationAiService } from '../services/registration-ai.service';

@Controller('registration')
@UseGuards(JwtAuthGuard)
export class RegistrationAiController {
  constructor(private readonly registrationAiService: RegistrationAiService) {}

  /**
   * GET /registration/match/phonetic?firstName=John&lastName=Smith&dob=1980-03-15
   * Returns potential duplicate patients before registration completes.
   */
  @Get('match/phonetic')
  async findPhoneticMatches(
    @Query('firstName') firstName: string,
    @Query('lastName') lastName: string,
    @Query('dob') dob: string | undefined,
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const matches = await this.registrationAiService.findPhoneticMatches(
      firstName,
      lastName,
      tenantId,
      dob,
    );
    return { matches, count: matches.length };
  }

  /**
   * POST /registration/ocr-insurance-card
   * Upload insurance card image (multipart/form-data, field: "card")
   * Returns: { memberId, groupNumber, planName, payerName, confidence }
   */
  @Post('ocr-insurance-card')
  @UseInterceptors(FileInterceptor('card'))
  async ocrInsuranceCard(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { sessionToken?: string },
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const sessionToken = body.sessionToken ?? this.registrationAiService.createSessionToken();

    const result = await this.registrationAiService.ocrInsuranceCard(
      file.buffer,
      file.mimetype,
      sessionToken,
      tenantId,
    );

    return {
      sessionToken,
      memberId: result.memberId,
      groupNumber: result.groupNumber,
      planName: result.planName,
      payerName: result.payerName,
      effectiveDate: result.effectiveDate,
      expiryDate: result.expiryDate,
      confidence: result.confidence,
    };
  }

  /**
   * GET /registration/sdoh-questions
   * Returns the AHC HRSN questionnaire structure.
   */
  @Get('sdoh-questions')
  async getSdohQuestions(@Request() req: any) {
    const tenantId = req.headers['x-tenant-id'];
    const questions = await this.registrationAiService.getSdohQuestions(tenantId);
    return { questions };
  }

  /**
   * POST /registration/sdoh-score
   * Body: { patientId, answers: { housing: 0, food: 1, ... } }
   */
  @Post('sdoh-score')
  async scoreSdoh(
    @Body() body: { patientId: string; answers: Record<string, number> },
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const conductedByUserId = req.user.sub;
    return this.registrationAiService.scoreSdohAnswers(
      body.patientId,
      body.answers,
      conductedByUserId,
      tenantId,
    );
  }
}
