import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WhoSmartGuidelinesService } from '../services/who-smart-guidelines.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('WHO Smart Guidelines')
@Controller('who-smart-guidelines')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WhoSmartGuidelinesController {
  constructor(
    private readonly whoSmartGuidelinesService: WhoSmartGuidelinesService
  ) {}

  @Get('guidelines')
  @ApiOperation({ summary: 'List available WHO Smart Guidelines' })
  @ApiResponse({ status: 200, description: 'List of available guidelines' })
  async listGuidelines() {
    return {
      guidelines: await this.whoSmartGuidelinesService.listGuidelines(),
      message: 'Contact SMART_DAKS@who.int to get FHIR resources'
    };
  }

  @Get('forms')
  @ApiOperation({ summary: 'List available WHO Smart Forms (Questionnaires)' })
  @ApiResponse({ status: 200, description: 'List of available Smart Forms' })
  async listSmartForms() {
    return {
      forms: await this.whoSmartGuidelinesService.listSmartForms(),
      message: 'Contact SMART_DAKS@who.int to get FHIR resources'
    };
  }

  @Get('guidelines/:condition')
  @ApiOperation({ summary: 'Get WHO Smart Guidelines recommendations for a condition' })
  @ApiResponse({ status: 200, description: 'Guidelines recommendations' })
  async getGuidelines(
    @Param('condition') condition: string,
    @Query('age') age?: number,
    @Query('gender') gender?: string
  ) {
    const recommendations = await this.whoSmartGuidelinesService.getRecommendations(
      condition,
      { age: age ? Number(age) : undefined, gender }
    );

    if (!recommendations || recommendations.length === 0) {
      return {
        condition,
        recommendations: [],
        message: 'No WHO Smart Guidelines found for this condition. Using CDSS guidelines instead.',
        source: 'who_smart_guidelines'
      };
    }

    return {
      condition,
      recommendations,
      source: 'who_smart_guidelines',
      count: recommendations.length
    };
  }

  @Post('guidelines/recommendations')
  @ApiOperation({ summary: 'Get WHO Smart Guidelines recommendations with patient data' })
  @ApiResponse({ status: 200, description: 'Guidelines recommendations' })
  async getRecommendations(@Body() body: {
    condition: string;
    patientData?: {
      age?: number;
      gender?: string;
      vitals?: Record<string, any>;
      labs?: Record<string, any>;
      conditions?: string[];
      medications?: string[];
    };
  }) {
    const recommendations = await this.whoSmartGuidelinesService.getRecommendations(
      body.condition,
      body.patientData
    );

    if (!recommendations || recommendations.length === 0) {
      return {
        condition: body.condition,
        recommendations: [],
        message: 'No WHO Smart Guidelines found for this condition. Using CDSS guidelines instead.',
        source: 'who_smart_guidelines'
      };
    }

    return {
      condition: body.condition,
      recommendations,
      source: 'who_smart_guidelines',
      count: recommendations.length
    };
  }

  @Get('forms/:formId')
  @ApiOperation({ summary: 'Get WHO Smart Form (Questionnaire) by ID' })
  @ApiResponse({ status: 200, description: 'Smart Form structure' })
  async getSmartForm(@Param('formId') formId: string) {
    const form = await this.whoSmartGuidelinesService.getSmartForm(formId);

    if (!form) {
      return {
        formId,
        message: 'Smart Form not found. Contact SMART_DAKS@who.int to get FHIR resources',
        source: 'who_smart_guidelines'
      };
    }

    return form;
  }

  @Post('reload')
  @ApiOperation({ summary: 'Reload WHO Smart Guidelines from filesystem' })
  @ApiResponse({ status: 200, description: 'Guidelines reloaded' })
  async reloadGuidelines() {
    await this.whoSmartGuidelinesService.reloadGuidelines();
    return {
      message: 'WHO Smart Guidelines reloaded successfully',
      timestamp: new Date().toISOString()
    };
  }
}
