import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, IsObject } from 'class-validator';

export class CreatePostVisitSessionDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional({ description: 'Doctor ID. Defaults to authenticated clinician when omitted.' })
  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @ApiPropertyOptional({ description: 'Appointment ID' })
  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @ApiPropertyOptional({ description: 'Telemedicine consultation ID' })
  @IsUUID()
  @IsOptional()
  consultationId?: string;

  @ApiPropertyOptional({
    description: 'Source of consultation context',
    enum: ['in_person', 'telemedicine', 'hybrid'],
    default: 'in_person',
  })
  @IsEnum(['in_person', 'telemedicine', 'hybrid'])
  @IsOptional()
  sourceType?: 'in_person' | 'telemedicine' | 'hybrid';

  @ApiPropertyOptional({ description: 'Session language', default: 'en' })
  @IsString()
  @MaxLength(10)
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ description: 'Session start timestamp' })
  @IsDateString()
  @IsOptional()
  startedAt?: string;
}

export class PostVisitSessionReviewMetadataDto {
  @ApiPropertyOptional({ description: 'Review safety level (optional)', enum: ['low', 'moderate', 'high', 'critical'] })
  @IsEnum(['low', 'moderate', 'high', 'critical'])
  @IsOptional()
  safetyLevel?: 'low' | 'moderate' | 'high' | 'critical';

  @ApiPropertyOptional({ description: 'Additional risk flags object as serialized JSON' })
  @IsString()
  @IsOptional()
  riskFlagsJson?: string;
}

export class RegeneratePostVisitDraftDto {
  @ApiPropertyOptional({ description: 'Optional reason for regeneration (auditable)' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class ReviewPostVisitArtifactDto {
  @ApiProperty({ description: 'Artifact type to review', enum: ['soap_note', 'visit_summary', 'recommendation_bundle'] })
  @IsEnum(['soap_note', 'visit_summary', 'recommendation_bundle'])
  @IsNotEmpty()
  artifactType: 'soap_note' | 'visit_summary' | 'recommendation_bundle';

  @ApiProperty({ description: 'Review action', enum: ['accept', 'edit', 'reject'] })
  @IsEnum(['accept', 'edit', 'reject'])
  @IsNotEmpty()
  action: 'accept' | 'edit' | 'reject';

  @ApiPropertyOptional({ description: 'Optional edited content when action=edit' })
  @IsObject()
  @IsOptional()
  editedContent?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Optional review reason/comment' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Optional review metadata (safety/risk)' })
  @IsObject()
  @IsOptional()
  reviewMetadata?: Record<string, any>;
}

export class ExecutePostVisitRecommendationDto {
  @ApiPropertyOptional({ description: 'Optional doctor note for execution audit trail' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Optional explicit payload override for execution' })
  @IsObject()
  @IsOptional()
  actionPayload?: Record<string, any>;
}

export class PublishPostVisitSessionDto {
  @ApiPropertyOptional({ description: 'Optional publish note for audit trail' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Optional release metadata for patient companion channels' })
  @IsObject()
  @IsOptional()
  publishMetadata?: Record<string, any>;
}

export class CreatePostVisitCompanionMessageDto {
  @ApiProperty({ description: 'Patient message text' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;

  @ApiPropertyOptional({ description: 'Message language (optional)' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({
    description: 'Message type',
    enum: ['question', 'answer', 'summary', 'checklist', 'alert', 'system'],
    default: 'question',
  })
  @IsEnum(['question', 'answer', 'summary', 'checklist', 'alert', 'system'])
  @IsOptional()
  messageType?: 'question' | 'answer' | 'summary' | 'checklist' | 'alert' | 'system';
}

export class PostVisitCompanionAcknowledgementDto {
  @ApiProperty({
    description: 'Acknowledgement type',
    enum: ['teach_back', 'medication_adherence', 'follow_up_commitment', 'warning_sign_understanding'],
  })
  @IsEnum(['teach_back', 'medication_adherence', 'follow_up_commitment', 'warning_sign_understanding'])
  @IsNotEmpty()
  acknowledgementType:
    | 'teach_back'
    | 'medication_adherence'
    | 'follow_up_commitment'
    | 'warning_sign_understanding';

  @ApiPropertyOptional({ description: 'Acknowledgement status', default: true })
  @IsBoolean()
  @IsOptional()
  acknowledged?: boolean;

  @ApiPropertyOptional({ description: 'Optional acknowledgement details/payload' })
  @IsObject()
  @IsOptional()
  details?: Record<string, any>;
}

export class ResolvePostVisitEscalationDto {
  @ApiPropertyOptional({ description: 'Resolution status override', enum: ['resolved', 'dismissed'], default: 'resolved' })
  @IsEnum(['resolved', 'dismissed'])
  @IsOptional()
  status?: 'resolved' | 'dismissed';

  @ApiPropertyOptional({ description: 'Optional resolution note' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  resolutionNote?: string;
}
