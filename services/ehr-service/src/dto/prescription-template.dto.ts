import { IsString, IsOptional, IsBoolean, IsEnum, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrescriptionTemplateCategory, PrescriptionTemplateRoute } from '../entities/prescription-template.entity';

export class CreatePrescriptionTemplateDto {
  @ApiProperty({ description: 'Template name', example: 'Paracetamol 500mg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Template category',
    enum: Object.values(PrescriptionTemplateCategory),
  })
  @IsEnum(PrescriptionTemplateCategory)
  category: PrescriptionTemplateCategory;

  @ApiProperty({ description: 'Medication name', example: 'Paracetamol' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  medicationName: string;

  @ApiPropertyOptional({ description: 'Generic name', example: 'Acetaminophen' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  genericName?: string;

  @ApiProperty({ description: 'Dosage', example: '500' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  dosage: string;

  @ApiPropertyOptional({ description: 'Dosage unit', example: 'mg' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  dosageUnit?: string;

  @ApiProperty({ description: 'Frequency', example: 'Every 6-8 hours as needed' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  frequency: string;

  @ApiPropertyOptional({
    description: 'Route of administration',
    enum: Object.values(PrescriptionTemplateRoute),
  })
  @IsEnum(PrescriptionTemplateRoute)
  @IsOptional()
  route?: PrescriptionTemplateRoute;

  @ApiPropertyOptional({ description: 'Duration', example: '3-5 days' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  duration?: string;

  @ApiPropertyOptional({ description: 'Instructions for patient' })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Indications for use' })
  @IsString()
  @IsOptional()
  indications?: string;

  @ApiPropertyOptional({ description: 'Contraindications' })
  @IsString()
  @IsOptional()
  contraindications?: string;

  @ApiPropertyOptional({ description: 'Side effects' })
  @IsString()
  @IsOptional()
  sideEffects?: string;

  @ApiPropertyOptional({ description: 'Specialty', example: 'General Practice' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  specialty?: string;

  @ApiPropertyOptional({ description: 'Mark as default template', default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdatePrescriptionTemplateDto {
  @ApiPropertyOptional({ description: 'Template name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Template category',
    enum: Object.values(PrescriptionTemplateCategory),
  })
  @IsEnum(PrescriptionTemplateCategory)
  @IsOptional()
  category?: PrescriptionTemplateCategory;

  @ApiPropertyOptional({ description: 'Medication name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  medicationName?: string;

  @ApiPropertyOptional({ description: 'Generic name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  genericName?: string;

  @ApiPropertyOptional({ description: 'Dosage' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  dosage?: string;

  @ApiPropertyOptional({ description: 'Dosage unit' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  dosageUnit?: string;

  @ApiPropertyOptional({ description: 'Frequency' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  frequency?: string;

  @ApiPropertyOptional({
    description: 'Route of administration',
    enum: Object.values(PrescriptionTemplateRoute),
  })
  @IsEnum(PrescriptionTemplateRoute)
  @IsOptional()
  route?: PrescriptionTemplateRoute;

  @ApiPropertyOptional({ description: 'Duration' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  duration?: string;

  @ApiPropertyOptional({ description: 'Instructions for patient' })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Indications for use' })
  @IsString()
  @IsOptional()
  indications?: string;

  @ApiPropertyOptional({ description: 'Contraindications' })
  @IsString()
  @IsOptional()
  contraindications?: string;

  @ApiPropertyOptional({ description: 'Side effects' })
  @IsString()
  @IsOptional()
  sideEffects?: string;

  @ApiPropertyOptional({ description: 'Specialty' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  specialty?: string;

  @ApiPropertyOptional({ description: 'Mark as default template' })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}










