import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DiabetesType,
  DiabetesRegistryStatus,
} from '../entities/diabetes-registry.entity';
import {
  DiabetesMedicationType,
  DiabetesMedicationCategory,
  DiabetesMedicationStatus,
} from '../entities/diabetes-medication.entity';
import { InsulinRegimenType, InsulinRegimenStatus } from '../entities/insulin-regimen.entity';
import { DiabetesScreeningType } from '../entities/diabetes-complication-screening.entity';
import {
  DiabetesEducationSessionType,
  DiabetesEducationCompletionStatus,
} from '../entities/diabetes-education-session.entity';
import { DiabetesAlertSeverity, DiabetesAlertType } from '../entities/diabetes-alert.entity';
import {
  DiabetesDeviceIntegrationStatus,
  DiabetesDeviceIntegrationType,
  DiabetesDeviceType,
} from '../entities/diabetes-device-integration.entity';
import { GlucoseMonitoringType, GlucoseReadingType } from '../entities/glucose-monitoring.entity';

const DIABETES_TYPES = ['type1', 'type2', 'gestational', 'lada', 'mody', 'secondary', 'prediabetes', 'other'] as const;
const DIABETES_REGISTRY_STATUSES = ['active', 'in_remission', 'resolved', 'deceased'] as const;
const GLUCOSE_UNITS = ['mg/dL', 'mmol/L'] as const;
const GLUCOSE_MONITORING_TYPES = ['self_monitoring', 'cgm', 'flash', 'lab'] as const;
const GLUCOSE_READING_TYPES = ['fasting', 'pre_meal', 'post_meal', 'random', 'bedtime', 'overnight', 'other'] as const;
const DIABETES_MEDICATION_TYPES = ['oral', 'injectable', 'insulin', 'combination', 'other'] as const;
const DIABETES_MEDICATION_CATEGORIES = [
  'metformin',
  'sulfonylurea',
  'dpp4_inhibitor',
  'sglt2_inhibitor',
  'glp1_agonist',
  'thiazolidinedione',
  'alpha_glucosidase_inhibitor',
  'meglitinide',
  'insulin_basal',
  'insulin_bolus',
  'insulin_premixed',
  'other',
] as const;
const DIABETES_MEDICATION_STATUSES = ['active', 'discontinued', 'on_hold', 'completed'] as const;
const INSULIN_REGIMEN_TYPES = ['basal_only', 'basal_bolus', 'premixed', 'pump', 'other'] as const;
const INSULIN_REGIMEN_STATUSES = ['active', 'discontinued', 'on_hold'] as const;
const DIABETES_SCREENING_TYPES = ['retinopathy', 'neuropathy', 'nephropathy', 'cardiovascular', 'foot_ulcer', 'other'] as const;
const DIABETES_EDUCATION_SESSION_TYPES = ['individual', 'group', 'online', 'phone', 'other'] as const;
const DIABETES_EDUCATION_COMPLETION_STATUSES = ['completed', 'partial', 'missed', 'rescheduled'] as const;
const DIABETES_ALERT_TYPES = [
  'overdue_screening',
  'abnormal_value',
  'medication_adherence',
  'hypoglycemia',
  'hyperglycemia',
  'care_bundle_incomplete',
  'device_issue',
  'other',
] as const;
const DIABETES_ALERT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const DIABETES_DEVICE_TYPES = ['cgm', 'insulin_pump', 'glucose_meter', 'smart_pen', 'fitness_tracker', 'other'] as const;
const DIABETES_DEVICE_INTEGRATION_TYPES = ['api', 'hl7', 'fhir', 'manual', 'healthkit', 'google_fit', 'file_upload'] as const;
const DIABETES_DEVICE_INTEGRATION_STATUSES = ['active', 'inactive', 'error', 'pending', 'revoked'] as const;
const GLUCOSE_TREND_PERIODS = ['7d', '14d', '30d', '90d', 'custom'] as const;

export class CreateDiabetesRegistryDto {
  @ApiProperty({ description: 'Patient ID', format: 'uuid' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ enum: DIABETES_TYPES })
  @IsEnum(DIABETES_TYPES)
  diabetesType: DiabetesType;

  @ApiProperty({ description: 'Diagnosis date', format: 'date' })
  @IsDateString()
  diagnosisDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  ageAtDiagnosis?: number;

  @ApiPropertyOptional({ enum: DIABETES_REGISTRY_STATUSES })
  @IsOptional()
  @IsEnum(DIABETES_REGISTRY_STATUSES)
  status?: DiabetesRegistryStatus;

  @ApiPropertyOptional({ description: 'Family history of diabetes' })
  @IsOptional()
  @IsBoolean()
  familyHistory?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  primaryCareProviderId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  endocrinologistId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  diabetesEducatorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  carePlan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDiabetesRegistryDto {
  @ApiPropertyOptional({ enum: DIABETES_TYPES })
  @IsOptional()
  @IsEnum(DIABETES_TYPES)
  diabetesType?: DiabetesType;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  diagnosisDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  ageAtDiagnosis?: number;

  @ApiPropertyOptional({ enum: DIABETES_REGISTRY_STATUSES })
  @IsOptional()
  @IsEnum(DIABETES_REGISTRY_STATUSES)
  status?: DiabetesRegistryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  familyHistory?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  primaryCareProviderId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  endocrinologistId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  diabetesEducatorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  carePlan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateDiabetesCareBundleDto {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  bundleDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hba1cChecked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  hba1cValue?: number;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  hba1cDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bloodPressureChecked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  systolicBp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  diastolicBp?: number;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  bloodPressureDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  lipidProfileChecked?: boolean;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  lipidProfileDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  footExamChecked?: boolean;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  footExamDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  footExamResult?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  eyeExamChecked?: boolean;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  eyeExamDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eyeExamResult?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  urineAcrChecked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  urineAcrValue?: number;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  urineAcrDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  educationDocumented?: boolean;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  educationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  medicationReviewCompleted?: boolean;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  medicationReviewDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bundleCompletionPercentage?: number;
}

export class RecordGlucoseDto {
  @ApiProperty({ enum: GLUCOSE_MONITORING_TYPES })
  @IsEnum(GLUCOSE_MONITORING_TYPES)
  monitoringType: GlucoseMonitoringType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty({ description: 'Glucose value' })
  @IsNumber()
  glucoseValue: number;

  @ApiPropertyOptional({ enum: GLUCOSE_UNITS })
  @IsOptional()
  @IsEnum(GLUCOSE_UNITS)
  glucoseUnit?: (typeof GLUCOSE_UNITS)[number];

  @ApiPropertyOptional({ enum: GLUCOSE_READING_TYPES })
  @IsOptional()
  @IsEnum(GLUCOSE_READING_TYPES)
  readingType?: GlucoseReadingType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mealContext?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  insulinDose?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insulinType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  carbohydratesGrams?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  exerciseMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  stressLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}

export class CreateCgmSummaryDto {
  @ApiProperty({ format: 'date' })
  @IsDateString()
  summaryDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  timeInRange?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  timeAboveRange?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  timeBelowRange?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  timeSevereHypo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  averageGlucose?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  glucoseVariability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  totalReadings?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class CreateDiabetesMedicationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  medicationName: string;

  @ApiProperty({ enum: DIABETES_MEDICATION_TYPES })
  @IsEnum(DIABETES_MEDICATION_TYPES)
  medicationType: DiabetesMedicationType;

  @ApiPropertyOptional({ enum: DIABETES_MEDICATION_CATEGORIES })
  @IsOptional()
  @IsEnum(DIABETES_MEDICATION_CATEGORIES)
  medicationCategory?: DiabetesMedicationCategory;

  @ApiProperty()
  @IsString()
  dosage: string;

  @ApiProperty()
  @IsString()
  frequency: string;

  @ApiPropertyOptional({ enum: ['oral','subcutaneous','intramuscular','intravenous','inhalation','other'] })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: DIABETES_MEDICATION_STATUSES })
  @IsOptional()
  @IsEnum(DIABETES_MEDICATION_STATUSES)
  status?: DiabetesMedicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  adherencePercentage?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  prescribedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonForDiscontinuation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInsulinRegimenDto {
  @ApiProperty({ enum: INSULIN_REGIMEN_TYPES })
  @IsEnum(INSULIN_REGIMEN_TYPES)
  regimenType: InsulinRegimenType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  basalInsulinType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  basalDose?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  basalFrequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bolusInsulinType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  bolusRatio?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  correctionFactor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  targetGlucose?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  carbRatio?: number;

  @ApiPropertyOptional()
  @IsOptional()
  pumpSettings?: Record<string, any>;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: INSULIN_REGIMEN_STATUSES })
  @IsOptional()
  @IsEnum(INSULIN_REGIMEN_STATUSES)
  status?: InsulinRegimenStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordComplicationScreeningDto {
  @ApiProperty({ enum: DIABETES_SCREENING_TYPES })
  @IsEnum(DIABETES_SCREENING_TYPES)
  screeningType: DiabetesScreeningType;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  screeningDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  screeningResult?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  severityGrade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  findings?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  treatmentRecommended?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  treatmentPlan?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  nextScreeningDueDate?: string;
}

export class RecordEducationSessionDto {
  @ApiProperty({ format: 'date' })
  @IsDateString()
  sessionDate: string;

  @ApiProperty({ enum: DIABETES_EDUCATION_SESSION_TYPES })
  @IsEnum(DIABETES_EDUCATION_SESSION_TYPES)
  sessionType: DiabetesEducationSessionType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topicsCovered?: string[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  educatorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  patientAttendance?: boolean;

  @ApiPropertyOptional({ enum: DIABETES_EDUCATION_COMPLETION_STATUSES })
  @IsOptional()
  @IsEnum(DIABETES_EDUCATION_COMPLETION_STATUSES)
  completionStatus?: DiabetesEducationCompletionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  assessmentScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateDiabetesAlertDto {
  @ApiProperty({ enum: DIABETES_ALERT_TYPES })
  @IsEnum(DIABETES_ALERT_TYPES)
  alertType: DiabetesAlertType;

  @ApiProperty({ enum: DIABETES_ALERT_SEVERITIES })
  @IsEnum(DIABETES_ALERT_SEVERITIES)
  alertSeverity: DiabetesAlertSeverity;

  @ApiProperty()
  @IsString()
  alertMessage: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relatedMetric?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  relatedValue?: number;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  relatedDate?: string;
}

export class CreateDeviceIntegrationDto {
  @ApiProperty({ enum: DIABETES_DEVICE_TYPES })
  @IsEnum(DIABETES_DEVICE_TYPES)
  deviceType: DiabetesDeviceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceBrand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceModel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceSerialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ enum: DIABETES_DEVICE_INTEGRATION_TYPES })
  @IsOptional()
  @IsEnum(DIABETES_DEVICE_INTEGRATION_TYPES)
  integrationType?: DiabetesDeviceIntegrationType;

  @ApiPropertyOptional({ enum: DIABETES_DEVICE_INTEGRATION_STATUSES })
  @IsOptional()
  @IsEnum(DIABETES_DEVICE_INTEGRATION_STATUSES)
  integrationStatus?: DiabetesDeviceIntegrationStatus;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  lastSyncAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  syncFrequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiCredentialsEncrypted?: string;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  settings?: Record<string, any>;
}

export class UpdateDiabetesMedicationDto extends PartialType(CreateDiabetesMedicationDto) {}

export class TrackMedicationAdherenceDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  adherencePercentage: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateInsulinRegimenDto extends PartialType(CreateInsulinRegimenDto) {}

export class CalculateInsulinDoseDto {
  @ApiProperty({ description: 'Current glucose reading' })
  @IsNumber()
  currentGlucose: number;

  @ApiPropertyOptional({ description: 'Target glucose; defaults to regimen target' })
  @IsOptional()
  @IsNumber()
  targetGlucose?: number;

  @ApiProperty({ description: 'Carbohydrate intake in grams' })
  @IsNumber()
  carbohydrateIntake: number;

  @ApiPropertyOptional({ description: 'Override correction factor' })
  @IsOptional()
  @IsNumber()
  correctionFactorOverride?: number;

  @ApiPropertyOptional({ description: 'Override carb ratio' })
  @IsOptional()
  @IsNumber()
  carbRatioOverride?: number;
}

export class GlucoseTrendsQueryDto {
  @ApiPropertyOptional({ enum: GLUCOSE_TREND_PERIODS })
  @IsOptional()
  @IsEnum(GLUCOSE_TREND_PERIODS)
  period?: (typeof GLUCOSE_TREND_PERIODS)[number];

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

class CgmDataPointDto {
  @ApiProperty()
  @IsNumber()
  value: number;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  timestamp: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trend?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventType?: string;
}

export class SyncCgmDataDto {
  @ApiProperty({ type: () => [CgmDataPointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CgmDataPointDto)
  entries: CgmDataPointDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ScreeningHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DIABETES_SCREENING_TYPES })
  @IsOptional()
  @IsEnum(DIABETES_SCREENING_TYPES)
  screeningType?: DiabetesScreeningType;
}

export class AcknowledgeAlertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class ResolveAlertDto extends AcknowledgeAlertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}

export class UpdateDeviceIntegrationDto extends PartialType(CreateDeviceIntegrationDto) {}


