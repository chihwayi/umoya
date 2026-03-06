import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, IsObject, IsNumber } from 'class-validator';

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

export class ReviewPostVisitBillingSuggestionDto {
  @ApiProperty({ description: 'Billing review action', enum: ['approve', 'reject'] })
  @IsEnum(['approve', 'reject'])
  @IsNotEmpty()
  action: 'approve' | 'reject';

  @ApiPropertyOptional({ description: 'Optional doctor note for approval/rejection audit trail' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  note?: string;
}

export class GeneratePostVisitAdminDocumentsDto {
  @ApiPropertyOptional({
    description: 'Subset of admin document templates to generate and sign',
    enum: ['referral_letter', 'sick_note', 'return_to_work'],
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(['referral_letter', 'sick_note', 'return_to_work'], { each: true })
  @IsOptional()
  documentTypes?: Array<'referral_letter' | 'sick_note' | 'return_to_work'>;

  @ApiPropertyOptional({ description: 'Optional note attached to generated admin documents' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ description: 'Whether to sign documents immediately', default: true })
  @IsBoolean()
  @IsOptional()
  signImmediately?: boolean;
}

export class ExecutePostVisitVoiceCommandDto {
  @ApiProperty({
    description: 'Normalized doctor voice command intent',
    enum: ['APPROVE_SUMMARY', 'APPROVE_BUNDLE', 'GENERATE_ADMIN_DOCS', 'REGENERATE_DRAFT', 'SIGN_AND_PUBLISH'],
  })
  @IsEnum(['APPROVE_SUMMARY', 'APPROVE_BUNDLE', 'GENERATE_ADMIN_DOCS', 'REGENERATE_DRAFT', 'SIGN_AND_PUBLISH'])
  @IsNotEmpty()
  command: 'APPROVE_SUMMARY' | 'APPROVE_BUNDLE' | 'GENERATE_ADMIN_DOCS' | 'REGENERATE_DRAFT' | 'SIGN_AND_PUBLISH';

  @ApiPropertyOptional({ description: 'Optional operator note captured with the command execution' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ description: 'Mandatory confirmation when command=SIGN_AND_PUBLISH', default: false })
  @IsBoolean()
  @IsOptional()
  confirmSignAndPublish?: boolean;

  @ApiPropertyOptional({ description: 'Optional publish metadata passed through for SIGN_AND_PUBLISH' })
  @IsObject()
  @IsOptional()
  publishMetadata?: Record<string, any>;
}

export class ReviewPostVisitTrialMatchDto {
  @ApiProperty({ description: 'Doctor trial workflow decision', enum: ['consider', 'defer', 'exclude', 'enroll'] })
  @IsEnum(['consider', 'defer', 'exclude', 'enroll'])
  @IsNotEmpty()
  action: 'consider' | 'defer' | 'exclude' | 'enroll';

  @ApiPropertyOptional({ description: 'Optional clinician rationale for trial decision' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  note?: string;
}

export class CuratePostVisitCompanionMemoryDto {
  @ApiProperty({ description: 'Companion memory curation action', enum: ['promote', 'retire', 'reactivate'] })
  @IsEnum(['promote', 'retire', 'reactivate'])
  @IsNotEmpty()
  action: 'promote' | 'retire' | 'reactivate';

  @ApiPropertyOptional({ description: 'Optional curation note/rationale' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  note?: string;
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

  @ApiPropertyOptional({ description: 'Superseded citation IDs explicitly acknowledged by doctor before publish', type: [String] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  @IsOptional()
  acknowledgedSupersededCitationIds?: string[];
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

export class ClassifyPostVisitEscalationDto {
  @ApiProperty({ description: 'Patient companion message text for escalation classification' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;

  @ApiPropertyOptional({ description: 'Optional post-visit session ID for context-aware classification' })
  @IsUUID()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Message language hint', default: 'en' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  language?: string;
}

export class ReassignPostVisitDiarizationSegmentDto {
  @ApiProperty({ description: 'Speaker role assignment', enum: ['doctor', 'patient', 'unknown'] })
  @IsEnum(['doctor', 'patient', 'unknown'])
  @IsNotEmpty()
  speakerRole: 'doctor' | 'patient' | 'unknown';

  @ApiPropertyOptional({ description: 'Optional speaker label (e.g. Speaker A)' })
  @IsString()
  @IsOptional()
  @MaxLength(60)
  speakerLabel?: string;

  @ApiPropertyOptional({ description: 'Optional reassignment note for audit trail' })
  @IsString()
  @IsOptional()
  @MaxLength(300)
  note?: string;
}

export class IngestPostVisitDocumentIntelligenceDto {
  @ApiPropertyOptional({
    description: 'Document classification type',
    enum: ['lab_report', 'prescription', 'imaging_report', 'discharge_summary', 'other'],
    default: 'other',
  })
  @IsEnum(['lab_report', 'prescription', 'imaging_report', 'discharge_summary', 'other'])
  @IsOptional()
  documentType?: 'lab_report' | 'prescription' | 'imaging_report' | 'discharge_summary' | 'other';

  @ApiPropertyOptional({ description: 'Language hint for OCR pipeline', default: 'en' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({ description: 'Optional clinician note for ingestion audit' })
  @IsString()
  @IsOptional()
  @MaxLength(400)
  note?: string;
}

export class AnalyzePostVisitIntraVisitAlertDto {
  @ApiProperty({ description: 'Live transcript chunk to analyze for safety alerts' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text: string;

  @ApiPropertyOptional({ description: 'Source channel label', default: 'streamed_transcript' })
  @IsString()
  @IsOptional()
  @MaxLength(40)
  source?: string;

  @ApiPropertyOptional({ description: 'Optional transcript offset in seconds' })
  @IsNumber()
  @IsOptional()
  transcriptOffsetSeconds?: number;
}

export class ResolvePostVisitIntraVisitAlertDto {
  @ApiProperty({ description: 'Doctor resolution action', enum: ['confirmed', 'dismissed'] })
  @IsEnum(['confirmed', 'dismissed'])
  @IsNotEmpty()
  status: 'confirmed' | 'dismissed';

  @ApiPropertyOptional({ description: 'Optional resolution note' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}

export class AcknowledgePostVisitIntraVisitAlertDto {
  @ApiPropertyOptional({ description: 'Optional acknowledgement note' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}
