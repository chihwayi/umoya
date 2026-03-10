import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDemoAccessRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  clinicName: string;

  @IsEmail()
  @MaxLength(160)
  workEmail: string;

  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  roleTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  currentSystem?: string;

  @IsString()
  @MinLength(20)
  @MaxLength(1500)
  interestSummary: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  interestAreas: string[];

  @IsOptional()
  @IsString()
  @IsIn(['email', 'phone', 'whatsapp'])
  preferredContactMethod?: 'email' | 'phone' | 'whatsapp';
}
