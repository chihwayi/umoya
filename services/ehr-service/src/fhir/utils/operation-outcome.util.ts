/**
 * FHIR OperationOutcome Utility
 * Generates proper FHIR R4 OperationOutcome resources for error responses
 */

export enum IssueSeverity {
  FATAL = 'fatal',
  ERROR = 'error',
  WARNING = 'warning',
  INFORMATION = 'information',
}

export enum IssueType {
  INVALID = 'invalid',
  STRUCTURE = 'structure',
  REQUIRED = 'required',
  VALUE = 'value',
  INVARIANT = 'invariant',
  SECURITY = 'security',
  LOGIN = 'login',
  UNKNOWN = 'unknown',
  EXPIRED = 'expired',
  FORBIDDEN = 'forbidden',
  SUPPRESSED = 'suppressed',
  PROCESSING = 'processing',
  NOT_SUPPORTED = 'not-supported',
  DUPLICATE = 'duplicate',
  NOT_FOUND = 'not-found',
  TOO_LONG = 'too-long',
  CODE_INVALID = 'code-invalid',
  EXTENSION = 'extension',
  TOO_COSTLY = 'too-costly',
  BUSINESS_RULE = 'business-rule',
  CONFLICT = 'conflict',
  TRANSIENT = 'transient',
  LOCK_ERROR = 'lock-error',
  NO_STORE = 'no-store',
  EXCEPTION = 'exception',
  TIMEOUT = 'timeout',
  INCOMPLETE = 'incomplete',
  THROTTLED = 'throttled',
  INFORMATIONAL = 'informational',
}

export interface OperationOutcomeIssue {
  severity: IssueSeverity;
  code: IssueType;
  details?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  diagnostics?: string;
  location?: string[];
}

export class OperationOutcomeUtil {
  /**
   * Create an OperationOutcome resource
   */
  static create(
    issues: OperationOutcomeIssue[],
    id?: string
  ): any {
    return {
      resourceType: 'OperationOutcome',
      id: id || `outcome-${Date.now()}`,
      issue: issues.map(issue => ({
        severity: issue.severity,
        code: issue.code,
        ...(issue.details && { details: issue.details }),
        ...(issue.diagnostics && { diagnostics: issue.diagnostics }),
        ...(issue.location && issue.location.length > 0 && { location: issue.location }),
      })),
    };
  }

  /**
   * Create an error OperationOutcome
   */
  static error(
    message: string,
    code: IssueType = IssueType.EXCEPTION,
    diagnostics?: string,
    location?: string[]
  ): any {
    return this.create([
      {
        severity: IssueSeverity.ERROR,
        code,
        details: {
          text: message,
        },
        diagnostics,
        location,
      },
    ]);
  }

  /**
   * Create a fatal error OperationOutcome
   */
  static fatal(
    message: string,
    code: IssueType = IssueType.EXCEPTION,
    diagnostics?: string,
    location?: string[]
  ): any {
    return this.create([
      {
        severity: IssueSeverity.FATAL,
        code,
        details: {
          text: message,
        },
        diagnostics,
        location,
      },
    ]);
  }

  /**
   * Create a not found OperationOutcome
   */
  static notFound(resourceType: string, id: string): any {
    return this.create([
      {
        severity: IssueSeverity.ERROR,
        code: IssueType.NOT_FOUND,
        details: {
          text: `${resourceType} with ID ${id} not found`,
        },
        diagnostics: `The requested ${resourceType} resource with ID ${id} does not exist`,
      },
    ]);
  }

  /**
   * Create a validation error OperationOutcome
   */
  static validationError(
    message: string,
    field?: string,
    diagnostics?: string
  ): any {
    return this.create([
      {
        severity: IssueSeverity.ERROR,
        code: IssueType.INVALID,
        details: {
          text: message,
        },
        diagnostics,
        location: field ? [field] : undefined,
      },
    ]);
  }

  /**
   * Create a forbidden OperationOutcome
   */
  static forbidden(message: string = 'Access forbidden'): any {
    return this.create([
      {
        severity: IssueSeverity.ERROR,
        code: IssueType.FORBIDDEN,
        details: {
          text: message,
        },
      },
    ]);
  }

  /**
   * Create a conflict OperationOutcome
   */
  static conflict(message: string, diagnostics?: string): any {
    return this.create([
      {
        severity: IssueSeverity.ERROR,
        code: IssueType.CONFLICT,
        details: {
          text: message,
        },
        diagnostics,
      },
    ]);
  }

  /**
   * Create a bad request OperationOutcome
   */
  static badRequest(message: string, field?: string): any {
    return this.create([
      {
        severity: IssueSeverity.ERROR,
        code: IssueType.INVALID,
        details: {
          text: message,
        },
        location: field ? [field] : undefined,
      },
    ]);
  }

  /**
   * Create a not supported OperationOutcome
   */
  static notSupported(operation: string): any {
    return this.create([
      {
        severity: IssueSeverity.ERROR,
        code: IssueType.NOT_SUPPORTED,
        details: {
          text: `Operation ${operation} is not supported`,
        },
      },
    ]);
  }
}

