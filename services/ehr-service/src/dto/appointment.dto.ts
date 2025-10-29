import { IsNotEmpty, IsString, IsOptional, IsDateString, IsUUID } from 'class-validator';

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
}

export class AppointmentQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

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