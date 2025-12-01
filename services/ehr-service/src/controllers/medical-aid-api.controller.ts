import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { MedicalAidApiService } from '../services/medical-aid-api.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Medical Aid API Configuration')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('medical-aid-api')
export class MedicalAidApiController {
  constructor(private readonly medicalAidApiService: MedicalAidApiService) {}

  @Get('configurations')
  @ApiOperation({ summary: 'Get all medical aid API configurations' })
  @ApiResponse({ status: 200, description: 'Configurations retrieved successfully' })
  async getConfigurations(@Request() req: RequestWithTenant) {
    // Get all configurations
    const configs = await req.tenantDb.query(
      `SELECT 
        id, medical_aid_name, provider_type, api_base_url,
        authentication_type, is_active, test_mode, created_at, updated_at
       FROM medical_aid_api_configurations
       ORDER BY medical_aid_name`,
    );

    return configs.map((c: any) => ({
      id: c.id,
      medicalAidName: c.medical_aid_name,
      providerType: c.provider_type,
      apiBaseUrl: c.api_base_url,
      authenticationType: c.authentication_type,
      isActive: c.is_active,
      testMode: c.test_mode,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  }

  @Get('configurations/:medicalAidName')
  @ApiOperation({ summary: 'Get API configuration for a specific medical aid' })
  @ApiResponse({ status: 200, description: 'Configuration retrieved successfully' })
  async getConfiguration(
    @Param('medicalAidName') medicalAidName: string,
    @Request() req: RequestWithTenant,
  ) {
    const config = await this.medicalAidApiService.getApiConfiguration(
      medicalAidName,
      req.tenantDb,
    );

    if (!config) {
      return null;
    }

    // Don't return sensitive data in full response
    return {
      id: config.id,
      medicalAidName: config.medicalAidName,
      providerType: config.providerType,
      apiBaseUrl: config.apiBaseUrl,
      authenticationType: config.authenticationType,
      authEndpoint: config.authEndpoint,
      tokenEndpoint: config.tokenEndpoint,
      claimSubmissionEndpoint: config.claimSubmissionEndpoint,
      statusCheckEndpoint: config.statusCheckEndpoint,
      preauthEndpoint: config.preauthEndpoint,
      memberVerificationEndpoint: config.memberVerificationEndpoint,
      requestTimeout: config.requestTimeout,
      retryCount: config.retryCount,
      retryDelay: config.retryDelay,
      isActive: config.isActive,
      testMode: config.testMode,
      hasApiKey: !!config.apiKey,
      hasApiSecret: !!config.apiSecret,
    };
  }

  @Post('configurations')
  @ApiOperation({ summary: 'Create or update medical aid API configuration' })
  @ApiResponse({ status: 201, description: 'Configuration saved successfully' })
  async saveConfiguration(
    @Body() config: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.medicalAidApiService.saveApiConfiguration(config, req.tenantDb);
  }

  @Post('verify-member')
  @ApiOperation({ summary: 'Verify member with medical aid provider' })
  @ApiResponse({ status: 200, description: 'Member verification completed' })
  async verifyMember(
    @Body() body: { medicalAidName: string; memberNumber: string },
    @Request() req: RequestWithTenant,
  ) {
    return this.medicalAidApiService.verifyMember(
      body.medicalAidName,
      body.memberNumber,
      req.tenantDb,
    );
  }

  @Post('webhook/:medicalAidName')
  @ApiOperation({ summary: 'Receive webhook from medical aid provider' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async processWebhook(
    @Param('medicalAidName') medicalAidName: string,
    @Body() webhookData: any,
    @Request() req: RequestWithTenant,
  ) {
    // Extract signature from headers if present
    const signature = (req as any).headers['x-signature'] || (req as any).headers['authorization'];

    const result = await this.medicalAidApiService.processWebhook(
      medicalAidName,
      webhookData,
      signature,
      req.tenantDb,
    );

    if (result.processed && result.claimId) {
      // Process the claim response
      // This would typically trigger a claim status update
      return { success: true, claimId: result.claimId };
    }

    return { success: false, error: result.error };
  }
}

