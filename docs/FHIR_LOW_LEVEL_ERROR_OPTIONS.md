# Options for Low-Level NestJS Error with FHIR Endpoints

## Current Situation
- `/api/fhir/Patient` returns 500 Internal Server Error
- No logs from middleware, guards, or exception filters
- Error occurs before NestJS processes the request
- Other controllers using `@Request() req: RequestWithTenant` work fine
- Routes are mapped correctly

## Option 1: Use Custom Decorators (RECOMMENDED)
Create custom parameter decorators to extract tenant info directly, bypassing the RequestWithTenant type issue.

**Pros:**
- Clean, reusable solution
- Type-safe
- Works around NestJS dependency injection issues
- Used by many NestJS applications

**Implementation:**
```typescript
// decorators/tenant.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DataSource } from 'typeorm';

export const TenantDb = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): DataSource => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantDb;
  },
);

export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId;
  },
);

// Usage in controller:
async searchPatients(
  @Query() query: any,
  @TenantDb() tenantDb: DataSource,
  @TenantId() tenantId: string
) {
  return this.fhirService.searchPatients(query, tenantDb, tenantId);
}
```

## Option 2: Inject TenantService Directly
Get tenantDb from TenantService in the controller instead of relying on middleware.

**Pros:**
- Direct access, no type issues
- Explicit dependency injection

**Cons:**
- Need to extract tenantId from headers manually
- Less clean than middleware approach

**Implementation:**
```typescript
constructor(
  private fhirService: FhirService,
  private tenantService: TenantService
) {}

async searchPatients(
  @Query() query: any,
  @Headers('x-tenant-id') tenantId: string
) {
  const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
  return this.fhirService.searchPatients(query, tenantDb, tenantId);
}
```

## Option 3: Use Type Assertion Workaround
Cast request to `any` first, then to `RequestWithTenant` to bypass TypeScript type checking.

**Pros:**
- Minimal code changes
- Quick fix

**Cons:**
- Loses type safety
- Not ideal long-term solution

**Implementation:**
```typescript
async searchPatients(
  @Query() query: any,
  @Req() req: any
) {
  const tenantReq = req as RequestWithTenant;
  return this.fhirService.searchPatients(query, tenantReq.tenantDb, tenantReq.tenantId);
}
```

## Option 4: Fix RequestWithTenant Interface Properly
Ensure RequestWithTenant properly extends Express Request with all required properties.

**Implementation:**
```typescript
import { Request } from 'express';
import { DataSource } from 'typeorm';

export interface RequestWithTenant extends Request {
  tenantId?: string;
  tenantDb?: DataSource;
  user?: any;
}

// Ensure all Express Request properties are available
declare module 'express' {
  interface Request {
    tenantId?: string;
    tenantDb?: DataSource;
    user?: any;
  }
}
```

## Option 5: Use Global Interceptor to Catch Early Errors
Create an interceptor that runs before everything else to catch and log errors.

**Implementation:**
```typescript
@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('🔍 [Interceptor] Request:', context.switchToHttp().getRequest().url);
    return next.handle().pipe(
      catchError(error => {
        console.error('🚨 [Interceptor] Error caught:', error);
        throw error;
      })
    );
  }
}
```

## Option 6: Check NestJS Version Compatibility
Verify if there's a known issue with the NestJS version being used.

**Action:**
- Check `package.json` for NestJS version
- Look for known issues with custom request types
- Consider upgrading/downgrading if needed

## Option 7: Use ExecutionContext Directly
Access request through ExecutionContext instead of parameter injection.

**Implementation:**
```typescript
import { ExecutionContext } from '@nestjs/common';

// In a custom decorator or guard
const request = context.switchToHttp().getRequest();
const tenantDb = request.tenantDb;
const tenantId = request.tenantId;
```

## Recommended Approach

**Start with Option 1 (Custom Decorators)** - This is the cleanest, most NestJS-idiomatic solution and avoids the type injection issues entirely.

If that doesn't work, try **Option 2 (Direct Service Injection)** as a fallback.


