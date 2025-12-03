import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsObject, IsEnum, IsDate, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ConsentType {
  TREATMENT = 'treatment',
  SURGERY = 'surgery',
  PROCEDURE = 'procedure',
  RESEARCH = 'research',
  HIPAA = 'hipaa',
  PHOTOGRAPHY = 'photography',
  RELEASE_OF_INFORMATION = 'release_of_information',
  FINANCIAL = 'financial',
  TELEHEALTH = 'telehealth',
  VACCINE = 'vaccine',
  ANESTHESIA = 'anesthesia',
  BLOOD_TRANSFUSION = 'blood_transfusion',
  GENERAL = 'general',
}

export enum ConsentStatus {
  PENDING = 'pending',
  SIGNED = 'signed',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  SUPERSEDED = 'superseded',
}

export enum SignerRole {
  PATIENT = 'patient',
  GUARDIAN = 'guardian',
  WITNESS = 'witness',
  PROVIDER = 'provider',
  LEGAL_REPRESENTATIVE = 'legal_representative',
}

export enum SignatureType {
  ELECTRONIC = 'electronic',
  DIGITAL = 'digital',
  BIOMETRIC = 'biometric',
  TYPED = 'typed',
}

export class CreateConsentTemplateDto {
  @ApiProperty()
  @IsString()
  templateName: string;

  @ApiProperty()
  @IsString()
  templateCode: string;

  @ApiProperty({ enum: ConsentType })
  @IsEnum(ConsentType)
  consentType: ConsentType;

  @ApiProperty()
  @IsString()
  version: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  languageCode?: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  requiredFields?: any[];

  @ApiProperty()
  @IsObject()
  signatureRequirements: {
    patient: boolean;
    guardian: boolean;
    witness: boolean;
    provider: boolean;
  };

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  validityPeriodDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  procedureCodes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  effectiveDate: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expirationDate?: Date;
}

export class UpdateConsentTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  requiredFields?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  signatureRequirements?: {
    patient: boolean;
    guardian: boolean;
    witness: boolean;
    provider: boolean;
  };

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  validityPeriodDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  procedureCodes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expirationDate?: Date;
}

export class CreatePatientConsentDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty()
  @IsUUID()
  templateId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  procedureId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  filledFields?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SignConsentDto {
  @ApiProperty({ enum: SignerRole })
  @IsEnum(SignerRole)
  signerRole: SignerRole;

  @ApiProperty()
  @IsString()
  signerName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signerRelationship?: string;

  @ApiProperty({ enum: SignatureType })
  @IsEnum(SignatureType)
  signatureType: SignatureType;

  @ApiProperty()
  @IsString()
  signatureData: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signatureMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  geolocation?: { lat: number; lon: number; accuracy: number };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  verificationCode?: string;
}

export class DeclineConsentDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class RevokeConsentDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class ConsentQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ enum: ConsentType })
  @IsOptional()
  @IsEnum(ConsentType)
  consentType?: ConsentType;

  @ApiPropertyOptional({ enum: ConsentStatus })
  @IsOptional()
  @IsEnum(ConsentStatus)
  status?: ConsentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  offset?: number;
}

