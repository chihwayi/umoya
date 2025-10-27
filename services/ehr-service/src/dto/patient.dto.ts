import { IsString, IsEmail, IsOptional, IsDateString, IsEnum, MinLength, IsPhoneNumber } from 'class-validator';
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
}