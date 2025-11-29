import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithTenant } from '../middleware/tenant.middleware';

/**
 * Guard to enforce HIPAA "Minimum Necessary" rule
 * 
 * This guard ensures users only access the minimum PHI necessary for their job function.
 * 
 * Usage:
 * @UseGuards(MinimumNecessaryGuard)
 * @MinimumNecessary({ roles: ['doctor', 'nurse'], fields: ['id', 'name', 'dateOfBirth'] })
 * @Get('patients/:id')
 */
export const MINIMUM_NECESSARY_KEY = 'minimum_necessary';

export interface MinimumNecessaryOptions {
  roles?: string[]; // Roles allowed to access this endpoint
  fields?: string[]; // Specific fields that can be accessed
  excludeFields?: string[]; // Fields to exclude from response
  requireJustification?: boolean; // Require user to provide justification
}

export const MinimumNecessary = (options: MinimumNecessaryOptions) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(MINIMUM_NECESSARY_KEY, options, descriptor?.value || target);
  };
};

@Injectable()
export class MinimumNecessaryGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Get minimum necessary options from decorator
    const options = this.reflector.getAllAndOverride<MinimumNecessaryOptions>(
      MINIMUM_NECESSARY_KEY,
      [handler, controller],
    );

    if (!options) {
      // No minimum necessary restrictions, allow access
      return true;
    }

    // Check role restrictions
    const user = (request as any).user;
    const userRole = user?.role || 'unknown';

    if (options.roles && !options.roles.includes(userRole)) {
      throw new ForbiddenException(
        `Access denied. This resource requires one of the following roles: ${options.roles.join(', ')}`,
      );
    }

    // Store options in request for interceptor to filter response
    (request as any).minimumNecessaryOptions = options;

    // Check if justification is required
    if (options.requireJustification) {
      const justification = request.headers['x-access-justification'] || request.body?.justification;
      if (!justification) {
        throw new ForbiddenException(
          'Access justification required. Please provide a reason for accessing this PHI.',
        );
      }
    }

    return true;
  }
}


