import { IsNotEmpty, IsString, IsOptional, IsDateString, IsUUID, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAppointmentDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  @IsDateString()
  @IsNotEmpty()
  appointmentDate: string;

  @IsOptional()
  durationMinutes?: number;

  @IsString()
  @IsOptional()
  appointmentType?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  feeAmount?: number;

  @IsOptional()
  @Type(() => Boolean)
  isTelehealth?: boolean;

  @IsString()
  @IsOptional()
  virtualMeetingUrl?: string;
}

export class UpdateAppointmentDto {
  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @IsDateString()
  @IsOptional()
  appointmentDate?: string;

  @IsOptional()
  durationMinutes?: number;

  @IsString()
  @IsOptional()
  appointmentType?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  feeAmount?: number;

  @IsString()
  @IsOptional()
  primaryDiagnosisCode?: string;

  @IsString()
  @IsOptional()
  primaryDiagnosisDescription?: string;

  @IsOptional()
  diagnosisCodes?: string[];

  @IsString()
  @IsOptional()
  diagnosisSnomedCode?: string;

  @IsString()
  @IsOptional()
  diagnosisSnomedTerm?: string;

  @IsOptional()
  whoSmartFormData?: Record<string, any>;
}

export class AppointmentQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  appointmentType?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}