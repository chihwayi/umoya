import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { Hl7Service } from '../services/hl7.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('HL7 v2.x Integration')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hl7')
export class Hl7Controller {
  constructor(private hl7Service: Hl7Service) {}

  @Post('adt')
  @ApiOperation({ summary: 'Process HL7 ADT (Admit, Discharge, Transfer) message' })
  @ApiResponse({ status: 200, description: 'HL7 ADT message processed successfully' })
  async processAdtMessage(
    @Body() body: { message: string },
    @Request() req: RequestWithTenant
  ) {
    return this.hl7Service.processAdtMessage(body.message, req.tenantDb);
  }

  @Post('orm')
  @ApiOperation({ summary: 'Process HL7 ORM (Order) message' })
  @ApiResponse({ status: 200, description: 'HL7 ORM message processed successfully' })
  async processOrmMessage(
    @Body() body: { message: string },
    @Request() req: RequestWithTenant
  ) {
    return this.hl7Service.processOrmMessage(body.message, req.tenantDb);
  }

  @Post('oru')
  @ApiOperation({ summary: 'Process HL7 ORU (Observation Result) message' })
  @ApiResponse({ status: 200, description: 'HL7 ORU message processed successfully' })
  async processOruMessage(
    @Body() body: { message: string },
    @Request() req: RequestWithTenant
  ) {
    return this.hl7Service.processOruMessage(body.message, req.tenantDb);
  }

  @Post('mdm')
  @ApiOperation({ summary: 'Process HL7 MDM (Medical Document Management) message' })
  @ApiResponse({ status: 200, description: 'HL7 MDM message processed successfully' })
  async processMdmMessage(
    @Body() body: { message: string },
    @Request() req: RequestWithTenant
  ) {
    return this.hl7Service.processMdmMessage(body.message, req.tenantDb);
  }

  @Get('generate/adt/:patientId')
  @ApiOperation({ summary: 'Generate HL7 ADT message for patient' })
  @ApiResponse({ status: 200, description: 'HL7 ADT message generated' })
  async generateAdtMessage(
    @Request() req: RequestWithTenant
  ) {
    return this.hl7Service.generateAdtMessage((req as any).params.patientId, req.tenantDb);
  }

  @Get('generate/orm/:orderId')
  @ApiOperation({ summary: 'Generate HL7 ORM message for order' })
  @ApiResponse({ status: 200, description: 'HL7 ORM message generated' })
  async generateOrmMessage(
    @Request() req: RequestWithTenant
  ) {
    return this.hl7Service.generateOrmMessage((req as any).params.orderId, req.tenantDb);
  }
}