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

  @IsString()
  @IsOptional()
  priorityLevel?: string;

  @IsOptional()
  isTelehealth?: boolean;

  @IsString()
  @IsOptional()
  virtualMeetingUrl?: string;

  @IsString()
  @IsOptional()
  recurringPattern?: string;

  @IsString()
  @IsOptional()
  patientInstructions?: string;

  @IsString()
  @IsOptional()
  preparationNotes?: string;

  @IsOptional()
  estimatedCost?: number;
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

  @IsString()
  @IsOptional()
  priorityLevel?: string;

  @IsOptional()
  isTelehealth?: boolean;

  @IsString()
  @IsOptional()
  virtualMeetingUrl?: string;

  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @IsOptional()
  insuranceVerified?: boolean;
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