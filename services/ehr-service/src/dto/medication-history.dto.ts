import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  MedicationStatus,
  MedicationType,
  ReconciliationStatus,
  ReconciliationType,
} from '../entities/patient-medication.entity';

export class CreateMedicationDto {
  @IsString()
  @MaxLength(255)
  medicationName: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  genericName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  dosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  dosageUnit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  frequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  route?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  duration?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(MedicationType)
  medicationType?: MedicationType;

  @IsOptional()
  @IsEnum(MedicationStatus)
  status?: MedicationStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(ReconciliationStatus)
  reconciliationStatus?: ReconciliationStatus;

  @IsOptional()
  @IsString()
  reconciliationNotes?: string;
}

export class UpdateMedicationDto extends PartialType(CreateMedicationDto) {}

export class RecordAdherenceDto {
  @IsDateString()
  adherenceDate: string;

  @IsBoolean()
  taken: boolean;

  @IsOptional()
  @IsString()
  missedReason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateReconciliationDto {
  @IsEnum(ReconciliationType)
  reconciliationType: ReconciliationType;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  medicationIds?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export interface MedicationReconciliationResultDto {
  id: string;
  discrepanciesFound: number;
  discrepanciesResolved: number;
  medicationsNeedingReview: Array<{
    id: string;
    medicationName: string;
    dosage?: string;
    frequency?: string;
    reconciliationStatus: ReconciliationStatus;
    reconciliationNotes?: string;
  }>;
  medicationsVerified: Array<{
    id: string;
    medicationName: string;
    dosage?: string;
    frequency?: string;
  }>;
}

