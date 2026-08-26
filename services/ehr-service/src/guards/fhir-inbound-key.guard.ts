import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Guards inbound FHIR Bundle submissions from external HIE/referral systems.
 * These callers have no staff/patient JWT, so auth is a shared-secret header
 * checked against FHIR_INBOUND_API_KEY. Fails closed if the env var is unset.
 */
@Injectable()
export class FhirInboundKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedKey = (process.env.FHIR_INBOUND_API_KEY || '').trim();
    if (!expectedKey) {
      throw new UnauthorizedException('FHIR inbound ingestion is not configured');
    }

    const request = context.switchToHttp().getRequest();
    const providedKey = String(request.headers?.['x-fhir-api-key'] || '');

    if (providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid FHIR inbound API key');
    }

    return true;
  }
}
