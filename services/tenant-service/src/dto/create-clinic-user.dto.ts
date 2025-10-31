import { IsString, IsEmail, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';

export enum ClinicUserRole {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  RECEPTIONIST = 'receptionist',
  PHARMACIST = 'pharmacist',
  LAB_TECH = 'lab_tech'
}

export class CreateClinicUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  phone?: string;

  @IsEnum(ClinicUserRole)
  role: ClinicUserRole;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsString()
  @MinLength(8)
  temporaryPassword: string;
}