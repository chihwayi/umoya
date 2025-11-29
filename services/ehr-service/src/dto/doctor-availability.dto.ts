import { IsNotEmpty, IsString, IsOptional, IsDateString, IsUUID, IsBoolean, IsTimeZone } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDoctorAvailabilityDto {
  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsOptional()
  @Type(() => Boolean)
  isAllDay?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  isUnavailable?: boolean;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateDoctorAvailabilityDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsOptional()
  @Type(() => Boolean)
  isAllDay?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  isUnavailable?: boolean;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class DoctorAvailabilityQueryDto {
  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @IsDateString()
  @IsOptional()
  date?: string; // Query for availability on a specific date

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsOptional()
  @Type(() => Boolean)
  isUnavailable?: boolean;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

