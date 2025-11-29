import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsInt,
  IsNumber,
  IsArray,
  IsDateString,
  IsObject,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

// Report Template DTOs
export enum ReportType {
  FINANCIAL = 'financial',
  CLINICAL = 'clinical',
  OPERATIONAL = 'operational',
  CUSTOM = 'custom',
}

export class CreateReportTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Report type', enum: ReportType })
  @IsEnum(ReportType)
  @IsNotEmpty()
  reportType: ReportType;

  @ApiPropertyOptional({ description: 'Report category' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Report configuration (filters, columns, etc.)', type: 'object' })
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Query configuration (SQL, data sources, etc.)', type: 'object' })
  @IsObject()
  @IsOptional()
  queryConfig?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Visualization configuration (charts, graphs, etc.)', type: 'object' })
  @IsObject()
  @IsOptional()
  visualizationConfig?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Whether template is public', default: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Whether template is default for category', default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Roles that can access this template', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sharedWithRoles?: string[];
}

export class UpdateReportTemplateDto extends PartialType(CreateReportTemplateDto) {}

export class ReportTemplateQueryDto {
  @ApiPropertyOptional({ description: 'Filter by report type', enum: ReportType })
  @IsEnum(ReportType)
  @IsOptional()
  reportType?: ReportType;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by public templates', default: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export class ExecuteReportDto {
  @ApiPropertyOptional({ description: 'Filters to apply', type: 'object' })
  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Export format', enum: ['pdf', 'excel', 'csv', 'json'] })
  @IsString()
  @IsOptional()
  format?: string;

  @ApiPropertyOptional({ description: 'Page number for pagination' })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

// Scheduled Report DTOs
export enum ScheduleType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

export enum ReportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
  JSON = 'json',
}

export class CreateScheduledReportDto {
  @ApiPropertyOptional({ description: 'Template ID to use' })
  @IsUUID()
  @IsOptional()
  templateId?: string;

  @ApiProperty({ description: 'Schedule name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Schedule type', enum: ScheduleType })
  @IsEnum(ScheduleType)
  @IsNotEmpty()
  scheduleType: ScheduleType;

  @ApiPropertyOptional({ description: 'Schedule configuration (cron expression, etc.)', type: 'object' })
  @IsObject()
  @IsOptional()
  scheduleConfig?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Email recipients', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recipients?: string[];

  @ApiPropertyOptional({ description: 'Recipient roles', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recipientRoles?: string[];

  @ApiPropertyOptional({ description: 'Report format', enum: ReportFormat, default: ReportFormat.PDF })
  @IsEnum(ReportFormat)
  @IsOptional()
  format?: ReportFormat;

  @ApiPropertyOptional({ description: 'Report filters', type: 'object' })
  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Whether schedule is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateScheduledReportDto extends PartialType(CreateScheduledReportDto) {}

export class ScheduledReportQueryDto {
  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

// Clinical Outcome DTOs
export enum OutcomeType {
  TREATMENT_RESPONSE = 'treatment_response',
  READMISSION = 'readmission',
  COMPLICATION = 'complication',
  MORTALITY = 'mortality',
  QUALITY_OF_LIFE = 'quality_of_life',
  OTHER = 'other',
}

export enum OutcomeStatus {
  IMPROVED = 'improved',
  STABLE = 'stable',
  WORSENED = 'worsened',
  RESOLVED = 'resolved',
  ONGOING = 'ongoing',
}

export enum Severity {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  CRITICAL = 'critical',
}

export class CreateClinicalOutcomeDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Outcome type', enum: OutcomeType })
  @IsEnum(OutcomeType)
  @IsNotEmpty()
  outcomeType: OutcomeType;

  @ApiPropertyOptional({ description: 'Condition name' })
  @IsString()
  @IsOptional()
  condition?: string;

  @ApiPropertyOptional({ description: 'SNOMED code' })
  @IsString()
  @IsOptional()
  snomedCode?: string;

  @ApiPropertyOptional({ description: 'Baseline date' })
  @IsDateString()
  @IsOptional()
  baselineDate?: string;

  @ApiPropertyOptional({ description: 'Outcome date' })
  @IsDateString()
  @IsOptional()
  outcomeDate?: string;

  @ApiPropertyOptional({ description: 'Outcome value' })
  @IsNumber()
  @IsOptional()
  outcomeValue?: number;

  @ApiPropertyOptional({ description: 'Outcome unit' })
  @IsString()
  @IsOptional()
  outcomeUnit?: string;

  @ApiPropertyOptional({ description: 'Outcome status', enum: OutcomeStatus })
  @IsEnum(OutcomeStatus)
  @IsOptional()
  outcomeStatus?: OutcomeStatus;

  @ApiPropertyOptional({ description: 'Severity', enum: Severity })
  @IsEnum(Severity)
  @IsOptional()
  severity?: Severity;

  @ApiPropertyOptional({ description: 'Related appointment ID' })
  @IsUUID()
  @IsOptional()
  relatedAppointmentId?: string;

  @ApiPropertyOptional({ description: 'Related prescription ID' })
  @IsUUID()
  @IsOptional()
  relatedPrescriptionId?: string;

  @ApiPropertyOptional({ description: 'Related lab order ID' })
  @IsUUID()
  @IsOptional()
  relatedLabOrderId?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateClinicalOutcomeDto extends PartialType(CreateClinicalOutcomeDto) {}

export class ClinicalOutcomeQueryDto {
  @ApiPropertyOptional({ description: 'Filter by patient ID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Filter by outcome type', enum: OutcomeType })
  @IsEnum(OutcomeType)
  @IsOptional()
  outcomeType?: OutcomeType;

  @ApiPropertyOptional({ description: 'Filter by condition' })
  @IsString()
  @IsOptional()
  condition?: string;

  @ApiPropertyOptional({ description: 'Filter by date from' })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by date to' })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

// Analytics Metrics DTOs
export enum MetricCategory {
  FINANCIAL = 'financial',
  CLINICAL = 'clinical',
  OPERATIONAL = 'operational',
}

export class CreateAnalyticsMetricDto {
  @ApiProperty({ description: 'Metric name' })
  @IsString()
  @IsNotEmpty()
  metricName: string;

  @ApiPropertyOptional({ description: 'Metric category', enum: MetricCategory })
  @IsEnum(MetricCategory)
  @IsOptional()
  metricCategory?: MetricCategory;

  @ApiProperty({ description: 'Metric date' })
  @IsDateString()
  @IsNotEmpty()
  metricDate: string;

  @ApiPropertyOptional({ description: 'Metric value' })
  @IsNumber()
  @IsOptional()
  metricValue?: number;

  @ApiPropertyOptional({ description: 'Metric unit' })
  @IsString()
  @IsOptional()
  metricUnit?: string;

  @ApiPropertyOptional({ description: 'Additional dimensions', type: 'object' })
  @IsObject()
  @IsOptional()
  dimensions?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Calculation method' })
  @IsString()
  @IsOptional()
  calculationMethod?: string;
}

export class UpdateAnalyticsMetricDto extends PartialType(CreateAnalyticsMetricDto) {}

export class AnalyticsMetricQueryDto {
  @ApiPropertyOptional({ description: 'Filter by metric name' })
  @IsString()
  @IsOptional()
  metricName?: string;

  @ApiPropertyOptional({ description: 'Filter by category', enum: MetricCategory })
  @IsEnum(MetricCategory)
  @IsOptional()
  metricCategory?: MetricCategory;

  @ApiPropertyOptional({ description: 'Filter by date from' })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by date to' })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

// Report Execution DTOs
export class ReportExecutionQueryDto {
  @ApiPropertyOptional({ description: 'Filter by template ID' })
  @IsUUID()
  @IsOptional()
  reportTemplateId?: string;

  @ApiPropertyOptional({ description: 'Filter by scheduled report ID' })
  @IsUUID()
  @IsOptional()
  scheduledReportId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by execution type', enum: ['manual', 'scheduled', 'api'] })
  @IsString()
  @IsOptional()
  executionType?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

// Report Favorite DTOs
export class CreateReportFavoriteDto {
  @ApiProperty({ description: 'Report template ID' })
  @IsUUID()
  @IsNotEmpty()
  reportTemplateId: string;

  @ApiPropertyOptional({ description: 'Custom name for favorite' })
  @IsString()
  @IsOptional()
  customName?: string;

  @ApiPropertyOptional({ description: 'Display order', default: 0 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  order?: number;
}

export class UpdateReportFavoriteDto {
  @ApiPropertyOptional({ description: 'Custom name for favorite' })
  @IsString()
  @IsOptional()
  customName?: string;

  @ApiPropertyOptional({ description: 'Display order' })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  order?: number;
}

// Analytics Query DTOs
export class GetMetricTrendsDto {
  @ApiProperty({ description: 'Metric name' })
  @IsString()
  @IsNotEmpty()
  metricName: string;

  @ApiPropertyOptional({ description: 'Period', enum: ['7d', '30d', '90d', '1y', 'all'] })
  @IsString()
  @IsOptional()
  period?: string;

  @ApiPropertyOptional({ description: 'Date from' })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Date to' })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Group by', enum: ['day', 'week', 'month', 'quarter', 'year'] })
  @IsString()
  @IsOptional()
  groupBy?: string;
}

export class CompareMetricsDto {
  @ApiProperty({ description: 'Metric name' })
  @IsString()
  @IsNotEmpty()
  metricName: string;

  @ApiProperty({ description: 'First period start date' })
  @IsDateString()
  @IsNotEmpty()
  period1Start: string;

  @ApiProperty({ description: 'First period end date' })
  @IsDateString()
  @IsNotEmpty()
  period1End: string;

  @ApiProperty({ description: 'Second period start date' })
  @IsDateString()
  @IsNotEmpty()
  period2Start: string;

  @ApiProperty({ description: 'Second period end date' })
  @IsDateString()
  @IsNotEmpty()
  period2End: string;
}

