import { IsString, IsEmail, IsEnum, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { SubscriptionTier } from '../entities/tenant.entity';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  clinicName: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, { message: 'Subdomain must contain only lowercase letters, numbers, and hyphens' })
  subdomain: string;

  @IsEmail()
  contactEmail: string;

  @IsString()
  @MinLength(10)
  contactPhone: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsEnum(SubscriptionTier)
  subscriptionTier: SubscriptionTier;
}