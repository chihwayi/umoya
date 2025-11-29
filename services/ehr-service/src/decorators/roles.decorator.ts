import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to declare which user roles can access a controller handler.
 * Usage: @Roles('radiologist', 'admin')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);





