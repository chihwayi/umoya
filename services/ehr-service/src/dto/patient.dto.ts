import { IsString, IsEmail, IsOptional, IsDateString, IsEnum, MinLength, IsBoolean, IsInt, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

export enum BloodType {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-'
}

export class CreatePatientDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(2)
  lastName: string;

  @ApiProperty({ example: '1990-01-15' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ example: '63-123456-A-12' })
  @IsString()
  nationalId: string;

  @ApiProperty({ example: '+263771234567' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'john.doe@email.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '123 Main Street, Harare' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'Harare' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  emergencyContactName: string;

  @ApiProperty({ example: '+263771234568' })
  @IsString()
  emergencyContactPhone: string;

  @ApiProperty({ example: 'Spouse' })
  @IsString()
  emergencyContactRelationship: string;

  @ApiProperty({ example: 'CIMAS', required: false })
  @IsOptional()
  @IsString()
  medicalAidProvider?: string;

  @ApiProperty({ example: 'CIMAS123456', required: false })
  @IsOptional()
  @IsString()
  medicalAidNumber?: string;

  @ApiProperty({ enum: BloodType, required: false })
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @ApiProperty({ example: 'Penicillin, Shellfish', required: false })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiProperty({ example: 'Diabetes, Hypertension', required: false })
  @IsOptional()
  @IsString()
  medicalHistory?: string;

  // ── Extended demographics (Sprint 60) ─────────────────────────────────────
  @IsOptional() @IsString() ethnicity?: string;
  @IsOptional() @IsString() race?: string;
  @ApiProperty({ example: 'en', required: false })
  @IsOptional() @IsString() preferredLanguage?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() countryOfBirth?: string;
  @IsOptional() @IsString() religion?: string;
  @IsOptional() @IsBoolean() interpreterRequired?: boolean;
  @IsOptional() @IsString() maritalStatus?: string;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() employmentStatus?: string;
  @IsOptional() @IsString() educationLevel?: string;
  @IsOptional() @IsBoolean() disabilityStatus?: boolean;
  @IsOptional() @IsString() disabilityType?: string;
  /** never | former | current */
  @IsOptional() @IsString() smokingStatus?: string;
  @IsOptional() @IsNumber() packYears?: number;
  /** none | occasional | moderate | heavy */
  @IsOptional() @IsString() alcoholUse?: string;
  @IsOptional() @IsInt() @Min(0) @Max(12) auditCScore?: number;
  @IsOptional() @IsBoolean() substanceUse?: boolean;
  @IsOptional() @IsString() substanceUseDetails?: string;
  /** not_pregnant | pregnant | postpartum | unknown */
  @IsOptional() @IsString() pregnancyStatus?: string;
  @IsOptional() @IsInt() gestationalAgeWeeks?: number;
  @IsOptional() @IsBoolean() advanceDirectiveOnFile?: boolean;
}

export class UpdatePatientDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContactRelationship?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  medicalAidProvider?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  medicalAidNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  medicalHistory?: string;

  // ── Extended demographics (Sprint 60) ─────────────────────────────────────
  @IsOptional() @IsString() ethnicity?: string;
  @IsOptional() @IsString() race?: string;
  @IsOptional() @IsString() preferredLanguage?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() countryOfBirth?: string;
  @IsOptional() @IsString() religion?: string;
  @IsOptional() @IsBoolean() interpreterRequired?: boolean;
  @IsOptional() @IsString() maritalStatus?: string;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() employmentStatus?: string;
  @IsOptional() @IsString() educationLevel?: string;
  @IsOptional() @IsBoolean() disabilityStatus?: boolean;
  @IsOptional() @IsString() disabilityType?: string;
  @IsOptional() @IsString() smokingStatus?: string;
  @IsOptional() @IsNumber() packYears?: number;
  @IsOptional() @IsString() alcoholUse?: string;
  @IsOptional() @IsInt() @Min(0) @Max(12) auditCScore?: number;
  @IsOptional() @IsBoolean() substanceUse?: boolean;
  @IsOptional() @IsString() substanceUseDetails?: string;
  @IsOptional() @IsString() pregnancyStatus?: string;
  @IsOptional() @IsInt() gestationalAgeWeeks?: number;
  @IsOptional() @IsBoolean() advanceDirectiveOnFile?: boolean;
}

export class PatientQueryDto {
  @ApiProperty({ required: false, description: 'Free text search across patient name, MRN, ID' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: 'Patient number / MRN filter' })
  @IsOptional()
  @IsString()
  patientNumber?: string;

  @ApiProperty({ required: false, description: 'National ID filter' })
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiProperty({ required: false, description: 'Gender filter' })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ required: false, description: 'Page number for pagination', default: 1 })
  @IsOptional()
  page?: number;

  @ApiProperty({ required: false, description: 'Page size for pagination', default: 25 })
  @IsOptional()
  limit?: number;
}