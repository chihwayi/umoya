import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FhirInboundService } from '../services/fhir-inbound.service';
import { FhirInboundKeyGuard } from '../guards/fhir-inbound-key.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type * as fhir from 'fhir/r4';

@Controller('fhir/inbound')
export class FhirInboundController {
  constructor(private readonly svc: FhirInboundService) {}

  @Post('Bundle')
  @UseGuards(FhirInboundKeyGuard)
  ingestBundle(
    @Body() bundle: fhir.Bundle,
    @Query('subdomain') subdomain: string,
    @Query('source') source: string,
  ) {
    return this.svc.ingestBundle(subdomain, bundle, source || 'external');
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard)
  getIngestionLogs(@Query('subdomain') subdomain: string) {
    return this.svc.getIngestionLogs(subdomain);
  }
}
