import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsArray,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsIn,
  Length,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { SubscriptionTier } from '../entities/tenant.entity';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  clinicName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsEnum(SubscriptionTier)
  subscriptionTier?: SubscriptionTier;

  @IsOptional()
  @IsIn(['demo', 'paid'])
  subscriptionMode?: 'demo' | 'paid';

  @IsOptional()
  @IsIn(['full_ehr', 'claims_only'])
  packagePreset?: 'full_ehr' | 'claims_only';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  packageName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledModules?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  demoDurationDays?: number;

  @IsOptional()
  @IsDateString()
  demoExpiresAt?: string;

  @IsOptional()
  @IsDateString()
  billingEndsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  gracePeriodDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  suspensionWarningDays?: number;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @IsOptional()
  @IsIn(['clinic', 'hospital', 'ministry'])
  deploymentMode?: 'clinic' | 'hospital' | 'ministry';

  @IsOptional()
  @IsBoolean()
  mfaRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  sessionTimeoutMinutes?: number;

  @IsOptional()
  @IsBoolean()
  allowEmergencyBypass?: boolean;

  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, boolean>;
}
