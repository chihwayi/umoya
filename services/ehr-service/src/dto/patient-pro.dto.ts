import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsArray, ValidateNested, IsNumber, IsEnum, IsDateString, IsNotEmpty, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignQuestionnaireDto {
  @ApiProperty({ description: 'Questionnaire template ID or code' })
  @IsString()
  templateId: string;

  @ApiPropertyOptional({ description: 'Appointment ID if assigned before appointment' })
  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @ApiPropertyOptional({ description: 'Due date for completion' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Notes from doctor/nurse' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class QuestionnaireResponseDto {
  @ApiProperty({ description: 'Question number' })
  @IsNumber()
  questionNumber: number;

  @ApiProperty({ description: 'Question text' })
  @IsString()
  questionText: string;

  @ApiProperty({ description: 'Response value (can be number, text, or choice value)' })
  @IsNotEmpty({ message: 'Response value is required' })
  responseValue: string | number;

  @ApiProperty({ description: 'Response type', enum: ['number', 'text', 'choice', 'scale', 'boolean'] })
  @IsEnum(['number', 'text', 'choice', 'scale', 'boolean'])
  responseType: string;
}

export class SubmitQuestionnaireDto {
  @ApiProperty({ description: 'Array of question responses', type: [QuestionnaireResponseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionnaireResponseDto)
  responses: QuestionnaireResponseDto[];
}

export class CreateQuestionnaireScheduleDto {
  @ApiProperty({ description: 'Questionnaire template ID or code' })
  @IsString()
  templateId: string;

  @ApiProperty({ description: 'Schedule type', enum: ['one_time', 'daily', 'weekly', 'monthly', 'event_triggered'] })
  @IsEnum(['one_time', 'daily', 'weekly', 'monthly', 'event_triggered'])
  scheduleType: string;

  @ApiProperty({ description: 'Start date' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'End date (null for indefinite)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Frequency (every N days/weeks/months)' })
  @IsNumber()
  @IsOptional()
  frequency?: number;

  @ApiPropertyOptional({ description: 'Day of week (0=Sunday, 6=Saturday)' })
  @IsNumber()
  @IsOptional()
  dayOfWeek?: number;

  @ApiPropertyOptional({ description: 'Day of month (1-31)' })
  @IsNumber()
  @IsOptional()
  dayOfMonth?: number;

  @ApiPropertyOptional({ description: 'Trigger event (e.g., appointment_scheduled, medication_started)' })
  @IsString()
  @IsOptional()
  triggerEvent?: string;
}

