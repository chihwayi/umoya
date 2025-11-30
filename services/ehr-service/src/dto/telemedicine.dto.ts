import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
  Max,
  IsDateString,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

// Consultation DTOs
export class CreateTelemedicineConsultationDto {
  @ApiProperty({ description: 'Appointment ID (optional)' })
  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Doctor ID' })
  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  @ApiPropertyOptional({ description: 'Consultation type', enum: ['video', 'audio', 'chat', 'hybrid'], default: 'video' })
  @IsEnum(['video', 'audio', 'chat', 'hybrid'])
  @IsOptional()
  consultationType?: 'video' | 'audio' | 'chat' | 'hybrid';

  @ApiProperty({ description: 'Scheduled start time' })
  @IsDateString()
  @IsNotEmpty()
  scheduledStartTime: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateTelemedicineConsultationDto {
  @ApiPropertyOptional({ description: 'Status', enum: ['scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show', 'technical_issue'] })
  @IsEnum(['scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show', 'technical_issue'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Actual start time' })
  @IsDateString()
  @IsOptional()
  actualStartTime?: string;

  @ApiPropertyOptional({ description: 'Actual end time' })
  @IsDateString()
  @IsOptional()
  actualEndTime?: string;

  @ApiPropertyOptional({ description: 'Connection quality', enum: ['excellent', 'good', 'fair', 'poor'] })
  @IsEnum(['excellent', 'good', 'fair', 'poor'])
  @IsOptional()
  connectionQuality?: string;

  @ApiPropertyOptional({ description: 'Doctor connection quality', enum: ['excellent', 'good', 'fair', 'poor'] })
  @IsEnum(['excellent', 'good', 'fair', 'poor'])
  @IsOptional()
  doctorConnectionQuality?: string;

  @ApiPropertyOptional({ description: 'Patient joined' })
  @IsBoolean()
  @IsOptional()
  patientJoined?: boolean;

  @ApiPropertyOptional({ description: 'Doctor joined' })
  @IsBoolean()
  @IsOptional()
  doctorJoined?: boolean;

  @ApiPropertyOptional({ description: 'Technical issues' })
  @IsString()
  @IsOptional()
  technicalIssues?: string;

  @ApiPropertyOptional({ description: 'Recording enabled' })
  @IsBoolean()
  @IsOptional()
  recordingEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Recording URL' })
  @IsString()
  @IsOptional()
  recordingUrl?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Satisfaction rating (1-5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  satisfactionRating?: number;

  @ApiPropertyOptional({ description: 'Satisfaction feedback' })
  @IsString()
  @IsOptional()
  satisfactionFeedback?: string;
}

export class JoinConsultationDto {
  @ApiProperty({ description: 'User ID joining' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Role (patient or doctor)' })
  @IsEnum(['patient', 'doctor'])
  @IsNotEmpty()
  role: 'patient' | 'doctor';
}

export class RecordSatisfactionDto {
  @ApiProperty({ description: 'Satisfaction rating (1-5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  rating: number;

  @ApiPropertyOptional({ description: 'Feedback' })
  @IsString()
  @IsOptional()
  feedback?: string;
}

// Device DTOs
export class CreateTelemedicineDeviceDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Device type', enum: ['smartphone', 'tablet', 'laptop', 'desktop'] })
  @IsEnum(['smartphone', 'tablet', 'laptop', 'desktop'])
  @IsNotEmpty()
  deviceType: string;

  @ApiPropertyOptional({ description: 'Device name' })
  @IsString()
  @IsOptional()
  deviceName?: string;

  @ApiPropertyOptional({ description: 'Operating system' })
  @IsString()
  @IsOptional()
  operatingSystem?: string;

  @ApiPropertyOptional({ description: 'Browser' })
  @IsString()
  @IsOptional()
  browser?: string;

  @ApiPropertyOptional({ description: 'Browser version' })
  @IsString()
  @IsOptional()
  browserVersion?: string;

  @ApiPropertyOptional({ description: 'Internet connection type', enum: ['wifi', 'mobile_data', 'ethernet', 'unknown'] })
  @IsEnum(['wifi', 'mobile_data', 'ethernet', 'unknown'])
  @IsOptional()
  internetConnectionType?: string;

  @ApiPropertyOptional({ description: 'Average bandwidth (Mbps)' })
  @IsInt()
  @IsOptional()
  averageBandwidth?: number;

  @ApiPropertyOptional({ description: 'Is primary device' })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class UpdateTelemedicineDeviceDto {
  @ApiPropertyOptional({ description: 'Device name' })
  @IsString()
  @IsOptional()
  deviceName?: string;

  @ApiPropertyOptional({ description: 'Average bandwidth (Mbps)' })
  @IsInt()
  @IsOptional()
  averageBandwidth?: number;

  @ApiPropertyOptional({ description: 'Is primary device' })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

// Consent DTOs
export class CreateTelemedicineConsentDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Consent type', enum: ['general_telehealth', 'video_recording', 'data_sharing', 'research'] })
  @IsEnum(['general_telehealth', 'video_recording', 'data_sharing', 'research'])
  @IsNotEmpty()
  consentType: string;

  @ApiPropertyOptional({ description: 'Consent status', enum: ['granted', 'denied', 'expired', 'revoked'], default: 'granted' })
  @IsEnum(['granted', 'denied', 'expired', 'revoked'])
  @IsOptional()
  consentStatus?: string;

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Consent document URL' })
  @IsString()
  @IsOptional()
  consentDocumentUrl?: string;

  @ApiPropertyOptional({ description: 'IP address' })
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'User agent' })
  @IsString()
  @IsOptional()
  userAgent?: string;

  @ApiPropertyOptional({ description: 'Witnessed by (user ID)' })
  @IsUUID()
  @IsOptional()
  witnessedById?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateTelemedicineConsentDto {
  @ApiPropertyOptional({ description: 'Consent status', enum: ['granted', 'denied', 'expired', 'revoked'] })
  @IsEnum(['granted', 'denied', 'expired', 'revoked'])
  @IsOptional()
  consentStatus?: string;

  @ApiPropertyOptional({ description: 'Revoked date' })
  @IsDateString()
  @IsOptional()
  revokedDate?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

// Technical Log DTOs
export class CreateTechnicalLogDto {
  @ApiProperty({ description: 'Consultation ID' })
  @IsUUID()
  @IsNotEmpty()
  consultationId: string;

  @ApiProperty({ description: 'Log type', enum: ['connection_issue', 'audio_issue', 'video_issue', 'bandwidth_issue', 'other'] })
  @IsEnum(['connection_issue', 'audio_issue', 'video_issue', 'bandwidth_issue', 'other'])
  @IsNotEmpty()
  logType: string;

  @ApiPropertyOptional({ description: 'Severity', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' })
  @IsEnum(['low', 'medium', 'high', 'critical'])
  @IsOptional()
  severity?: string;

  @ApiProperty({ description: 'Description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Resolution' })
  @IsString()
  @IsOptional()
  resolution?: string;
}

export class UpdateTechnicalLogDto {
  @ApiPropertyOptional({ description: 'Resolution' })
  @IsString()
  @IsOptional()
  resolution?: string;

  @ApiPropertyOptional({ description: 'Resolved' })
  @IsBoolean()
  @IsOptional()
  resolved?: boolean;
}

// Remote Monitoring DTOs
export class CreateRemoteMonitoringDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Monitoring type', enum: ['blood_pressure', 'blood_glucose', 'weight', 'temperature', 'heart_rate', 'oxygen_saturation', 'other'] })
  @IsEnum(['blood_pressure', 'blood_glucose', 'weight', 'temperature', 'heart_rate', 'oxygen_saturation', 'other'])
  @IsNotEmpty()
  monitoringType: string;

  @ApiPropertyOptional({ description: 'Device name' })
  @IsString()
  @IsOptional()
  deviceName?: string;

  @ApiPropertyOptional({ description: 'Device model' })
  @IsString()
  @IsOptional()
  deviceModel?: string;

  @ApiProperty({ description: 'Reading value' })
  @IsNumber()
  @IsNotEmpty()
  readingValue: number;

  @ApiProperty({ description: 'Reading unit (e.g., mmHg, mg/dL, kg)' })
  @IsString()
  @IsNotEmpty()
  readingUnit: string;

  @ApiPropertyOptional({ description: 'Reading date' })
  @IsDateString()
  @IsOptional()
  readingDate?: string;

  @ApiPropertyOptional({ description: 'Device synced' })
  @IsBoolean()
  @IsOptional()
  deviceSynced?: boolean;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateRemoteMonitoringDto {
  @ApiPropertyOptional({ description: 'Reading value' })
  @IsNumber()
  @IsOptional()
  readingValue?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Alert triggered' })
  @IsBoolean()
  @IsOptional()
  alertTriggered?: boolean;

  @ApiPropertyOptional({ description: 'Alert severity', enum: ['low', 'medium', 'high', 'critical'] })
  @IsEnum(['low', 'medium', 'high', 'critical'])
  @IsOptional()
  alertSeverity?: string;
}

// Digital Prescription DTOs
export class CreateDigitalPrescriptionDto {
  @ApiProperty({ description: 'Consultation ID' })
  @IsUUID()
  @IsNotEmpty()
  consultationId: string;

  @ApiPropertyOptional({ description: 'Prescription ID' })
  @IsUUID()
  @IsOptional()
  prescriptionId?: string;

  @ApiPropertyOptional({ description: 'Patient e-signature (base64)' })
  @IsString()
  @IsOptional()
  eSignaturePatient?: string;

  @ApiPropertyOptional({ description: 'Doctor e-signature (base64)' })
  @IsString()
  @IsOptional()
  eSignatureDoctor?: string;

  @ApiPropertyOptional({ description: 'Signature method', enum: ['digital_pen', 'touch', 'click_to_sign'] })
  @IsEnum(['digital_pen', 'touch', 'click_to_sign'])
  @IsOptional()
  signatureMethod?: string;
}

export class SignPrescriptionDto {
  @ApiProperty({ description: 'Signature (base64 encoded)' })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({ description: 'Role (patient or doctor)' })
  @IsEnum(['patient', 'doctor'])
  @IsNotEmpty()
  role: 'patient' | 'doctor';

  @ApiPropertyOptional({ description: 'Signature method', enum: ['digital_pen', 'touch', 'click_to_sign'] })
  @IsEnum(['digital_pen', 'touch', 'click_to_sign'])
  @IsOptional()
  signatureMethod?: string;
}

// Query DTOs
export class TelemedicineConsultationQueryDto {
  @ApiPropertyOptional({ description: 'Patient ID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Doctor ID' })
  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @ApiPropertyOptional({ description: 'Appointment ID' })
  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @ApiPropertyOptional({ description: 'Status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Date from' })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Date to' })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

export class RemoteMonitoringQueryDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional({ description: 'Monitoring type' })
  @IsString()
  @IsOptional()
  monitoringType?: string;

  @ApiPropertyOptional({ description: 'Date from' })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Date to' })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

