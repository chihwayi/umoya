import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { NotificationCampaignService } from '../services/notification-campaign.service';

@ApiTags('Campaigns')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class NotificationCampaignController {
  constructor(private readonly campaignService: NotificationCampaignService) {}

  @Get()
  @ApiOperation({ summary: 'List notification campaigns' })
  @ApiResponse({ status: 200 })
  list(@Req() req: RequestWithTenant) {
    return this.campaignService.listCampaigns(req.tenantDb);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign' })
  @ApiResponse({ status: 200 })
  get(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.campaignService.getCampaign(req.tenantDb, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create campaign (draft/scheduled)' })
  @ApiResponse({ status: 201 })
  create(@Body() body: any, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return this.campaignService.createCampaign(req.tenantDb, userId, body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update campaign (draft/scheduled only)' })
  @ApiResponse({ status: 200 })
  update(@Param('id') id: string, @Body() body: any, @Req() req: RequestWithTenant) {
    return this.campaignService.updateCampaign(req.tenantDb, id, body);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel campaign' })
  @ApiResponse({ status: 200 })
  cancel(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.campaignService.cancelCampaign(req.tenantDb, id);
  }

  @Get(':id/recipients')
  @ApiOperation({ summary: 'List campaign recipients' })
  @ApiResponse({ status: 200 })
  recipients(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.campaignService.listRecipients(req.tenantDb, id);
  }

  @Post(':id/recipients/prepare')
  @ApiOperation({ summary: 'Prepare recipients (manual list or criteria/recall list)' })
  @ApiResponse({ status: 200 })
  prepareRecipients(@Param('id') id: string, @Body() body: { patientIds?: string[] }, @Req() req: RequestWithTenant) {
    return this.campaignService.prepareRecipients(req.tenantDb, id, body);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send campaign now' })
  @ApiResponse({ status: 200 })
  sendNow(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.campaignService.sendCampaignNow(req.tenantDb, id);
  }
}

