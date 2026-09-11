import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Guards inbound HL7 lab-result submissions from the National Health
 * Laboratory Service (NHLS) feed. This caller has no staff/patient JWT, so
 * auth is a shared-secret header checked against NHLS_INBOUND_API_KEY.
 * Fails closed if the env var is unset — matches FhirInboundKeyGuard.
 */
@Injectable()
export class NhlsInboundKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedKey = (process.env.NHLS_INBOUND_API_KEY || '').trim();
    if (!expectedKey) {
      throw new UnauthorizedException('NHLS inbound ingestion is not configured');
    }

    const request = context.switchToHttp().getRequest();
    const providedKey = String(request.headers?.['x-nhls-api-key'] || '');

    if (providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid NHLS inbound API key');
    }

    return true;
  }
}
