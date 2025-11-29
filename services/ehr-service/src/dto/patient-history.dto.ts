import { IsString, IsOptional, IsDateString, IsEnum, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type ConditionType = 'diagnosis' | 'surgery' | 'procedure' | 'injury' | 'hospitalization' | 'other';
export type HistoryStatus = 'active' | 'resolved' | 'chronic' | 'history';
export type Relationship = 'mother' | 'father' | 'sibling' | 'grandmother' | 'grandfather' | 'aunt' | 'uncle' | 'cousin' | 'other';
export type HistoryType = 'smoking' | 'alcohol' | 'drug_use' | 'occupation' | 'exercise' | 'diet' | 'travel' | 'sexual_history' | 'other';

export class CreateMedicalHistoryDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty({ enum: ['diagnosis', 'surgery', 'procedure', 'injury', 'hospitalization', 'other'] })
  @IsEnum(['diagnosis', 'surgery', 'procedure', 'injury', 'hospitalization', 'other'])
  conditionType: ConditionType;

  @ApiProperty()
  @IsString()
  conditionName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  snomedConceptId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  snomedTerm?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  diagnosisDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  resolvedDate?: string;

  @ApiProperty({ enum: ['active', 'resolved', 'chronic', 'history'], required: false, default: 'active' })
  @IsOptional()
  @IsEnum(['active', 'resolved', 'chronic', 'history'])
  status?: HistoryStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  treatingPhysician?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  facilityName?: string;
}

export class CreateFamilyHistoryDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty({ enum: ['mother', 'father', 'sibling', 'grandmother', 'grandfather', 'aunt', 'uncle', 'cousin', 'other'] })
  @IsEnum(['mother', 'father', 'sibling', 'grandmother', 'grandfather', 'aunt', 'uncle', 'cousin', 'other'])
  relationship: Relationship;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  relativeName?: string;

  @ApiProperty()
  @IsString()
  conditionName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  snomedConceptId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  snomedTerm?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(150)
  ageAtOnset?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(150)
  ageAtDeath?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  causeOfDeath?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSocialHistoryDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty({ enum: ['smoking', 'alcohol', 'drug_use', 'occupation', 'exercise', 'diet', 'travel', 'sexual_history', 'other'] })
  @IsEnum(['smoking', 'alcohol', 'drug_use', 'occupation', 'exercise', 'diet', 'travel', 'sexual_history', 'other'])
  historyType: HistoryType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  quantity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMedicalHistoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(['diagnosis', 'surgery', 'procedure', 'injury', 'hospitalization', 'other'])
  conditionType?: ConditionType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  conditionName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  snomedConceptId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  snomedTerm?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  diagnosisDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  resolvedDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(['active', 'resolved', 'chronic', 'history'])
  status?: HistoryStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

