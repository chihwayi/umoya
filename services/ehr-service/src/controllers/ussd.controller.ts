import { Controller, Post, Get, Body, Headers, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UssdSessionService } from '../services/ussd-session.service';
import { SmsCampaignService, CreateCampaignDto } from '../services/sms-campaign.service';
import { AdherenceNudgeService } from '../services/adherence-nudge.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('USSD')
@Controller('ussd')
export class UssdController {
  constructor(private readonly ussdSession: UssdSessionService) {}

  @Post('callback')
  @ApiOperation({ summary: "Africa's Talking USSD webhook (no auth — external callback)" })
  async handleUssdCallback(
    @Body() body: { sessionId: string; phoneNumber: string; serviceCode: string; text: string },
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: Request,
  ): Promise<string> {
    const db = (req as any).tenantDb;
    const response = await this.ussdSession.handleCallback(body.sessionId, body.phoneNumber, body.text, db);
    return response.text;
  }
}

@ApiTags('SMS Campaigns')
@Controller('sms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SmsCampaignController {
  constructor(
    private readonly campaigns: SmsCampaignService,
    private readonly nudges: AdherenceNudgeService,
  ) {}

  @Post('campaigns')
  @ApiOperation({ summary: 'Create and dispatch an SMS campaign' })
  createCampaign(@Body() dto: CreateCampaignDto, @Req() req: Request) {
    return this.campaigns.createCampaign(dto, (req as any).user.sub, (req as any).tenantDb);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'List SMS campaigns' })
  listCampaigns(@Req() req: Request) {
    return this.campaigns.listCampaigns((req as any).tenantDb);
  }

  @Get('campaigns/:id/stats')
  @ApiOperation({ summary: 'Get campaign delivery stats' })
  getCampaignStats(@Param('id') id: string, @Req() req: Request) {
    return this.campaigns.getCampaignStats(id, (req as any).tenantDb);
  }

  @Post('nudges/enrol/:patientId')
  @ApiOperation({ summary: 'Enrol patient in adherence nudge schedule' })
  async enrolNudge(
    @Param('patientId') patientId: string,
    @Body() body: { nudgeType: string; language: 'en' | 'sn' | 'nd' },
    @Req() req: Request,
  ) {
    await this.nudges.enrollPatientInNudges(patientId, body.nudgeType, body.language, (req as any).tenantDb);
    return { enrolled: true };
  }

  @Post('nudges/trigger')
  @ApiOperation({ summary: 'Manually trigger pending adherence nudges (for testing)' })
  triggerNudges(@Req() req: Request) {
    return this.nudges.sendNudgesNow((req as any).tenantDb);
  }
}
