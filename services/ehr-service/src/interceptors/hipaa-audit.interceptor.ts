import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { HipaaAuditService, HipaaAuditAction } from '../services/hipaa-audit.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

/**
 * Interceptor to automatically log PHI access for HIPAA compliance
 * 
 * Usage:
 * @UseInterceptors(HipaaAuditInterceptor)
 * @Get('patients/:id')
 * async getPatient(@Param('id') id: string) { ... }
 */
@Injectable()
export class HipaaAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HipaaAuditInterceptor.name);

  constructor(private readonly hipaaAuditService: HipaaAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Extract user information
    const user = (request as any).user;
    const userId = user?.id || user?.userId || 'anonymous';
    const userName = user?.fullName || user?.name || user?.email || 'Unknown';
    const userRole = user?.role || 'unknown';

    // Extract request metadata
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || request.connection.remoteAddress;
    const userAgent = request.headers['user-agent'];
    const sessionId = (request as any).sessionId || request.headers['x-session-id'];

    // Determine action and resource type from route
    const method = request.method;
    const route = request.route?.path || request.url;
    const action = this.determineAction(method, route, handler.name);
    const resourceType = this.determineResourceType(route, controller.name);

    // Extract patient ID from params or body
    const patientId = this.extractPatientId(request);

    // Extract resource ID
    const resourceId = (request.params?.id || request.params?.patientId || request.body?.id) as string | undefined;

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: async (data) => {
          try {
            // Log successful access
            await this.hipaaAuditService.logPhiAccess(
              request.tenantDb,
              userId,
              userName,
              userRole,
              action,
              resourceType,
              resourceId || 'unknown',
              patientId || 'unknown',
              ipAddress as string,
              userAgent,
              sessionId,
              {
                fields: this.determineDataFields(data),
                recordCount: Array.isArray(data) ? data.length : data?.data?.length || 1,
              },
              {
                method,
                route,
                handler: handler.name,
                controller: controller.name,
                responseTime: Date.now() - startTime,
              },
            );
          } catch (error) {
            // Never fail the request due to audit logging
            this.logger.error(`Failed to log audit event: ${error.message}`);
          }
        },
        error: async (error) => {
          try {
            // Log failed access
            await this.hipaaAuditService.logFailedAccess(
              request.tenantDb,
              userId,
              action,
              resourceType,
              resourceId,
              patientId || null,
              error.message || 'Access denied',
              ipAddress as string,
              userAgent,
              {
                method,
                route,
                handler: handler.name,
                error: error.name,
              },
            );
          } catch (auditError) {
            this.logger.error(`Failed to log failed access: ${auditError.message}`);
          }
        },
      }),
    );
  }

  private determineAction(method: string, route: string, handlerName: string): HipaaAuditAction {
    const lowerRoute = route.toLowerCase();
    const lowerHandler = handlerName.toLowerCase();

    // View/Read operations
    if (method === 'GET') {
      if (lowerRoute.includes('patient') || lowerHandler.includes('patient')) {
        return HipaaAuditAction.PATIENT_VIEW;
      }
      if (lowerRoute.includes('medical-record') || lowerHandler.includes('medicalrecord')) {
        return HipaaAuditAction.MEDICAL_RECORD_VIEW;
      }
      if (lowerRoute.includes('prescription') || lowerHandler.includes('prescription')) {
        return HipaaAuditAction.PRESCRIPTION_VIEW;
      }
      if (lowerRoute.includes('lab') || lowerHandler.includes('lab')) {
        return HipaaAuditAction.LAB_RESULT_VIEW;
      }
      if (lowerRoute.includes('imaging') || lowerHandler.includes('imaging')) {
        return HipaaAuditAction.IMAGING_VIEW;
      }
      if (lowerRoute.includes('vitals') || lowerHandler.includes('vitals')) {
        return HipaaAuditAction.VITALS_VIEW;
      }
      if (lowerRoute.includes('allergy') || lowerHandler.includes('allergy')) {
        return HipaaAuditAction.ALLERGY_VIEW;
      }
      if (lowerRoute.includes('problem') || lowerHandler.includes('problem')) {
        return HipaaAuditAction.PROBLEM_VIEW;
      }
      if (lowerRoute.includes('appointment') || lowerHandler.includes('appointment')) {
        return HipaaAuditAction.APPOINTMENT_VIEW;
      }
      if (lowerRoute.includes('billing') || lowerHandler.includes('billing')) {
        return HipaaAuditAction.BILLING_VIEW;
      }
      if (lowerRoute.includes('search') || lowerHandler.includes('search')) {
        return HipaaAuditAction.SEARCH_PATIENTS;
      }
    }

    // Create operations
    if (method === 'POST') {
      if (lowerRoute.includes('patient') || lowerHandler.includes('createpatient')) {
        return HipaaAuditAction.PATIENT_CREATE;
      }
      if (lowerRoute.includes('medical-record') || lowerHandler.includes('createmedicalrecord')) {
        return HipaaAuditAction.MEDICAL_RECORD_CREATE;
      }
      if (lowerRoute.includes('prescription') || lowerHandler.includes('createprescription')) {
        return HipaaAuditAction.PRESCRIPTION_CREATE;
      }
      if (lowerRoute.includes('lab') || lowerHandler.includes('createlab')) {
        return HipaaAuditAction.LAB_ORDER_CREATE;
      }
      if (lowerRoute.includes('imaging') || lowerHandler.includes('createimaging')) {
        return HipaaAuditAction.IMAGING_CREATE;
      }
      if (lowerRoute.includes('vitals') || lowerHandler.includes('createvitals')) {
        return HipaaAuditAction.VITALS_CREATE;
      }
      if (lowerRoute.includes('allergy') || lowerHandler.includes('createallergy')) {
        return HipaaAuditAction.ALLERGY_CREATE;
      }
      if (lowerRoute.includes('problem') || lowerHandler.includes('createproblem')) {
        return HipaaAuditAction.PROBLEM_CREATE;
      }
      if (lowerRoute.includes('appointment') || lowerHandler.includes('createappointment')) {
        return HipaaAuditAction.APPOINTMENT_CREATE;
      }
    }

    // Update operations
    if (method === 'PUT' || method === 'PATCH') {
      if (lowerRoute.includes('patient') || lowerHandler.includes('updatepatient')) {
        return HipaaAuditAction.PATIENT_UPDATE;
      }
      if (lowerRoute.includes('medical-record') || lowerHandler.includes('updatemedicalrecord')) {
        return HipaaAuditAction.MEDICAL_RECORD_UPDATE;
      }
      if (lowerRoute.includes('prescription') || lowerHandler.includes('updateprescription')) {
        return HipaaAuditAction.PRESCRIPTION_UPDATE;
      }
      if (lowerRoute.includes('lab') || lowerHandler.includes('updatelab')) {
        return HipaaAuditAction.LAB_ORDER_UPDATE;
      }
      if (lowerRoute.includes('imaging') || lowerHandler.includes('updateimaging')) {
        return HipaaAuditAction.IMAGING_UPDATE;
      }
      if (lowerRoute.includes('vitals') || lowerHandler.includes('updatevitals')) {
        return HipaaAuditAction.VITALS_UPDATE;
      }
      if (lowerRoute.includes('allergy') || lowerHandler.includes('updateallergy')) {
        return HipaaAuditAction.ALLERGY_UPDATE;
      }
      if (lowerRoute.includes('problem') || lowerHandler.includes('updateproblem')) {
        return HipaaAuditAction.PROBLEM_UPDATE;
      }
      if (lowerRoute.includes('appointment') || lowerHandler.includes('updateappointment')) {
        return HipaaAuditAction.APPOINTMENT_UPDATE;
      }
    }

    // Delete operations
    if (method === 'DELETE') {
      if (lowerRoute.includes('patient') || lowerHandler.includes('deletepatient')) {
        return HipaaAuditAction.PATIENT_DELETE;
      }
      if (lowerRoute.includes('medical-record') || lowerHandler.includes('deletemedicalrecord')) {
        return HipaaAuditAction.MEDICAL_RECORD_DELETE;
      }
      if (lowerRoute.includes('prescription') || lowerHandler.includes('deleteprescription')) {
        return HipaaAuditAction.PRESCRIPTION_DELETE;
      }
      if (lowerRoute.includes('allergy') || lowerHandler.includes('deleteallergy')) {
        return HipaaAuditAction.ALLERGY_DELETE;
      }
      if (lowerRoute.includes('problem') || lowerHandler.includes('deleteproblem')) {
        return HipaaAuditAction.PROBLEM_DELETE;
      }
      if (lowerRoute.includes('appointment') || lowerHandler.includes('deleteappointment')) {
        return HipaaAuditAction.APPOINTMENT_DELETE;
      }
    }

    // Default fallback
    return HipaaAuditAction.PATIENT_VIEW;
  }

  private determineResourceType(route: string, controllerName: string): string {
    const lowerRoute = route.toLowerCase();
    const lowerController = controllerName.toLowerCase();

    if (lowerRoute.includes('patient') || lowerController.includes('patient')) {
      return 'patient';
    }
    if (lowerRoute.includes('medical-record') || lowerController.includes('medicalrecord')) {
      return 'medical_record';
    }
    if (lowerRoute.includes('prescription') || lowerController.includes('prescription')) {
      return 'prescription';
    }
    if (lowerRoute.includes('lab') || lowerController.includes('lab')) {
      return 'lab_order';
    }
    if (lowerRoute.includes('imaging') || lowerController.includes('imaging')) {
      return 'imaging';
    }
    if (lowerRoute.includes('vitals') || lowerController.includes('vitals')) {
      return 'vitals';
    }
    if (lowerRoute.includes('allergy') || lowerController.includes('allergy')) {
      return 'allergy';
    }
    if (lowerRoute.includes('problem') || lowerController.includes('problem')) {
      return 'problem';
    }
    if (lowerRoute.includes('appointment') || lowerController.includes('appointment')) {
      return 'appointment';
    }
    if (lowerRoute.includes('billing') || lowerController.includes('billing')) {
      return 'billing';
    }

    return 'unknown';
  }

  private extractPatientId(request: Request): string | undefined {
    // Try params first
    if (request.params?.patientId) {
      return request.params.patientId;
    }
    if (request.params?.id && request.route?.path?.includes('patient')) {
      return request.params.id;
    }

    // Try body
    if (request.body?.patientId) {
      return request.body.patientId;
    }
    if (request.body?.patient?.id) {
      return request.body.patient.id;
    }

    // Try query
    if (request.query?.patientId) {
      return request.query.patientId as string;
    }

    return undefined;
  }

  private determineDataFields(data: any): string[] {
    if (!data) {
      return [];
    }

    const fields: string[] = [];
    const obj = Array.isArray(data) ? (data[0] || {}) : (data.data?.[0] || data);

    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach((key) => {
        // Exclude non-PHI fields
        if (
          !['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at'].includes(key) &&
          !key.startsWith('_')
        ) {
          fields.push(key);
        }
      });
    }

    return fields;
  }
}


