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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { NcidService } from '../services/ncid.service';

@ApiTags('NCID')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ncid')
export class NcidController {
  constructor(private readonly ncidService: NcidService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register or link a national ID to a patient' })
  register(
    @Body()
    body: {
      patientId: string;
      countryCode: string;
      idType: string;
      idNumber: string;
      isPrimary?: boolean;
      verificationMethod?: string;
      verifiedBy?: string;
    },
    @Request() req: RequestWithTenant,
  ) {
    return this.ncidService.registerNcid(req.tenantId!, body);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all national IDs for a patient' })
  getIds(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.ncidService.getPatientIds(req.tenantId!, patientId);
  }

  @Get('patient/:patientId/programmes')
  @ApiOperation({ summary: 'Get programme linkages for a patient' })
  getProgrammes(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.ncidService.getProgrammeLinkages(req.tenantId!, patientId);
  }

  @Post('patient/:patientId/gaps')
  @ApiOperation({ summary: 'CDSS: Detect cross-programme enrolment gaps' })
  gaps(
    @Param('patientId') patientId: string,
    @Body()
    body: {
      diagnoses: string[];
      ageYears: number;
      sex: string;
      isPregnant: boolean;
    },
    @Request() req: RequestWithTenant,
  ) {
    return this.ncidService.analyseGaps(req.tenantId!, patientId, body);
  }

  @Post('programme-linkage')
  @ApiOperation({ summary: 'Upsert a programme linkage for a patient' })
  upsertLinkage(
    @Body()
    body: {
      patientId: string;
      programme: string;
      programmeNumber?: string;
      enrolledAt?: string;
      facilityEnrolled?: string;
    },
    @Request() req: RequestWithTenant,
  ) {
    return this.ncidService.upsertProgrammeLinkage(req.tenantId!, body.patientId, body.programme, {
      programmeNumber: body.programmeNumber,
      enrolledAt: body.enrolledAt,
      facilityEnrolled: body.facilityEnrolled,
    });
  }

  @Post('deduplication/score')
  @ApiOperation({ summary: 'CDSS: Score demographic similarity between two patients' })
  score(
    @Body()
    body: {
      patientIdA: string;
      patientIdB: string;
      demographics: {
        a: {
          givenName: string;
          familyName: string;
          dob: string;
          sex: string;
          phone?: string;
          mothersName?: string;
          village?: string;
        };
        b: {
          givenName: string;
          familyName: string;
          dob: string;
          sex: string;
          phone?: string;
          mothersName?: string;
          village?: string;
        };
      };
    },
    @Request() req: RequestWithTenant,
  ) {
    return this.ncidService.scoreDeduplication(
      req.tenantId!,
      body.patientIdA,
      body.patientIdB,
      body.demographics,
    );
  }

  @Get('duplicates/pending')
  @ApiOperation({ summary: 'Get pending duplicate flags ordered by match score' })
  pendingDuplicates(@Request() req: RequestWithTenant) {
    return this.ncidService.getPendingDuplicates(req.tenantId!);
  }

  @Patch('duplicates/:flagId/resolve')
  @ApiOperation({ summary: 'Resolve a duplicate flag' })
  resolve(
    @Param('flagId') flagId: string,
    @Body()
    body: {
      status: 'confirmed_duplicate' | 'confirmed_different' | 'merged' | 'dismissed';
      resolvedBy: string;
      mergedIntoPatientId?: string;
      notes?: string;
    },
    @Request() req: RequestWithTenant,
  ) {
    return this.ncidService.resolveDuplicate(req.tenantId!, flagId, body);
  }
}
