import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const RESPONSE_ASSESSMENT_TYPES = ['baseline', 'interim', 'end_of_treatment', 'follow_up'] as const;
export const RECIST_RESPONSES = ['CR', 'PR', 'SD', 'PD', 'NE'] as const;
export const CLINICAL_TRIAL_STATUSES = ['screening', 'enrolled', 'on_treatment', 'completed', 'withdrawn'] as const;
export const PRO_TYPES = ['EORTC_QLQ_C30', 'FACT_G', 'symptom_tracking', 'functional_status', 'satisfaction'] as const;

export class CreateOncologyImagingFindingDto {
  @ApiPropertyOptional({ description: 'Related imaging study ID' })
  @IsOptional()
  @IsUUID()
  imagingStudyId?: string;

  @ApiProperty({ description: 'Imaging date', format: 'date' })
  @IsDateString()
  imagingDate: string;

  @ApiProperty({ description: 'Imaging modality, e.g. CT, MRI' })
  @IsString()
  imagingType: string;

  @ApiPropertyOptional({ description: 'Detailed modality such as PET-CT, 3T MRI' })
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional({ description: 'Findings narrative' })
  @IsOptional()
  @IsString()
  findings?: string;

  @ApiPropertyOptional({ description: 'Tumor size in centimeters' })
  @IsOptional()
  @IsNumber()
  tumorSizeCm?: number;

  @ApiPropertyOptional({ description: 'Tumor location description' })
  @IsOptional()
  @IsString()
  tumorLocation?: string;

  @ApiPropertyOptional({ description: 'Number of lymph nodes involved' })
  @IsOptional()
  @IsNumber()
  lymphNodesInvolved?: number;

  @ApiPropertyOptional({ description: 'Metastatic sites' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metastaticSites?: string[];

  @ApiPropertyOptional({ enum: RECIST_RESPONSES })
  @IsOptional()
  @IsEnum(RECIST_RESPONSES)
  recistResponse?: (typeof RECIST_RESPONSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  recistCriteriaMet?: boolean;

  @ApiPropertyOptional({ description: 'Radiologist ID' })
  @IsOptional()
  @IsUUID()
  radiologistId?: string;
}

export class CreateOncologyPathologyDto {
  @ApiPropertyOptional({ description: 'Linked pathology report ID' })
  @IsOptional()
  @IsUUID()
  pathologyReportId?: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  specimenDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specimenType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  histologyType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  histologySnomedCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  histologySnomedTerm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  grade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stageT?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stageN?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stageM?: string;

  @ApiPropertyOptional({ description: 'Biomarkers JSON payload' })
  @IsOptional()
  biomarkers?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Genetic testing JSON payload' })
  @IsOptional()
  geneticTesting?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Genomic data JSON payload' })
  @IsOptional()
  genomicData?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Pathologist ID' })
  @IsOptional()
  @IsUUID()
  pathologistId?: string;
}

export class UpdateOncologyBiomarkersDto {
  @ApiPropertyOptional()
  @IsOptional()
  biomarkers?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  geneticTesting?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  genomicData?: Record<string, any>;
}

export class CreateResponseAssessmentDto {
  @ApiPropertyOptional({ description: 'Linked regimen ID' })
  @IsOptional()
  @IsUUID()
  regimenId?: string;

  @ApiProperty({ description: 'Assessment date', format: 'date' })
  @IsDateString()
  assessmentDate: string;

  @ApiProperty({ enum: RESPONSE_ASSESSMENT_TYPES })
  @IsEnum(RESPONSE_ASSESSMENT_TYPES)
  assessmentType: (typeof RESPONSE_ASSESSMENT_TYPES)[number];

  @ApiPropertyOptional({ enum: RECIST_RESPONSES })
  @IsOptional()
  @IsEnum(RECIST_RESPONSES)
  recistResponse?: (typeof RECIST_RESPONSES)[number];

  @ApiPropertyOptional({ description: 'Best overall response to date' })
  @IsOptional()
  @IsString()
  bestOverallResponse?: string;

  @ApiPropertyOptional({ description: 'Number of measurable target lesions' })
  @IsOptional()
  @IsNumber()
  targetLesionsCount?: number;

  @ApiPropertyOptional({ description: 'Sum of target lesion diameters (cm)' })
  @IsOptional()
  @IsNumber()
  targetLesionsSizeCm?: number;

  @ApiPropertyOptional({ description: 'Qualitative status of non-target lesions' })
  @IsOptional()
  @IsString()
  nonTargetLesionsStatus?: string;

  @ApiPropertyOptional({ description: 'Indicates if new lesions are present' })
  @IsOptional()
  @IsBoolean()
  newLesions?: boolean;

  @ApiPropertyOptional({ description: 'Free text notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CalculateAssessmentRecistDto {
  @ApiPropertyOptional({ description: 'Baseline assessment ID for comparison' })
  @IsOptional()
  @IsUUID()
  baselineAssessmentId?: string;
}

export class CreateSurvivorshipPlanDto {
  @ApiPropertyOptional({ description: 'Treatment completion date', format: 'date' })
  @IsOptional()
  @IsDateString()
  treatmentCompletionDate?: string;

  @ApiPropertyOptional({ description: 'Structured follow-up plan JSON' })
  @IsOptional()
  followUpSchedule?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Surveillance imaging schedule JSON' })
  @IsOptional()
  surveillanceImagingSchedule?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Long-term side effects list' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  longTermSideEffects?: string[];

  @ApiPropertyOptional({ description: 'Recurrence risk level' })
  @IsOptional()
  @IsString()
  recurrenceRisk?: string;

  @ApiPropertyOptional({ description: 'Lifestyle recommendations' })
  @IsOptional()
  @IsString()
  lifestyleRecommendations?: string;
}

export class UpdateSurvivorshipPlanDto extends CreateSurvivorshipPlanDto {}

export class EnrollClinicalTrialDto {
  @ApiProperty()
  @IsString()
  trialName: string;

  @ApiPropertyOptional({ description: 'External trial identifier (e.g., NCT number)' })
  @IsOptional()
  @IsString()
  trialId?: string;

  @ApiPropertyOptional({ description: 'Trial phase' })
  @IsOptional()
  @IsString()
  trialPhase?: string;

  @ApiPropertyOptional({ description: 'Enrollment date', format: 'date' })
  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;

  @ApiPropertyOptional({ enum: CLINICAL_TRIAL_STATUSES })
  @IsOptional()
  @IsEnum(CLINICAL_TRIAL_STATUSES)
  enrollmentStatus?: (typeof CLINICAL_TRIAL_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Protocol compliance percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  protocolCompliancePercentage?: number;

  @ApiPropertyOptional({ description: 'Trial endpoints JSON' })
  @IsOptional()
  trialEndpoints?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notes or eligibility info' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateClinicalTrialStatusDto {
  @ApiProperty({ enum: CLINICAL_TRIAL_STATUSES })
  @IsEnum(CLINICAL_TRIAL_STATUSES)
  enrollmentStatus: (typeof CLINICAL_TRIAL_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Protocol compliance percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  protocolCompliancePercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  trialEndpoints?: Record<string, any>;
}

export class RecordTrialComplianceDto {
  @ApiProperty({ description: 'Compliance percentage' })
  @IsNumber()
  @Min(0)
  @Max(100)
  protocolCompliancePercentage: number;

  @ApiPropertyOptional({ description: 'Updated endpoints JSON' })
  @IsOptional()
  trialEndpoints?: Record<string, any>;
}

export class RecordPatientReportedOutcomeDto {
  @ApiProperty({ enum: PRO_TYPES })
  @IsEnum(PRO_TYPES)
  assessmentType: (typeof PRO_TYPES)[number];

  @ApiProperty({ description: 'Assessment date', format: 'date' })
  @IsDateString()
  assessmentDate: string;

  @ApiProperty({ description: 'Assessment payload JSON' })
  assessmentData: Record<string, any>;

  @ApiPropertyOptional({ description: 'Total score (if available)' })
  @IsOptional()
  @IsNumber()
  totalScore?: number;

  @ApiPropertyOptional({ description: 'Domain scores JSON' })
  @IsOptional()
  domainScores?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Completed by patient flag' })
  @IsOptional()
  @IsBoolean()
  completedByPatient?: boolean;
}

export class ProHistoryQueryDto {
  @ApiPropertyOptional({ enum: PRO_TYPES })
  @IsOptional()
  @IsEnum(PRO_TYPES)
  assessmentType?: (typeof PRO_TYPES)[number];
}

export class RecordGenomicDataDto {
  @ApiProperty({ description: 'Pathology record ID to attach data to' })
  @IsUUID()
  pathologyId: string;

  @ApiProperty({ description: 'Genomic data JSON (mutations, MSI, TMB, etc.)' })
  genomicData: Record<string, any>;
}

export class RecordFinancialToxicityDto {
  @ApiProperty({ description: 'Assessment date', format: 'date' })
  @IsDateString()
  assessmentDate: string;

  @ApiPropertyOptional({ description: 'Total cost to date' })
  @IsOptional()
  @IsNumber()
  totalCostToDate?: number;

  @ApiPropertyOptional({ description: 'Total insurance coverage to date' })
  @IsOptional()
  @IsNumber()
  insuranceCoverageTotal?: number;

  @ApiPropertyOptional({ description: 'Total out-of-pocket cost to date' })
  @IsOptional()
  @IsNumber()
  outOfPocketTotal?: number;

  @ApiPropertyOptional({ description: 'Total financial assistance received' })
  @IsOptional()
  @IsNumber()
  financialAssistanceTotal?: number;

  @ApiPropertyOptional({ description: 'Financial stress score (1-10)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  financialStressScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class OncologyAnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Start date for analytics window', format: 'date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for analytics window', format: 'date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by cancer type / diagnosis' })
  @IsOptional()
  @IsString()
  cancerType?: string;

  @ApiPropertyOptional({ description: 'Filter by stage (overall_stage)' })
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional({ description: 'Filter by oncologist/user id' })
  @IsOptional()
  @IsUUID()
  oncologistId?: string;

  @ApiPropertyOptional({ description: 'Filter by biomarker keyword' })
  @IsOptional()
  @IsString()
  biomarker?: string;
}

export class OncologyAlertCheckDto {
  @ApiPropertyOptional({ description: 'Include treatment recommendations in response' })
  @IsOptional()
  @IsBoolean()
  includeRecommendations?: boolean;

  @ApiPropertyOptional({ description: 'Include surveillance reminders in response' })
  @IsOptional()
  @IsBoolean()
  includeSurveillance?: boolean;

  @ApiPropertyOptional({ description: 'Include toxicity alerts in response' })
  @IsOptional()
  @IsBoolean()
  includeToxicity?: boolean;
}

