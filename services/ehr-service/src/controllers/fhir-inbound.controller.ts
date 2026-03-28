import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { FhirInboundService } from '../services/fhir-inbound.service';
import type * as fhir from 'fhir/r4';

@Controller('fhir/inbound')
export class FhirInboundController {
  constructor(private readonly svc: FhirInboundService) {}

  @Post('Bundle')
  ingestBundle(
    @Body() bundle: fhir.Bundle,
    @Query('subdomain') subdomain: string,
    @Query('source') source: string,
  ) {
    return this.svc.ingestBundle(subdomain, bundle, source || 'external');
  }

  @Get('logs')
  getIngestionLogs(@Query('subdomain') subdomain: string) {
    return this.svc.getIngestionLogs(subdomain);
  }
}
